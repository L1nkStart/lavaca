import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { initializePayments, PAYMENT_MODE, isTestMode } from "@/lib/payments/config";
import { PaymentFactory } from "@/lib/payments/payment-factory";
import { PaymentProvider } from "@/lib/payments/types";

export const runtime = "nodejs";

async function assertAdmin() {
    const supabase = await createClient();

    const {
        data: { user },
        error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
        return { ok: false as const, status: 401, error: "No autorizado" };
    }

    const { data: actorProfile, error: actorError } = await supabase
        .from("users")
        .select("role")
        .eq("id", user.id)
        .single();

    if (actorError || actorProfile?.role !== "admin") {
        return { ok: false as const, status: 403, error: "Permisos insuficientes" };
    }

    return { ok: true as const };
}

async function checkProvider(provider: PaymentProvider) {
    try {
        await PaymentFactory.getProvider(provider);
        return { ready: true, error: null as string | null };
    } catch (error: any) {
        return {
            ready: false,
            error: error?.message || "Error no identificado",
        };
    }
}

export async function GET() {
    try {
        const adminCheck = await assertAdmin();

        if (!adminCheck.ok) {
            return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status });
        }

        PaymentFactory.clearCache();
        initializePayments();

        const stripeEnvConfigured = !!process.env.STRIPE_SECRET_KEY;
        const stripeWebhookConfigured = !!process.env.STRIPE_WEBHOOK_SECRET;

        const binanceEnvConfigured =
            !!process.env.BINANCE_API_KEY &&
            !!process.env.BINANCE_API_SECRET &&
            !!process.env.BINANCE_PAY_CERT_SN;

        const stripe = await checkProvider(PaymentProvider.STRIPE);
        const binance = await checkProvider(PaymentProvider.BINANCE);

        return NextResponse.json({
            mode: PAYMENT_MODE,
            testMode: isTestMode(),
            providers: {
                stripe: {
                    envConfigured: stripeEnvConfigured,
                    webhookConfigured: stripeWebhookConfigured,
                    providerReady: stripe.ready,
                    error: stripe.error,
                },
                binance: {
                    envConfigured: binanceEnvConfigured,
                    webhookConfigured: true,
                    providerReady: binance.ready,
                    error: binance.error,
                },
            },
            checkedAt: new Date().toISOString(),
        });
    } catch (error: any) {
        console.error("Admin payments health error:", error);
        return NextResponse.json(
            { error: "Error interno", details: error?.message || "Unknown error" },
            { status: 500 },
        );
    }
}
