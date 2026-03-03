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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { isLikelyRestrictedRegion, loadStripeSdkConditionally } from "@/lib/payments/stripe-loader";
import { createClient } from "@/lib/supabase/client";

interface DonationCheckoutProps {
    campaignId: string;
    campaignTitle: string;
}

type Currency = 'USD' | 'BS';
type PaymentMethod = 'card' | 'paypal' | 'googlepay' | 'zelle' | 'crypto' | 'pagomovil' | 'transfer';

interface PaymentMethodConfig {
    code: PaymentMethod;
    name: string;
    description?: string | null;
    is_active: boolean;
    display_order: number;
    settings: Record<string, any>;
}

interface TransferAccount {
    id: string;
    method_code: string;
    bank_name: string;
    account_holder: string;
    account_number: string;
    account_type?: string | null;
    document_id?: string | null;
    currency: string;
    instructions?: string | null;
    is_active: boolean;
    display_order: number;
}

const STRIPE_METHODS: PaymentMethod[] = ['card'];
const MANUAL_METHODS: PaymentMethod[] = ['zelle', 'pagomovil', 'transfer'];

const METHOD_META: Record<PaymentMethod, { icon: string; defaultName: string }> = {
    card: { icon: '💳', defaultName: 'Tarjeta de Crédito/Débito' },
    paypal: { icon: '🅿️', defaultName: 'PayPal' },
    googlepay: { icon: '📱', defaultName: 'Google Pay' },
    zelle: { icon: '💵', defaultName: 'Zelle' },
    crypto: { icon: '₿', defaultName: 'Binance Pay' },
    pagomovil: { icon: '📱', defaultName: 'Pago Móvil' },
    transfer: { icon: '🏦', defaultName: 'Transferencia Bancaria' },
};

const USD_ALLOWED_METHODS: PaymentMethod[] = ['card', 'zelle', 'crypto'];
const BS_ALLOWED_METHODS: PaymentMethod[] = ['pagomovil', 'transfer'];

export function DonationCheckout({
    campaignId,
    campaignTitle,
}: DonationCheckoutProps) {
    const [currency, setCurrency] = useState<Currency>('USD');
    const [amount, setAmount] = useState(10);
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('card');
    const [isAnonymous, setIsAnonymous] = useState(false);
    const [donorEmail, setDonorEmail] = useState("");
    const [donorName, setDonorName] = useState("");
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [checkoutError, setCheckoutError] = useState<string | null>(null);
    const [internationalMethodWarning, setInternationalMethodWarning] = useState<string | null>(null);
    const [stripeStatus, setStripeStatus] = useState<'checking' | 'available' | 'blocked'>('checking');
    const [paymentConfigs, setPaymentConfigs] = useState<PaymentMethodConfig[]>([]);
    const [configuredTransferAccounts, setConfiguredTransferAccounts] = useState<TransferAccount[]>([]);

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
        accountId: "",
        reference: "",
    });

    const [zelleData, setZelleData] = useState({
        reference: "",
    });

    useEffect(() => {
        const preloadAuthenticatedEmail = async () => {
            try {
                const supabase = createClient();
                const { data, error } = await supabase.auth.getUser();

                if (error) {
                    console.error('Error fetching auth user:', error);
                    return;
                }

                const userEmail = data?.user?.email?.trim() || "";
                const userFullName = data?.user?.user_metadata?.full_name?.trim() || "";
                if (userEmail) {
                    setIsAuthenticated(true);
                    setDonorEmail(userEmail);
                }

                if (userFullName) {
                    setDonorName(userFullName);
                }
            } catch (error) {
                console.error('Error preloading donor email:', error);
            }
        };

        preloadAuthenticatedEmail();
    }, []);

    useEffect(() => {
        const fetchPaymentConfigs = async () => {
            try {
                const response = await fetch('/api/payment-methods', { cache: 'no-store' });
                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data?.error || 'No se pudo cargar la configuración de pagos');
                }

                setPaymentConfigs(data.methods || []);
                setConfiguredTransferAccounts(data.transferAccounts || []);
            } catch (error) {
                console.error('Error fetching payment configs:', error);
            }
        };

        fetchPaymentConfigs();
    }, []);

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

    const activeConfigMethods = paymentConfigs.filter((config) => config.is_active);

    const availableMethods = activeConfigMethods
        .filter((config) => {
            const method = config.code;
            if (currency === 'USD' && !USD_ALLOWED_METHODS.includes(method)) return false;
            if (currency === 'BS' && !BS_ALLOWED_METHODS.includes(method)) return false;
            if (method === 'card' && stripeStatus !== 'available') return false;
            return true;
        })
        .sort((a, b) => a.display_order - b.display_order)
        .map((config) => ({
            id: config.code,
            name: config.name || METHOD_META[config.code].defaultName,
            icon: METHOD_META[config.code].icon,
            description: config.description || '',
            settings: config.settings || {},
        }));

    // Keep selected payment method aligned with available configured methods
    useEffect(() => {
        if (availableMethods.length === 0) return;

        const stillAvailable = availableMethods.some((method) => method.id === paymentMethod);
        if (!stillAvailable) {
            setPaymentMethod(availableMethods[0].id);
        }
    }, [availableMethods, paymentMethod]);

    useEffect(() => {
        if (!configuredTransferAccounts.length) return;
        if (!transferData.accountId) {
            setTransferData((prev) => ({ ...prev, accountId: configuredTransferAccounts[0].id }));
        }
    }, [configuredTransferAccounts, transferData.accountId]);

    // Validate Stripe availability once on load
    useEffect(() => {
        const validateStripeAvailability = async () => {
            if (isLikelyRestrictedRegion()) {
                setStripeStatus('blocked');
                setInternationalMethodWarning('Los pagos con tarjeta no están disponibles en tu región actualmente. Puedes donar con Binance Pay o métodos locales.');
                return;
            }

            try {
                await loadStripeSdkConditionally();
                setStripeStatus('available');
                setInternationalMethodWarning(null);
            } catch (error) {
                console.error('Error loading Stripe SDK:', error);
                setStripeStatus('blocked');
                setInternationalMethodWarning('No pudimos habilitar pagos con tarjeta en este momento. Puedes donar con Binance Pay o métodos locales.');
            }
        };

        validateStripeAvailability();
    }, []);

    const handleSelectPaymentMethod = async (method: PaymentMethod) => {
        setCheckoutError(null);

        if (!STRIPE_METHODS.includes(method)) {
            setPaymentMethod(method);
            setInternationalMethodWarning(null);
            return;
        }

        if (stripeStatus !== 'available') {
            setInternationalMethodWarning('Los pagos con tarjeta no están disponibles en este momento. Usa Binance Pay o un método local.');
            return;
        }

        setPaymentMethod(method);

        try {
            await loadStripeSdkConditionally();
            setInternationalMethodWarning(null);
        } catch (error) {
            console.error('Error loading Stripe SDK:', error);
            setInternationalMethodWarning('No pudimos cargar el método de pago internacional. Por favor, verifica tu conexión o intenta con uno de nuestros métodos locales.');
        }
    }

    const selectedMethodConfig = availableMethods.find((method) => method.id === paymentMethod);
    const selectedTransferAccount = configuredTransferAccounts.find((account) => account.id === transferData.accountId);

    const amountInUSD = currency === 'USD' ? amount : amount / (exchangeRate || 43.02);

    const handleDonate = async () => {
        setIsLoading(true);
        setCheckoutError(null);
        try {
            // Validation
            const normalizedDonorEmail = donorEmail.trim().toLowerCase();
            const normalizedDonorName = donorName.trim().replace(/\s+/g, ' ');
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

            if (!normalizedDonorEmail) {
                setCheckoutError("El correo electrónico es obligatorio para procesar la donación y enviar el recibo.");
                return;
            }

            if (!emailRegex.test(normalizedDonorEmail)) {
                setCheckoutError("Ingresa un correo electrónico válido.");
                return;
            }

            if (normalizedDonorName && normalizedDonorName.length < 2) {
                setCheckoutError("El nombre del donante debe tener al menos 2 caracteres o dejarse en blanco.");
                return;
            }

            if (normalizedDonorName.length > 120) {
                setCheckoutError("El nombre del donante no puede superar 120 caracteres.");
                return;
            }

            if (paymentMethod === "pagomovil" && (!pagoMovilData.bank || !pagoMovilData.phone || !pagoMovilData.cedula)) {
                setCheckoutError("Por favor completa todos los datos de Pago Móvil");
                return;
            }

            if (paymentMethod === "transfer" && (!transferData.accountId || !transferData.reference)) {
                setCheckoutError("Por favor completa los datos de la transferencia");
                return;
            }

            if (paymentMethod === "zelle" && !zelleData.reference.trim()) {
                setCheckoutError("La referencia de pago es obligatoria para Zelle.");
                return;
            }

            if (STRIPE_METHODS.includes(paymentMethod)) {
                try {
                    await loadStripeSdkConditionally();
                    setInternationalMethodWarning(null);
                } catch (error) {
                    console.error('International checkout load error:', error);
                    setInternationalMethodWarning('No pudimos cargar el método de pago internacional. Por favor, verifica tu conexión o intenta con uno de nuestros métodos locales.');
                    return;
                }
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
                    donorEmail: normalizedDonorEmail,
                    donorName: normalizedDonorName || null,
                    pagoMovilData: paymentMethod === "pagomovil" ? pagoMovilData : null,
                    manualPaymentData: paymentMethod === "transfer"
                        ? {
                            ...transferData,
                            bank: selectedTransferAccount?.bank_name || null,
                            accountId: selectedTransferAccount?.id || null,
                            accountNumber: selectedTransferAccount?.account_number || null,
                        }
                        : paymentMethod === "zelle"
                            ? {
                                reference: zelleData.reference.trim(),
                            }
                            : null,
                }),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.details || result.error || "Error creating donation");
            }

            const checkoutUrl = result?.payment?.metadata?.checkoutUrl;
            const confirmationType = result?.payment?.metadata?.confirmationType;

            if (checkoutUrl) {
                window.location.href = checkoutUrl;
            } else if (result.payment && result.payment.success && result.payment.status === 'completed' && confirmationType === 'api') {
                window.location.href = `/campaigns/${campaignId}?donation=success`;
            } else if (result.payment && (confirmationType === 'manual' || MANUAL_METHODS.includes(paymentMethod))) {
                window.location.href = `/campaigns/${campaignId}?donation=pending`;
            } else {
                window.location.href = `/campaigns/${campaignId}?donation=pending`;
            }
        } catch (error) {
            console.error("Error:", error);
            setCheckoutError("Ocurrió un error al procesar la donación. Por favor intenta de nuevo.");
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
                    {checkoutError && (
                        <Alert variant="destructive">
                            <AlertDescription>{checkoutError}</AlertDescription>
                        </Alert>
                    )}

                    {internationalMethodWarning && (
                        <Alert className="bg-yellow-500/5 border-yellow-500/30">
                            <AlertDescription>
                                {internationalMethodWarning}
                            </AlertDescription>
                        </Alert>
                    )}

                    {availableMethods.length === 0 && (
                        <Alert className="bg-yellow-500/5 border-yellow-500/30">
                            <AlertDescription>
                                No hay métodos de pago activos para esta moneda en este momento.
                            </AlertDescription>
                        </Alert>
                    )}

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
                                    onClick={() => handleSelectPaymentMethod(method.id)}
                                    className={cn(
                                        "flex items-center gap-3 p-4 rounded-lg border-2 transition-all text-left",
                                        paymentMethod === method.id
                                            ? "border-primary bg-primary/5"
                                            : "border-border hover:border-primary/50"
                                    )}
                                >
                                    <span className="text-2xl">{method.icon}</span>
                                    <div>
                                        <span className="font-medium block">{method.name}</span>
                                        {method.description ? (
                                            <span className="text-xs text-muted-foreground">{method.description}</span>
                                        ) : null}
                                    </div>
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
                            <h4 className="font-semibold text-sm">Datos para pagar</h4>
                            <p className="text-sm text-muted-foreground">
                                Banco: <strong>{String(selectedMethodConfig?.settings?.bank || 'No configurado')}</strong> ·
                                Teléfono: <strong>{String(selectedMethodConfig?.settings?.phone || 'No configurado')}</strong> ·
                                Cédula/RIF: <strong>{String(selectedMethodConfig?.settings?.cedula || 'No configurado')}</strong>
                            </p>
                            {selectedMethodConfig?.settings?.qrImageUrl ? (
                                <div className="rounded border bg-background p-2 inline-block">
                                    <img
                                        src={String(selectedMethodConfig.settings.qrImageUrl)}
                                        alt="QR de Pago Móvil"
                                        className="h-40 w-40 object-contain"
                                    />
                                </div>
                            ) : null}

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

                    {paymentMethod === 'zelle' && (
                        <div className="space-y-3 p-4 bg-muted/30 rounded-lg">
                            <h4 className="font-semibold text-sm">Datos para pagar por Zelle</h4>
                            <p className="text-sm text-muted-foreground">
                                Email receptor: <strong>{String(selectedMethodConfig?.settings?.email || 'No configurado')}</strong>
                            </p>
                            {selectedMethodConfig?.settings?.accountName ? (
                                <p className="text-sm text-muted-foreground">
                                    Titular: <strong>{String(selectedMethodConfig?.settings?.accountName)}</strong>
                                </p>
                            ) : null}

                            <div>
                                <Label htmlFor="zelle-reference">Referencia de pago (obligatoria)</Label>
                                <Input
                                    id="zelle-reference"
                                    placeholder="Código de confirmación / referencia"
                                    value={zelleData.reference}
                                    onChange={(e) => setZelleData({ reference: e.target.value })}
                                />
                            </div>
                        </div>
                    )}

                    {paymentMethod === 'transfer' && (
                        <div className="space-y-3 p-4 bg-muted/30 rounded-lg">
                            <h4 className="font-semibold text-sm">Cuenta destino</h4>
                            <Select
                                value={transferData.accountId}
                                onValueChange={(value) => setTransferData({ ...transferData, accountId: value })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecciona una cuenta bancaria" />
                                </SelectTrigger>
                                <SelectContent>
                                    {configuredTransferAccounts.map((account) => (
                                        <SelectItem key={account.id} value={account.id}>
                                            {account.bank_name} · {account.account_number} · {account.account_holder}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            {selectedTransferAccount ? (
                                <p className="text-xs text-muted-foreground">
                                    {selectedTransferAccount.account_type ? `${selectedTransferAccount.account_type} · ` : ''}
                                    {selectedTransferAccount.document_id ? `${selectedTransferAccount.document_id} · ` : ''}
                                    {selectedTransferAccount.currency}
                                </p>
                            ) : null}

                            <h4 className="font-semibold text-sm">Datos de Transferencia</h4>
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
                        <h4 className="font-semibold">Información de contacto del donante</h4>

                        <Alert className="bg-primary/5 border-primary/20">
                            <AlertDescription className="text-xs">
                                Tu correo y nombre de contacto no se publican en la página. Te pedimos datos reales para poder emitir recibos y gestionar devoluciones (refunds) si fuera necesario.
                            </AlertDescription>
                        </Alert>

                        <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
                            <div className="flex items-start gap-3">
                                <Checkbox
                                    id="anonymous"
                                    checked={isAnonymous}
                                    onCheckedChange={(checked) => setIsAnonymous(checked as boolean)}
                                />
                                <div className="space-y-1">
                                    <Label htmlFor="anonymous" className="cursor-pointer text-sm font-medium">
                                        Donar de forma anónima
                                    </Label>
                                    <p className="text-xs text-muted-foreground">
                                        Tu nombre no se mostrará públicamente en la campaña, pero conservamos tu correo para recibo y prevención de fraude.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div>
                            <Label htmlFor="email">Correo electrónico (obligatorio)</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="tu@email.com"
                                value={donorEmail}
                                onChange={(e) => setDonorEmail(e.target.value)}
                                disabled={isAuthenticated}
                                required
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                                {isAuthenticated
                                    ? "Usamos el correo verificado de tu cuenta para emitir el recibo automático."
                                    : "Este correo es obligatorio para enviar tu recibo automático en cualquier método de pago."}
                            </p>
                        </div>

                        <div>
                            <Label htmlFor="donor-name">Nombre del donante (opcional)</Label>
                            <Input
                                id="donor-name"
                                type="text"
                                placeholder="Tu nombre"
                                value={donorName}
                                onChange={(e) => setDonorName(e.target.value)}
                                maxLength={120}
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                                Recomendamos usar tu nombre real para facilitar soporte y posibles reembolsos.
                            </p>
                        </div>
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
                disabled={isLoading || rateLoading || availableMethods.length === 0}
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
