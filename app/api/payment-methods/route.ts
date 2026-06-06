import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
    try {
        const supabase = await createClient();

        const [methodsResult, accountsResult] = await Promise.all([
            supabase
                .from("payment_method_configs")
                .select("code, name, description, is_active, display_order, settings")
                .eq("is_active", true)
                .order("display_order", { ascending: true }),
            supabase
                .from("payment_method_bank_accounts")
                .select("id, method_code, bank_name, account_holder, account_number, account_type, document_id, currency, instructions, is_active, display_order")
                .eq("method_code", "transfer")
                .eq("is_active", true)
                .order("display_order", { ascending: true }),
        ]);

        if (methodsResult.error) throw methodsResult.error;
        if (accountsResult.error) throw accountsResult.error;

        return NextResponse.json({
            methods: methodsResult.data || [],
            transferAccounts: accountsResult.data || [],
        });
    } catch (error: any) {
        console.error("Error fetching public payment methods:", error);
        return NextResponse.json(
            { error: "Error interno", details: error?.message || "Unknown error" },
            { status: 500 },
        );
    }
}
