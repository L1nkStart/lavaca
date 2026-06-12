import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { refreshExchangeRate } from '@/lib/exchange-rate';

/**
 * Forzar actualización de la tasa de cambio oficial BCV.
 * Usado tanto desde el panel de admin como desde el cron de Coolify.
 */
export async function POST(_request: NextRequest) {
    try {
        const result = await refreshExchangeRate();
        if (!result) {
            return NextResponse.json(
                { success: false, error: 'No se pudo obtener la tasa BCV' },
                { status: 502 },
            );
        }

        return NextResponse.json({
            success: true,
            rawRate: result.rawRate,
            finalRate: result.finalRate,
            rate: result.finalRate,
            rateId: result.rateId,
            timestamp: new Date().toISOString(),
        });
    } catch (error: any) {
        console.error('[exchange-rate/update] error:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to update', details: error?.message },
            { status: 500 },
        );
    }
}

/**
 * Info sobre la tasa actual (útil para debug).
 */
export async function GET() {
    try {
        const supabase = createAdminClient();

        const [{ data: currentRate }, { data: lastUpdate }] = await Promise.all([
            supabase.rpc('get_active_exchange_rate'),
            supabase
                .from('exchange_rates')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle(),
        ]);

        return NextResponse.json({
            currentRate,
            lastUpdate,
        });
    } catch (error: any) {
        return NextResponse.json({ error: error?.message }, { status: 500 });
    }
}
