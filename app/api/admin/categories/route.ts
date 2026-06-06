import { NextRequest, NextResponse } from "next/server";
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

    const { data: actorProfile } = await supabase
        .from("users")
        .select("role")
        .eq("id", user.id)
        .single();

    if (actorProfile?.role !== "admin") {
        return { ok: false as const, status: 403, error: "Permisos insuficientes" };
    }

    return { ok: true as const, userId: user.id };
}

export async function GET() {
    try {
        const adminCheck = await assertAdmin();
        if (!adminCheck.ok) {
            return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status });
        }

        const adminSupabase = createAdminClient();
        const { data, error } = await adminSupabase
            .from("categories")
            .select("id, name, description, icon_emoji, order_index, created_at")
            .order("order_index", { ascending: true, nullsFirst: false });

        if (error) throw error;

        return NextResponse.json({ categories: data || [] });
    } catch (error: any) {
        console.error("Error listing categories:", error);
        return NextResponse.json(
            { error: "Error interno", details: error?.message || "Unknown error" },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const adminCheck = await assertAdmin();
        if (!adminCheck.ok) {
            return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status });
        }

        const body = await request.json();
        const name = typeof body?.name === "string" ? body.name.trim() : "";

        if (!name) {
            return NextResponse.json({ error: "El nombre es obligatorio" }, { status: 400 });
        }

        const adminSupabase = createAdminClient();
        const { data, error } = await adminSupabase
            .from("categories")
            .insert({
                name,
                description: typeof body?.description === "string" ? body.description.trim() : null,
                icon_emoji: typeof body?.icon_emoji === "string" ? body.icon_emoji.trim() || null : null,
                order_index: Number.isFinite(Number(body?.order_index))
                    ? Number(body.order_index)
                    : null,
            })
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ category: data });
    } catch (error: any) {
        console.error("Error creating category:", error);
        return NextResponse.json(
            { error: "Error interno", details: error?.message || "Unknown error" },
            { status: 500 }
        );
    }
}

export async function PATCH(request: NextRequest) {
    try {
        const adminCheck = await assertAdmin();
        if (!adminCheck.ok) {
            return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status });
        }

        const body = await request.json();
        const id = typeof body?.id === "string" ? body.id : "";

        if (!id) {
            return NextResponse.json({ error: "ID obligatorio" }, { status: 400 });
        }

        const updates: Record<string, unknown> = {};
        if (typeof body?.name === "string") updates.name = body.name.trim();
        if (typeof body?.description === "string") updates.description = body.description.trim();
        if (typeof body?.icon_emoji === "string") updates.icon_emoji = body.icon_emoji.trim() || null;
        if (Number.isFinite(Number(body?.order_index))) updates.order_index = Number(body.order_index);

        if (Object.keys(updates).length === 0) {
            return NextResponse.json({ error: "Sin cambios" }, { status: 400 });
        }

        const adminSupabase = createAdminClient();
        const { data, error } = await adminSupabase
            .from("categories")
            .update(updates)
            .eq("id", id)
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ category: data });
    } catch (error: any) {
        console.error("Error updating category:", error);
        return NextResponse.json(
            { error: "Error interno", details: error?.message || "Unknown error" },
            { status: 500 }
        );
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const adminCheck = await assertAdmin();
        if (!adminCheck.ok) {
            return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status });
        }

        const { searchParams } = new URL(request.url);
        const id = searchParams.get("id");

        if (!id) {
            return NextResponse.json({ error: "ID obligatorio" }, { status: 400 });
        }

        const adminSupabase = createAdminClient();

        const { count } = await adminSupabase
            .from("campaigns")
            .select("id", { count: "exact", head: true })
            .eq("category_id", id);

        if ((count || 0) > 0) {
            return NextResponse.json(
                { error: `No se puede eliminar: hay ${count} campañas usando esta categoría` },
                { status: 409 }
            );
        }

        const { error } = await adminSupabase
            .from("categories")
            .delete()
            .eq("id", id);

        if (error) throw error;

        return NextResponse.json({ ok: true });
    } catch (error: any) {
        console.error("Error deleting category:", error);
        return NextResponse.json(
            { error: "Error interno", details: error?.message || "Unknown error" },
            { status: 500 }
        );
    }
}
