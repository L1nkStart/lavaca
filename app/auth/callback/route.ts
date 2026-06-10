import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { buildAbsoluteUrl } from "@/lib/url";

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const next = searchParams.get("redirectTo") ?? "/";

    if (code) {
        const supabase = await createClient();

        const { data, error } = await supabase.auth.exchangeCodeForSession(code);

        if (!error && data.user) {
            // Crear el perfil si no existe (típico flujo OAuth).
            const { data: existingProfile } = await supabase
                .from("users")
                .select("id")
                .eq("id", data.user.id)
                .maybeSingle();

            if (!existingProfile) {
                const { error: profileError } = await supabase
                    .from("users")
                    .upsert(
                        {
                            id: data.user.id,
                            email: data.user.email!,
                            full_name:
                                data.user.user_metadata?.full_name ||
                                data.user.user_metadata?.name ||
                                "Usuario",
                            avatar_url: data.user.user_metadata?.avatar_url,
                            role: "donor",
                            kyc_status: "pending",
                        },
                        { onConflict: "id" },
                    );

                if (profileError) {
                    console.error("Error creating OAuth profile:", profileError);
                }
            }

            return NextResponse.redirect(buildAbsoluteUrl(request, next));
        }
    }

    return NextResponse.redirect(
        buildAbsoluteUrl(request, "/auth/login?error=authentication_failed"),
    );
}
