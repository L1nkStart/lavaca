import { NextRequest, NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { directDonationMoneyLabel } from '@/lib/direct-payments'

/**
 * POST /api/admin/direct-payments/[id]
 *   Body: { action: 'note' | 'remind' | 'reopen' | 'annul', reason?: string }
 *
 * Herramientas de MEDIACIÓN de LaVaca sobre un pago directo (modo crisis).
 * LaVaca NUNCA confirma un pago directo (el dinero llegó a la cuenta del
 * organizador y solo él puede verificarlo). Lo que sí puede hacer:
 *
 *   note    Deja una nota en la bitácora (contacto con las partes, acuerdos).
 *   remind  Recuerda al organizador que tiene este pago por confirmar.
 *   reopen  Un pago RECHAZADO vuelve a "por confirmar" (p. ej. el donante
 *           demostró que sí pagó). El organizador decide de nuevo.
 *   annul   Un pago CONFIRMADO se anula (falso, duplicado o confirmado por
 *           error): se descuenta de la barra de la campaña.
 *
 * Todo queda en audit_logs y se notifica a las partes.
 */

async function assertAdmin() {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return { ok: false as const, status: 401, error: 'No autorizado' }
    const { data: actor } = await supabase.from('users').select('role').eq('id', user.id).single()
    if (actor?.role !== 'admin') return { ok: false as const, status: 403, error: 'Permisos insuficientes' }
    return { ok: true as const, userId: user.id }
}

type Action = 'note' | 'remind' | 'reopen' | 'annul'
const ACTIONS: Action[] = ['note', 'remind', 'reopen', 'annul']
const round2 = (v: number) => Math.round(v * 100) / 100

/**
 * Descuenta `amount` de la barra con compare-and-swap: el UPDATE solo aplica si
 * el valor no cambió desde que lo leímos, para no pisar una acreditación que
 * el trigger haga en paralelo. Reintenta unas veces.
 */
async function decrementCampaignAmount(db: SupabaseClient, campaignId: string, amount: number) {
    for (let attempt = 0; attempt < 5; attempt++) {
        const { data: current, error: readError } = await db
            .from('campaigns')
            .select('current_amount_usd')
            .eq('id', campaignId)
            .single()
        if (readError || !current) return { ok: false, error: readError?.message || 'Campaña no encontrada' }

        const before = current.current_amount_usd
        const next = round2(Math.max(Number(before) - amount, 0))
        const { data: swapped, error: writeError } = await db
            .from('campaigns')
            .update({ current_amount_usd: next })
            .eq('id', campaignId)
            .eq('current_amount_usd', before)
            .select('id')
        if (writeError) return { ok: false, error: writeError.message }
        if (swapped && swapped.length > 0) return { ok: true, before: Number(before), after: next }
    }
    return { ok: false, error: 'La barra cambió varias veces mientras se anulaba; revisa el monto de la campaña.' }
}

async function notify(db: SupabaseClient, row: Record<string, any>) {
    const { error } = await db.from('notifications').insert(row)
    if (error) console.warn('[admin/direct-payments] notificación falló:', error.message)
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const adminCheck = await assertAdmin()
        if (!adminCheck.ok) return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status })

        const { id } = await params
        const body = await request.json().catch(() => null)
        const action = body?.action as Action
        const reason = typeof body?.reason === 'string' ? body.reason.trim().slice(0, 1000) : ''

        if (!ACTIONS.includes(action)) return NextResponse.json({ error: 'Acción inválida' }, { status: 400 })
        if (action !== 'remind' && reason.length < 5) {
            return NextResponse.json({ error: 'Describe brevemente el motivo (mínimo 5 caracteres)' }, { status: 400 })
        }

        const db = createAdminClient()
        const { data: donation, error: fetchError } = await db
            .from('donations')
            .select('id, campaign_id, donor_id, is_direct, payment_status, amount_usd, amount_bs, currency, reference_number, created_at, confirmed_by, confirmed_at, admin_notes, campaigns ( title, creator_id )')
            .eq('id', id)
            .maybeSingle()

        if (fetchError) throw fetchError
        if (!donation || !donation.is_direct) {
            return NextResponse.json({ error: 'Pago directo no encontrado' }, { status: 404 })
        }

        const campaign: any = Array.isArray(donation.campaigns) ? donation.campaigns[0] : donation.campaigns
        const amountLabel = directDonationMoneyLabel(donation)
        const refLabel = donation.reference_number ? ` (ref. ${donation.reference_number})` : ''
        const crisisLink = `/creator/campaigns/${donation.campaign_id}/crisis`
        const now = new Date().toISOString()
        let changes: Record<string, any> = {}
        let extra: Record<string, any> = {}

        if (action === 'note') {
            changes = { note: true, payment_status: donation.payment_status }
        }

        if (action === 'remind') {
            if (donation.payment_status !== 'pending') {
                return NextResponse.json({ error: 'Solo se puede recordar un pago que sigue por confirmar' }, { status: 409 })
            }
            if (campaign?.creator_id) {
                await notify(db, {
                    user_id: campaign.creator_id,
                    type: 'donation_received',
                    title: 'LaVaca: tienes un pago esperando tu confirmación',
                    message: `Un donante registró un pago de ${amountLabel}${refLabel} en "${campaign.title}". Revisa tu cuenta y confírmalo o recházalo para que el donante sepa qué pasó.${reason ? ` Nota de LaVaca: ${reason}` : ''}`,
                    link: crisisLink,
                    campaign_id: donation.campaign_id,
                    related_id: donation.id,
                })
            }
            changes = { reminded_creator: true }
        }

        if (action === 'reopen') {
            if (donation.payment_status !== 'failed') {
                return NextResponse.json({ error: 'Solo se puede reabrir un pago rechazado' }, { status: 409 })
            }
            const { data: updated, error } = await db
                .from('donations')
                .update({
                    payment_status: 'pending',
                    confirmed_by: null,
                    confirmed_at: null,
                    completed_at: null,
                    admin_notes: `Reabierto por LaVaca: ${reason}`,
                })
                .eq('id', id)
                .eq('is_direct', true)
                .eq('payment_status', 'failed')
                .select('id')
            if (error) throw error
            if (!updated || updated.length === 0) {
                return NextResponse.json({ error: 'El pago cambió de estado. Recarga la página.' }, { status: 409 })
            }
            changes = {
                payment_status: { from: 'failed', to: 'pending' },
                previous_confirmed_by: donation.confirmed_by,
                previous_confirmed_at: donation.confirmed_at,
                previous_admin_notes: donation.admin_notes,
            }
            if (campaign?.creator_id) {
                await notify(db, {
                    user_id: campaign.creator_id,
                    type: 'donation_received',
                    title: 'LaVaca reabrió un pago para que lo revises',
                    message: `El pago de ${amountLabel}${refLabel} en "${campaign.title}" volvió a "por confirmar". Motivo: ${reason}`,
                    link: crisisLink,
                    campaign_id: donation.campaign_id,
                    related_id: donation.id,
                })
            }
        }

        if (action === 'annul') {
            if (donation.payment_status !== 'completed') {
                return NextResponse.json({ error: 'Solo se puede anular un pago confirmado' }, { status: 409 })
            }
            const { data: updated, error } = await db
                .from('donations')
                .update({
                    payment_status: 'failed',
                    admin_notes: `Anulado por LaVaca: ${reason}`,
                })
                .eq('id', id)
                .eq('is_direct', true)
                .eq('payment_status', 'completed')
                .select('id')
            if (error) throw error
            if (!updated || updated.length === 0) {
                return NextResponse.json({ error: 'El pago cambió de estado. Recarga la página.' }, { status: 409 })
            }

            // El trigger de acreditación solo SUMA al pasar a 'completed'; al
            // anular hay que descontar a mano.
            const bar = await decrementCampaignAmount(db, donation.campaign_id, Number(donation.amount_usd) || 0)
            if (!bar.ok) console.error('[admin/direct-payments annul] no se pudo descontar de la barra:', bar.error)
            extra = { barAdjusted: bar.ok, barError: bar.ok ? undefined : bar.error }

            changes = {
                payment_status: { from: 'completed', to: 'failed' },
                amount_usd_removed: Number(donation.amount_usd) || 0,
                campaign_amount: bar.ok ? { before: bar.before, after: bar.after } : { error: bar.error },
                previous_confirmed_by: donation.confirmed_by,
                previous_confirmed_at: donation.confirmed_at,
                previous_admin_notes: donation.admin_notes,
            }

            if (campaign?.creator_id) {
                await notify(db, {
                    user_id: campaign.creator_id,
                    type: 'donation_received',
                    title: 'LaVaca anuló un pago confirmado',
                    message: `El pago de ${amountLabel}${refLabel} en "${campaign.title}" fue anulado y ya no suma a tu campaña. Motivo: ${reason}`,
                    link: crisisLink,
                    campaign_id: donation.campaign_id,
                    related_id: donation.id,
                })
            }
            if (donation.donor_id) {
                await notify(db, {
                    user_id: donation.donor_id,
                    type: 'donation_received',
                    title: 'Actualización sobre tu aporte',
                    message: `LaVaca revisó tu pago de ${amountLabel}${refLabel} a "${campaign?.title || 'la campaña'}" y quedó anulado. Motivo: ${reason}. Si crees que es un error, escríbenos.`,
                    link: '/contact',
                    campaign_id: donation.campaign_id,
                    related_id: donation.id,
                })
            }
        }

        const { error: auditError } = await db.from('audit_logs').insert({
            admin_id: adminCheck.userId,
            action: `direct_payment_${action}`,
            target_table: 'donations',
            target_id: id,
            changes: { ...changes, at: now, campaign_id: donation.campaign_id },
            reason: reason || null,
        })
        if (auditError) {
            console.error('[admin/direct-payments] audit log falló:', auditError.message)
            // Una nota sin bitácora no sirve de nada: avisamos al admin.
            if (action === 'note') {
                return NextResponse.json({ error: 'No se pudo guardar la nota', details: auditError.message }, { status: 500 })
            }
        }

        return NextResponse.json({ ok: true, action, ...extra })
    } catch (error: any) {
        console.error('[admin/direct-payments POST] error:', error)
        return NextResponse.json({ error: 'Error interno', details: error?.message }, { status: 500 })
    }
}
