import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function assertAdmin() {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return { ok: false as const, status: 401, error: 'No autorizado' }

    const { data: actor } = await supabase.from('users').select('role').eq('id', user.id).single()
    if (actor?.role !== 'admin') return { ok: false as const, status: 403, error: 'Permisos insuficientes' }
    return { ok: true as const, userId: user.id }
}

/**
 * PATCH /api/admin/media-changes/[id]
 *   Body: { action: 'approve' | 'reject', reviewNotes?: string }
 *
 * Aprobar aplica el cambio a la campaña en vivo (archivando lo anterior);
 * rechazar deja todo como estaba. En ambos casos se notifica al creador.
 */
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const adminCheck = await assertAdmin()
        if (!adminCheck.ok) {
            return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status })
        }

        const { id } = await params
        const body = await request.json()
        const action = body?.action as 'approve' | 'reject' | undefined
        const reviewNotes = typeof body?.reviewNotes === 'string' ? body.reviewNotes.trim() : null

        if (action !== 'approve' && action !== 'reject') {
            return NextResponse.json({ error: 'Acción inválida' }, { status: 400 })
        }
        if (action === 'reject' && !reviewNotes) {
            return NextResponse.json({ error: 'El motivo del rechazo es obligatorio' }, { status: 400 })
        }

        const adminSupabase = createAdminClient()

        const { data: change, error: fetchError } = await adminSupabase
            .from('campaign_media_changes')
            .select('id, campaign_id, requested_by, change_type, proposed_url, previous_url, status')
            .eq('id', id)
            .maybeSingle()

        if (fetchError || !change) {
            return NextResponse.json({ error: 'Cambio no encontrado' }, { status: 404 })
        }
        if (change.status !== 'pending') {
            return NextResponse.json({ error: `Este cambio ya fue ${change.status}` }, { status: 400 })
        }

        const { data: campaign } = await adminSupabase
            .from('campaigns')
            .select('id, title, slug, main_image_url')
            .eq('id', change.campaign_id)
            .maybeSingle()

        const now = new Date().toISOString()

        if (action === 'approve') {
            if (change.change_type === 'main_image' && change.proposed_url) {
                // Archivar portada anterior + aplicar la nueva.
                if (campaign?.main_image_url) {
                    await adminSupabase.from('campaign_media_archive').insert({
                        campaign_id: change.campaign_id,
                        url: campaign.main_image_url,
                        kind: 'main_image',
                        reason: 'Reemplazada por portada aprobada en moderación',
                    })
                }
                await adminSupabase
                    .from('campaigns')
                    .update({ main_image_url: change.proposed_url, updated_at: now })
                    .eq('id', change.campaign_id)
            } else if (change.change_type === 'gallery_add' && change.proposed_url) {
                const { data: details } = await adminSupabase
                    .from('campaign_details')
                    .select('id, gallery_images')
                    .eq('campaign_id', change.campaign_id)
                    .maybeSingle()
                const gallery: string[] = details?.gallery_images || []
                const merged = gallery.includes(change.proposed_url) ? gallery : [...gallery, change.proposed_url]

                if (details?.id) {
                    await adminSupabase
                        .from('campaign_details')
                        .update({ gallery_images: merged, updated_at: now })
                        .eq('campaign_id', change.campaign_id)
                } else {
                    await adminSupabase.from('campaign_details').insert({
                        campaign_id: change.campaign_id,
                        full_story: '',
                        gallery_images: merged,
                        support_documents: [],
                    })
                }
            } else if (change.change_type === 'gallery_remove' && change.previous_url) {
                const { data: details } = await adminSupabase
                    .from('campaign_details')
                    .select('gallery_images')
                    .eq('campaign_id', change.campaign_id)
                    .maybeSingle()
                const gallery: string[] = details?.gallery_images || []
                const filtered = gallery.filter((url) => url !== change.previous_url)

                await adminSupabase
                    .from('campaign_details')
                    .update({ gallery_images: filtered, updated_at: now })
                    .eq('campaign_id', change.campaign_id)

                await adminSupabase.from('campaign_media_archive').insert({
                    campaign_id: change.campaign_id,
                    url: change.previous_url,
                    kind: 'gallery',
                    reason: 'Eliminada de la galería (aprobado en moderación)',
                })
            }
        }

        // Marcar el cambio resuelto.
        await adminSupabase
            .from('campaign_media_changes')
            .update({
                status: action === 'approve' ? 'approved' : 'rejected',
                review_notes: reviewNotes,
                reviewed_by: adminCheck.userId,
                reviewed_at: now,
            })
            .eq('id', id)

        // Notificar al creador.
        const typeLabel =
            change.change_type === 'main_image' ? 'la portada'
                : change.change_type === 'gallery_add' ? 'una imagen de galería'
                    : 'la eliminación de una imagen'
        await adminSupabase.from('notifications').insert({
            user_id: change.requested_by,
            type: 'campaign_update',
            title: action === 'approve' ? 'Cambio de imagen aprobado' : 'Cambio de imagen rechazado',
            message: action === 'approve'
                ? `Se aprobó ${typeLabel} de tu campaña "${campaign?.title || ''}".`
                : `Se rechazó ${typeLabel} de tu campaña "${campaign?.title || ''}". Motivo: ${reviewNotes}`,
            link: `/creator/campaigns/${change.campaign_id}/edit`,
            campaign_id: change.campaign_id,
        })

        // Auditoría.
        try {
            await adminSupabase.from('audit_logs').insert({
                admin_id: adminCheck.userId,
                action: action === 'approve' ? 'approve_media_change' : 'reject_media_change',
                target_table: 'campaign_media_changes',
                target_id: id,
                changes: { change_type: change.change_type, status: action === 'approve' ? 'approved' : 'rejected' },
                reason: reviewNotes || 'Moderación de imagen',
            })
        } catch (logError) {
            console.warn('audit log failed:', logError)
        }

        return NextResponse.json({ ok: true, status: action === 'approve' ? 'approved' : 'rejected' })
    } catch (error: any) {
        console.error('Error moderating media change:', error)
        return NextResponse.json({ error: 'Error interno', details: error?.message }, { status: 500 })
    }
}
