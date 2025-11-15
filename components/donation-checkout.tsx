"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { DonationMethodSelector, PaymentMethod } from "./donation-method-selector";
import { DonationAmountInput } from "./donation-amount-input";
import { PagoMovilForm } from "./payment-forms/pagomovil-form";
import { ManualPaymentForm } from "./payment-forms/manual-payment-form";
import { Loader2 } from 'lucide-react';

interface DonationCheckoutProps {
  campaignId: string;
  campaignTitle: string;
}

export function DonationCheckout({
  campaignId,
  campaignTitle,
}: DonationCheckoutProps) {
  const [amountUSD, setAmountUSD] = useState(10);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('card');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [donorEmail, setDonorEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);

  const [pago, setPagoMovilData] = useState({
    bank: "",
    phone: "",
    cedula: "",
  });

  const [manualPayment, setManualPayment] = useState({
    reference: "",
    proofDescription: "",
  });

  const exchangeRate = 41.25; // Should be fetched from API

  const handleDonate = async () => {
    setIsLoading(true);
    try {
      // Validate
      if (!isAnonymous && !donorEmail) {
        alert("Por favor ingresa tu correo");
        setIsLoading(false);
        return;
      }

      if (paymentMethod === "pagomovil" && (!pago.bank || !pago.phone || !pago.cedula)) {
        alert("Por favor completa todos los datos de PagoMóvil");
        setIsLoading(false);
        return;
      }

      if (["zelle", "transfer", "crypto"].includes(paymentMethod) && !manualPayment.reference) {
        alert("Por favor ingresa la referencia de tu transferencia");
        setIsLoading(false);
        return;
      }

      // Call API to create donation
      const response = await fetch("/api/donations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignId,
          amountUSD,
          paymentMethod,
          isAnonymous,
          donorEmail: isAnonymous ? null : donorEmail,
          pagoMovilData: paymentMethod === "pagomovil" ? pago : null,
          manualPaymentData: ["zelle", "transfer", "crypto"].includes(paymentMethod)
            ? manualPayment
            : null,
        }),
      });

      if (!response.ok) throw new Error("Error creating donation");

      const donation = await response.json();

      // Redirect based on payment method
      if (paymentMethod === "card") {
        // Redirect to Stripe checkout
        window.location.href = `/api/checkout?donationId=${donation.id}`;
      } else if (paymentMethod === "paypal") {
        // Redirect to PayPal
        window.location.href = `/api/paypal/create?donationId=${donation.id}`;
      } else {
        // Show success for manual/automatic methods
        alert("¡Gracias por tu donación! Te enviaremos una confirmación por correo.");
        window.location.href = `/campaigns/${campaignId}`;
      }
    } catch (error) {
      console.error("Error:", error);
      alert("Ocurrió un error. Por favor intenta de nuevo.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Donación para: {campaignTitle}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Amount Input */}
          <DonationAmountInput
            amountUSD={amountUSD}
            onAmountChange={setAmountUSD}
            exchangeRate={exchangeRate}
          />

          {/* Payment Method Selector */}
          <DonationMethodSelector value={paymentMethod} onChange={setPaymentMethod} />

          {/* Specific Payment Forms */}
          {paymentMethod === "pagomovil" && (
            <PagoMovilForm data={pago} onChange={setPagoMovilData} />
          )}

          {["zelle", "transfer", "crypto"].includes(paymentMethod) && (
            <ManualPaymentForm
              paymentType={paymentMethod as any}
              data={manualPayment}
              onChange={setManualPayment}
            />
          )}

          {/* Donor Info */}
          <div className="space-y-3 border-t border-border pt-4">
            <h4 className="font-semibold">Información del donante</h4>
            
            <div className="flex items-center gap-3">
              <Checkbox
                id="anonymous"
                checked={isAnonymous}
                onCheckedChange={(checked) => setIsAnonymous(checked as boolean)}
              />
              <Label htmlFor="anonymous" className="cursor-pointer">
                Donar de forma anónima
              </Label>
            </div>

            {!isAnonymous && (
              <div>
                <Label htmlFor="email">Correo electrónico</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="tu@email.com"
                  value={donorEmail}
                  onChange={(e) => setDonorEmail(e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Tu correo será usado para enviar el recibo de donación
                </p>
              </div>
            )}
          </div>

          {/* Terms */}
          <div className="space-y-3 bg-muted/50 p-4 rounded-lg">
            <div className="flex items-start gap-3">
              <Checkbox id="terms" />
              <Label htmlFor="terms" className="text-xs cursor-pointer">
                Acepto los términos y condiciones de LaVaca y confirmo que los fondos irán a la campaña indicada
              </Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Donate Button */}
      <Button
        size="lg"
        className="w-full bg-primary hover:bg-primary/90 h-12 text-base"
        onClick={handleDonate}
        disabled={isLoading}
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Procesando...
          </>
        ) : (
          `Donar $${amountUSD.toFixed(2)}`
        )}
      </Button>

      <div className="text-center text-sm text-muted-foreground">
        <p>LaVaca usa encriptación 256-bit para proteger tus datos</p>
      </div>
    </div>
  );
}
