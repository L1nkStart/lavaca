"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { DonationMethodSelector, PaymentMethod } from "./donation-method-selector";
import { DonationAmountInput } from "./donation-amount-input";
import { PagoMovilForm } from "./payment-forms/pagomovil-form";
import { ManualPaymentForm } from "./payment-forms/manual-payment-form";
import { Loader2, Clock, TrendingUp } from 'lucide-react';
import { Alert, AlertDescription } from "@/components/ui/alert";

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

  // Exchange rate state
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);
  const [rateExpiresAt, setRateExpiresAt] = useState<string | null>(null);
  const [rateLoading, setRateLoading] = useState(true);
  const [timeRemaining, setTimeRemaining] = useState<string>("");

  // Fetch exchange rate on mount
  useEffect(() => {
    const fetchExchangeRate = async () => {
      try {
        const response = await fetch('/api/exchange-rate');
        const data = await response.json();

        if (response.ok) {
          setExchangeRate(data.rate);
          setRateExpiresAt(data.expiresAt);
        } else {
          console.error('Failed to fetch exchange rate:', data);
          setExchangeRate(43.02); // Fallback rate
        }
      } catch (error) {
        console.error('Error fetching exchange rate:', error);
        setExchangeRate(43.02); // Fallback rate
      } finally {
        setRateLoading(false);
      }
    };

    fetchExchangeRate();
  }, []);

  // Update countdown timer
  useEffect(() => {
    if (!rateExpiresAt) return;

    const updateTimer = () => {
      const now = new Date().getTime();
      const expiry = new Date(rateExpiresAt).getTime();
      const diff = expiry - now;

      if (diff <= 0) {
        setTimeRemaining("Tasa expirada - Recarga la página");
        return;
      }

      const minutes = Math.floor(diff / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      setTimeRemaining(`${minutes}:${seconds.toString().padStart(2, '0')}`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [rateExpiresAt]);

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

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.details || result.error || "Error creating donation");
      }

      // Check payment result
      if (result.payment && result.payment.success) {
        // Payment was successful (completed immediately in test mode)
        alert(
          "✅ ¡Donación exitosa!\n\n" +
          "Gracias por tu apoyo. Tu donación ha sido confirmada.\n\n" +
          (result.payment.status === 'completed'
            ? "El pago fue procesado exitosamente."
            : "Estamos procesando tu pago.")
        );
        window.location.href = `/campaigns/${campaignId}?donation=success`;
      } else if (result.payment && result.payment.externalId) {
        // Payment needs external processing (Stripe, PayPal, etc.)
        // Redirect to external payment page
        window.location.href = result.payment.metadata?.checkoutUrl || `/campaigns/${campaignId}`;
      } else {
        // Payment failed or pending manual approval
        alert(
          "⏳ Donación registrada\n\n" +
          "Tu donación ha sido registrada y está pendiente de confirmación.\n" +
          "Te notificaremos cuando se complete el proceso."
        );
        window.location.href = `/campaigns/${campaignId}?donation=pending`;
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
      {/* Exchange Rate Info */}
      {exchangeRate && rateExpiresAt && (
        <Alert className="bg-primary/5 border-primary/20">
          <TrendingUp className="h-4 w-4 text-primary" />
          <AlertDescription className="flex items-center justify-between">
            <span className="text-sm">
              <strong>Tasa BCV:</strong> {exchangeRate.toFixed(2)} Bs/USD
            </span>
            <span className="text-xs flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Válida por: <strong>{timeRemaining}</strong>
            </span>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Donación para: {campaignTitle}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Amount Input */}
          {rateLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Cargando tasa de cambio...</span>
            </div>
          ) : (
            <DonationAmountInput
              amountUSD={amountUSD}
              onAmountChange={setAmountUSD}
              exchangeRate={exchangeRate || 43.02}
            />
          )}

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
        disabled={isLoading || rateLoading}
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Procesando...
          </>
        ) : (
          <>
            Donar ${amountUSD.toFixed(2)} USD
            {exchangeRate && (
              <span className="ml-2 opacity-75">
                ≈ {(amountUSD * exchangeRate).toFixed(2)} Bs
              </span>
            )}
          </>
        )}
      </Button>

      <div className="text-center text-sm text-muted-foreground">
        <p>LaVaca usa encriptación 256-bit para proteger tus datos</p>
      </div>
    </div>
  );
}
