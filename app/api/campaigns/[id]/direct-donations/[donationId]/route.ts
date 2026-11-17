import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { directDonationMoneyLabel } from '@/lib/direct-payments'

/**
 * PATCH /api/campaigns/[id]/direct-donations/[donationId]
 *   Body: { action: 'confirm' | 'reject', reason?: string }
 *
 * El creador confirma (sube la barra vía el trigger de acreditación) o
 * rechaza un pago directo registrado por un donante. Solo el creador dueño,
 * solo sobre donaciones directas PENDIENTES.
 *
 * La transición es atómica: el UPDATE exige `payment_status = 'pending'` y
 * devuelve la fila; si otro request (doble toque, dos pestañas) ya la resolvió,
 * no se actualiza nada y respondemos 409. Así un pago rechazado nunca termina
 * confirmado por una carrera, ni la barra se acredita dos veces.
 */
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; donationId: string }> }
) {
    try {
        const supabase = await createClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

        const { id, donationId } = await params
        const body = await request.json().catch(() => null)
        const action = body?.action as 'confirm' | 'reject' | undefined
        if (action !== 'confirm' && action !== 'reject') {
            return NextResponse.json({ error: 'Acción inválida' }, { status: 400 })
        }
        const reason = typeof body?.reason === 'string' ? body.reason.trim().slice(0, 300) : ''

        const { data: campaign } = await supabase
            .from('campaigns')
            .select('id, creator_id, title')
            .eq('id', id)
            .maybeSingle()
        if (!campaign) return NextResponse.json({ error: 'Campaña no encontrada' }, { status: 404 })
        if (campaign.creator_id !== user.id) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

        const adminSupabase = createAdminClient()

        const { data: donation } = await adminSupabase
            .from('donations')
            .select('id, campaign_id, is_direct, payment_status, donor_id, amount_usd, amount_bs, currency')
            .eq('id', donationId)
            .maybeSingle()

        if (!donation || donation.campaign_id !== id || !donation.is_direct) {
            return NextResponse.json({ error: 'Pago directo no encontrado' }, { status: 404 })
        }
        if (donation.payment_status !== 'pending') {
            return NextResponse.json(
                { error: `Este pago ya fue ${donation.payment_status === 'completed' ? 'confirmado' : 'rechazado'}` },
                { status: 409 }
            )
        }

        const now = new Date().toISOString()
        const update =
            action === 'confirm'
                ? {
                    // El trigger update_campaign_amount_on_donation acredita la
                    // barra cuando payment_status pasa a 'completed'.
                    payment_status: 'completed',
                    completed_at: now,
                    confirmed_by: user.id,
                    confirmed_at: now,
                    admin_notes: 'Pago directo confirmado por el organizador',
                }
                : {
                    payment_status: 'failed',
                    confirmed_by: user.id,
                    confirmed_at: now,
                    admin_notes: reason
                        ? `Pago directo rechazado por el organizador: ${reason}`
                        : 'Pago directo rechazado por el organizador',
                }

        const { data: updated, error } = await adminSupabase
            .from('donations')
            .update(update)
            .eq('id', donationId)
            .eq('is_direct', true)
            .eq('payment_status', 'pending')
            .select('id, payment_status')
        if (error) throw error
        if (!updated || updated.length === 0) {
            return NextResponse.json({ error: 'Este pago ya fue resuelto. Recarga la página.' }, { status: 409 })
        }

        // Avisar al donante (si tiene cuenta) del resultado. Best-effort: el
        // pago ya quedó resuelto aunque la notificación falle.
        if (donation.donor_id && donation.donor_id !== user.id) {
            const amountLabel = directDonationMoneyLabel(donation)
            const { error: notifyError } = await adminSupabase.from('notifications').insert({
                user_id: donation.donor_id,
                type: 'donation_received',
                title: action === 'confirm' ? 'Tu aporte fue confirmado' : 'El organizador no encontró tu pago',
                message:
                    action === 'confirm'
                        ? `El organizador de "${campaign.title}" confirmó que recibió tu pago de ${amountLabel}. ¡Gracias!`
                        : `El organizador de "${campaign.title}" no encontró tu pago de ${amountLabel}${reason ? ` (${reason})` : ''}. Si sí pagaste, escríbenos con tu comprobante y LaVaca te ayuda a resolverlo.`,
                link: action === 'confirm' ? `/campaigns/${id}` : '/contact',
                campaign_id: id,
                related_id: donationId,
            })
            if (notifyError) console.warn('[direct-donations PATCH] notificación al donante falló:', notifyError.message)
        }

        return NextResponse.json({ ok: true, status: update.payment_status })
    } catch (error: any) {
        console.error('[direct-donations PATCH] error:', error)
        return NextResponse.json({ error: error?.message || 'Error interno' }, { status: 500 })
    }
}
