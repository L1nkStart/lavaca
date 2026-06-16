import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * POST /api/campaigns/[id]/media
 *
 * Gestiona los cambios de imágenes de una campaña con moderación
 * (shadow editing, ver PLAN-EDICION-CAMPANAS.md):
 *
 *   multipart/form-data:
 *     - file + changeType ('main_image' | 'gallery_add')  -> sube a Storage y
 *       crea un cambio PENDIENTE. NO toca la campaña en vivo.
 *
 *   application/json:
 *     - { action: 'set_cover', galleryUrl }  -> fija como portada una imagen
 *       que YA está en la galería (ya fue aprobada). Inmediato, sin moderación.
 *     - { action: 'gallery_remove', url }     -> crea un cambio PENDIENTE para
 *       quitar una imagen de la galería (un admin confirma para no borrar evidencia).
 *
 * GET devuelve los cambios pendientes de la campaña (para mostrar "en revisión").
 */

const MAX_IMAGE_BYTES = 5 * 1024 * 1024 // 5 MB
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const ALLOWED_EXT = new Set(['jpg', 'jpeg', 'png', 'webp'])
const MAX_GALLERY = 6

async function loadOwnedCampaign(id: string, userId: string) {
    const supabase = await createClient()
    const { data: campaign } = await supabase
        .from('campaigns')
        .select('id, creator_id, main_image_url')
        .eq('id', id)
        .maybeSingle()

    if (!campaign) return { error: 'Campaña no encontrada', status: 404 as const }
    if (campaign.creator_id !== userId) return { error: 'No tienes permisos para editar esta campaña', status: 403 as const }
    return { campaign }
}

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const supabase = await createClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
        }

        const { id } = await params
        const owned = await loadOwnedCampaign(id, user.id)
        if ('error' in owned) {
            return NextResponse.json({ error: owned.error }, { status: owned.status })
        }

        const { data: pending } = await supabase
            .from('campaign_media_changes')
            .select('id, change_type, proposed_url, previous_url, status, created_at')
            .eq('campaign_id', id)
            .eq('status', 'pending')
            .order('created_at', { ascending: false })

        return NextResponse.json({ pending: pending || [] })
    } catch (error: any) {
        return NextResponse.json({ error: error?.message || 'Error interno' }, { status: 500 })
    }
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const supabase = await createClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
        }

        const { id } = await params
        const owned = await loadOwnedCampaign(id, user.id)
        if ('error' in owned) {
            return NextResponse.json({ error: owned.error }, { status: owned.status })
        }
        const campaign = owned.campaign

        const adminSupabase = createAdminClient()
        const contentType = request.headers.get('content-type') || ''

        // ============ JSON: set_cover / gallery_remove ============
        if (contentType.includes('application/json')) {
            const body = await request.json()
            const action = body?.action as string

            const { data: details } = await adminSupabase
                .from('campaign_details')
                .select('id, gallery_images')
                .eq('campaign_id', id)
                .maybeSingle()
            const gallery: string[] = details?.gallery_images || []

            if (action === 'set_cover') {
                const galleryUrl = String(body?.galleryUrl || '')
                if (!gallery.includes(galleryUrl)) {
                    return NextResponse.json(
                        { error: 'Solo puedes fijar como portada una imagen que ya esté aprobada en tu galería.' },
                        { status: 400 }
                    )
                }
                // Archivar la portada anterior (auditoría) y fijar la nueva.
                if (campaign.main_image_url && campaign.main_image_url !== galleryUrl) {
                    await adminSupabase.from('campaign_media_archive').insert({
                        campaign_id: id,
                        url: campaign.main_image_url,
                        kind: 'main_image',
                        reason: 'Reemplazada por imagen de galería (set_cover)',
                    })
                }
                await adminSupabase
                    .from('campaigns')
                    .update({ main_image_url: galleryUrl, updated_at: new Date().toISOString() })
                    .eq('id', id)

                return NextResponse.json({ ok: true, action: 'set_cover', mainImageUrl: galleryUrl })
            }

            if (action === 'gallery_remove') {
                const url = String(body?.url || '')
                if (!gallery.includes(url)) {
                    return NextResponse.json({ error: 'Esa imagen no está en la galería.' }, { status: 400 })
                }
                // Cola de moderación: un admin confirma la eliminación.
                const { data: change, error: insertError } = await adminSupabase
                    .from('campaign_media_changes')
                    .insert({
                        campaign_id: id,
                        requested_by: user.id,
                        change_type: 'gallery_remove',
                        previous_url: url,
                        status: 'pending',
                    })
                    .select('id, change_type, previous_url, status, created_at')
                    .single()

                if (insertError) {
                    return NextResponse.json({ error: insertError.message }, { status: 400 })
                }
                return NextResponse.json({ ok: true, action: 'gallery_remove', change })
            }

            return NextResponse.json({ error: 'Acción no soportada' }, { status: 400 })
        }

        // ============ multipart: subir portada o imagen de galería ============
        const form = await request.formData()
        const file = form.get('file') as File | null
        const changeType = String(form.get('changeType') || '')

        if (!file) {
            return NextResponse.json({ error: 'No se recibió ningún archivo' }, { status: 400 })
        }
        if (changeType !== 'main_image' && changeType !== 'gallery_add') {
            return NextResponse.json({ error: 'Tipo de cambio inválido' }, { status: 400 })
        }

        // Validaciones técnicas.
        if (file.size > MAX_IMAGE_BYTES) {
            return NextResponse.json({ error: 'La imagen no puede superar 5 MB' }, { status: 400 })
        }
        const ext = (file.name.split('.').pop() || '').toLowerCase()
        if (!ALLOWED_TYPES.has(file.type) && !ALLOWED_EXT.has(ext)) {
            return NextResponse.json(
                { error: 'Formato no permitido. Usa JPG, PNG o WebP.' },
                { status: 400 }
            )
        }

        // Límite de galería: aprobadas + pendientes < 6.
        if (changeType === 'gallery_add') {
            const { data: details } = await adminSupabase
                .from('campaign_details')
                .select('gallery_images')
                .eq('campaign_id', id)
                .maybeSingle()
            const galleryCount = (details?.gallery_images || []).length

            const { count: pendingAdds } = await adminSupabase
                .from('campaign_media_changes')
                .select('id', { count: 'exact', head: true })
                .eq('campaign_id', id)
                .eq('change_type', 'gallery_add')
                .eq('status', 'pending')

            if (galleryCount + (pendingAdds || 0) >= MAX_GALLERY) {
                return NextResponse.json(
                    { error: `La galería admite máximo ${MAX_GALLERY} imágenes (incluyendo las que están en revisión).` },
                    { status: 400 }
                )
            }
        }

        // Subir a Storage en carpeta "pending" (no se muestra hasta aprobar).
        const safeExt = ALLOWED_EXT.has(ext) ? ext : 'jpg'
        const fileName = `pending/${id}/${changeType}_${Date.now()}_${Math.random().toString(36).slice(2)}.${safeExt}`
        const arrayBuffer = await file.arrayBuffer()

        const { error: uploadError } = await adminSupabase.storage
            .from('campaigns')
            .upload(fileName, arrayBuffer, {
                cacheControl: '3600',
                upsert: false,
                contentType: file.type || `image/${safeExt}`,
            })

        if (uploadError) {
            return NextResponse.json({ error: 'No se pudo subir la imagen', details: uploadError.message }, { status: 500 })
        }

        const { data: publicData } = adminSupabase.storage.from('campaigns').getPublicUrl(fileName)
        const proposedUrl = publicData.publicUrl

        const { data: change, error: insertError } = await adminSupabase
            .from('campaign_media_changes')
            .insert({
                campaign_id: id,
                requested_by: user.id,
                change_type: changeType,
                proposed_url: proposedUrl,
                previous_url: changeType === 'main_image' ? campaign.main_image_url : null,
                status: 'pending',
            })
            .select('id, change_type, proposed_url, previous_url, status, created_at')
            .single()

        if (insertError) {
            return NextResponse.json({ error: insertError.message }, { status: 400 })
        }

        return NextResponse.json({ ok: true, change })
    } catch (error: any) {
        return NextResponse.json({ error: error?.message || 'Error interno' }, { status: 500 })
    }
}
