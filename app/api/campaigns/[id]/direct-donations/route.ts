import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * GET /api/campaigns/[id]/direct-donations?status=pending|all
 * Lista las donaciones directas (modo crisis) de la campaña para que el
 * creador las confirme. Solo el creador dueño.
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const supabase = await createClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

        const { id } = await params
        const { data: campaign } = await supabase
            .from('campaigns')
            .select('id, creator_id')
            .eq('id', id)
            .maybeSingle()

        if (!campaign) return NextResponse.json({ error: 'Campaña no encontrada' }, { status: 404 })
        if (campaign.creator_id !== user.id) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

        const { searchParams } = new URL(request.url)
        const statusFilter = searchParams.get('status') || 'pending'

        const adminSupabase = createAdminClient()
        let query = adminSupabase
            .from('donations')
            .select('id, amount_usd, amount_bs, currency, payment_method, reference_number, capture_url, donor_name, email, is_anonymous, payment_status, created_at, confirmed_at, crisis_account_id')
            .eq('campaign_id', id)
            .eq('is_direct', true)
            .order('created_at', { ascending: false })

        if (statusFilter !== 'all') {
            query = query.eq('payment_status', statusFilter)
        }

        const { data, error } = await query
        if (error) throw error
        return NextResponse.json({ donations: data || [] })
    } catch (error: any) {
        return NextResponse.json({ error: error?.message || 'Error interno' }, { status: 500 })
    }
}
