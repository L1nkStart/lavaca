/**
 * ============================================
 * SALDOS MULTI-MONEDA POR CAMPAÑA - LaVaca
 * ============================================
 * Wrapper tipado del RPC `get_campaign_balances` (migración 30).
 * Los saldos se calculan on-the-fly en la BD; acá solo se consumen.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export interface CampaignBalances {
    campaign_id: string;
    /** Bolívares disponibles para retirar (neto − retirado − reservado) */
    saldo_bs: number;
    /** Dólares disponibles para retirar */
    saldo_usd: number;
    donated_bs: number;
    donated_usd: number;
    withdrawn_bs: number;
    withdrawn_usd: number;
    /** Reservado en solicitudes de retiro pendientes */
    pending_bs: number;
    pending_usd: number;
    has_pending_bs: boolean;
    has_pending_usd: boolean;
    /** Tasa promedio ponderada a la que entraron los Bs */
    avg_entry_rate: number;
    current_rate: number;
    /** Valor indexado en USD del saldo Bs vivo (costo promedio) */
    bs_indexed_usd: number;
    fx_loss_unrealized: number;
    fx_loss_realized: number;
    fx_loss_total: number;
    last_bs_donation_at: string | null;
    last_bs_withdrawal_at: string | null;
}

export const EMPTY_BALANCES: Omit<CampaignBalances, 'campaign_id'> = {
    saldo_bs: 0,
    saldo_usd: 0,
    donated_bs: 0,
    donated_usd: 0,
    withdrawn_bs: 0,
    withdrawn_usd: 0,
    pending_bs: 0,
    pending_usd: 0,
    has_pending_bs: false,
    has_pending_usd: false,
    avg_entry_rate: 0,
    current_rate: 0,
    bs_indexed_usd: 0,
    fx_loss_unrealized: 0,
    fx_loss_realized: 0,
    fx_loss_total: 0,
    last_bs_donation_at: null,
    last_bs_withdrawal_at: null,
};

export async function getCampaignBalances(
    supabase: SupabaseClient,
    campaignId: string,
): Promise<CampaignBalances | null> {
    const { data, error } = await supabase.rpc('get_campaign_balances', {
        p_campaign_id: campaignId,
    });

    if (error) {
        console.error(`Error fetching balances for campaign ${campaignId}:`, error.message);
        return null;
    }

    return (data as CampaignBalances) || null;
}

/** Saldos de varias campañas en paralelo. Las que fallen devuelven ceros. */
export async function getBalancesForCampaigns(
    supabase: SupabaseClient,
    campaignIds: string[],
): Promise<Map<string, CampaignBalances>> {
    const results = await Promise.all(
        campaignIds.map(async (id) => {
            const balances = await getCampaignBalances(supabase, id);
            return [id, balances ?? { ...EMPTY_BALANCES, campaign_id: id }] as const;
        }),
    );

    return new Map(results);
}

/**
 * Días que el saldo Bs lleva "parado" (desde el último movimiento Bs:
 * retiro procesado o, si no hay, la última donación Bs). Alimenta la
 * alerta anti-inflación.
 */
export function daysSinceLastBsMovement(balances: CampaignBalances): number | null {
    const reference = balances.last_bs_withdrawal_at || balances.last_bs_donation_at;
    if (!reference) return null;

    const elapsedMs = Date.now() - new Date(reference).getTime();
    if (!Number.isFinite(elapsedMs) || elapsedMs < 0) return null;

    return Math.floor(elapsedMs / (24 * 60 * 60 * 1000));
}
