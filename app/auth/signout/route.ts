import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";
import { buildAbsoluteUrl } from "@/lib/url";

export async function POST(request: NextRequest) {
    const supabase = await createClient();
    await supabase.auth.signOut();

    // Usamos el helper en vez de `new URL('/', request.url)` para que
    // Coolify/Traefik no nos mande a localhost cuando el Host header del
    // request interno apunta al contenedor.
    return NextResponse.redirect(buildAbsoluteUrl(request, "/"));
}

// Aceptamos GET también, por si alguien abre /auth/signout en la URL.
export async function GET(request: NextRequest) {
    return POST(request);
}
