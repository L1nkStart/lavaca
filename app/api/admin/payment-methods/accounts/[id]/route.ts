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

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const adminCheck = await assertAdmin();

        if (!adminCheck.ok) {
            return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status });
        }

        const { id } = await params;

        const body = await request.json();
        const payload: Record<string, any> = {};

        if (typeof body.bank_name === "string") payload.bank_name = body.bank_name.trim();
        if (typeof body.account_holder === "string") payload.account_holder = body.account_holder.trim();
        if (typeof body.account_number === "string") payload.account_number = body.account_number.trim();
        if (typeof body.account_type === "string") payload.account_type = body.account_type.trim();
        if (typeof body.document_id === "string") payload.document_id = body.document_id.trim();
        if (typeof body.currency === "string") payload.currency = body.currency.trim();
        if (typeof body.instructions === "string") payload.instructions = body.instructions.trim();
        if (typeof body.is_active === "boolean") payload.is_active = body.is_active;
        if (typeof body.display_order === "number") payload.display_order = body.display_order;

        if (Object.keys(payload).length === 0) {
            return NextResponse.json({ error: "No hay cambios para guardar" }, { status: 400 });
        }

        const adminSupabase = createAdminClient();

        const { data, error } = await adminSupabase
            .from("payment_method_bank_accounts")
            .update(payload)
            .eq("id", id)
            .select("id, method_code, bank_name, account_holder, account_number, account_type, document_id, currency, instructions, is_active, display_order, updated_at")
            .single();

        if (error) throw error;

        return NextResponse.json({ success: true, account: data });
    } catch (error: any) {
        console.error("Error updating transfer account:", error);
        return NextResponse.json(
            { error: "Error interno", details: error?.message || "Unknown error" },
            { status: 500 },
        );
    }
}

export async function DELETE(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const adminCheck = await assertAdmin();

        if (!adminCheck.ok) {
            return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status });
        }

        const { id } = await params;

        const adminSupabase = createAdminClient();

        const { error } = await adminSupabase
            .from("payment_method_bank_accounts")
            .delete()
            .eq("id", id);

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("Error deleting transfer account:", error);
        return NextResponse.json(
            { error: "Error interno", details: error?.message || "Unknown error" },
            { status: 500 },
        );
    }
}
