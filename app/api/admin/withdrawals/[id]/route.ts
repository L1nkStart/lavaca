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

        const adminSupabase = createAdminClient()

        // Cargamos la solicitud para conocer su moneda y proteger transiciones
        const { data: withdrawal, error: withdrawalError } = await adminSupabase
            .from("withdrawal_requests")
            .select("id, status, currency, amount_bs, amount_usd, campaign_id")
            .eq("id", id)
            .maybeSingle()

        if (withdrawalError || !withdrawal) {
            return NextResponse.json({ error: "Solicitud de retiro no encontrada" }, { status: 404 })
        }

        if (withdrawal.status !== "pending") {
            return NextResponse.json(
                { error: `La solicitud ya fue resuelta (estado actual: ${withdrawal.status})` },
                { status: 400 }
            )
        }

        const isBsWithdrawal = withdrawal.currency === "BS"

        if (status === "processed") {
            const parsedRate = Number(exchangeRateUsed)
            if (!referenceNumber?.trim()) {
                return NextResponse.json({ error: "reference_number es obligatorio para procesar" }, { status: 400 })
            }
            // La tasa solo es obligatoria para retiros en bolívares: con ella
            // se congela la pérdida cambiaria de ese retiro.
            if (isBsWithdrawal && (!exchangeRateUsed || Number.isNaN(parsedRate) || parsedRate <= 0)) {
                return NextResponse.json({ error: "exchange_rate_used es obligatorio para retiros en bolívares" }, { status: 400 })
            }
        }

        if (status === "failed" && !rejectionReason?.trim()) {
            return NextResponse.json({ error: "rejection_reason es obligatorio para marcar como failed" }, { status: 400 })
        }

        const updatePayload: Record<string, any> = {
            status,
        }

        if (status === "processed") {
            const parsedRate = Number(exchangeRateUsed)
            updatePayload.exchange_rate_used = Number.isFinite(parsedRate) && parsedRate > 0 ? parsedRate : null
            updatePayload.reference_number = referenceNumber?.trim() || null
            updatePayload.rejection_reason = null
            updatePayload.processed_at = new Date().toISOString()

            // Retiro BS: congelar valor indexado y pérdida cambiaria AHORA.
            //   indexed_usd_value = monto_bs / tasa_promedio_entrada
            //   fx_loss_usd       = indexed_usd_value - (monto_bs / tasa_del_retiro)
            // Se guardan en la fila y nunca se recalculan (decisión del plan).
            if (isBsWithdrawal && withdrawal.campaign_id && Number(withdrawal.amount_bs) > 0) {
                const { data: bsDonations } = await adminSupabase
                    .from("donations")
                    .select("amount_bs, amount_usd")
                    .eq("campaign_id", withdrawal.campaign_id)
                    .eq("payment_status", "completed")
                    .eq("currency", "BS")
                    .not("amount_bs", "is", null)

                let sumBs = 0
                let sumUsd = 0
                for (const donation of bsDonations || []) {
                    sumBs += Number(donation.amount_bs || 0)
                    sumUsd += Number(donation.amount_usd || 0)
                }

                const avgEntryRate = sumUsd > 0 ? sumBs / sumUsd : 0
                const amountBs = Number(withdrawal.amount_bs)

                if (avgEntryRate > 0 && parsedRate > 0) {
                    const indexedUsd = amountBs / avgEntryRate
                    const fxLoss = indexedUsd - amountBs / parsedRate
                    updatePayload.indexed_usd_value = Math.round(indexedUsd * 100) / 100
                    updatePayload.fx_loss_usd = Math.round(fxLoss * 100) / 100
                    // amount_usd indicativo se actualiza al valor real del retiro
                    updatePayload.amount_usd = Math.round((amountBs / parsedRate) * 100) / 100
                }
            }
        } else {
            updatePayload.rejection_reason = rejectionReason?.trim() || null
            updatePayload.processed_at = null
        }

        const { data, error } = await adminSupabase
            .from("withdrawal_requests")
            .update(updatePayload)
            .eq("id", id)
            .select("id, status, currency, fx_loss_usd, indexed_usd_value")
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
