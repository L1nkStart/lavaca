import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function assertAdmin() {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return { ok: false as const, status: 401, error: 'No autorizado' }
    const { data: actor } = await supabase.from('users').select('role').eq('id', user.id).single()
    if (actor?.role !== 'admin') return { ok: false as const, status: 403, error: 'Permisos insuficientes' }
    return { ok: true as const }
}

/**
 * GET /api/admin/donations?status=all|completed|failed|pending
 * Historial de donaciones de la plataforma (método normal, is_direct = false):
 * las que el admin aprueba/rechaza. Incluye los soportes de pago.
 */
export async function GET(request: NextRequest) {
    try {
        const adminCheck = await assertAdmin()
        if (!adminCheck.ok) return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status })

        const { searchParams } = new URL(request.url)
        const status = searchParams.get('status') || 'all'

        const adminSupabase = createAdminClient()
        let query = adminSupabase
            .from('donations')
            .select(`
                id, campaign_id, amount_usd, amount_bs, currency, payment_method, payment_status,
                reference_number, capture_url, donor_name, email, is_anonymous, is_direct,
                created_at, completed_at, approved_at, admin_notes,
                campaigns ( title, slug )
            `)
            .eq('is_direct', false)
            .order('created_at', { ascending: false })
            .limit(300)

        if (status !== 'all') {
            query = query.eq('payment_status', status)
        }

        const { data, error } = await query
        if (error) throw error

        const normalized = (data || []).map((d: any) => ({
            ...d,
            campaigns: Array.isArray(d.campaigns) ? d.campaigns[0] || null : d.campaigns,
        }))

        return NextResponse.json({ donations: normalized })
    } catch (error: any) {
        console.error('Error fetching admin donations history:', error)
        return NextResponse.json({ error: 'Error interno', details: error?.message }, { status: 500 })
    }
}
