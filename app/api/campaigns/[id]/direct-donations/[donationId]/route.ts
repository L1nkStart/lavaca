import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * PATCH /api/campaigns/[id]/direct-donations/[donationId]
 *   Body: { action: 'confirm' | 'reject' }
 *
 * El creador confirma (sube la barra vía el trigger de acreditación) o
 * rechaza un pago directo registrado por un donante. Solo el creador dueño,
 * solo sobre donaciones directas pendientes.
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
        const body = await request.json()
        const action = body?.action as 'confirm' | 'reject' | undefined
        if (action !== 'confirm' && action !== 'reject') {
            return NextResponse.json({ error: 'Acción inválida' }, { status: 400 })
        }

        const { data: campaign } = await supabase
            .from('campaigns')
            .select('id, creator_id')
            .eq('id', id)
            .maybeSingle()
        if (!campaign) return NextResponse.json({ error: 'Campaña no encontrada' }, { status: 404 })
        if (campaign.creator_id !== user.id) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

        const adminSupabase = createAdminClient()

        const { data: donation } = await adminSupabase
            .from('donations')
            .select('id, campaign_id, is_direct, payment_status')
            .eq('id', donationId)
            .maybeSingle()

        if (!donation || donation.campaign_id !== id || !donation.is_direct) {
            return NextResponse.json({ error: 'Pago directo no encontrado' }, { status: 404 })
        }
        if (donation.payment_status !== 'pending') {
            return NextResponse.json({ error: `Este pago ya fue ${donation.payment_status === 'completed' ? 'confirmado' : 'resuelto'}` }, { status: 400 })
        }

        const now = new Date().toISOString()
        if (action === 'confirm') {
            // El trigger update_campaign_amount_on_donation acredita la barra
            // cuando payment_status pasa a 'completed'.
            const { error } = await adminSupabase
                .from('donations')
                .update({
                    payment_status: 'completed',
                    completed_at: now,
                    confirmed_by: user.id,
                    confirmed_at: now,
                })
                .eq('id', donationId)
                .neq('payment_status', 'completed')
            if (error) throw error
            return NextResponse.json({ ok: true, status: 'completed' })
        }

        const { error } = await adminSupabase
            .from('donations')
            .update({
                payment_status: 'failed',
                confirmed_by: user.id,
                confirmed_at: now,
                admin_notes: 'Pago directo rechazado por el organizador',
            })
            .eq('id', donationId)
            .neq('payment_status', 'completed')
        if (error) throw error
        return NextResponse.json({ ok: true, status: 'failed' })
    } catch (error: any) {
        return NextResponse.json({ error: error?.message || 'Error interno' }, { status: 500 })
    }
}
