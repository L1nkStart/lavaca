import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const ALLOWED_TOPICS = new Set([
    "general",
    "campana",
    "donacion",
    "garante",
    "reporte",
    "prensa",
    "otro",
]);

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const topic = typeof body?.topic === "string" ? body.topic : "general";
        const name = typeof body?.name === "string" ? body.name.trim() : "";
        const email =
            typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
        const message = typeof body?.message === "string" ? body.message.trim() : "";

        // Validación
        if (!ALLOWED_TOPICS.has(topic)) {
            return NextResponse.json({ error: "Topic inválido" }, { status: 400 });
        }
        if (name.length < 2 || name.length > 120) {
            return NextResponse.json(
                { error: "Nombre inválido (2-120 caracteres)" },
                { status: 400 }
            );
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return NextResponse.json({ error: "Email inválido" }, { status: 400 });
        }
        if (message.length < 10 || message.length > 2000) {
            return NextResponse.json(
                { error: "Mensaje inválido (10-2000 caracteres)" },
                { status: 400 }
            );
        }

        // Detectar si el usuario está autenticado (para asociar el mensaje)
        let userId: string | null = null;
        try {
            const supabase = await createClient();
            const { data } = await supabase.auth.getUser();
            if (data?.user?.id) userId = data.user.id;
        } catch {
            // anon, sin problema
        }

        const adminSupabase = createAdminClient();

        const ip =
            request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
            request.headers.get("x-real-ip") ||
            null;
        const userAgent = request.headers.get("user-agent") || null;

        const { data: inserted, error } = await adminSupabase
            .from("contact_messages")
            .insert({
                topic,
                name,
                email,
                message,
                user_id: userId,
                ip_address: ip,
                user_agent: userAgent,
            })
            .select("id")
            .single();

        if (error) {
            console.error("[contact] insert error:", error);
            throw error;
        }

        // TODO: cuando esté Resend/SMTP configurado, mandar email al equipo aquí.

        return NextResponse.json({ ok: true, id: inserted.id });
    } catch (error: any) {
        console.error("contact POST error:", error);
        return NextResponse.json(
            { error: "Error interno", details: error?.message || "Unknown error" },
            { status: 500 }
        );
    }
}
