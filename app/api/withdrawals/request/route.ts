import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCampaignBalances } from '@/lib/balances'
import {
    computeWithdrawalQuote,
    formatMoneyByCurrency,
    getPlatformCommissionPercent,
    getWithdrawalFeeConfig,
    getWithdrawalMinimums,
    withdrawalCurrencyForAccountType,
} from '@/lib/fees'

/**
 * POST /api/withdrawals/request
 * Crea una solicitud de retiro en la moneda que dicta el tipo de cuenta
 * destino (bank_bs/pagomovil -> BS; zelle/paypal/crypto -> USD).
 * Reglas:
 *   - El monto se valida contra el saldo disponible de ESA moneda
 *     (el RPC ya descuenta retiros procesados y solicitudes pendientes).
 *   - Máximo 1 solicitud pendiente por moneda por campaña.
 *   - El desglose (comisión LaVaca + fee de pasarela + neto) se calcula
 *     server-side y queda guardado en la fila.
 */
export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient()

        const {
            data: { user },
            error: authError,
        } = await supabase.auth.getUser()

        if (authError || !user) {
            return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
        }

        const body = await request.json()
        const campaignId = body?.campaignId as string | undefined
        const accountId = body?.accountId as string | undefined
        // `amount` viene en la moneda del retiro. Se acepta `amountUsd` como
        // alias para no romper llamadas viejas (retiros USD).
        const amount = Number(body?.amount ?? body?.amountUsd)

        if (!campaignId || !accountId || Number.isNaN(amount)) {
            return NextResponse.json({ error: 'Datos incompletos para solicitar retiro' }, { status: 400 })
        }

        if (amount <= 0) {
            return NextResponse.json({ error: 'El monto debe ser mayor a 0' }, { status: 400 })
        }

        const { data: campaign, error: campaignError } = await supabase
            .from('campaigns')
            .select('id, creator_id, campaign_type')
            .eq('id', campaignId)
            .maybeSingle()

        if (campaignError || !campaign) {
            return NextResponse.json({ error: 'Campaña no encontrada' }, { status: 404 })
        }

        if (campaign.creator_id !== user.id) {
            return NextResponse.json({ error: 'No tienes permisos para solicitar retiros de esta campaña' }, { status: 403 })
        }

        // Las campañas en modo crisis no usan retiros: el dinero llega directo
        // al organizador. (Si el modo crisis global está apagado, se comporta normal.)
        if (campaign.campaign_type === 'crisis') {
            const { data: cfg } = await createAdminClient()
                .from('admin_config')
                .select('crisis_mode_enabled')
                .limit(1)
                .maybeSingle()
            if (cfg?.crisis_mode_enabled) {
                return NextResponse.json(
                    { error: 'Las campañas en modo crisis no usan retiros: las donaciones llegan directo a tus cuentas.' },
                    { status: 400 }
                )
            }
        }

        const { data: account, error: accountError } = await supabase
            .from('withdrawal_accounts')
            .select('id, creator_id, account_type')
            .eq('id', accountId)
            .maybeSingle()

        if (accountError || !account) {
            return NextResponse.json({ error: 'Cuenta de retiro no encontrada' }, { status: 404 })
        }

        if (account.creator_id !== user.id) {
            return NextResponse.json({ error: 'La cuenta de retiro seleccionada no te pertenece' }, { status: 403 })
        }

        const currency = withdrawalCurrencyForAccountType(account.account_type)

        const [balances, platformCommissionPercent, feeConfig, minimums] = await Promise.all([
            getCampaignBalances(supabase, campaignId),
            getPlatformCommissionPercent(supabase),
            getWithdrawalFeeConfig(supabase, account.account_type),
            getWithdrawalMinimums(supabase),
        ])

        if (!balances) {
            return NextResponse.json({ error: 'No se pudieron obtener los saldos de la campaña' }, { status: 400 })
        }

        // 1 solicitud pendiente por moneda por campaña
        const hasPendingInCurrency = currency === 'BS' ? balances.has_pending_bs : balances.has_pending_usd
        if (hasPendingInCurrency) {
            return NextResponse.json(
                {
                    error: currency === 'BS'
                        ? 'Ya tienes una solicitud de retiro en bolívares pendiente para esta campaña'
                        : 'Ya tienes una solicitud de retiro en dólares pendiente para esta campaña',
                },
                { status: 400 }
            )
        }

        const available = currency === 'BS' ? balances.saldo_bs : balances.saldo_usd
        const minimum = currency === 'BS' ? minimums.minBs : minimums.minUsd

        if (available <= 0) {
            return NextResponse.json(
                {
                    error: currency === 'BS'
                        ? 'No tienes saldo en bolívares disponible para retirar en esta campaña'
                        : 'No tienes saldo en dólares disponible para retirar en esta campaña',
                },
                { status: 400 }
            )
        }

        if (amount < minimum) {
            return NextResponse.json(
                { error: `El monto mínimo de retiro es ${formatMoneyByCurrency(minimum, currency)}` },
                { status: 400 }
            )
        }

        if (amount > available) {
            return NextResponse.json(
                { error: 'El monto solicitado supera el saldo disponible en esa moneda' },
                { status: 400 }
            )
        }

        const quote = computeWithdrawalQuote({
            amount,
            accountType: account.account_type,
            platformCommissionPercent,
            feeConfig,
        })

        // amount_usd es NOT NULL en el esquema; para retiros Bs guardamos el
        // equivalente indicativo a la tasa actual (el valor congelado real se
        // fija al procesar, en indexed_usd_value / fx_loss_usd).
        const indicativeUsd = currency === 'BS'
            ? Number((amount / (balances.current_rate || 1)).toFixed(2))
            : amount

        const { error: insertError } = await supabase
            .from('withdrawal_requests')
            .insert({
                creator_id: user.id,
                campaign_id: campaignId,
                account_id: accountId,
                amount_usd: indicativeUsd,
                amount_bs: currency === 'BS' ? amount : null,
                currency,
                platform_fee: quote.platformFee,
                gateway_fee: quote.gatewayFee,
                net_amount: quote.netAmount,
                status: 'pending',
                exchange_rate_used: null,
            })

        if (insertError) {
            return NextResponse.json({ error: insertError.message }, { status: 400 })
        }

        return NextResponse.json({ ok: true, quote, currency })
    } catch (error: any) {
        return NextResponse.json(
            { error: error?.message || 'No se pudo procesar la solicitud de retiro' },
            { status: 500 }
        )
    }
}
