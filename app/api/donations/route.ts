import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { PaymentManager } from "@/lib/payments/payment-manager";
import { PaymentProvider, PaymentType } from "@/lib/payments/types";
import { initializePayments, isProviderConfigured } from "@/lib/payments/config";
import { getActiveExchangeRate } from "@/lib/exchange-rate";

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
      donorName,
      pagoMovilData,
      manualPaymentData,
      captureUrl,
    } = body;

    const safeCaptureUrl =
      typeof captureUrl === "string" && captureUrl.startsWith("http")
        ? captureUrl
        : null;

    const manualMethods = new Set(["zelle", "pagomovil", "transfer"]);
    const apiMethods = new Set(["card", "paypal", "googlepay", "crypto", "chinchin"]);

    if (!manualMethods.has(paymentMethod) && !apiMethods.has(paymentMethod)) {
      return NextResponse.json(
        { error: "Método de pago no soportado" },
        { status: 400 }
      );
    }

    if (paymentMethod === "zelle") {
      const zelleReference =
        typeof manualPaymentData?.reference === "string"
          ? manualPaymentData.reference.trim()
          : "";

      if (!zelleReference) {
        return NextResponse.json(
          { error: "La referencia de pago es obligatoria para Zelle" },
          { status: 400 }
        );
      }
    }

    // Get authenticated user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const authenticatedEmail = user?.email?.trim().toLowerCase() || null;
    const requestEmail = typeof donorEmail === "string" ? donorEmail.trim().toLowerCase() : "";
    const finalDonorEmail = authenticatedEmail || requestEmail;
    const normalizedDonorName =
      typeof donorName === "string" ? donorName.trim().replace(/\s+/g, " ") : "";
    const fallbackDonorName =
      typeof user?.user_metadata?.full_name === "string"
        ? user.user_metadata.full_name.trim().replace(/\s+/g, " ")
        : "";
    const fallbackNameIsValid = fallbackDonorName.length >= 2 && fallbackDonorName.length <= 120;

    if (normalizedDonorName && normalizedDonorName.length < 2) {
      return NextResponse.json(
        { error: "El nombre del donante debe tener al menos 2 caracteres o dejarse en blanco" },
        { status: 400 }
      );
    }

    if (normalizedDonorName.length > 120) {
      return NextResponse.json(
        { error: "El nombre del donante no puede superar 120 caracteres" },
        { status: 400 }
      );
    }

    const finalDonorName = normalizedDonorName || (fallbackNameIsValid ? fallbackDonorName : "") || null;

    if (!finalDonorEmail) {
      return NextResponse.json(
        { error: "El correo electrónico del donante es obligatorio" },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(finalDonorEmail)) {
      return NextResponse.json(
        { error: "El correo electrónico no es válido" },
        { status: 400 }
      );
    }

    // Initialize payment system
    initializePayments();

    // Resolve live Bs/USD rate so the donation snapshot reflects what the
    // donor actually saw (rather than a hard-coded placeholder).
    const liveExchangeRate = await getActiveExchangeRate();
    const amountBs = Number((amountUSD * liveExchangeRate).toFixed(2));

    // Create donation record
    const { data: donation, error } = await supabase
      .from("donations")
      .insert({
        campaign_id: campaignId,
        donor_id: user?.id || null,
        email: finalDonorEmail,
        amount_usd: amountUSD,
        amount_bs: amountBs,
        payment_method: paymentMethod,
        payment_status: "pending",
        is_anonymous: isAnonymous,
        donor_name: finalDonorName,
        reference_number:
          paymentMethod === "zelle"
            ? manualPaymentData?.reference?.trim() || null
            : paymentMethod === "pagomovil"
              ? pagoMovilData?.reference || null
              : paymentMethod === "transfer"
                ? manualPaymentData?.reference?.trim() || null
                : null,
        capture_url: manualMethods.has(paymentMethod) ? safeCaptureUrl : null,
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
      chinchin: PaymentProvider.CHINCHIN,
      zelle: PaymentProvider.ZELLE,
      pagomovil: PaymentProvider.PAGO_MOVIL,
    };

    const provider = providerMap[paymentMethod] || PaymentProvider.STRIPE;

    // Si el método es manual por diseño (zelle/pagomovil/transfer) O si es un
    // método automatizado pero el provider aún no tiene credenciales reales,
    // dejamos la donación como `pending` para que el admin la apruebe a mano
    // desde /admin/payments. Esto permite operar la plataforma desde el día 1
    // aún sin integraciones de Stripe/Binance/etc.
    const providerReady = isProviderConfigured(provider);
    const treatAsManual = manualMethods.has(paymentMethod) || !providerReady;

    if (treatAsManual) {
      const reason = !manualMethods.has(paymentMethod) && !providerReady
        ? `Provider ${provider} sin credenciales — pendiente de aprobación manual`
        : "Pago pendiente de verificación manual";

      // Si caímos a manual por falta de credenciales pero la donación fue
      // creada sin admin_notes (es una pasarela automatizada), lo dejamos
      // anotado para que el admin entienda el contexto.
      if (!manualMethods.has(paymentMethod)) {
        await supabase
          .from("donations")
          .update({ admin_notes: reason })
          .eq("id", donation.id);
      }

      return NextResponse.json({
        donation,
        payment: {
          success: true,
          status: "pending",
          metadata: {
            confirmationType: "manual",
            paymentMethod,
            providerAvailable: providerReady,
            fallbackReason: providerReady ? undefined : reason,
          },
        },
      });
    }

    // Process payment through PaymentManager
    try {
      const paymentResult = await PaymentManager.processPayment({
        amount: {
          usd: amountUSD,
          bs: amountBs,
          exchangeRate: liveExchangeRate,
        },
        provider,
        paymentType: PaymentType.CARD,
        metadata: {
          campaignId,
          donationId: donation.id,
          donorId: user?.id,
          donorEmail: finalDonorEmail,
          isAnonymous,
        },
        customerInfo: {
          email: finalDonorEmail,
          name: finalDonorName || undefined,
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
            reference_number: isBinanceMethod ? paymentResult.externalId || null : null,
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
