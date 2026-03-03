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

        const [verificationsResult, campaignsResult, paymentsResult, withdrawalsResult] = await Promise.all([
            adminSupabase
                .from("verification_requests")
                .select("id", { count: "exact", head: true })
                .eq("status", "pending"),
            adminSupabase
                .from("campaigns")
                .select("id", { count: "exact", head: true })
                .in("status", ["pending_review", "draft"]),
            adminSupabase
                .from("donations")
                .select("id", { count: "exact", head: true })
                .eq("payment_status", "pending"),
            adminSupabase
                .from("withdrawal_requests")
                .select("id", { count: "exact", head: true })
                .eq("status", "pending"),
        ])

        return NextResponse.json({
            verifications: verificationsResult.count || 0,
            campaigns: campaignsResult.count || 0,
            payments: paymentsResult.count || 0,
            withdrawals: withdrawalsResult.count || 0,
        })
    } catch (error: any) {
        console.error("Error fetching admin sidebar badges:", error)
        return NextResponse.json(
            { error: "Error interno", details: error?.message || "Unknown error" },
            { status: 500 }
        )
    }
}
