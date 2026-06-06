import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * PayPal webhook handler.
 *
 * Eventos relevantes:
 *   - CHECKOUT.ORDER.APPROVED      → orden lista para capturar
 *   - CHECKOUT.ORDER.COMPLETED     → orden completada
 *   - PAYMENT.CAPTURE.COMPLETED    → captura efectiva del cargo
 *   - PAYMENT.CAPTURE.DENIED       → captura rechazada
 *   - PAYMENT.CAPTURE.REFUNDED     → reembolso
 *
 * IMPORTANTE: PayPal recomienda verificar la firma mediante el endpoint
 * `/v1/notifications/verify-webhook-signature` usando `PAYPAL_WEBHOOK_ID`.
 * Por ahora se valida la estructura del evento; cuando se configuren las
 * credenciales reales se debe activar la verificación (ver TODO abajo).
 */

async function markCompleted(donationId: string, externalRef?: string) {
    const supabase = createAdminClient();

    const { data: existing } = await supabase
        .from("donations")
        .select("id, payment_status")
        .eq("id", donationId)
        .single();

    if (!existing) {
        throw new Error("Donation not found for PayPal webhook");
    }
    if (existing.payment_status === "completed") return;

    const { error } = await supabase
        .from("donations")
        .update({
            payment_status: "completed",
            completed_at: new Date().toISOString(),
            paypal_transaction_id: externalRef || null,
            admin_notes: null,
        })
        .eq("id", donationId)
        .neq("payment_status", "completed");

    if (error) throw error;
}

async function markFailed(donationId: string, reason: string, externalRef?: string) {
    const supabase = createAdminClient();

    const { error } = await supabase
        .from("donations")
        .update({
            payment_status: "failed",
            paypal_transaction_id: externalRef || null,
            admin_notes: reason,
        })
        .eq("id", donationId)
        .neq("payment_status", "completed");

    if (error) throw error;
}

export async function POST(request: NextRequest) {
    try {
        const payload = await request.text();
        const event = payload ? JSON.parse(payload) : {};

        // TODO: activar verificación de firma cuando se tenga PAYPAL_WEBHOOK_ID.
        // const transmissionId = request.headers.get("paypal-transmission-id");
        // const transmissionTime = request.headers.get("paypal-transmission-time");
        // const certUrl = request.headers.get("paypal-cert-url");
        // const authAlgo = request.headers.get("paypal-auth-algo");
        // const transmissionSig = request.headers.get("paypal-transmission-sig");
        // const webhookId = process.env.PAYPAL_WEBHOOK_ID;
        // if (!await verifyPaypalSignature({ ... })) {
        //     return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
        // }

        const eventType: string = event?.event_type || "";
        const resource = event?.resource || {};

        const customId =
            resource?.purchase_units?.[0]?.custom_id ||
            resource?.custom_id ||
            resource?.supplementary_data?.related_ids?.order_id;

        const donationId = customId;
        const externalRef = resource?.id;

        if (!donationId) {
            return NextResponse.json({ received: true });
        }

        if (
            eventType === "CHECKOUT.ORDER.COMPLETED" ||
            eventType === "PAYMENT.CAPTURE.COMPLETED"
        ) {
            await markCompleted(donationId, externalRef);
        } else if (
            eventType === "PAYMENT.CAPTURE.DENIED" ||
            eventType === "CHECKOUT.ORDER.VOIDED"
        ) {
            await markFailed(donationId, "PayPal denegó/anuló el pago", externalRef);
        }

        return NextResponse.json({ received: true });
    } catch (error: any) {
        console.error("PayPal webhook processing error:", error);
        return NextResponse.json(
            { error: "Webhook error", details: error?.message || "Unknown error" },
            { status: 500 },
        );
    }
}
