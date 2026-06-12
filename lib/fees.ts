/**
 * ============================================
 * FEES & MULTI-MONEDA - LaVaca
 * ============================================
 * Lógica compartida del modelo multi-moneda (ver PLAN-MULTIMONEDA.md):
 *   - Clasificación de moneda por método de donación y tipo de cuenta de retiro.
 *   - Cálculo de fee de pasarela en donaciones (configurable por el admin
 *     en payment_method_configs.settings).
 *   - Cálculo del desglose de retiros (comisión LaVaca + fee de pasarela)
 *     usando withdrawal_fee_configs + admin_config.
 *
 * Todo cálculo que afecte dinero se hace SIEMPRE server-side con estas
 * funciones; el cliente solo muestra previews.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export type BalanceCurrency = 'USD' | 'BS';

/** Métodos de donación cuyo dinero entra en bolívares. */
export const BS_DONATION_METHODS = new Set(['pagomovil', 'transfer', 'chinchin']);

/** Tipos de cuenta de retiro cuyo dinero sale en bolívares. */
export const BS_WITHDRAWAL_ACCOUNT_TYPES = new Set(['bank_bs', 'pagomovil']);

export function donationCurrencyForMethod(methodCode: string): BalanceCurrency {
    return BS_DONATION_METHODS.has(methodCode) ? 'BS' : 'USD';
}

export function withdrawalCurrencyForAccountType(accountType: string): BalanceCurrency {
    return BS_WITHDRAWAL_ACCOUNT_TYPES.has(accountType) ? 'BS' : 'USD';
}

// ============================================
// FEES DE DONACIÓN
// ============================================

export interface DonationFeeConfig {
    percent: number;
    fixedUsd: number;
}

/**
 * Lee la config de fee del método desde payment_method_configs.settings
 * (llaves donation_fee_percent / donation_fee_fixed_usd). Si el método no
 * existe o no tiene fee configurado, devuelve 0 (no se cobra de más nunca
 * por un error de config).
 */
export async function getDonationFeeConfig(
    supabase: SupabaseClient,
    methodCode: string,
): Promise<DonationFeeConfig> {
    const { data } = await supabase
        .from('payment_method_configs')
        .select('settings')
        .eq('code', methodCode)
        .maybeSingle();

    const settings = (data?.settings || {}) as Record<string, unknown>;
    const percent = Number(settings.donation_fee_percent);
    const fixedUsd = Number(settings.donation_fee_fixed_usd);

    return {
        percent: Number.isFinite(percent) && percent > 0 ? percent : 0,
        fixedUsd: Number.isFinite(fixedUsd) && fixedUsd > 0 ? fixedUsd : 0,
    };
}

export function computeDonationFeeUsd(amountUsd: number, config: DonationFeeConfig): number {
    if (amountUsd <= 0) return 0;
    const fee = (amountUsd * config.percent) / 100 + config.fixedUsd;
    return Math.round(fee * 100) / 100;
}

export interface DonationAmounts {
    currency: BalanceCurrency;
    /** Fee de pasarela estimado en USD */
    gatewayFeeUsd: number;
    /** Fee de pasarela en Bs, calculado nativo (solo donaciones BS) */
    gatewayFeeBs: number;
    /** Lo que acredita al saldo de la campaña, en USD */
    netAmountUsd: number;
    /** Lo que acredita al saldo Bs (solo donaciones BS) */
    netAmountBs: number | null;
    /** Total que paga el donante en USD (amount + fee si lo cubre) */
    totalChargedUsd: number;
}

/**
 * Calcula los montos de una donación según el modelo confirmado:
 *   - Donante cubre el fee  -> paga amount + fee, la campaña acredita amount.
 *   - Donante no lo cubre   -> paga amount, la campaña acredita amount - fee.
 * La barra pública siempre suma amount_usd bruto; el saldo retirable usa el neto.
 *
 * Para donaciones en Bs, `exactAmountBs` es el monto canónico: los bolívares
 * exactos que el donante transfirió. El neto Bs se calcula restando el fee
 * sobre ESE monto, nunca re-convirtiendo USD->Bs (eso producía montos como
 * "Bs 1.001,48" en una donación de Bs 1.000 por diferencias de tasa entre
 * cliente y servidor).
 */
export function computeDonationAmounts(params: {
    amountUsd: number;
    methodCode: string;
    feeConfig: DonationFeeConfig;
    feeCoveredByDonor: boolean;
    exchangeRate: number;
    exactAmountBs?: number | null;
}): DonationAmounts {
    const { amountUsd, methodCode, feeConfig, feeCoveredByDonor, exchangeRate, exactAmountBs } = params;
    const currency = donationCurrencyForMethod(methodCode);
    const round2 = (value: number) => Math.round(value * 100) / 100;
    const gatewayFeeUsd = computeDonationFeeUsd(amountUsd, feeConfig);

    const netAmountUsd = feeCoveredByDonor
        ? amountUsd
        : Math.max(round2(amountUsd - gatewayFeeUsd), 0);

    let netAmountBs: number | null = null;
    let gatewayFeeBs = 0;
    if (currency === 'BS') {
        if (exactAmountBs != null && exactAmountBs > 0) {
            // Fee calculado nativamente en Bs sobre el monto exacto: evita
            // que el redondeo del fee en USD (ej: $0.036 -> $0.04) infle o
            // distorsione el descuento al convertirlo de vuelta.
            gatewayFeeBs = round2((exactAmountBs * feeConfig.percent) / 100 + feeConfig.fixedUsd * exchangeRate);
            netAmountBs = feeCoveredByDonor
                ? exactAmountBs
                : Math.max(round2(exactAmountBs - gatewayFeeBs), 0);
        } else {
            gatewayFeeBs = round2(gatewayFeeUsd * exchangeRate);
            netAmountBs = round2(netAmountUsd * exchangeRate);
        }
    }

    const totalChargedUsd = feeCoveredByDonor
        ? round2(amountUsd + gatewayFeeUsd)
        : amountUsd;

    return { currency, gatewayFeeUsd, gatewayFeeBs, netAmountUsd, netAmountBs, totalChargedUsd };
}

// ============================================
// FEES DE RETIRO
// ============================================

export interface WithdrawalFeeConfigRow {
    account_type: string;
    currency: BalanceCurrency;
    fee_percent: number;
    fee_fixed: number;
    is_active: boolean;
}

export interface WithdrawalQuote {
    currency: BalanceCurrency;
    /** Monto bruto solicitado, en la moneda del retiro */
    amount: number;
    /** Comisión de plataforma LaVaca, en la moneda del retiro */
    platformFee: number;
    platformFeePercent: number;
    /** Fee bancario / de pasarela, en la moneda del retiro */
    gatewayFee: number;
    gatewayFeePercent: number;
    gatewayFeeFixed: number;
    /** Lo que recibe el creador */
    netAmount: number;
}

export async function getWithdrawalFeeConfig(
    supabase: SupabaseClient,
    accountType: string,
): Promise<WithdrawalFeeConfigRow | null> {
    const { data } = await supabase
        .from('withdrawal_fee_configs')
        .select('account_type, currency, fee_percent, fee_fixed, is_active')
        .eq('account_type', accountType)
        .maybeSingle();

    return (data as WithdrawalFeeConfigRow) || null;
}

export async function getPlatformCommissionPercent(supabase: SupabaseClient): Promise<number> {
    const { data } = await supabase
        .from('admin_config')
        .select('platform_commission_percentage')
        .limit(1)
        .maybeSingle();

    const percent = Number(data?.platform_commission_percentage);
    return Number.isFinite(percent) && percent >= 0 ? percent : 5;
}

export async function getWithdrawalMinimums(
    supabase: SupabaseClient,
): Promise<{ minUsd: number; minBs: number }> {
    const { data } = await supabase
        .from('admin_config')
        .select('min_withdrawal_usd, min_withdrawal_bs')
        .limit(1)
        .maybeSingle();

    const minUsd = Number(data?.min_withdrawal_usd);
    const minBs = Number(data?.min_withdrawal_bs);

    return {
        minUsd: Number.isFinite(minUsd) && minUsd > 0 ? minUsd : 10,
        minBs: Number.isFinite(minBs) && minBs > 0 ? minBs : 500,
    };
}

/**
 * Desglose completo de un retiro:
 *   neto = monto - comisión LaVaca (%) - fee de pasarela (% + fijo)
 * Todo en la moneda del retiro (los % se aplican directo sobre el monto,
 * sin convertir a USD y de vuelta, para evitar dobles redondeos).
 */
export function computeWithdrawalQuote(params: {
    amount: number;
    accountType: string;
    platformCommissionPercent: number;
    feeConfig: WithdrawalFeeConfigRow | null;
}): WithdrawalQuote {
    const { amount, accountType, platformCommissionPercent, feeConfig } = params;
    const currency = withdrawalCurrencyForAccountType(accountType);

    const round2 = (value: number) => Math.round(value * 100) / 100;

    const platformFee = round2((amount * platformCommissionPercent) / 100);

    const gatewayFeePercent = feeConfig?.is_active ? Number(feeConfig.fee_percent) || 0 : 0;
    const gatewayFeeFixed = feeConfig?.is_active ? Number(feeConfig.fee_fixed) || 0 : 0;
    const gatewayFee = round2((amount * gatewayFeePercent) / 100 + gatewayFeeFixed);

    const netAmount = Math.max(round2(amount - platformFee - gatewayFee), 0);

    return {
        currency,
        amount: round2(amount),
        platformFee,
        platformFeePercent: platformCommissionPercent,
        gatewayFee,
        gatewayFeePercent,
        gatewayFeeFixed,
        netAmount,
    };
}

// ============================================
// FORMATEO (compartido server/client)
// ============================================

export function formatBs(value: number): string {
    return `Bs ${new Intl.NumberFormat('es-VE', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(Number.isFinite(value) ? value : 0)}`;
}

export function formatUsd(value: number): string {
    return `$${new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(Number.isFinite(value) ? value : 0)}`;
}

export function formatMoneyByCurrency(value: number, currency: BalanceCurrency): string {
    return currency === 'BS' ? formatBs(value) : formatUsd(value);
}
