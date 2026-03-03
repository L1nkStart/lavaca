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

export async function POST(request: NextRequest) {
    try {
        const adminCheck = await assertAdmin();

        if (!adminCheck.ok) {
            return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status });
        }

        const body = await request.json();
        const {
            bank_name,
            account_holder,
            account_number,
            account_type,
            document_id,
            currency,
            instructions,
            is_active,
            display_order,
        } = body;

        if (!bank_name || !account_holder || !account_number) {
            return NextResponse.json(
                { error: "Banco, titular y número de cuenta son obligatorios" },
                { status: 400 },
            );
        }

        const adminSupabase = createAdminClient();

        const { data, error } = await adminSupabase
            .from("payment_method_bank_accounts")
            .insert({
                method_code: "transfer",
                bank_name: String(bank_name).trim(),
                account_holder: String(account_holder).trim(),
                account_number: String(account_number).trim(),
                account_type: account_type ? String(account_type).trim() : null,
                document_id: document_id ? String(document_id).trim() : null,
                currency: currency ? String(currency).trim() : "BS",
                instructions: instructions ? String(instructions).trim() : null,
                is_active: typeof is_active === "boolean" ? is_active : true,
                display_order: typeof display_order === "number" ? display_order : 0,
            })
            .select("id, method_code, bank_name, account_holder, account_number, account_type, document_id, currency, instructions, is_active, display_order, updated_at")
            .single();

        if (error) throw error;

        return NextResponse.json({ success: true, account: data });
    } catch (error: any) {
        console.error("Error creating transfer account:", error);
        return NextResponse.json(
            { error: "Error interno", details: error?.message || "Unknown error" },
            { status: 500 },
        );
    }
}
