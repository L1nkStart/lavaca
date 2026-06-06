import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type Decision = "approved" | "rejected";

export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } },
) {
    try {
        const param = await params;
        const { id } = param;
        const body = await request.json();
        const decision = body?.decision as Decision;
        const rejectionReason =
            typeof body?.rejectionReason === "string" ? body.rejectionReason.trim() : "";

        if (decision !== "approved" && decision !== "rejected") {
            return NextResponse.json(
                { error: "Decisión inválida" },
                { status: 400 },
            );
        }

        if (decision === "rejected" && !rejectionReason) {
            return NextResponse.json(
                { error: "Debes indicar una razón de rechazo" },
                { status: 400 },
            );
        }

        const supabase = await createClient();
        const {
            data: { user },
            error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json(
                { error: "No autorizado" },
                { status: 401 },
            );
        }

        const { data: actorProfile, error: actorError } = await supabase
            .from("users")
            .select("role")
            .eq("id", user.id)
            .single();

        if (actorError || actorProfile?.role !== "admin") {
            return NextResponse.json(
                { error: "Permisos insuficientes" },
                { status: 403 },
            );
        }

        const { data: verification, error: verificationError } = await supabase
            .from("verification_requests")
            .select("id, user_id")
            .eq("id", id)
            .single();

        if (verificationError || !verification) {
            return NextResponse.json(
                { error: "Solicitud de verificación no encontrada" },
                { status: 404 },
            );
        }

        const adminSupabase = createAdminClient();

        const reviewedAt = new Date().toISOString();

        const { data: updatedRequest, error: requestUpdateError } = await adminSupabase
            .from("verification_requests")
            .update({
                status: decision,
                rejection_reason: decision === "rejected" ? rejectionReason : null,
                reviewed_by: user.id,
                reviewed_at: reviewedAt,
            })
            .eq("id", id)
            .select("id")
            .single();

        if (requestUpdateError || !updatedRequest) {
            throw requestUpdateError || new Error("No se pudo actualizar verification_requests con la llave de servicio");
        }

        const { data: updatedUser, error: userUpdateError } = await adminSupabase
            .from("users")
            .update({
                kyc_status: decision === "approved" ? "verified" : "rejected",
                kyc_rejected_reason: decision === "rejected" ? rejectionReason : null,
                updated_at: reviewedAt,
            })
            .eq("id", verification.user_id)
            .select("id")
            .single();

        if (userUpdateError || !updatedUser) {
            throw userUpdateError || new Error("No se pudo actualizar el usuario de KYC");
        }

        return NextResponse.json({
            success: true,
            decision,
            verificationId: id,
            userId: verification.user_id,
            kycStatus: decision === "approved" ? "verified" : "rejected",
        });
    } catch (error: any) {
        console.error("Error processing verification decision:", error);

        const message = error?.message || "Unknown error";
        const invalidKey =
            message.includes("Invalid API key") ||
            message.includes("SUPABASE_SERVICE_ROLE_KEY") ||
            message.includes("Missing Supabase admin environment variables");

        if (invalidKey) {
            return NextResponse.json(
                {
                    error: "Configuración inválida de Supabase Admin",
                    details:
                        "Revisa SUPABASE_SERVICE_ROLE_KEY en .env (no uses 'your-service-role-key') y reinicia el servidor.",
                },
                { status: 500 },
            );
        }

        return NextResponse.json(
            { error: "Error interno", details: message },
            { status: 500 },
        );
    }
}
