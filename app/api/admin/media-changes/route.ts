import { NextResponse } from 'next/server'
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

/** GET /api/admin/media-changes — cambios de imagen pendientes de moderación */
export async function GET() {
    try {
        const adminCheck = await assertAdmin()
        if (!adminCheck.ok) {
            return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status })
        }

        const adminSupabase = createAdminClient()
        const { data, error } = await adminSupabase
            .from('campaign_media_changes')
            .select(`
                id,
                campaign_id,
                requested_by,
                change_type,
                proposed_url,
                previous_url,
                status,
                created_at,
                campaigns ( title, slug, main_image_url ),
                users:requested_by ( full_name, email )
            `)
            .eq('status', 'pending')
            .order('created_at', { ascending: false })

        if (error) throw error

        const normalized = (data || []).map((item: any) => ({
            ...item,
            campaigns: Array.isArray(item.campaigns) ? item.campaigns[0] || null : item.campaigns,
            users: Array.isArray(item.users) ? item.users[0] || null : item.users,
        }))

        return NextResponse.json({ changes: normalized })
    } catch (error: any) {
        console.error('Error fetching media changes:', error)
        return NextResponse.json(
            { error: 'Error interno', details: error?.message || 'Unknown error' },
            { status: 500 }
        )
    }
}
