import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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
        const amountUsd = Number(body?.amountUsd)

        if (!campaignId || !accountId || Number.isNaN(amountUsd)) {
            return NextResponse.json({ error: 'Datos incompletos para solicitar retiro' }, { status: 400 })
        }

        if (amountUsd <= 0) {
            return NextResponse.json({ error: 'El monto debe ser mayor a 0' }, { status: 400 })
        }

        const { data: campaign, error: campaignError } = await supabase
            .from('campaigns')
            .select('id, creator_id, current_amount_usd')
            .eq('id', campaignId)
            .maybeSingle()

        if (campaignError || !campaign) {
            return NextResponse.json({ error: 'Campaña no encontrada' }, { status: 404 })
        }

        if (campaign.creator_id !== user.id) {
            return NextResponse.json({ error: 'No tienes permisos para solicitar retiros de esta campaña' }, { status: 403 })
        }

        const { data: previousRequests, error: previousRequestsError } = await supabase
            .from('withdrawal_requests')
            .select('amount_usd, status')
            .eq('creator_id', user.id)
            .eq('campaign_id', campaignId)

        if (previousRequestsError) {
            return NextResponse.json({ error: previousRequestsError.message }, { status: 400 })
        }

        const hasPendingRequest = (previousRequests || []).some((request) => request.status === 'pending')
        if (hasPendingRequest) {
            return NextResponse.json(
                { error: 'Ya tienes una solicitud de retiro pendiente para esta campaña' },
                { status: 400 }
            )
        }

        const withdrawnAmount = (previousRequests || [])
            .filter((request) => request.status === 'processed')
            .reduce((sum, request) => sum + Number(request.amount_usd || 0), 0)

        const availableAmount = Math.max(Number(campaign.current_amount_usd || 0) - withdrawnAmount, 0)

        if (availableAmount <= 0) {
            return NextResponse.json({ error: 'No tienes fondos disponibles para retirar en esta campaña' }, { status: 400 })
        }

        if (amountUsd > availableAmount) {
            return NextResponse.json(
                { error: 'El monto solicitado supera el saldo disponible de la campaña' },
                { status: 400 }
            )
        }

        const { data: account, error: accountError } = await supabase
            .from('withdrawal_accounts')
            .select('id, creator_id')
            .eq('id', accountId)
            .maybeSingle()

        if (accountError || !account) {
            return NextResponse.json({ error: 'Cuenta de retiro no encontrada' }, { status: 404 })
        }

        if (account.creator_id !== user.id) {
            return NextResponse.json({ error: 'La cuenta de retiro seleccionada no te pertenece' }, { status: 403 })
        }

        const { error: insertError } = await supabase
            .from('withdrawal_requests')
            .insert({
                creator_id: user.id,
                campaign_id: campaignId,
                account_id: accountId,
                amount_usd: amountUsd,
                amount_bs: null,
                status: 'pending',
                exchange_rate_used: null,
            })

        if (insertError) {
            return NextResponse.json({ error: insertError.message }, { status: 400 })
        }

        return NextResponse.json({ ok: true })
    } catch (error: any) {
        return NextResponse.json(
            { error: error?.message || 'No se pudo procesar la solicitud de retiro' },
            { status: 500 }
        )
    }
}
