import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * POST /api/campaigns/[id]/goal
 *   Body: { newGoal: number, reason: string }
 *
 * Cambia la meta de una campaña con transparencia total (ver
 * PLAN-EDICION-CAMPANAS.md):
 *   - Disminuir: la nueva meta no puede ser menor a lo ya recaudado.
 *   - Aumentar: sin tope, pero exige motivo.
 *   - Se congela (requiere soporte/admin) si la campaña cerró o ya retiró fondos.
 *   - Guarda historial, fija la meta original, publica una actualización +
 *     comentario del sistema en el muro y notifica a donantes y seguidores.
 */
export async function POST(
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
        const body = await request.json()
        const newGoal = Number(body?.newGoal)
        const reason = typeof body?.reason === 'string' ? body.reason.trim() : ''

        if (!Number.isFinite(newGoal) || newGoal < 10) {
            return NextResponse.json({ error: 'La meta debe ser de al menos $10 USD' }, { status: 400 })
        }

        if (reason.length < 10) {
            return NextResponse.json(
                { error: 'El motivo del cambio es obligatorio (mínimo 10 caracteres). Tus donantes lo verán.' },
                { status: 400 }
            )
        }

        const { data: campaign, error: campaignError } = await supabase
            .from('campaigns')
            .select('id, creator_id, title, slug, status, goal_amount_usd, current_amount_usd, original_goal_amount_usd')
            .eq('id', id)
            .maybeSingle()

        if (campaignError || !campaign) {
            return NextResponse.json({ error: 'Campaña no encontrada' }, { status: 404 })
        }

        if (campaign.creator_id !== user.id) {
            return NextResponse.json({ error: 'No tienes permisos para editar esta campaña' }, { status: 403 })
        }

        const previousGoal = Number(campaign.goal_amount_usd || 0)
        const raised = Number(campaign.current_amount_usd || 0)
        const roundedNewGoal = Math.round(newGoal * 100) / 100

        if (roundedNewGoal === previousGoal) {
            return NextResponse.json({ error: 'La nueva meta es igual a la actual.' }, { status: 400 })
        }

        const changeType: 'increase' | 'decrease' = roundedNewGoal > previousGoal ? 'increase' : 'decrease'

        // Congelamiento: campañas cerradas/completadas o con retiros procesados
        // no se auto-editan (requieren revisión de soporte).
        const frozenStatus = campaign.status === 'closed' || campaign.status === 'completed'

        const adminSupabase = createAdminClient()

        const { count: processedWithdrawals } = await adminSupabase
            .from('withdrawal_requests')
            .select('id', { count: 'exact', head: true })
            .eq('campaign_id', id)
            .eq('status', 'processed')

        if (frozenStatus || (processedWithdrawals || 0) > 0) {
            return NextResponse.json(
                {
                    error: 'Esta campaña ya cerró o retiró fondos, por lo que la meta está congelada. Escribe a soporte para evaluar el cambio.',
                },
                { status: 409 }
            )
        }

        // Disminuir: nunca por debajo de lo recaudado.
        if (changeType === 'decrease' && roundedNewGoal < raised) {
            return NextResponse.json(
                {
                    error: `La nueva meta no puede ser menor a lo ya recaudado ($${raised.toFixed(2)}).`,
                },
                { status: 400 }
            )
        }

        // 1. Actualizar la meta + fijar la meta original si es el primer cambio.
        const updatePayload: Record<string, any> = {
            goal_amount_usd: roundedNewGoal,
            updated_at: new Date().toISOString(),
        }
        if (campaign.original_goal_amount_usd == null) {
            updatePayload.original_goal_amount_usd = previousGoal
        }

        const { error: updateError } = await adminSupabase
            .from('campaigns')
            .update(updatePayload)
            .eq('id', id)

        if (updateError) {
            return NextResponse.json({ error: 'No se pudo actualizar la meta', details: updateError.message }, { status: 500 })
        }

        // 2. Historial de meta.
        await adminSupabase.from('campaign_goal_history').insert({
            campaign_id: id,
            previous_goal: previousGoal,
            new_goal: roundedNewGoal,
            change_type: changeType,
            reason,
            created_by: user.id,
        })

        // 3. Actualización pública (campaign_updates) con el motivo.
        const verb = changeType === 'increase' ? 'aumentó' : 'redujo'
        await adminSupabase.from('campaign_updates').insert({
            campaign_id: id,
            creator_id: user.id,
            title: 'Actualización de la meta',
            content: `Se ${verb} la meta de $${previousGoal.toFixed(2)} a $${roundedNewGoal.toFixed(2)}.\n\nMotivo: ${reason}`,
            image_url: null,
        })

        // 4. Comentario del sistema en el muro.
        await adminSupabase.from('campaign_comments').insert({
            campaign_id: id,
            user_id: user.id,
            is_system: true,
            is_from_creator: false,
            content: `El creador actualizó la meta de la campaña de $${previousGoal.toFixed(2)} a $${roundedNewGoal.toFixed(2)}. Motivo: ${reason}`,
        })

        // 5. Notificar a donantes (con donación completada) y seguidores.
        const [{ data: donorRows }, { data: followerRows }] = await Promise.all([
            adminSupabase
                .from('donations')
                .select('donor_id')
                .eq('campaign_id', id)
                .eq('payment_status', 'completed')
                .not('donor_id', 'is', null),
            adminSupabase
                .from('campaign_followers')
                .select('user_id')
                .eq('campaign_id', id),
        ])

        const recipientIds = new Set<string>()
        for (const row of donorRows || []) {
            if (row.donor_id) recipientIds.add(row.donor_id as string)
        }
        for (const row of followerRows || []) {
            if (row.user_id) recipientIds.add(row.user_id as string)
        }
        recipientIds.delete(user.id) // el creador no se notifica a sí mismo

        if (recipientIds.size > 0) {
            const link = campaign.slug ? `/campaigns/${campaign.slug}` : `/campaigns/${id}`
            const notifications = Array.from(recipientIds).map((recipientId) => ({
                user_id: recipientId,
                type: 'campaign_update' as const,
                title: 'Una campaña que apoyas actualizó su meta',
                message: `"${campaign.title}" ${verb} su meta a $${roundedNewGoal.toFixed(2)}. Motivo: ${reason}`,
                link,
                campaign_id: id,
                data: {
                    previous_goal: previousGoal,
                    new_goal: roundedNewGoal,
                    change_type: changeType,
                },
            }))

            // Insertar en lotes para no exceder límites.
            const BATCH = 500
            for (let i = 0; i < notifications.length; i += BATCH) {
                await adminSupabase.from('notifications').insert(notifications.slice(i, i + BATCH))
            }
        }

        return NextResponse.json({
            ok: true,
            previousGoal,
            newGoal: roundedNewGoal,
            changeType,
            notified: recipientIds.size,
        })
    } catch (error: any) {
        return NextResponse.json(
            { error: error?.message || 'No se pudo procesar el cambio de meta' },
            { status: 500 }
        )
    }
}
