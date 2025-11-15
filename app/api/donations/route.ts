import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();

    const {
      campaignId,
      amountUSD,
      paymentMethod,
      isAnonymous,
      donorEmail,
      pagoMovilData,
      manualPaymentData,
    } = body;

    // Get authenticated user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Create donation record
    const { data: donation, error } = await supabase
      .from("donations")
      .insert({
        campaign_id: campaignId,
        donor_id: user?.id || null,
        amount_usd: amountUSD,
        amount_vef: amountUSD * 41.25, // Should get live rate
        payment_method: paymentMethod,
        status: paymentMethod === "card" || paymentMethod === "paypal" 
          ? "pending" 
          : "pending",
        anonymous: isAnonymous,
        donor_email: isAnonymous ? null : donorEmail,
        donor_name: isAnonymous ? null : donorEmail?.split("@")[0],
      })
      .select()
      .single();

    if (error) throw error;

    // If manual payment, create manual payment record
    if (["zelle", "transfer", "crypto"].includes(paymentMethod)) {
      const { error: manualError } = await supabase
        .from("manual_payments")
        .insert({
          donation_id: donation.id,
          payment_type: paymentMethod,
          transaction_reference: manualPaymentData?.reference,
          status: "pending_approval",
        });

      if (manualError) throw manualError;
    }

    return NextResponse.json(donation);
  } catch (error) {
    console.error("Error creating donation:", error);
    return NextResponse.json(
      { error: "Failed to create donation" },
      { status: 500 }
    );
  }
}
