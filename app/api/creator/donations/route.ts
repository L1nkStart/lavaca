import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * GET /api/creator/donations?status=all|completed|pending|failed
 * Historial de donaciones recibidas en las campañas del creador (método normal
 * y pagos directos de crisis), con sus soportes de pago.
 */
export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

        const { searchParams } = new URL(request.url)
        const status = searchParams.get('status') || 'all'

        const adminSupabase = createAdminClient()

        const { data: campaigns } = await adminSupabase
            .from('campaigns')
            .select('id, title')
            .eq('creator_id', user.id)

        const campaignIds = (campaigns || []).map((c) => c.id)
        if (campaignIds.length === 0) return NextResponse.json({ donations: [] })

        const titleById = new Map((campaigns || []).map((c) => [c.id, c.title]))

        let query = adminSupabase
            .from('donations')
            .select(`
                id, campaign_id, amount_usd, amount_bs, currency, payment_method, payment_status,
                reference_number, capture_url, donor_name, email, is_anonymous, is_direct,
                created_at, completed_at
            `)
            .in('campaign_id', campaignIds)
            .order('created_at', { ascending: false })
            .limit(300)

        if (status !== 'all') {
            query = query.eq('payment_status', status)
        }

        const { data, error } = await query
        if (error) throw error

        const donations = (data || []).map((d: any) => ({ ...d, campaign_title: titleById.get(d.campaign_id) || 'Campaña' }))
        return NextResponse.json({ donations })
    } catch (error: any) {
        return NextResponse.json({ error: error?.message || 'Error interno' }, { status: 500 })
    }
}
