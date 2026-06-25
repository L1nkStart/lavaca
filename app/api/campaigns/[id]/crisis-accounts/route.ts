import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const ACCOUNT_TYPES = new Set(['pagomovil', 'zelle', 'transfer', 'crypto'])

async function ownsCampaign(id: string, userId: string) {
    const supabase = await createClient()
    const { data: campaign } = await supabase
        .from('campaigns')
        .select('id, creator_id, campaign_type')
        .eq('id', id)
        .maybeSingle()
    if (!campaign) return { error: 'Campaña no encontrada', status: 404 as const }
    if (campaign.creator_id !== userId) return { error: 'No tienes permisos sobre esta campaña', status: 403 as const }
    return { campaign }
}

/** GET — lista las cuentas de recepción de la campaña (incluye inactivas, para el creador) */
export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const supabase = await createClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

        const { id } = await params
        const owned = await ownsCampaign(id, user.id)
        if ('error' in owned) return NextResponse.json({ error: owned.error }, { status: owned.status })

        const adminSupabase = createAdminClient()
        const { data, error } = await adminSupabase
            .from('campaign_crisis_accounts')
            .select('*')
            .eq('campaign_id', id)
            .order('display_order', { ascending: true })
            .order('created_at', { ascending: true })

        if (error) throw error
        return NextResponse.json({ accounts: data || [] })
    } catch (error: any) {
        return NextResponse.json({ error: error?.message || 'Error interno' }, { status: 500 })
    }
}

/** POST — crea una cuenta de recepción */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const supabase = await createClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

        const { id } = await params
        const owned = await ownsCampaign(id, user.id)
        if ('error' in owned) return NextResponse.json({ error: owned.error }, { status: owned.status })

        const body = await request.json()
        const accountType = String(body?.account_type || '')
        const holder = String(body?.account_holder_name || '').trim()

        if (!ACCOUNT_TYPES.has(accountType)) {
            return NextResponse.json({ error: 'Tipo de cuenta inválido' }, { status: 400 })
        }
        if (holder.length < 2) {
            return NextResponse.json({ error: 'El nombre del titular es obligatorio' }, { status: 400 })
        }

        // Validaciones mínimas por tipo para no publicar datos incompletos.
        const phone = body?.phone_number ? String(body.phone_number).trim() : null
        const ci = body?.ci_number ? String(body.ci_number).trim() : null
        const bankName = body?.bank_name ? String(body.bank_name).trim() : null
        const email = body?.email ? String(body.email).trim() : null
        const accountNumber = body?.account_number ? String(body.account_number).trim() : null
        const wallet = body?.crypto_wallet_address ? String(body.crypto_wallet_address).trim() : null
        const network = body?.crypto_network ? String(body.crypto_network).trim() : null
        const instructions = body?.instructions ? String(body.instructions).trim() : null

        if (accountType === 'pagomovil' && (!phone || !ci || !bankName)) {
            return NextResponse.json({ error: 'PagoMóvil requiere teléfono, cédula y banco' }, { status: 400 })
        }
        if (accountType === 'zelle' && !email) {
            return NextResponse.json({ error: 'Zelle requiere el correo' }, { status: 400 })
        }
        if (accountType === 'transfer' && (!bankName || !accountNumber)) {
            return NextResponse.json({ error: 'La transferencia requiere banco y número de cuenta' }, { status: 400 })
        }
        if (accountType === 'crypto' && (!wallet || !network)) {
            return NextResponse.json({ error: 'Cripto requiere la wallet y la red' }, { status: 400 })
        }

        const adminSupabase = createAdminClient()
        const { data, error } = await adminSupabase
            .from('campaign_crisis_accounts')
            .insert({
                campaign_id: id,
                account_type: accountType,
                account_holder_name: holder,
                phone_number: phone,
                ci_number: ci,
                bank_name: bankName,
                email,
                account_number: accountNumber,
                crypto_wallet_address: wallet,
                crypto_network: network,
                instructions,
            })
            .select('*')
            .single()

        if (error) throw error
        return NextResponse.json({ ok: true, account: data })
    } catch (error: any) {
        return NextResponse.json({ error: error?.message || 'Error interno' }, { status: 500 })
    }
}
