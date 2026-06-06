import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ChinchinProvider } from "@/lib/payments/providers/chinchin-provider";

export const runtime = "nodejs";

type ChinchinWebhookPayload = {
    event?: string;
    merchantTradeNo?: string;
    orderId?: string;
    externalId?: string;
    status?: string;
    bizStatus?: string;
    amount?: string | number;
    currency?: string;
    raw?: unknown;
};

async function markCompleted(donationId: string, externalRef?: string) {
    const supabase = createAdminClient();

    const { data: existingDonation, error: existingError } = await supabase
        .from("donations")
        .select("id, payment_status")
        .eq("id", donationId)
        .single();

    if (existingError || !existingDonation) {
        throw new Error("Donation not found for ChinChin webhook");
    }

    if (existingDonation.payment_status === "completed") {
        return;
    }

    const { error } = await supabase
        .from("donations")
        .update({
            payment_status: "completed",
            completed_at: new Date().toISOString(),
            reference_number: externalRef || null,
            admin_notes: null,
        })
        .eq("id", donationId)
        .neq("payment_status", "completed");

    if (error) throw error;
}

async function markFailed(
    donationId: string,
    reason: string,
    externalRef?: string,
) {
    const supabase = createAdminClient();

    const { error } = await supabase
        .from("donations")
        .update({
            payment_status: "failed",
            reference_number: externalRef || null,
            admin_notes: reason,
        })
        .eq("id", donationId)
        .neq("payment_status", "completed");

    if (error) throw error;
}

export async function POST(request: NextRequest) {
    try {
        const signature =
            request.headers.get("x-chinchin-signature") ||
            request.headers.get("chinchin-signature") ||
            "";
        const nonce =
            request.headers.get("x-chinchin-nonce") ||
            request.headers.get("chinchin-nonce") ||
            "";
        const timestamp =
            request.headers.get("x-chinchin-timestamp") ||
            request.headers.get("chinchin-timestamp") ||
            "";

        if (!signature || !nonce || !timestamp) {
            return NextResponse.json(
                { error: "Missing ChinChin headers" },
                { status: 400 },
            );
        }

        const payload = await request.text();
        const secret =
            process.env.CHINCHIN_WEBHOOK_SECRET || process.env.CHINCHIN_API_SECRET;

        if (!secret) {
            return NextResponse.json(
                { error: "Missing ChinChin webhook secret" },
                { status: 500 },
            );
        }

        const isValid = ChinchinProvider.verifySignature({
            timestamp,
            nonce,
            payload,
            signature,
            secret,
        });

        if (!isValid) {
            return NextResponse.json(
                { error: "Invalid ChinChin signature" },
                { status: 400 },
            );
        }

        const data = (payload ? JSON.parse(payload) : {}) as ChinchinWebhookPayload;
        const donationId = data.merchantTradeNo;

        if (!donationId) {
            return NextResponse.json({ received: true });
        }

        const status = (data.status || data.bizStatus || "").toUpperCase();
        const externalRef = data.orderId || data.externalId || undefined;

        if (["PAID", "SUCCESS", "COMPLETED"].includes(status)) {
            await markCompleted(donationId, externalRef);
        } else if (
            ["FAIL", "FAILED", "ERROR", "EXPIRED", "CANCELED", "CANCELLED"].includes(
                status,
            )
        ) {
            await markFailed(donationId, "Pago ChinChin no completado", externalRef);
        }

        return NextResponse.json({ received: true });
    } catch (error: any) {
        console.error("ChinChin webhook processing error:", error);
        return NextResponse.json(
            { error: "Webhook error", details: error?.message || "Unknown error" },
            { status: 500 },
        );
    }
}
