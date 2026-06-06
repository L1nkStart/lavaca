import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const ALLOWED_METHOD_CODES = new Set(["card", "crypto", "zelle", "pagomovil", "transfer"]);

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
    { params }: { params: Promise<{ code: string }> },
) {
    try {
        const adminCheck = await assertAdmin();

        if (!adminCheck.ok) {
            return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status });
        }

        const { code } = await params;
        if (!ALLOWED_METHOD_CODES.has(code)) {
            return NextResponse.json({ error: "Método inválido" }, { status: 400 });
        }

        const body = await request.json();

        const payload: Record<string, any> = {
            updated_by: adminCheck.userId,
        };

        if (typeof body.name === "string") payload.name = body.name.trim();
        if (typeof body.description === "string") payload.description = body.description.trim();
        if (typeof body.is_active === "boolean") payload.is_active = body.is_active;
        if (typeof body.display_order === "number") payload.display_order = body.display_order;
        if (body.settings && typeof body.settings === "object") payload.settings = body.settings;

        if (Object.keys(payload).length === 1) {
            return NextResponse.json({ error: "No hay cambios para guardar" }, { status: 400 });
        }

        const adminSupabase = createAdminClient();

        const { data, error } = await adminSupabase
            .from("payment_method_configs")
            .update(payload)
            .eq("code", code)
            .select("code, name, description, is_active, display_order, settings, updated_at")
            .single();

        if (error) throw error;

        return NextResponse.json({ success: true, method: data });
    } catch (error: any) {
        console.error("Error updating payment method:", error);
        return NextResponse.json(
            { error: "Error interno", details: error?.message || "Unknown error" },
            { status: 500 },
        );
    }
}
