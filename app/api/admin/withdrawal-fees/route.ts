import { NextRequest, NextResponse } from "next/server"
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

const VALID_ACCOUNT_TYPES = new Set(["bank_bs", "pagomovil", "zelle", "paypal", "crypto"])

/** GET /api/admin/withdrawal-fees — lista de fees de retiro por tipo de cuenta */
export async function GET() {
    try {
        const adminCheck = await assertAdmin()
        if (!adminCheck.ok) {
            return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status })
        }

        const adminSupabase = createAdminClient()
        const { data, error } = await adminSupabase
            .from("withdrawal_fee_configs")
            .select("account_type, currency, fee_percent, fee_fixed, is_active, updated_at")
            .order("currency", { ascending: true })
            .order("account_type", { ascending: true })

        if (error) throw error

        return NextResponse.json({ fees: data || [] })
    } catch (error: any) {
        console.error("Error fetching withdrawal fees:", error)
        return NextResponse.json(
            { error: "Error interno", details: error?.message || "Unknown error" },
            { status: 500 }
        )
    }
}

/** PATCH /api/admin/withdrawal-fees — actualiza el fee de un tipo de cuenta */
export async function PATCH(request: NextRequest) {
    try {
        const adminCheck = await assertAdmin()
        if (!adminCheck.ok) {
            return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status })
        }

        const body = await request.json()
        const accountType = body?.account_type as string | undefined

        if (!accountType || !VALID_ACCOUNT_TYPES.has(accountType)) {
            return NextResponse.json({ error: "Tipo de cuenta inválido" }, { status: 400 })
        }

        const updatePayload: Record<string, any> = {}

        if (body?.fee_percent !== undefined) {
            const feePercent = Number(body.fee_percent)
            if (!Number.isFinite(feePercent) || feePercent < 0 || feePercent > 100) {
                return NextResponse.json({ error: "fee_percent debe estar entre 0 y 100" }, { status: 400 })
            }
            updatePayload.fee_percent = feePercent
        }

        if (body?.fee_fixed !== undefined) {
            const feeFixed = Number(body.fee_fixed)
            if (!Number.isFinite(feeFixed) || feeFixed < 0) {
                return NextResponse.json({ error: "fee_fixed debe ser mayor o igual a 0" }, { status: 400 })
            }
            updatePayload.fee_fixed = feeFixed
        }

        if (body?.is_active !== undefined) {
            updatePayload.is_active = body.is_active === true
        }

        if (Object.keys(updatePayload).length === 0) {
            return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 })
        }

        const adminSupabase = createAdminClient()
        const { data, error } = await adminSupabase
            .from("withdrawal_fee_configs")
            .update(updatePayload)
            .eq("account_type", accountType)
            .select("account_type, currency, fee_percent, fee_fixed, is_active")
            .single()

        if (error) throw error

        return NextResponse.json({ success: true, fee: data })
    } catch (error: any) {
        console.error("Error updating withdrawal fee:", error)
        return NextResponse.json(
            { error: "Error interno", details: error?.message || "Unknown error" },
            { status: 500 }
        )
    }
}
