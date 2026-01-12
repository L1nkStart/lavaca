"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Clock, TrendingUp, Shield, CheckCircle, RefreshCcw } from 'lucide-react';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

interface DonationCheckoutProps {
    campaignId: string;
    campaignTitle: string;
}

type Currency = 'USD' | 'BS';
type PaymentMethod = 'card' | 'paypal' | 'googlepay' | 'zelle' | 'crypto' | 'pagomovil' | 'transfer';

const USD_METHODS: { id: PaymentMethod; name: string; icon: string }[] = [
    { id: 'card', name: 'Tarjeta de Crédito/Débito', icon: '💳' },
    { id: 'paypal', name: 'PayPal', icon: '🅿️' },
    { id: 'googlepay', name: 'Google Pay', icon: '📱' },
    { id: 'zelle', name: 'Zelle', icon: '💵' },
    { id: 'crypto', name: 'Criptomonedas', icon: '₿' },
];

const BS_METHODS: { id: PaymentMethod; name: string; icon: string }[] = [
    { id: 'pagomovil', name: 'Pago Móvil', icon: '📱' },
    { id: 'transfer', name: 'Transferencia Bancaria', icon: '🏦' },
];

export function DonationCheckout({
    campaignId,
    campaignTitle,
}: DonationCheckoutProps) {
    const [currency, setCurrency] = useState<Currency>('USD');
    const [amount, setAmount] = useState(10);
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('card');
    const [isAnonymous, setIsAnonymous] = useState(false);
    const [donorEmail, setDonorEmail] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    // Exchange rate state
    const [exchangeRate, setExchangeRate] = useState<number | null>(null);
    const [rateExpiresAt, setRateExpiresAt] = useState<string | null>(null);
    const [rateLoading, setRateLoading] = useState(true);
    const [timeRemaining, setTimeRemaining] = useState<string>("");

    // Payment form data
    const [pagoMovilData, setPagoMovilData] = useState({
        bank: "",
        phone: "",
        cedula: "",
    });

    const [transferData, setTransferData] = useState({
        bank: "",
        reference: "",
    });

    // Fetch exchange rate
    useEffect(() => {
        const fetchExchangeRate = async () => {
            try {
                const response = await fetch('/api/exchange-rate');
                const data = await response.json();

                if (response.ok) {
                    setExchangeRate(data.rate);
                    setRateExpiresAt(data.expiresAt);
                } else {
                    setExchangeRate(43.02);
                }
            } catch (error) {
                console.error('Error fetching exchange rate:', error);
                setExchangeRate(43.02);
            } finally {
                setRateLoading(false);
            }
        };

        fetchExchangeRate();
    }, []);

    // Countdown timer
    useEffect(() => {
        if (!rateExpiresAt) return;

        const updateTimer = () => {
            const now = new Date().getTime();
            const expiry = new Date(rateExpiresAt).getTime();
            const diff = expiry - now;

            if (diff <= 0) {
                setTimeRemaining("Expirado");
                return;
            }

            const minutes = Math.floor(diff / 60000);
            const seconds = Math.floor((diff % 60000) / 1000);
            setTimeRemaining(`${minutes}:${seconds.toString().padStart(2, '0')}`);
        };

        updateTimer();
        const interval = setInterval(updateTimer, 1000);
        return () => clearInterval(interval);
    }, [rateExpiresAt]);

    // Change default payment method when currency changes
    useEffect(() => {
        if (currency === 'USD') {
            setPaymentMethod('card');
        } else {
            setPaymentMethod('pagomovil');
        }
    }, [currency]);

    const availableMethods = currency === 'USD' ? USD_METHODS : BS_METHODS;

    const amountInUSD = currency === 'USD' ? amount : amount / (exchangeRate || 43.02);
    const amountInBS = currency === 'BS' ? amount : amount * (exchangeRate || 43.02);

    const handleDonate = async () => {
        setIsLoading(true);
        try {
            // Validation
            if (!isAnonymous && !donorEmail) {
                alert("Por favor ingresa tu correo");
                setIsLoading(false);
                return;
            }

            if (paymentMethod === "pagomovil" && (!pagoMovilData.bank || !pagoMovilData.phone || !pagoMovilData.cedula)) {
                alert("Por favor completa todos los datos de Pago Móvil");
                setIsLoading(false);
                return;
            }

            if (paymentMethod === "transfer" && (!transferData.bank || !transferData.reference)) {
                alert("Por favor completa los datos de la transferencia");
                setIsLoading(false);
                return;
            }

            // Call API
            const response = await fetch("/api/donations", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    campaignId,
                    amountUSD: amountInUSD,
                    paymentMethod,
                    isAnonymous,
                    donorEmail: isAnonymous ? null : donorEmail,
                    pagoMovilData: paymentMethod === "pagomovil" ? pagoMovilData : null,
                    manualPaymentData: paymentMethod === "transfer" ? transferData : null,
                }),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.details || result.error || "Error creating donation");
            }

            if (result.payment && result.payment.success) {
                alert("✅ ¡Donación exitosa!\n\nGracias por tu apoyo.");
                window.location.href = `/campaigns/${campaignId}?donation=success`;
            } else if (result.payment && result.payment.externalId) {
                window.location.href = result.payment.metadata?.checkoutUrl || `/campaigns/${campaignId}`;
            } else {
                alert("⏳ Donación registrada\n\nTu donación está pendiente de confirmación.");
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
            {/* Trust Badge */}
            <Alert className="bg-primary/5 border-primary/20">
                <Shield className="h-4 w-4 text-primary" />
                <AlertDescription>
                    <div className="space-y-1">
                        <p className="font-semibold text-sm">LaVaca protege tu donación</p>
                        <p className="text-xs text-muted-foreground">
                            Te garantizamos un reembolso completo durante un año en el caso poco probable
                            de que se produzca algún tipo de fraude.
                        </p>
                    </div>
                </AlertDescription>
            </Alert>

            {/* Exchange Rate Info - Solo si moneda es BS */}
            {currency === 'BS' && exchangeRate && rateExpiresAt && (
                <Alert className="bg-blue-500/5 border-blue-500/20">
                    <TrendingUp className="h-4 w-4 text-blue-500" />
                    <AlertDescription className="flex items-center justify-between">
                        <span className="text-sm">
                            <strong>Tasa BCV:</strong> {exchangeRate.toFixed(2)} Bs/USD
                        </span>
                        <span className="text-xs flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Válida: <strong>{timeRemaining}</strong>
                        </span>
                    </AlertDescription>
                </Alert>
            )}

            <Card>
                <CardHeader>
                    <CardTitle className="text-xl">Donación para: {campaignTitle}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Currency Selector */}
                    <div className="space-y-3">
                        <Label className="text-base font-semibold">Moneda</Label>
                        <Tabs value={currency} onValueChange={(v) => setCurrency(v as Currency)}>
                            <TabsList className="grid w-full grid-cols-2">
                                <TabsTrigger value="USD" className="flex items-center gap-2">
                                    💵 Dólares (USD)
                                </TabsTrigger>
                                <TabsTrigger value="BS" className="flex items-center gap-2">
                                    🇻🇪 Bolívares (Bs)
                                </TabsTrigger>
                            </TabsList>
                        </Tabs>
                    </div>

                    {/* Amount Input */}
                    {rateLoading ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <Label className="text-base font-semibold">Monto a donar</Label>

                            {/* Quick amounts */}
                            <div className="grid grid-cols-4 gap-2">
                                {(currency === 'USD' ? [10, 25, 50, 100] : [500, 1000, 2000, 5000]).map((preset) => (
                                    <Button
                                        key={preset}
                                        variant={amount === preset ? "default" : "outline"}
                                        size="sm"
                                        onClick={() => setAmount(preset)}
                                    >
                                        {currency === 'USD' ? '$' : 'Bs'} {preset}
                                    </Button>
                                ))}
                            </div>

                            {/* Custom amount */}
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                                    {currency === 'USD' ? '$' : 'Bs'}
                                </span>
                                <Input
                                    type="number"
                                    value={amount}
                                    onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                                    className="pl-8 text-lg font-semibold h-12"
                                    min={currency === 'USD' ? 1 : 50}
                                />
                            </div>

                            {/* Equivalence - Solo si paga en BS */}
                            {currency === 'BS' && exchangeRate && (
                                <p className="text-sm text-muted-foreground">
                                    Equivalente: <strong>${amountInUSD.toFixed(2)} USD</strong> al cambio BCV
                                </p>
                            )}
                        </div>
                    )}

                    {/* Payment Methods */}
                    <div className="space-y-3">
                        <Label className="text-base font-semibold">Método de pago</Label>
                        <div className="grid grid-cols-1 gap-2">
                            {availableMethods.map((method) => (
                                <button
                                    key={method.id}
                                    onClick={() => setPaymentMethod(method.id)}
                                    className={cn(
                                        "flex items-center gap-3 p-4 rounded-lg border-2 transition-all text-left",
                                        paymentMethod === method.id
                                            ? "border-primary bg-primary/5"
                                            : "border-border hover:border-primary/50"
                                    )}
                                >
                                    <span className="text-2xl">{method.icon}</span>
                                    <span className="font-medium">{method.name}</span>
                                    {paymentMethod === method.id && (
                                        <CheckCircle className="ml-auto h-5 w-5 text-primary" />
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Payment-specific forms */}
                    {paymentMethod === 'pagomovil' && (
                        <div className="space-y-3 p-4 bg-muted/30 rounded-lg">
                            <h4 className="font-semibold text-sm">Datos de Pago Móvil</h4>
                            <div>
                                <Label htmlFor="bank">Banco</Label>
                                <Input
                                    id="bank"
                                    placeholder="Ej: 0102 - Banco de Venezuela"
                                    value={pagoMovilData.bank}
                                    onChange={(e) => setPagoMovilData({ ...pagoMovilData, bank: e.target.value })}
                                />
                            </div>
                            <div>
                                <Label htmlFor="phone">Teléfono</Label>
                                <Input
                                    id="phone"
                                    placeholder="04XX-XXXXXXX"
                                    value={pagoMovilData.phone}
                                    onChange={(e) => setPagoMovilData({ ...pagoMovilData, phone: e.target.value })}
                                />
                            </div>
                            <div>
                                <Label htmlFor="cedula">Cédula</Label>
                                <Input
                                    id="cedula"
                                    placeholder="V-XXXXXXXX"
                                    value={pagoMovilData.cedula}
                                    onChange={(e) => setPagoMovilData({ ...pagoMovilData, cedula: e.target.value })}
                                />
                            </div>
                        </div>
                    )}

                    {paymentMethod === 'transfer' && (
                        <div className="space-y-3 p-4 bg-muted/30 rounded-lg">
                            <h4 className="font-semibold text-sm">Datos de Transferencia</h4>
                            <div>
                                <Label htmlFor="transfer-bank">Banco</Label>
                                <Input
                                    id="transfer-bank"
                                    placeholder="Nombre del banco"
                                    value={transferData.bank}
                                    onChange={(e) => setTransferData({ ...transferData, bank: e.target.value })}
                                />
                            </div>
                            <div>
                                <Label htmlFor="reference">Referencia</Label>
                                <Input
                                    id="reference"
                                    placeholder="Número de referencia"
                                    value={transferData.reference}
                                    onChange={(e) => setTransferData({ ...transferData, reference: e.target.value })}
                                />
                            </div>
                        </div>
                    )}

                    {/* Donor Info */}
                    <div className="space-y-3 border-t pt-4">
                        <h4 className="font-semibold">Información del donante</h4>

                        <div className="flex items-center gap-3">
                            <Checkbox
                                id="anonymous"
                                checked={isAnonymous}
                                onCheckedChange={(checked) => setIsAnonymous(checked as boolean)}
                            />
                            <Label htmlFor="anonymous" className="cursor-pointer text-sm">
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
                                    Recibirás un recibo automático por email
                                </p>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Trust Features */}
            <Card className="bg-muted/30">
                <CardContent className="pt-6">
                    <div className="grid md:grid-cols-3 gap-4 text-center">
                        <div>
                            <Shield className="h-8 w-8 mx-auto mb-2 text-primary" />
                            <h4 className="font-semibold text-sm">Protección Total</h4>
                            <p className="text-xs text-muted-foreground">Garantía de reembolso</p>
                        </div>
                        <div>
                            <RefreshCcw className="h-8 w-8 mx-auto mb-2 text-primary" />
                            <h4 className="font-semibold text-sm">Fácil y Seguro</h4>
                            <p className="text-xs text-muted-foreground">Proceso simple</p>
                        </div>
                        <div>
                            <CheckCircle className="h-8 w-8 mx-auto mb-2 text-primary" />
                            <h4 className="font-semibold text-sm">Recibo Automático</h4>
                            <p className="text-xs text-muted-foreground">Por email</p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Donate Button */}
            <Button
                size="lg"
                className="w-full h-14 text-lg"
                onClick={handleDonate}
                disabled={isLoading || rateLoading}
            >
                {isLoading ? (
                    <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Procesando...
                    </>
                ) : (
                    <>
                        Donar {currency === 'USD' ? `$${amount.toFixed(2)} USD` : `${amount.toFixed(2)} Bs`}
                    </>
                )}
            </Button>

            {/* Security Notice */}
            <div className="text-center space-y-2">
                <p className="text-sm text-muted-foreground flex items-center justify-center gap-2">
                    <Shield className="h-4 w-4" />
                    LaVaca usa encriptación de nivel bancario (256-bit SSL)
                </p>
                <p className="text-xs text-muted-foreground">
                    Consulta nuestra <a href="/garantia" className="underline">Garantía de Donación</a>
                </p>
            </div>
        </div>
    );
}
