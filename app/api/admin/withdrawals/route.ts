import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

async function assertAdmin() {
    const supabase = await createClient()

    const {
        data: { user },
        error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
        return { ok: false as const, status: 401, error: "No autorizado" }
    }

    const { data: actorProfile, error: actorError } = await supabase
        .from("users")
        .select("role")
        .eq("id", user.id)
        .single()

    if (actorError || actorProfile?.role !== "admin") {
        return { ok: false as const, status: 403, error: "Permisos insuficientes" }
    }

    return { ok: true as const }
}

export async function GET() {
    try {
        const adminCheck = await assertAdmin()

        if (!adminCheck.ok) {
            return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status })
        }

        const adminSupabase = createAdminClient()

        const { data, error } = await adminSupabase
            .from("withdrawal_requests")
            .select(`
        id,
        creator_id,
        campaign_id,
        account_id,
        amount_usd,
        amount_bs,
        currency,
        platform_fee,
        gateway_fee,
        net_amount,
        indexed_usd_value,
        fx_loss_usd,
        status,
        exchange_rate_used,
        reference_number,
        rejection_reason,
        created_at,
        processed_at,
        campaigns (
          title
        ),
        users:creator_id (
          full_name,
          email
        ),
        withdrawal_accounts (
          account_type,
          account_holder_name
        )
      `)
            .order("created_at", { ascending: false })

        if (error) throw error

        const normalized = (data || []).map((item: any) => ({
            ...item,
            campaigns: Array.isArray(item.campaigns) ? item.campaigns[0] || null : item.campaigns,
            users: Array.isArray(item.users) ? item.users[0] || null : item.users,
            withdrawal_accounts: Array.isArray(item.withdrawal_accounts)
                ? item.withdrawal_accounts[0] || null
                : item.withdrawal_accounts,
        }))

        return NextResponse.json({ requests: normalized })
    } catch (error: any) {
        console.error("Error fetching admin withdrawals:", error)
        return NextResponse.json(
            { error: "Error interno", details: error?.message || "Unknown error" },
            { status: 500 }
        )
    }
}
