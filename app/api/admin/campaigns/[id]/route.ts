import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const ALLOWED_STATUSES = new Set([
    "draft",
    "pending_review",
    "active",
    "completed",
    "closed",
    "rejected",
]);

async function assertAdmin() {
    const supabase = await createClient();

    const {
        data: { user },
        error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
        return { ok: false as const, status: 401, error: "No autorizado", userId: null as string | null };
    }

    const { data: actorProfile, error: actorError } = await supabase
        .from("users")
        .select("role")
        .eq("id", user.id)
        .single();

    if (actorError || actorProfile?.role !== "admin") {
        return { ok: false as const, status: 403, error: "Permisos insuficientes", userId: null as string | null };
    }

    return { ok: true as const, userId: user.id };
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: { id: string } },
) {
    try {
        const adminCheck = await assertAdmin();

        if (!adminCheck.ok) {
            return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status });
        }

        const { id } = params;
        const body = await request.json();
        const newStatus = body?.status as string | undefined;
        const newCampaignType = body?.campaign_type as string | undefined;
        const reviewNotes = typeof body?.reviewNotes === "string" ? body.reviewNotes.trim() : "";

        const adminSupabase = createAdminClient();

        // Cambio de tipo Normal <-> Crisis (independiente del cambio de estado).
        if (newCampaignType !== undefined) {
            if (newCampaignType !== "normal" && newCampaignType !== "crisis") {
                return NextResponse.json({ error: "Tipo de campaña inválido" }, { status: 400 });
            }
            const { data: updated, error: typeError } = await adminSupabase
                .from("campaigns")
                .update({ campaign_type: newCampaignType, updated_at: new Date().toISOString() })
                .eq("id", id)
                .select("id, campaign_type")
                .single();

            if (typeError || !updated) {
                return NextResponse.json({ error: "No se pudo cambiar el tipo de campaña" }, { status: 500 });
            }
            return NextResponse.json({ success: true, campaign: updated });
        }

        if (!newStatus || !ALLOWED_STATUSES.has(newStatus)) {
            return NextResponse.json({ error: "Estado inválido" }, { status: 400 });
        }

        const { data: existingCampaign, error: existingError } = await adminSupabase
            .from("campaigns")
            .select("id, creator_id, status")
            .eq("id", id)
            .single();

        if (existingError || !existingCampaign) {
            return NextResponse.json({ error: "Campaña no encontrada" }, { status: 404 });
        }

        const requiresReviewNotes =
            existingCampaign.status === "pending_review" && ["active", "rejected", "completed", "closed"].includes(newStatus);

        if (requiresReviewNotes && !reviewNotes) {
            return NextResponse.json(
                { error: "Debes agregar notas de revisión para esta transición de estado" },
                { status: 400 },
            );
        }

        const now = new Date().toISOString();
        const updatePayload: Record<string, any> = {
            status: newStatus,
            updated_at: now,
        };

        if (requiresReviewNotes) {
            updatePayload.reviewed_by = adminCheck.userId;
            updatePayload.review_notes = reviewNotes;
            updatePayload.reviewed_at = now;
        }

        const { data: updatedCampaign, error: updateError } = await adminSupabase
            .from("campaigns")
            .update(updatePayload)
            .eq("id", id)
            .select("id, creator_id, status")
            .single();

        if (updateError || !updatedCampaign) {
            throw updateError || new Error("No se pudo actualizar la campaña");
        }

        if (requiresReviewNotes) {
            const notificationType = newStatus === "active" ? "campaign_approved" : "campaign_rejected";
            const notificationTitle = newStatus === "active" ? "Campaña aprobada" : "Campaña no aprobada";
            const notificationMessage =
                newStatus === "active"
                    ? "Tu campaña fue aprobada y ya puede recibir donaciones."
                    : "Tu campaña requiere ajustes. Revisa las observaciones del equipo de seguridad.";

            await adminSupabase.from("notifications").insert({
                user_id: existingCampaign.creator_id,
                type: notificationType,
                title: notificationTitle,
                message: notificationMessage,
                link: "/creator/campaigns",
                data: {
                    campaign_id: id,
                    review_notes: reviewNotes,
                    reviewed_by: adminCheck.userId,
                },
            });
        }

        return NextResponse.json({ success: true, campaign: updatedCampaign });
    } catch (error: any) {
        console.error("Error updating campaign from admin API:", error);
        return NextResponse.json(
            { error: "Error interno", details: error?.message || "Unknown error" },
            { status: 500 },
        );
    }
}

export async function DELETE(
    _request: NextRequest,
    { params }: { params: { id: string } },
) {
    try {
        const adminCheck = await assertAdmin();

        if (!adminCheck.ok) {
            return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status });
        }

        const { id } = params;
        const adminSupabase = createAdminClient();

        const { data: campaign, error: campaignError } = await adminSupabase
            .from("campaigns")
            .select("id")
            .eq("id", id)
            .single();

        if (campaignError || !campaign) {
            return NextResponse.json({ error: "Campaña no encontrada" }, { status: 404 });
        }

        const { error: deleteError } = await adminSupabase
            .from("campaigns")
            .delete()
            .eq("id", id);

        if (deleteError) {
            const message = deleteError.message || "No se pudo eliminar la campaña";
            return NextResponse.json({ error: message }, { status: 400 });
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("Error deleting campaign from admin API:", error);
        return NextResponse.json(
            { error: "Error interno", details: error?.message || "Unknown error" },
            { status: 500 },
        );
    }
}
