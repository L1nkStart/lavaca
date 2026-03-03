import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get or create session ID from cookies
    const cookieStore = await cookies();
    let sessionId = cookieStore.get('donation_session')?.value;

    if (!sessionId) {
      sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // Call freeze_rate_for_session function
    const { data, error } = await supabase
      .rpc('freeze_rate_for_session', {
        p_session_id: sessionId,
        p_duration_minutes: 10
      })
      .single();

    if (error) {
      console.error('Error freezing rate:', error);

      // Fallback: get active rate directly
      const { data: activeRate } = await supabase
        .rpc('get_active_exchange_rate');

      if (activeRate) {
        return NextResponse.json({
          rate: activeRate,
          expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
          sessionId,
          source: 'fallback'
        });
      }

      // Secondary fallback: latest stored rate (even if expired/inactive)
      const { data: latestRateRow, error: latestRateError } = await supabase
        .from('exchange_rates')
        .select('rate, expires_at')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!latestRateError && latestRateRow?.rate) {
        return NextResponse.json({
          rate: latestRateRow.rate,
          expiresAt: latestRateRow.expires_at || new Date(Date.now() + 10 * 60 * 1000).toISOString(),
          sessionId,
          source: 'latest-rate-fallback'
        });
      }

      // Final fallback: safe static rate to keep checkout operational
      return NextResponse.json({
        rate: 43.02,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        sessionId,
        source: 'static-fallback'
      });
    }

    const response = NextResponse.json({
      rate: (data as any).rate,
      expiresAt: (data as any).expires_at,
      sessionId,
      source: 'frozen'
    });

    // Set session cookie if new
    if (!cookieStore.get('donation_session')?.value) {
      response.cookies.set('donation_session', sessionId, {
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 60 * 10, // 10 minutes
      });
    }

    return response;

  } catch (error: any) {
    console.error('Exchange rate API error:', error);
    return NextResponse.json({
      rate: 43.02,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      source: 'static-fallback-on-error',
      warning: error?.message || 'Failed to get exchange rate'
    });
  }
}
