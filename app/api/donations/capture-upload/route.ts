import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/pdf",
]);

/**
 * POST /api/donations/capture-upload
 * FormData: { file: File, campaignId?: string }
 *
 * Sube el comprobante de un pago manual (Zelle / transferencia / cripto) al
 * bucket `payment-captures` y devuelve la URL firmada (válida 1 año).
 * Aceptamos donantes invitados (sin sesión) para no bloquear el checkout.
 */
export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get("file");
        const campaignId =
            typeof formData.get("campaignId") === "string"
                ? (formData.get("campaignId") as string)
                : "anon";

        if (!file || typeof file === "string") {
            return NextResponse.json({ error: "Archivo requerido" }, { status: 400 });
        }

        if (file.size > MAX_BYTES) {
            return NextResponse.json(
                { error: "El archivo no puede superar 5 MB" },
                { status: 400 }
            );
        }

        if (!ALLOWED_TYPES.has(file.type)) {
            return NextResponse.json(
                { error: "Formato no permitido. Usa JPG, PNG, WebP o PDF" },
                { status: 400 }
            );
        }

        // Identificar al usuario (si está autenticado) para namespace de carpeta.
        let ownerSegment = "guest";
        try {
            const supabase = await createClient();
            const { data } = await supabase.auth.getUser();
            if (data?.user?.id) ownerSegment = data.user.id;
        } catch {
            // ignore: anon checkout
        }

        const adminSupabase = createAdminClient();
        const ext = (() => {
            switch (file.type) {
                case "image/jpeg":
                    return "jpg";
                case "image/png":
                    return "png";
                case "image/webp":
                    return "webp";
                case "application/pdf":
                    return "pdf";
                default:
                    return "bin";
            }
        })();

        const objectPath = `${ownerSegment}/${campaignId}/${Date.now()}-${Math.random()
            .toString(36)
            .slice(2, 10)}.${ext}`;

        const arrayBuffer = await file.arrayBuffer();
        const { error: uploadError } = await adminSupabase.storage
            .from("payment-captures")
            .upload(objectPath, Buffer.from(arrayBuffer), {
                contentType: file.type,
                upsert: false,
            });

        if (uploadError) {
            console.error("[capture-upload] upload error:", uploadError);
            return NextResponse.json(
                { error: "No se pudo subir el archivo", details: uploadError.message },
                { status: 500 }
            );
        }

        // Signed URL válida 1 año (admin la verá desde /admin/payments).
        const { data: signed, error: signedError } = await adminSupabase.storage
            .from("payment-captures")
            .createSignedUrl(objectPath, 60 * 60 * 24 * 365);

        if (signedError || !signed?.signedUrl) {
            console.error("[capture-upload] signed url error:", signedError);
            return NextResponse.json(
                { error: "No se pudo generar URL firmada" },
                { status: 500 }
            );
        }

        return NextResponse.json({
            url: signed.signedUrl,
            path: objectPath,
        });
    } catch (error: any) {
        console.error("capture-upload error:", error);
        return NextResponse.json(
            { error: "Error interno", details: error?.message || "Unknown error" },
            { status: 500 }
        );
    }
}
