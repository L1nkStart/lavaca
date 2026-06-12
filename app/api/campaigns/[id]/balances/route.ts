import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCampaignBalances } from '@/lib/balances'

/**
 * GET /api/campaigns/[id]/balances
 * Saldos multi-moneda de una campaña. Solo el creador o un admin pueden
 * leerlos (la autorización vive dentro del RPC get_campaign_balances).
 */
export async function GET(
    _request: NextRequest,
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

        const balances = await getCampaignBalances(supabase, id)

        if (!balances) {
            return NextResponse.json(
                { error: 'No se pudieron obtener los saldos de la campaña' },
                { status: 403 }
            )
        }

        return NextResponse.json({ balances })
    } catch (error: any) {
        return NextResponse.json(
            { error: error?.message || 'Error interno' },
            { status: 500 }
        )
    }
}
