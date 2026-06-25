import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function ownsCampaign(id: string, userId: string) {
    const supabase = await createClient()
    const { data: campaign } = await supabase
        .from('campaigns')
        .select('id, creator_id')
        .eq('id', id)
        .maybeSingle()
    if (!campaign) return { error: 'Campaña no encontrada', status: 404 as const }
    if (campaign.creator_id !== userId) return { error: 'No tienes permisos sobre esta campaña', status: 403 as const }
    return { campaign }
}

/** PATCH — activar/desactivar una cuenta de recepción */
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; accountId: string }> }
) {
    try {
        const supabase = await createClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

        const { id, accountId } = await params
        const owned = await ownsCampaign(id, user.id)
        if ('error' in owned) return NextResponse.json({ error: owned.error }, { status: owned.status })

        const body = await request.json()
        const adminSupabase = createAdminClient()
        const { data, error } = await adminSupabase
            .from('campaign_crisis_accounts')
            .update({ is_active: Boolean(body?.is_active), updated_at: new Date().toISOString() })
            .eq('id', accountId)
            .eq('campaign_id', id)
            .select('id, is_active')
            .single()

        if (error) throw error
        return NextResponse.json({ ok: true, account: data })
    } catch (error: any) {
        return NextResponse.json({ error: error?.message || 'Error interno' }, { status: 500 })
    }
}

/** DELETE — elimina una cuenta de recepción */
export async function DELETE(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string; accountId: string }> }
) {
    try {
        const supabase = await createClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

        const { id, accountId } = await params
        const owned = await ownsCampaign(id, user.id)
        if ('error' in owned) return NextResponse.json({ error: owned.error }, { status: owned.status })

        const adminSupabase = createAdminClient()
        const { error } = await adminSupabase
            .from('campaign_crisis_accounts')
            .delete()
            .eq('id', accountId)
            .eq('campaign_id', id)

        if (error) throw error
        return NextResponse.json({ ok: true })
    } catch (error: any) {
        return NextResponse.json({ error: error?.message || 'Error interno' }, { status: 500 })
    }
}
