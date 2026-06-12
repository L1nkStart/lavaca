"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Clock, TrendingUp, Shield, CheckCircle, RefreshCcw, HandCoins } from 'lucide-react';
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
type PaymentMethod = 'card' | 'paypal' | 'googlepay' | 'zelle' | 'crypto' | 'pagomovil' | 'transfer' | 'chinchin';

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
    chinchin: { icon: '💸', defaultName: 'ChinChin' },
    pagomovil: { icon: '📱', defaultName: 'Pago Móvil' },
    transfer: { icon: '🏦', defaultName: 'Transferencia Bancaria' },
};

const USD_ALLOWED_METHODS: PaymentMethod[] = ['card', 'paypal', 'zelle', 'crypto'];
const BS_ALLOWED_METHODS: PaymentMethod[] = ['pagomovil', 'transfer', 'chinchin'];

// Bancos venezolanos (código - nombre) para el select de PagoMóvil
const VE_BANKS = [
    { code: '0102', name: 'Banco de Venezuela' },
    { code: '0104', name: 'Venezolano de Crédito' },
    { code: '0105', name: 'Mercantil' },
    { code: '0108', name: 'Provincial' },
    { code: '0114', name: 'Bancaribe' },
    { code: '0115', name: 'Banco Exterior' },
    { code: '0128', name: 'Banco Caroní' },
    { code: '0134', name: 'Banesco' },
    { code: '0137', name: 'Sofitasa' },
    { code: '0138', name: 'Banco Plaza' },
    { code: '0151', name: 'BFC Banco Fondo Común' },
    { code: '0156', name: '100% Banco' },
    { code: '0157', name: 'DelSur' },
    { code: '0163', name: 'Banco del Tesoro' },
    { code: '0168', name: 'Bancrecer' },
    { code: '0169', name: 'Mi Banco' },
    { code: '0171', name: 'Banco Activo' },
    { code: '0172', name: 'Bancamiga' },
    { code: '0174', name: 'Banplus' },
    { code: '0175', name: 'Banco Bicentenario' },
    { code: '0177', name: 'Banfanb' },
    { code: '0191', name: 'BNC Banco Nacional de Crédito' },
];

const CEDULA_PREFIXES = ['V', 'E', 'J', 'G', 'P'];

// Teléfono móvil venezolano: 04XX + 7 dígitos (11 dígitos en total)
const VE_PHONE_REGEX = /^04\d{9}$/;
// Cédula/RIF: solo números, 6 a 9 dígitos
const CEDULA_REGEX = /^\d{6,9}$/;

const AMOUNT_LIMITS: Record<Currency, { min: number; max: number; presets: number[] }> = {
    USD: { min: 1, max: 1_000_000, presets: [10, 25, 50, 100] },
    BS: { min: 50, max: 50_000_000, presets: [500, 1000, 2000, 5000] },
};

const formatMoney = (value: number) =>
    new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(Number.isFinite(value) ? value : 0);

const moneyLabel = (value: number, currency: Currency) =>
    currency === 'USD' ? `$${formatMoney(value)} USD` : `${formatMoney(value)} Bs`;

export function DonationCheckout({
    campaignId,
    campaignTitle,
}: DonationCheckoutProps) {
    const [currency, setCurrency] = useState<Currency>('USD');
    const [amount, setAmount] = useState(10);
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('card');
    const [coverFees, setCoverFees] = useState(false);
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
        cedulaPrefix: "V",
        cedulaNumber: "",
    });

    const [transferData, setTransferData] = useState({
        accountId: "",
        reference: "",
    });

    const [zelleData, setZelleData] = useState({
        reference: "",
    });

    // Comprobante (capture) opcional para pagos manuales.
    const [captureFile, setCaptureFile] = useState<File | null>(null);
    const [captureUrl, setCaptureUrl] = useState<string | null>(null);
    const [captureUploading, setCaptureUploading] = useState(false);
    const [captureError, setCaptureError] = useState<string | null>(null);

    const resetCapture = () => {
        setCaptureFile(null);
        setCaptureUrl(null);
        setCaptureError(null);
    };

    const handleCaptureSelect = async (file: File | null) => {
        setCaptureError(null);
        if (!file) {
            resetCapture();
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            setCaptureError("El archivo no puede superar 5 MB");
            return;
        }
        const allowed = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
        if (!allowed.includes(file.type)) {
            setCaptureError("Formato no permitido. Usa JPG, PNG, WebP o PDF");
            return;
        }
        setCaptureFile(file);
        setCaptureUploading(true);
        try {
            const fd = new FormData();
            fd.append("file", file);
            fd.append("campaignId", campaignId);
            const response = await fetch("/api/donations/capture-upload", {
                method: "POST",
                body: fd,
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data?.error || "Error al subir");
            setCaptureUrl(data.url || null);
        } catch (error: any) {
            setCaptureError(error?.message || "Error al subir el comprobante");
            setCaptureFile(null);
            setCaptureUrl(null);
        } finally {
            setCaptureUploading(false);
        }
    };

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

    // Fetch exchange rate (reusable so the user can refresh an expired rate)
    const fetchExchangeRate = useCallback(async () => {
        try {
            setRateLoading(true);
            const response = await fetch('/api/exchange-rate', { cache: 'no-store' });
            const data = await response.json();

            if (response.ok) {
                setExchangeRate(data.rate);
                setRateExpiresAt(data.expiresAt);
            } else {
                setExchangeRate(43.02);
                setRateExpiresAt(null);
            }
        } catch (error) {
            console.error('Error fetching exchange rate:', error);
            setExchangeRate(43.02);
            setRateExpiresAt(null);
        } finally {
            setRateLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchExchangeRate();
    }, [fetchExchangeRate]);

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
    const amountLimits = AMOUNT_LIMITS[currency];
    const rateExpired = currency === 'BS' && timeRemaining === 'Expirado';
    const amountBelowMin = amount > 0 && amount < amountLimits.min;

    // Preview del fee de pasarela del método seleccionado. Es solo
    // informativo: el servidor recalcula el fee con la config de la BD.
    // El fee se calcula NATIVO en la moneda elegida (mismo criterio que el
    // servidor) para que el preview coincida con lo que se cobra de verdad.
    const feePercent = Number(selectedMethodConfig?.settings?.donation_fee_percent) || 0;
    const feeFixedUsd = Number(selectedMethodConfig?.settings?.donation_fee_fixed_usd) || 0;
    const round2 = (value: number) => Math.round(value * 100) / 100;
    const feeInSelectedCurrency = amount > 0
        ? (currency === 'USD'
            ? round2((amount * feePercent) / 100 + feeFixedUsd)
            : round2((amount * feePercent) / 100 + feeFixedUsd * (exchangeRate || 43.02)))
        : 0;
    const methodHasFee = feeInSelectedCurrency > 0;
    const effectiveCoverFees = methodHasFee && coverFees;
    // Lo que acredita la campaña, en la moneda elegida (sin re-conversiones).
    const netReceivedInSelectedCurrency = effectiveCoverFees
        ? amount
        : Math.max(round2(amount - feeInSelectedCurrency), 0);
    const totalToPay = effectiveCoverFees ? round2(amount + feeInSelectedCurrency) : amount;

    const handleDonate = async () => {
        setIsLoading(true);
        setCheckoutError(null);
        try {
            // Validation
            const limits = AMOUNT_LIMITS[currency];
            const symbol = currency === 'USD' ? '$' : 'Bs ';

            if (!Number.isFinite(amount) || amount <= 0) {
                setCheckoutError("Ingresa un monto válido para donar.");
                return;
            }

            if (amount < limits.min) {
                setCheckoutError(`El monto mínimo por donación es ${symbol}${formatMoney(limits.min)} ${currency}.`);
                return;
            }

            if (amount > limits.max) {
                setCheckoutError(`El monto máximo por donación es ${symbol}${formatMoney(limits.max)} ${currency}.`);
                return;
            }

            if (currency === 'BS' && rateExpired) {
                setCheckoutError("La tasa de cambio expiró. Actualízala antes de continuar para que el monto en dólares sea correcto.");
                return;
            }

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

            if (paymentMethod === "pagomovil") {
                if (!pagoMovilData.bank) {
                    setCheckoutError("Selecciona el banco desde el que hiciste el Pago Móvil.");
                    return;
                }
                if (!VE_PHONE_REGEX.test(pagoMovilData.phone)) {
                    setCheckoutError("El teléfono debe ser un número venezolano válido de 11 dígitos (ej: 04121234567).");
                    return;
                }
                if (!CEDULA_REGEX.test(pagoMovilData.cedulaNumber)) {
                    setCheckoutError("La cédula debe contener solo números (entre 6 y 9 dígitos).");
                    return;
                }
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
                    // Monto Bs exacto: para métodos en bolívares el servidor lo
                    // usa como canónico (evita re-conversiones con tasas distintas).
                    amountBs: currency === 'BS' ? amount : null,
                    paymentMethod,
                    coverFees: effectiveCoverFees,
                    isAnonymous,
                    donorEmail: normalizedDonorEmail,
                    donorName: normalizedDonorName || null,
                    pagoMovilData: paymentMethod === "pagomovil"
                        ? {
                            bank: pagoMovilData.bank,
                            phone: pagoMovilData.phone,
                            cedula: `${pagoMovilData.cedulaPrefix}-${pagoMovilData.cedulaNumber}`,
                        }
                        : null,
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
                    captureUrl: MANUAL_METHODS.includes(paymentMethod) ? captureUrl : null,
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
            {currency === 'BS' && exchangeRate && (
                <Alert className={cn(rateExpired ? 'border-destructive/30 bg-destructive/5' : 'border-primary/20 bg-primary/5')}>
                    <TrendingUp className={cn('h-4 w-4', rateExpired ? 'text-destructive' : 'text-primary')} />
                    <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm">
                            <strong>Tasa BCV:</strong> {exchangeRate.toFixed(2)} Bs/USD
                        </span>
                        {rateExpired ? (
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={fetchExchangeRate}
                                disabled={rateLoading}
                            >
                                <RefreshCcw className={cn('h-3 w-3', rateLoading && 'animate-spin')} />
                                Actualizar tasa
                            </Button>
                        ) : rateExpiresAt ? (
                            <span className="flex items-center gap-1 text-xs">
                                <Clock className="h-3 w-3" />
                                Válida: <strong>{timeRemaining}</strong>
                            </span>
                        ) : null}
                    </AlertDescription>
                </Alert>
            )}

            <Card>
                <CardHeader>
                    <CardTitle className="text-xl break-words">Donación para: {campaignTitle}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div aria-live="assertive">
                        {checkoutError && (
                            <Alert variant="destructive">
                                <AlertDescription>{checkoutError}</AlertDescription>
                            </Alert>
                        )}
                    </div>

                    {internationalMethodWarning && (
                        <Alert className="border-accent/30 bg-accent/5">
                            <AlertDescription>
                                {internationalMethodWarning}
                            </AlertDescription>
                        </Alert>
                    )}

                    {availableMethods.length === 0 && (
                        <Alert className="border-accent/30 bg-accent/5">
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
                            <Label htmlFor="donation-amount" className="text-base font-semibold">
                                Monto a donar
                            </Label>

                            {/* Quick amounts */}
                            <div className="grid grid-cols-4 gap-2">
                                {amountLimits.presets.map((preset) => (
                                    <Button
                                        key={preset}
                                        type="button"
                                        variant={amount === preset ? "default" : "outline"}
                                        size="sm"
                                        aria-pressed={amount === preset}
                                        onClick={() => setAmount(preset)}
                                    >
                                        {currency === 'USD' ? '$' : 'Bs'} {preset}
                                    </Button>
                                ))}
                            </div>

                            {/* Custom amount */}
                            <div className="relative">
                                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-foreground/60">
                                    {currency === 'USD' ? '$' : 'Bs'}
                                </span>
                                <Input
                                    id="donation-amount"
                                    type="number"
                                    inputMode="decimal"
                                    value={amount || ''}
                                    onChange={(e) => {
                                        const raw = e.target.value;
                                        if (raw === '') {
                                            setAmount(0);
                                            return;
                                        }
                                        const parsed = parseFloat(raw);
                                        setAmount(Number.isFinite(parsed) && parsed >= 0 ? parsed : 0);
                                    }}
                                    className="h-12 pl-8 text-lg font-semibold"
                                    min={amountLimits.min}
                                    max={amountLimits.max}
                                    step="0.01"
                                    aria-describedby="amount-hint"
                                    aria-invalid={amountBelowMin}
                                />
                            </div>

                            <p id="amount-hint" className="text-sm">
                                {amountBelowMin ? (
                                    <span className="text-destructive">
                                        El monto mínimo es {currency === 'USD' ? '$' : 'Bs '}
                                        {formatMoney(amountLimits.min)} {currency}.
                                    </span>
                                ) : currency === 'BS' && exchangeRate ? (
                                    <span className="text-foreground/70">
                                        Equivalente:{' '}
                                        <strong className="text-foreground">${formatMoney(amountInUSD)} USD</strong>{' '}
                                        al cambio BCV
                                    </span>
                                ) : (
                                    <span className="text-foreground/60">
                                        Mínimo {currency === 'USD' ? '$' : 'Bs '}
                                        {formatMoney(amountLimits.min)} {currency}.
                                    </span>
                                )}
                            </p>
                        </div>
                    )}

                    {/* Payment Methods */}
                    <div className="space-y-3">
                        <Label className="text-base font-semibold">Método de pago</Label>
                        <div className="grid grid-cols-1 gap-2">
                            {availableMethods.map((method) => (
                                <button
                                    key={method.id}
                                    type="button"
                                    aria-pressed={paymentMethod === method.id}
                                    onClick={() => handleSelectPaymentMethod(method.id)}
                                    className={cn(
                                        "flex items-center gap-3 rounded-lg border-2 p-4 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                        paymentMethod === method.id
                                            ? "border-primary bg-primary/5"
                                            : "border-border hover:border-primary/50"
                                    )}
                                >
                                    <span className="text-2xl" aria-hidden>{method.icon}</span>
                                    <div className="min-w-0">
                                        <span className="block font-medium">{method.name}</span>
                                        {method.description ? (
                                            <span className="text-xs text-foreground/60">{method.description}</span>
                                        ) : null}
                                    </div>
                                    {paymentMethod === method.id && (
                                        <CheckCircle className="ml-auto size-5 shrink-0 text-primary" />
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Desglose: lo que recibe la campaña + opción de cubrir comisiones */}
                    {amount >= amountLimits.min && selectedMethodConfig && (
                        <div className="space-y-3 rounded-lg border border-primary/20 bg-primary/5 p-4">
                            {methodHasFee ? (
                                <>
                                    <div className="space-y-1 text-sm">
                                        <div className="flex items-center justify-between">
                                            <span className="text-foreground/70">Tu donación</span>
                                            <span className="font-medium">{moneyLabel(amount, currency)}</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-foreground/70">
                                                Comisión de {selectedMethodConfig.name}
                                                {feePercent > 0 && ` (${feePercent}%${feeFixedUsd > 0 ? ` + $${formatMoney(feeFixedUsd)}` : ''})`}
                                            </span>
                                            <span className={cn('font-medium', effectiveCoverFees ? 'line-through text-foreground/40' : 'text-destructive')}>
                                                −{moneyLabel(feeInSelectedCurrency, currency)}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between border-t pt-1 text-base">
                                            <span className="font-semibold">La campaña recibirá</span>
                                            <span className="font-bold text-primary">
                                                {moneyLabel(netReceivedInSelectedCurrency, currency)}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between rounded-md bg-background border px-2 py-1.5 text-base">
                                            <span className="font-semibold">Tú pagarás</span>
                                            <span className="font-bold">
                                                {moneyLabel(totalToPay, currency)}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex items-start gap-3 rounded-md border border-border bg-background p-3">
                                        <Checkbox
                                            id="cover-fees"
                                            checked={coverFees}
                                            onCheckedChange={(checked) => setCoverFees(checked as boolean)}
                                        />
                                        <div className="space-y-1">
                                            <Label htmlFor="cover-fees" className="cursor-pointer text-sm font-medium flex items-center gap-1.5">
                                                <HandCoins className="h-4 w-4 text-primary" />
                                                Cubrir comisiones (+{moneyLabel(feeInSelectedCurrency, currency)})
                                            </Label>
                                            <p className="text-xs text-muted-foreground">
                                                Pagas la comisión de la pasarela aparte para que la campaña reciba tu donación completa.
                                            </p>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <p className="flex items-center gap-2 text-sm text-foreground/80">
                                    <CheckCircle className="h-4 w-4 shrink-0 text-primary" />
                                    Sin comisiones de procesamiento: la campaña recibe el monto completo de tu donación.
                                </p>
                            )}
                        </div>
                    )}

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

                            <h4 className="font-semibold text-sm">Datos de Pago Móvil (desde donde pagaste)</h4>
                            <div>
                                <Label htmlFor="bank">Banco emisor</Label>
                                <Select
                                    value={pagoMovilData.bank}
                                    onValueChange={(value) => setPagoMovilData({ ...pagoMovilData, bank: value })}
                                >
                                    <SelectTrigger id="bank">
                                        <SelectValue placeholder="Selecciona tu banco" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {VE_BANKS.map((bank) => (
                                            <SelectItem key={bank.code} value={`${bank.code} - ${bank.name}`}>
                                                {bank.code} - {bank.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label htmlFor="phone">Teléfono</Label>
                                <Input
                                    id="phone"
                                    type="tel"
                                    inputMode="numeric"
                                    placeholder="04121234567"
                                    maxLength={11}
                                    value={pagoMovilData.phone}
                                    onChange={(e) => {
                                        // Solo dígitos, máximo 11 (04XX + 7 dígitos)
                                        const digits = e.target.value.replace(/\D/g, "").slice(0, 11);
                                        setPagoMovilData({ ...pagoMovilData, phone: digits });
                                    }}
                                    aria-invalid={pagoMovilData.phone.length > 0 && !VE_PHONE_REGEX.test(pagoMovilData.phone)}
                                />
                                {pagoMovilData.phone.length > 0 && !VE_PHONE_REGEX.test(pagoMovilData.phone) && (
                                    <p className="text-xs text-destructive mt-1">
                                        Debe ser un número venezolano de 11 dígitos que empiece por 04.
                                    </p>
                                )}
                            </div>
                            <div>
                                <Label htmlFor="cedula">Cédula / RIF</Label>
                                <div className="flex gap-2">
                                    <Select
                                        value={pagoMovilData.cedulaPrefix}
                                        onValueChange={(value) => setPagoMovilData({ ...pagoMovilData, cedulaPrefix: value })}
                                    >
                                        <SelectTrigger className="w-20" aria-label="Tipo de documento">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {CEDULA_PREFIXES.map((prefix) => (
                                                <SelectItem key={prefix} value={prefix}>
                                                    {prefix}-
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <Input
                                        id="cedula"
                                        inputMode="numeric"
                                        placeholder="12345678"
                                        maxLength={9}
                                        className="flex-1"
                                        value={pagoMovilData.cedulaNumber}
                                        onChange={(e) => {
                                            const digits = e.target.value.replace(/\D/g, "").slice(0, 9);
                                            setPagoMovilData({ ...pagoMovilData, cedulaNumber: digits });
                                        }}
                                        aria-invalid={pagoMovilData.cedulaNumber.length > 0 && !CEDULA_REGEX.test(pagoMovilData.cedulaNumber)}
                                    />
                                </div>
                                {pagoMovilData.cedulaNumber.length > 0 && !CEDULA_REGEX.test(pagoMovilData.cedulaNumber) && (
                                    <p className="text-xs text-destructive mt-1">
                                        Solo números, entre 6 y 9 dígitos.
                                    </p>
                                )}
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

                    {/* Comprobante (capture) opcional para pagos manuales */}
                    {MANUAL_METHODS.includes(paymentMethod) && (
                        <div className="space-y-2 p-4 bg-muted/30 rounded-lg">
                            <h4 className="font-semibold text-sm">Comprobante de pago (opcional pero recomendado)</h4>
                            <p className="text-xs text-muted-foreground">
                                Sube una captura (JPG, PNG, WebP) o el PDF del comprobante.
                                Esto acelera la aprobación de tu donación. Máx 5 MB.
                            </p>
                            <Input
                                type="file"
                                accept="image/jpeg,image/png,image/webp,application/pdf"
                                onChange={(e) => handleCaptureSelect(e.target.files?.[0] || null)}
                                disabled={captureUploading}
                                className="cursor-pointer"
                            />
                            {captureUploading && (
                                <p className="text-xs text-muted-foreground flex items-center gap-2">
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                    Subiendo comprobante…
                                </p>
                            )}
                            {captureUrl && !captureUploading && (
                                <p className="flex items-center gap-2 text-xs text-primary">
                                    <CheckCircle className="h-3 w-3 shrink-0" />
                                    <span className="min-w-0 break-all">Comprobante listo ({captureFile?.name})</span>
                                </p>
                            )}
                            {captureError && (
                                <p className="text-xs text-destructive">{captureError}</p>
                            )}
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

            {/* Aviso para métodos manuales — clarifica que va a quedar
                "en revisión" hasta que el admin lo apruebe. Evita la
                sensación de "doné y no veo nada en la campaña". */}
            {MANUAL_METHODS.includes(paymentMethod) && (
                <Alert className="border-accent/30 bg-accent/5">
                    <Clock className="h-4 w-4 text-accent" />
                    <AlertDescription className="text-sm text-foreground/80">
                        <strong className="text-foreground">Pago manual:</strong> tu donación quedará en
                        revisión. Nuestro equipo la verifica y aprueba en menos
                        de 24 horas hábiles; recién ahí aparecerá en la
                        campaña. Te avisamos por correo cuando esté lista.
                    </AlertDescription>
                </Alert>
            )}

            {/* Donate Button */}
            <Button
                size="lg"
                className="h-14 w-full text-lg"
                onClick={handleDonate}
                disabled={
                    isLoading ||
                    rateLoading ||
                    availableMethods.length === 0 ||
                    amount < amountLimits.min ||
                    rateExpired
                }
            >
                {isLoading ? (
                    <>
                        <Loader2 className="mr-2 size-5 animate-spin" />
                        {MANUAL_METHODS.includes(paymentMethod)
                            ? 'Enviando tu reporte…'
                            : 'Procesando…'}
                    </>
                ) : (
                    <>Donar {moneyLabel(totalToPay, currency)}</>
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
