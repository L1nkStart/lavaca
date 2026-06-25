import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function assertAdmin() {
    const supabase = await createClient();

    const {
        data: { user },
        error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
        return { ok: false as const, status: 401, error: "No autorizado" };
    }

    const { data: actorProfile, error: actorError } = await supabase
        .from("users")
        .select("role")
        .eq("id", user.id)
        .single();

    if (actorError || actorProfile?.role !== "admin") {
        return { ok: false as const, status: 403, error: "Permisos insuficientes" };
    }

    return { ok: true as const };
}

export async function GET() {
    try {
        const adminCheck = await assertAdmin();

        if (!adminCheck.ok) {
            return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status });
        }

        const adminSupabase = createAdminClient();

        const { data, error } = await adminSupabase
            .from("campaigns")
            .select(
                `
        id,
        title,
        slug,
        story,
        status,
        campaign_type,
        goal_amount_usd,
        current_amount_usd,
        main_image_url,
        created_at,
        updated_at,
        creator_id,
        reviewed_by,
        review_notes,
        reviewed_at,
        users!campaigns_creator_id_fkey (
          full_name,
          email
        ),
        categories (
          name
        )
      `,
            )
            .order("created_at", { ascending: false });

        if (error) {
            throw error;
        }

        const normalized = (data || []).map((campaign: any) => ({
            ...campaign,
            users: Array.isArray(campaign.users) ? campaign.users[0] : campaign.users,
            categories: Array.isArray(campaign.categories)
                ? campaign.categories
                : campaign.categories
                    ? [campaign.categories]
                    : [],
        }));

        return NextResponse.json({ campaigns: normalized });
    } catch (error: any) {
        console.error("Error fetching admin campaigns:", error);
        return NextResponse.json(
            { error: "Error interno", details: error?.message || "Unknown error" },
            { status: 500 },
        );
    }
}
