import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/admin/payments/[id]
 *   Body: { action: 'approve' | 'reject', reason?: string, adminNotes?: string }
 *
 * Aprueba o rechaza un pago manual. Usa el service-role para esquivar RLS
 * (que estaba bloqueando silenciosamente el UPDATE cuando se intentaba desde
 * el cliente: Supabase no devuelve error, sólo actualiza 0 filas).
 *
 * La acreditación a la campaña la hace el trigger `update_campaign_amount_on_donation`
 * (definido en dumps/14-fix-donations-display.sql) cuando payment_status pasa a
 * 'completed'. Las notificaciones también se generan por trigger.
 */
async function assertAdmin() {
    const supabase = await createClient();
    const {
        data: { user },
        error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
        return { ok: false as const, status: 401, error: "No autenticado" };
    }

    const { data: actor } = await supabase
        .from("users")
        .select("role")
        .eq("id", user.id)
        .single();

    if (actor?.role !== "admin") {
        return { ok: false as const, status: 403, error: "Permisos insuficientes" };
    }

    return { ok: true as const, userId: user.id };
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const { id } = await params;
        if (!id) {
            return NextResponse.json({ error: "ID requerido" }, { status: 400 });
        }

        const adminCheck = await assertAdmin();
        if (!adminCheck.ok) {
            return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status });
        }

        const body = await request.json();
        const action = body?.action as "approve" | "reject" | undefined;
        const reason = typeof body?.reason === "string" ? body.reason.trim() : null;
        const adminNotes = typeof body?.adminNotes === "string" ? body.adminNotes.trim() : null;

        if (action !== "approve" && action !== "reject") {
            return NextResponse.json({ error: "Acción inválida" }, { status: 400 });
        }

        const adminSupabase = createAdminClient();

        // Buscar el donation antes de tocarlo (para idempotencia + auditoría).
        const { data: donation, error: fetchError } = await adminSupabase
            .from("donations")
            .select("id, payment_status, campaign_id, amount_usd, donor_id, email")
            .eq("id", id)
            .single();

        if (fetchError || !donation) {
            return NextResponse.json({ error: "Donación no encontrada" }, { status: 404 });
        }

        // Idempotencia: si ya está completado o fallado, no rompemos nada.
        if (action === "approve" && donation.payment_status === "completed") {
            return NextResponse.json({
                ok: true,
                already: true,
                donation: { id: donation.id, payment_status: "completed" },
            });
        }
        if (action === "reject" && donation.payment_status === "failed") {
            return NextResponse.json({
                ok: true,
                already: true,
                donation: { id: donation.id, payment_status: "failed" },
            });
        }

        // No permitir cambiar un pago ya completado a rechazado (eso requiere reembolso, no este endpoint).
        if (action === "reject" && donation.payment_status === "completed") {
            return NextResponse.json(
                {
                    error:
                        "No se puede rechazar un pago ya acreditado. Procesa un reembolso desde la pasarela.",
                },
                { status: 409 },
            );
        }

        if (action === "approve") {
            const now = new Date().toISOString();
            const { data: updated, error: updateError } = await adminSupabase
                .from("donations")
                .update({
                    payment_status: "completed",
                    completed_at: now,
                    approved_at: now,
                    // El admin puede dejar notas opcionales al aprobar; limpiamos
                    // el "pendiente de verificación manual" anterior.
                    admin_notes: adminNotes || null,
                })
                .eq("id", id)
                .neq("payment_status", "completed")
                .select("id, payment_status, amount_usd, campaign_id")
                .single();

            if (updateError) {
                console.error("[admin/payments approve] update error:", updateError);
                return NextResponse.json(
                    { error: "No se pudo aprobar", details: updateError.message },
                    { status: 500 },
                );
            }

            // Audit log (best-effort).
            try {
                await adminSupabase.from("audit_logs").insert({
                    admin_id: adminCheck.userId,
                    action: "approve_manual_payment",
                    target_table: "donations",
                    target_id: id,
                    changes: { payment_status: "completed", approved_at: now },
                    reason: adminNotes || "Aprobación manual de pago",
                });
            } catch (logError) {
                console.warn("[admin/payments approve] audit log failed:", logError);
            }

            return NextResponse.json({ ok: true, donation: updated });
        }

        // action === "reject"
        const rejectionReason = reason || adminNotes || "Pago rechazado por el administrador";

        const { data: updated, error: updateError } = await adminSupabase
            .from("donations")
            .update({
                payment_status: "failed",
                admin_notes: rejectionReason,
            })
            .eq("id", id)
            .neq("payment_status", "completed")
            .select("id, payment_status, amount_usd, campaign_id")
            .single();

        if (updateError) {
            console.error("[admin/payments reject] update error:", updateError);
            return NextResponse.json(
                { error: "No se pudo rechazar", details: updateError.message },
                { status: 500 },
            );
        }

        try {
            await adminSupabase.from("audit_logs").insert({
                admin_id: adminCheck.userId,
                action: "reject_manual_payment",
                target_table: "donations",
                target_id: id,
                changes: { payment_status: "failed" },
                reason: rejectionReason,
            });
        } catch (logError) {
            console.warn("[admin/payments reject] audit log failed:", logError);
        }

        return NextResponse.json({ ok: true, donation: updated });
    } catch (error: any) {
        console.error("admin/payments [id] error:", error);
        return NextResponse.json(
            { error: "Error interno", details: error?.message || "Unknown" },
            { status: 500 },
        );
    }
}
