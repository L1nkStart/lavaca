import Stripe from "stripe";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2026-02-25.clover",
  typescript: true,
});

function getWebhookSecret() {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secret) {
    throw new Error("Missing STRIPE_WEBHOOK_SECRET");
  }

  return secret;
}

async function markDonationCompleted(
  donationId: string,
  stripePaymentId: string,
) {
  const supabase = createAdminClient();

  const { data: existingDonation, error: existingError } = await supabase
    .from("donations")
    .select("id, payment_status")
    .eq("id", donationId)
    .single();

  if (existingError || !existingDonation) {
    throw new Error("Donation not found for webhook metadata");
  }

  if (existingDonation.payment_status === "completed") {
    return;
  }

  const { error: updateError } = await supabase
    .from("donations")
    .update({
      payment_status: "completed",
      completed_at: new Date().toISOString(),
      stripe_payment_id: stripePaymentId,
      admin_notes: null,
    })
    .eq("id", donationId)
    .neq("payment_status", "completed");

  if (updateError) {
    throw updateError;
  }
}

async function markDonationFailed(donationId: string, reason: string) {
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("donations")
    .update({
      payment_status: "failed",
      admin_notes: reason,
    })
    .eq("id", donationId)
    .neq("payment_status", "completed");

  if (error) {
    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    const signature = request.headers.get("stripe-signature");

    if (!signature) {
      return NextResponse.json(
        { error: "Missing Stripe signature" },
        { status: 400 },
      );
    }

    const payload = await request.text();
    const webhookSecret = getWebhookSecret();

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    } catch (error: any) {
      console.error("Stripe webhook signature verification failed:", error?.message);
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const donationId = session.metadata?.donation_id;

        if (!donationId) {
          break;
        }

        await markDonationCompleted(donationId, session.id);
        break;
      }

      case "checkout.session.async_payment_failed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const donationId = session.metadata?.donation_id;

        if (!donationId) {
          break;
        }

        await markDonationFailed(
          donationId,
          "Pago internacional no completado en Stripe",
        );
        break;
      }

      case "payment_intent.payment_failed": {
        const intent = event.data.object as Stripe.PaymentIntent;
        const donationId = intent.metadata?.donation_id;

        if (!donationId) {
          break;
        }

        await markDonationFailed(
          donationId,
          intent.last_payment_error?.message || "Pago internacional fallido",
        );
        break;
      }

      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error("Stripe webhook processing error:", error);
    return NextResponse.json(
      { error: "Webhook error", details: error?.message || "Unknown error" },
      { status: 500 },
    );
  }
}
