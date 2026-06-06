import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET — Lista invitaciones para el usuario autenticado.
 *   - Si `?as=invitee` (default): invitaciones recibidas a su email.
 *   - Si `?as=owner`: invitaciones que él emitió (como creador de la campaña).
 */
export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient();
        const {
            data: { user },
            error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: "No autenticado" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const as = searchParams.get("as") || "invitee";

        const adminSupabase = createAdminClient();
        let query = adminSupabase
            .from("guarantor_invitations")
            .select(
                `id, campaign_id, invited_by, invited_email, invited_name, message,
                 status, rejection_reason, expires_at, created_at, responded_at,
                 campaigns:campaigns!guarantor_invitations_campaign_id_fkey (
                   id, title, slug, main_image_url, goal_amount_usd, current_amount_usd
                 ),
                 inviter:users!guarantor_invitations_invited_by_fkey (
                   id, full_name, email
                 )`
            )
            .order("created_at", { ascending: false });

        if (as === "owner") {
            query = query.eq("invited_by", user.id);
        } else {
            const email = (user.email || "").toLowerCase().trim();
            if (!email) {
                return NextResponse.json({ invitations: [] });
            }
            query = query.ilike("invited_email", email);
        }

        const { data, error } = await query;

        if (error) {
            console.error("Error listing invitations:", error);
            throw error;
        }

        return NextResponse.json({ invitations: data || [] });
    } catch (error: any) {
        console.error("guarantor invitations GET error:", error);
        return NextResponse.json(
            { error: "Error interno", details: error?.message || "Unknown error" },
            { status: 500 }
        );
    }
}

/**
 * POST — Crear invitación. Solo el creador (o admin) de la campaña puede.
 *   Body: { campaign_id, invited_email, invited_name?, message? }
 */
export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();
        const {
            data: { user },
            error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: "No autenticado" }, { status: 401 });
        }

        const body = await request.json();
        const campaignId = typeof body?.campaign_id === "string" ? body.campaign_id : "";
        const invitedEmailRaw = typeof body?.invited_email === "string" ? body.invited_email : "";
        const invitedEmail = invitedEmailRaw.trim().toLowerCase();
        const invitedName = typeof body?.invited_name === "string" ? body.invited_name.trim() : null;
        const message = typeof body?.message === "string" ? body.message.trim() : null;

        if (!campaignId) {
            return NextResponse.json({ error: "campaign_id es obligatorio" }, { status: 400 });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!invitedEmail || !emailRegex.test(invitedEmail)) {
            return NextResponse.json({ error: "Email inválido" }, { status: 400 });
        }

        if (invitedEmail === (user.email || "").toLowerCase().trim()) {
            return NextResponse.json(
                { error: "No puedes invitarte a ti mismo" },
                { status: 400 }
            );
        }

        // Verificar que el caller sea owner o admin
        const { data: campaign, error: campaignError } = await supabase
            .from("campaigns")
            .select("id, creator_id")
            .eq("id", campaignId)
            .single();

        if (campaignError || !campaign) {
            return NextResponse.json({ error: "Campaña no encontrada" }, { status: 404 });
        }

        const { data: actorProfile } = await supabase
            .from("users")
            .select("role")
            .eq("id", user.id)
            .single();

        const isOwner = campaign.creator_id === user.id;
        const isAdmin = actorProfile?.role === "admin";

        if (!isOwner && !isAdmin) {
            return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
        }

        const adminSupabase = createAdminClient();

        // Evitar duplicados pendientes
        const { data: existing } = await adminSupabase
            .from("guarantor_invitations")
            .select("id")
            .eq("campaign_id", campaignId)
            .ilike("invited_email", invitedEmail)
            .eq("status", "pending")
            .maybeSingle();

        if (existing) {
            return NextResponse.json(
                { error: "Ya existe una invitación pendiente para ese correo" },
                { status: 409 }
            );
        }

        const { data: invitation, error: insertError } = await adminSupabase
            .from("guarantor_invitations")
            .insert({
                campaign_id: campaignId,
                invited_by: user.id,
                invited_email: invitedEmail,
                invited_name: invitedName,
                message,
            })
            .select()
            .single();

        if (insertError) throw insertError;

        // Crear notificación in-app si el invitado ya tiene cuenta.
        const { data: invitee } = await adminSupabase
            .from("users")
            .select("id")
            .ilike("email", invitedEmail)
            .maybeSingle();

        if (invitee?.id) {
            await adminSupabase.from("notifications").insert({
                user_id: invitee.id,
                type: "system",
                title: "Te invitaron a ser garante",
                message: `Tienes una nueva invitación para avalar una campaña en LaVaca.`,
                link: "/guarantor/dashboard",
                related_id: invitation.id,
            });
        }

        return NextResponse.json({ invitation });
    } catch (error: any) {
        console.error("guarantor invitations POST error:", error);
        return NextResponse.json(
            { error: "Error interno", details: error?.message || "Unknown error" },
            { status: 500 }
        );
    }
}
