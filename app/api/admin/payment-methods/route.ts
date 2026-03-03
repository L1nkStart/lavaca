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

export async function GET() {
    try {
        const adminCheck = await assertAdmin();

        if (!adminCheck.ok) {
            return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status });
        }

        const adminSupabase = createAdminClient();

        const [methodsResult, accountsResult] = await Promise.all([
            adminSupabase
                .from("payment_method_configs")
                .select("code, name, description, is_active, display_order, settings, updated_at")
                .order("display_order", { ascending: true }),
            adminSupabase
                .from("payment_method_bank_accounts")
                .select("id, method_code, bank_name, account_holder, account_number, account_type, document_id, currency, instructions, is_active, display_order, updated_at")
                .order("display_order", { ascending: true }),
        ]);

        if (methodsResult.error) throw methodsResult.error;
        if (accountsResult.error) throw accountsResult.error;

        return NextResponse.json({
            methods: methodsResult.data || [],
            transferAccounts: (accountsResult.data || []).filter((account) => account.method_code === "transfer"),
        });
    } catch (error: any) {
        console.error("Error fetching admin payment methods:", error);
        return NextResponse.json(
            { error: "Error interno", details: error?.message || "Unknown error" },
            { status: 500 },
        );
    }
}
