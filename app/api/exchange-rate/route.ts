import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { refreshExchangeRate } from '@/lib/exchange-rate';

const STATIC_FALLBACK_RATE = 43.02;

async function tryFreezeRate(sessionId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .rpc('freeze_rate_for_session', {
      p_session_id: sessionId,
      p_duration_minutes: 10,
    })
    .single();

  if (!error && (data as any)?.rate) {
    return {
      rate: (data as any).rate,
      expiresAt: (data as any).expires_at,
      source: 'frozen' as const,
    };
  }
  return null;
}

async function getLatestStoredRate() {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('exchange_rates')
    .select('rate, expires_at')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (data?.rate) {
    return {
      rate: Number(data.rate),
      expiresAt: data.expires_at || new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    };
  }
  return null;
}

export async function GET(_request: NextRequest) {
  try {
    const cookieStore = await cookies();
    let sessionId = cookieStore.get('donation_session')?.value;
    const isNewSession = !sessionId;
    if (isNewSession) {
      sessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    }

    // 1) Intento normal: freeze sobre la tasa activa.
    let result = await tryFreezeRate(sessionId!);

    // 2) Si falla, suele ser porque la tasa expiró. Refrescamos desde Binance
    //    automáticamente y reintentamos. Esto evita depender de un cron job
    //    cuando la app pasa muchas horas sin tráfico.
    if (!result) {
      console.warn('[exchange-rate] No active rate, refreshing from Binance…');
      const refreshed = await refreshExchangeRate();
      if (refreshed) {
        result = await tryFreezeRate(sessionId!);
        if (!result) {
          // El freeze sigue fallando aunque acabamos de refrescar — devolvemos
          // la tasa recién guardada manualmente.
          result = {
            rate: refreshed.finalRate,
            expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
            source: 'refreshed-fallback' as const,
          };
        }
      }
    }

    // 3) Si aún no hay tasa, último intento: la última tasa guardada (aunque expirada).
    if (!result) {
      const latest = await getLatestStoredRate();
      if (latest) {
        result = {
          rate: latest.rate,
          expiresAt: latest.expiresAt,
          source: 'latest-rate-fallback' as const,
        };
      }
    }

    // 4) Fallback estático.
    if (!result) {
      result = {
        rate: STATIC_FALLBACK_RATE,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        source: 'static-fallback' as const,
      };
    }

    const response = NextResponse.json({
      rate: result.rate,
      expiresAt: result.expiresAt,
      sessionId,
      source: result.source,
    });

    if (isNewSession) {
      response.cookies.set('donation_session', sessionId!, {
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 60 * 10,
      });
    }

    return response;
  } catch (error: any) {
    console.error('Exchange rate API error:', error);
    return NextResponse.json({
      rate: STATIC_FALLBACK_RATE,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      source: 'static-fallback-on-error',
      warning: error?.message || 'Failed to get exchange rate',
    });
  }
}
