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

    const manualMethods = new Set(["zelle", "pagomovil", "transfer"]);
    const apiMethods = new Set(["card", "paypal", "googlepay", "crypto"]);

    if (!manualMethods.has(paymentMethod) && !apiMethods.has(paymentMethod)) {
      return NextResponse.json(
        { error: "Método de pago no soportado" },
        { status: 400 }
      );
    }

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
        payment_reference:
          paymentMethod === "pagomovil"
            ? pagoMovilData?.reference || null
            : paymentMethod === "transfer"
              ? manualPaymentData?.reference || null
              : null,
        admin_notes: manualMethods.has(paymentMethod)
          ? "Pago pendiente de verificación manual"
          : null,
      })
      .select()
      .single();

    if (error) throw error;

    // Map payment method to provider
    const providerMap: Record<string, PaymentProvider> = {
      card: PaymentProvider.STRIPE,
      googlepay: PaymentProvider.STRIPE,
      paypal: PaymentProvider.PAYPAL,
      crypto: PaymentProvider.BINANCE,
      zelle: PaymentProvider.ZELLE,
      pagomovil: PaymentProvider.PAGO_MOVIL,
    };

    const provider = providerMap[paymentMethod] || PaymentProvider.STRIPE;

    if (manualMethods.has(paymentMethod)) {
      return NextResponse.json({
        donation,
        payment: {
          success: true,
          status: "pending",
          metadata: {
            confirmationType: "manual",
            paymentMethod,
          },
        },
      });
    }

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

        const isStripeMethod = paymentMethod === "card" || paymentMethod === "googlepay";
        const isBinanceMethod = paymentMethod === "crypto";

        const { data: updateData, error: updateError, count } = await supabase
          .from("donations")
          .update({
            payment_status: paymentResult.status,
            completed_at: paymentResult.status === 'completed' ? new Date().toISOString() : null,
            stripe_payment_id: isStripeMethod ? paymentResult.externalId || null : null,
            payment_reference: isBinanceMethod ? paymentResult.externalId || null : null,
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
        payment: {
          ...paymentResult,
          metadata: {
            ...(paymentResult.metadata || {}),
            confirmationType: "api",
          },
        },
      });
    } catch (paymentError: any) {
      console.error("Payment processing error:", paymentError);

      const details = paymentError?.message || "Error desconocido";
      const providerNotAvailable =
        details.includes("not implemented") ||
        details.includes("Provider") ||
        details.includes("not enabled");

      if (providerNotAvailable) {
        await supabase
          .from("donations")
          .update({
            payment_status: "pending",
            admin_notes: "Método automático pendiente de integración/confirmación",
          })
          .eq("id", donation.id);

        return NextResponse.json({
          donation,
          payment: {
            success: false,
            status: "pending",
            error: "No pudimos completar el método automático en este momento.",
            metadata: {
              confirmationType: "api",
              providerAvailable: false,
            },
          },
        });
      }

      await supabase
        .from("donations")
        .update({
          payment_status: "failed",
          admin_notes: details,
        })
        .eq("id", donation.id);

      return NextResponse.json({
        donation,
        payment: {
          success: false,
          status: "failed",
          error: paymentError.message,
          metadata: {
            confirmationType: "api",
            providerAvailable: true,
          },
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
