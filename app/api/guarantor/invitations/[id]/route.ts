import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * PATCH — Acepta o rechaza una invitación.
 *   Body: { action: 'accept' | 'reject', reason?: string }
 *
 * La aceptación llama al RPC `accept_guarantor_invitation`, que también
 * crea/promueve el registro de garante y la fila en campaign_guarantors.
 */
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        if (!id) {
            return NextResponse.json({ error: "ID obligatorio" }, { status: 400 });
        }

        const supabase = await createClient();
        const {
            data: { user },
            error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: "No autenticado" }, { status: 401 });
        }

        const body = await request.json();
        const action = body?.action;
        const reason = typeof body?.reason === "string" ? body.reason.trim() : null;

        if (action !== "accept" && action !== "reject") {
            return NextResponse.json({ error: "Acción inválida" }, { status: 400 });
        }

        if (action === "accept") {
            const { data, error } = await supabase.rpc("accept_guarantor_invitation", {
                p_invitation_id: id,
            });

            if (error) {
                return NextResponse.json(
                    { error: error.message || "No se pudo aceptar" },
                    { status: 400 }
                );
            }

            // Notificar al creador.
            const adminSupabase = createAdminClient();
            const { data: invitation } = await adminSupabase
                .from("guarantor_invitations")
                .select("invited_by, campaign_id")
                .eq("id", id)
                .single();

            if (invitation?.invited_by) {
                await adminSupabase.from("notifications").insert({
                    user_id: invitation.invited_by,
                    type: "system",
                    title: "Garante aceptó tu invitación",
                    message: "Un garante aceptó avalar tu campaña.",
                    link: `/campaigns/${invitation.campaign_id}`,
                    related_id: id,
                });
            }

            return NextResponse.json({ ok: true, campaign_guarantor_id: data });
        }

        // reject
        const { error } = await supabase.rpc("reject_guarantor_invitation", {
            p_invitation_id: id,
            p_reason: reason,
        });

        if (error) {
            return NextResponse.json(
                { error: error.message || "No se pudo rechazar" },
                { status: 400 }
            );
        }

        const adminSupabase = createAdminClient();
        const { data: invitation } = await adminSupabase
            .from("guarantor_invitations")
            .select("invited_by, campaign_id")
            .eq("id", id)
            .single();

        if (invitation?.invited_by) {
            await adminSupabase.from("notifications").insert({
                user_id: invitation.invited_by,
                type: "system",
                title: "Invitación de garante rechazada",
                message: reason
                    ? `El garante rechazó la invitación: ${reason}`
                    : "El garante rechazó la invitación.",
                link: `/campaigns/${invitation.campaign_id}`,
                related_id: id,
            });
        }

        return NextResponse.json({ ok: true });
    } catch (error: any) {
        console.error("guarantor invitations PATCH error:", error);
        return NextResponse.json(
            { error: "Error interno", details: error?.message || "Unknown error" },
            { status: 500 }
        );
    }
}

/**
 * DELETE — El creador cancela una invitación pendiente que envió.
 */
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        if (!id) {
            return NextResponse.json({ error: "ID obligatorio" }, { status: 400 });
        }

        const supabase = await createClient();
        const {
            data: { user },
            error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: "No autenticado" }, { status: 401 });
        }

        const adminSupabase = createAdminClient();

        const { data: invitation, error: fetchError } = await adminSupabase
            .from("guarantor_invitations")
            .select("invited_by, status")
            .eq("id", id)
            .single();

        if (fetchError || !invitation) {
            return NextResponse.json({ error: "Invitación no encontrada" }, { status: 404 });
        }

        const { data: actorProfile } = await supabase
            .from("users")
            .select("role")
            .eq("id", user.id)
            .single();

        if (invitation.invited_by !== user.id && actorProfile?.role !== "admin") {
            return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
        }

        if (invitation.status !== "pending") {
            return NextResponse.json(
                { error: "Solo se pueden cancelar invitaciones pendientes" },
                { status: 400 }
            );
        }

        const { error: updateError } = await adminSupabase
            .from("guarantor_invitations")
            .update({ status: "cancelled" })
            .eq("id", id);

        if (updateError) throw updateError;

        return NextResponse.json({ ok: true });
    } catch (error: any) {
        console.error("guarantor invitations DELETE error:", error);
        return NextResponse.json(
            { error: "Error interno", details: error?.message || "Unknown error" },
            { status: 500 }
        );
    }
}
