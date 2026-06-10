import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { buildAbsoluteUrl } from "@/lib/url";

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const tokenHash = searchParams.get("token_hash") ?? searchParams.get("token");
    const type = searchParams.get("type");
    const code = searchParams.get("code");
    const redirectTo = searchParams.get("redirect_to") ?? "/";
    const supabase = await createClient();

    const successPath = `/auth/login?verified=true&redirectTo=${encodeURIComponent(redirectTo)}`;

    const buildRedirect = (path: string) =>
        NextResponse.redirect(buildAbsoluteUrl(request, path));

    // Flow 1: PKCE/OAuth-style con `code`
    if (code) {
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);

        if (!error && data.user) {
            const { data: existingProfile } = await supabase
                .from("users")
                .select("id")
                .eq("id", data.user.id)
                .maybeSingle();

            if (!existingProfile) {
                await supabase
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
            }

            return buildRedirect(successPath);
        }
    }

    // Flow 2: OTP-style con token_hash/token + type
    if (tokenHash && type) {
        const { data, error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: type as any,
        });

        if (!error && data.user) {
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
                    console.error("Error creating profile during verification:", profileError);
                }
            }

            return buildRedirect(successPath);
        }

        // Si el token ya se usó pero el usuario ya está verificado, no devolvemos error.
        const { data: userData } = await supabase.auth.getUser();
        if (userData.user?.email_confirmed_at) {
            return buildRedirect(successPath);
        }
    }

    return buildRedirect("/auth/login?error=verification_failed");
}
