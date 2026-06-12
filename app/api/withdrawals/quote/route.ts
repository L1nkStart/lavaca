import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCampaignBalances } from '@/lib/balances'
import {
    computeWithdrawalQuote,
    getPlatformCommissionPercent,
    getWithdrawalFeeConfig,
    getWithdrawalMinimums,
    withdrawalCurrencyForAccountType,
} from '@/lib/fees'

/**
 * GET /api/withdrawals/quote?campaignId=&accountId=&amount=
 * Desglose exacto de un retiro ANTES de confirmar:
 *   monto − comisión LaVaca − fee bancario/pasarela = neto a recibir.
 * El cálculo siempre viene del servidor (config de la BD), nunca del cliente.
 */
export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient()

        const {
            data: { user },
            error: authError,
        } = await supabase.auth.getUser()

        if (authError || !user) {
            return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
        }

        const { searchParams } = new URL(request.url)
        const campaignId = searchParams.get('campaignId')
        const accountId = searchParams.get('accountId')
        const amount = Number(searchParams.get('amount'))

        if (!campaignId || !accountId || !Number.isFinite(amount) || amount <= 0) {
            return NextResponse.json({ error: 'Parámetros incompletos para cotizar el retiro' }, { status: 400 })
        }

        const { data: account, error: accountError } = await supabase
            .from('withdrawal_accounts')
            .select('id, creator_id, account_type, account_holder_name')
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
            return NextResponse.json({ error: 'No se pudieron obtener los saldos de la campaña' }, { status: 403 })
        }

        const available = currency === 'BS' ? balances.saldo_bs : balances.saldo_usd
        const minimum = currency === 'BS' ? minimums.minBs : minimums.minUsd

        const quote = computeWithdrawalQuote({
            amount,
            accountType: account.account_type,
            platformCommissionPercent,
            feeConfig,
        })

        return NextResponse.json({
            quote,
            currency,
            available,
            minimum,
            exceedsAvailable: amount > available,
            belowMinimum: amount < minimum,
            account: {
                id: account.id,
                account_type: account.account_type,
                account_holder_name: account.account_holder_name,
            },
        })
    } catch (error: any) {
        return NextResponse.json(
            { error: error?.message || 'No se pudo cotizar el retiro' },
            { status: 500 }
        )
    }
}
