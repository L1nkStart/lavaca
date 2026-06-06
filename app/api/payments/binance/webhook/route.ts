import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { BinanceProvider } from "@/lib/payments/providers/binance-provider";

export const runtime = "nodejs";

type BinanceWebhookEnvelope = {
    bizType?: string;
    bizId?: number | string;
    bizStatus?: string;
    data?: string;
};

type BinanceWebhookData = {
    merchantTradeNo?: string;
    prepayId?: string;
    transactionId?: string;
    status?: string;
    bizStatus?: string;
};

async function markCompleted(donationId: string, externalRef?: string) {
    const supabase = createAdminClient();

    const { data: existingDonation, error: existingError } = await supabase
        .from("donations")
        .select("id, payment_status")
        .eq("id", donationId)
        .single();

    if (existingError || !existingDonation) {
        throw new Error("Donation not found for Binance webhook");
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

async function markFailed(donationId: string, reason: string, externalRef?: string) {
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
        const signature = request.headers.get("binancepay-signature") || "";
        const nonce = request.headers.get("binancepay-nonce") || "";
        const timestamp = request.headers.get("binancepay-timestamp") || "";

        if (!signature || !nonce || !timestamp) {
            return NextResponse.json({ error: "Missing Binance headers" }, { status: 400 });
        }

        const payload = await request.text();
        const secret = process.env.BINANCE_API_SECRET;

        if (!secret) {
            return NextResponse.json({ error: "Missing Binance secret" }, { status: 500 });
        }

        const isValid = BinanceProvider.verifySignature({
            timestamp,
            nonce,
            payload,
            signature,
            secret,
        });

        if (!isValid) {
            return NextResponse.json({ error: "Invalid Binance signature" }, { status: 400 });
        }

        const envelope = (payload ? JSON.parse(payload) : {}) as BinanceWebhookEnvelope;
        const innerData = envelope.data ? (JSON.parse(envelope.data) as BinanceWebhookData) : ({} as BinanceWebhookData);

        const donationId = innerData.merchantTradeNo;

        if (!donationId) {
            return NextResponse.json({ received: true });
        }

        const status = (innerData.status || innerData.bizStatus || envelope.bizStatus || "").toUpperCase();
        const externalRef = innerData.prepayId || innerData.transactionId || undefined;

        if (["PAID", "SUCCESS"].includes(status)) {
            await markCompleted(donationId, externalRef);
        } else if (["FAIL", "FAILED", "ERROR", "EXPIRED", "CANCELED", "CANCELLED"].includes(status)) {
            await markFailed(donationId, "Pago Binance no completado", externalRef);
        }

        return NextResponse.json({ received: true });
    } catch (error: any) {
        console.error("Binance webhook processing error:", error);
        return NextResponse.json(
            { error: "Webhook error", details: error?.message || "Unknown error" },
            { status: 500 },
        );
    }
}
