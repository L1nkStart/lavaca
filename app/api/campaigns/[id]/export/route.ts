import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/campaigns/[id]/export?type=donations|withdrawals
 * Exporta CSV (UTF-8 con BOM para Excel) de donaciones o retiros de una
 * campaña. Solo el creador de la campaña o un admin.
 */

function csvEscape(value: unknown): string {
    if (value === null || value === undefined) return ''
    const text = String(value)
    if (/[",\n;]/.test(text)) {
        return `"${text.replace(/"/g, '""')}"`
    }
    return text
}

function toCsv(headers: string[], rows: unknown[][]): string {
    const lines = [headers.map(csvEscape).join(',')]
    for (const row of rows) {
        lines.push(row.map(csvEscape).join(','))
    }
    // BOM para que Excel detecte UTF-8 (tildes y "ñ" correctas)
    return `﻿${lines.join('\r\n')}`
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const supabase = await createClient()

        const {
            data: { user },
            error: authError,
        } = await supabase.auth.getUser()

        if (authError || !user) {
            return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
        }

        const { id } = await params
        const { searchParams } = new URL(request.url)
        const type = searchParams.get('type') === 'withdrawals' ? 'withdrawals' : 'donations'

        const { data: campaign, error: campaignError } = await supabase
            .from('campaigns')
            .select('id, creator_id, title')
            .eq('id', id)
            .maybeSingle()

        if (campaignError || !campaign) {
            return NextResponse.json({ error: 'Campaña no encontrada' }, { status: 404 })
        }

        if (campaign.creator_id !== user.id) {
            const { data: profile } = await supabase
                .from('users')
                .select('role')
                .eq('id', user.id)
                .maybeSingle()

            if (profile?.role !== 'admin') {
                return NextResponse.json({ error: 'No tienes permisos para exportar esta campaña' }, { status: 403 })
            }
        }

        let csv: string

        if (type === 'donations') {
            const { data: donations, error } = await supabase
                .from('donations')
                .select('created_at, donor_name, is_anonymous, payment_method, currency, amount_usd, amount_bs, gateway_fee_usd, fee_covered_by_donor, net_amount_usd, net_amount_bs, payment_status, reference_number')
                .eq('campaign_id', id)
                .order('created_at', { ascending: false })

            if (error) throw error

            csv = toCsv(
                ['Fecha', 'Donante', 'Anonima', 'Metodo', 'Moneda', 'Monto USD', 'Monto Bs', 'Fee pasarela USD', 'Fee cubierto por donante', 'Neto USD', 'Neto Bs', 'Estado', 'Referencia'],
                (donations || []).map((donation) => [
                    new Date(donation.created_at).toLocaleString('es-VE'),
                    donation.is_anonymous ? 'Anonimo' : donation.donor_name || 'Donante',
                    donation.is_anonymous ? 'Si' : 'No',
                    donation.payment_method,
                    donation.currency || 'USD',
                    donation.amount_usd ?? '',
                    donation.amount_bs ?? '',
                    donation.gateway_fee_usd ?? 0,
                    donation.fee_covered_by_donor ? 'Si' : 'No',
                    donation.net_amount_usd ?? '',
                    donation.net_amount_bs ?? '',
                    donation.payment_status,
                    donation.reference_number ?? '',
                ])
            )
        } else {
            const { data: withdrawals, error } = await supabase
                .from('withdrawal_requests')
                .select('created_at, currency, amount_usd, amount_bs, platform_fee, gateway_fee, net_amount, status, exchange_rate_used, indexed_usd_value, fx_loss_usd, reference_number, rejection_reason, processed_at')
                .eq('campaign_id', id)
                .order('created_at', { ascending: false })

            if (error) throw error

            csv = toCsv(
                ['Solicitado', 'Moneda', 'Monto', 'Comision plataforma', 'Fee pasarela', 'Neto recibido', 'Estado', 'Tasa usada', 'Valor indexado USD', 'Perdida cambiaria USD', 'Referencia', 'Motivo rechazo', 'Procesado'],
                (withdrawals || []).map((withdrawal) => [
                    new Date(withdrawal.created_at).toLocaleString('es-VE'),
                    withdrawal.currency || 'USD',
                    withdrawal.currency === 'BS' ? withdrawal.amount_bs ?? '' : withdrawal.amount_usd ?? '',
                    withdrawal.platform_fee ?? 0,
                    withdrawal.gateway_fee ?? 0,
                    withdrawal.net_amount ?? '',
                    withdrawal.status,
                    withdrawal.exchange_rate_used ?? '',
                    withdrawal.indexed_usd_value ?? '',
                    withdrawal.fx_loss_usd ?? '',
                    withdrawal.reference_number ?? '',
                    withdrawal.rejection_reason ?? '',
                    withdrawal.processed_at ? new Date(withdrawal.processed_at).toLocaleString('es-VE') : '',
                ])
            )
        }

        const safeTitle = campaign.title.replace(/[^\p{L}\p{N}]+/gu, '-').slice(0, 40)
        const filename = `lavaca-${type === 'donations' ? 'donaciones' : 'retiros'}-${safeTitle}.csv`

        return new NextResponse(csv, {
            headers: {
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': `attachment; filename="${filename}"`,
            },
        })
    } catch (error: any) {
        return NextResponse.json(
            { error: error?.message || 'No se pudo generar el CSV' },
            { status: 500 }
        )
    }
}
