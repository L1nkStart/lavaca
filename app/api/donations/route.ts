import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { PaymentManager } from "@/lib/payments/payment-manager";
import { PaymentProvider, PaymentType } from "@/lib/payments/types";
import { initializePayments } from "@/lib/payments/config";

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

    // Initialize payment system
    initializePayments();

    // Create donation record
    const { data: donation, error } = await supabase
      .from("donations")
      .insert({
        campaign_id: campaignId,
        donor_id: user?.id || null,
        email: donorEmail || 'anonymous@lavaca.app',
        amount_usd: amountUSD,
        amount_bs: amountUSD * 41.25, // Should get live rate
        payment_method: paymentMethod,
        payment_status: "pending",
        is_anonymous: isAnonymous,
        donor_name: isAnonymous ? null : donorEmail?.split("@")[0],
      })
      .select()
      .single();

    if (error) throw error;

    // Map payment method to provider
    const providerMap: Record<string, PaymentProvider> = {
      card: PaymentProvider.STRIPE,
      paypal: PaymentProvider.PAYPAL,
      crypto: PaymentProvider.BINANCE,
      zelle: PaymentProvider.ZELLE,
      pagomovil: PaymentProvider.PAGO_MOVIL,
    };

    const provider = providerMap[paymentMethod] || PaymentProvider.STRIPE;

    // Process payment through PaymentManager
    try {
      const paymentResult = await PaymentManager.processPayment({
        amount: {
          usd: amountUSD,
          bs: amountUSD * 41.25,
        },
        provider,
        paymentType: PaymentType.CARD,
        metadata: {
          campaignId,
          donationId: donation.id,
          donorId: user?.id,
          donorEmail: donorEmail || 'anonymous@lavaca.app',
          isAnonymous,
        },
        customerInfo: {
          email: donorEmail || 'anonymous@lavaca.app',
          name: donation.donor_name || undefined,
        },
        returnUrl: `${process.env.NEXT_PUBLIC_URL}/campaigns/${campaignId}?donation=success`,
        cancelUrl: `${process.env.NEXT_PUBLIC_URL}/campaigns/${campaignId}/donate?donation=cancelled`,
        providerSpecificData: {
          pagoMovilData,
          manualPaymentData,
        },
      });

      // Update donation with payment result
      console.log('🔍 Payment Result:', {
        success: paymentResult.success,
        status: paymentResult.status,
        transactionId: paymentResult.transactionId,
      });

      if (paymentResult.success) {
        console.log(`✅ Payment successful, updating donation to: ${paymentResult.status}`);

        const { data: updateData, error: updateError, count } = await supabase
          .from("donations")
          .update({
            payment_status: paymentResult.status,
            completed_at: paymentResult.status === 'completed' ? new Date().toISOString() : null,
          })
          .eq("id", donation.id)
          .select();

        if (updateError) {
          console.error('❌ Error updating donation status:', updateError);
        } else if (!updateData || updateData.length === 0) {
          console.error('⚠️ UPDATE executed but NO ROWS affected - RLS Policy blocking!');
          console.error('Donation ID:', donation.id);
          console.error('This means RLS policies are blocking the UPDATE');
        } else {
          console.log(`✅ Donation ${donation.id} updated to: ${paymentResult.status}`);
          console.log('Updated data:', updateData);
        }
      } else {
        console.warn('⚠️ Payment not successful:', paymentResult.error);
      }

      return NextResponse.json({
        donation,
        payment: paymentResult,
      });
    } catch (paymentError: any) {
      console.error("Payment processing error:", paymentError);

      // Update donation as failed
      await supabase
        .from("donations")
        .update({
          payment_status: "failed",
        })
        .eq("id", donation.id);

      return NextResponse.json({
        donation,
        payment: {
          success: false,
          error: paymentError.message,
        },
      });
    }
  } catch (error: any) {
    console.error("Error creating donation:", error);
    return NextResponse.json(
      { error: "Failed to create donation", details: error.message },
      { status: 500 }
    );
  }
}
