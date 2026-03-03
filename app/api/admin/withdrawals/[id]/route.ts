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

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const adminCheck = await assertAdmin()

        if (!adminCheck.ok) {
            return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status })
        }

        const { id } = await params
        const body = await request.json()

        const status = body?.status as "processed" | "failed" | undefined
        const exchangeRateUsed = body?.exchange_rate_used
        const referenceNumber = body?.reference_number as string | null | undefined
        const rejectionReason = body?.rejection_reason as string | null | undefined

        if (!status || !["processed", "failed"].includes(status)) {
            return NextResponse.json({ error: "Estado inválido" }, { status: 400 })
        }

        if (status === "processed") {
            const parsedRate = Number(exchangeRateUsed)
            if (!referenceNumber?.trim()) {
                return NextResponse.json({ error: "reference_number es obligatorio para procesar" }, { status: 400 })
            }
            if (!exchangeRateUsed || Number.isNaN(parsedRate) || parsedRate <= 0) {
                return NextResponse.json({ error: "exchange_rate_used inválido" }, { status: 400 })
            }
        }

        if (status === "failed" && !rejectionReason?.trim()) {
            return NextResponse.json({ error: "rejection_reason es obligatorio para marcar como failed" }, { status: 400 })
        }

        const adminSupabase = createAdminClient()

        const updatePayload: Record<string, any> = {
            status,
        }

        if (status === "processed") {
            updatePayload.exchange_rate_used = Number(exchangeRateUsed)
            updatePayload.reference_number = referenceNumber?.trim() || null
            updatePayload.rejection_reason = null
            updatePayload.processed_at = new Date().toISOString()
        } else {
            updatePayload.rejection_reason = rejectionReason?.trim() || null
            updatePayload.processed_at = null
        }

        const { data, error } = await adminSupabase
            .from("withdrawal_requests")
            .update(updatePayload)
            .eq("id", id)
            .select("id, status")
            .single()

        if (error) throw error

        return NextResponse.json({ success: true, request: data })
    } catch (error: any) {
        console.error("Error updating withdrawal request:", error)
        return NextResponse.json(
            { error: "Error interno", details: error?.message || "Unknown error" },
            { status: 500 }
        )
    }
}
