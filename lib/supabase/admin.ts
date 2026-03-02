import { createClient } from "@supabase/supabase-js";

export function createAdminClient() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const rawServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const serviceRoleKey = rawServiceRoleKey?.trim().replace(/^['\"]|['\"]$/g, "");

    if (!supabaseUrl || !serviceRoleKey) {
        throw new Error("Missing Supabase admin environment variables");
    }

    if (serviceRoleKey === "your-service-role-key") {
        throw new Error("Invalid SUPABASE_SERVICE_ROLE_KEY: placeholder value detected");
    }

    return createClient(supabaseUrl, serviceRoleKey, {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
        },
    });
}
