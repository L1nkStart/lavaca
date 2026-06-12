import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { createAdminClient } from "@/lib/supabase/admin";
import { Receipt, Heart, Wallet, HandCoins, BadgePercent } from "lucide-react";

export const metadata = {
    title: "Comisiones y tarifas | LaVaca",
    description:
        "Tabla transparente de todas las comisiones de LaVaca: fees por método de pago, comisión de plataforma y costos de retiro.",
};

// Dinámica: evita el prerender en build (createAdminClient necesita envs
// que pueden no existir al compilar) y siempre muestra la config vigente.
export const dynamic = "force-dynamic";

const DONATION_METHOD_LABELS: Record<string, string> = {
    card: "Tarjeta de Crédito/Débito",
    paypal: "PayPal",
    crypto: "Binance Pay (cripto)",
    chinchin: "ChinChin",
    zelle: "Zelle",
    pagomovil: "PagoMóvil",
    transfer: "Transferencia Bancaria",
};

const WITHDRAWAL_ACCOUNT_LABELS: Record<string, string> = {
    bank_bs: "Cuenta Bancaria (Bs.)",
    pagomovil: "PagoMóvil",
    zelle: "Zelle",
    paypal: "PayPal",
    crypto: "Criptomoneda",
};

const formatBs = (value: number) =>
    `Bs ${new Intl.NumberFormat("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value || 0)}`;

const formatUsd = (value: number) =>
    `$${new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value || 0)}`;

function donationFeeLabel(settings: Record<string, any>): string {
    const percent = Number(settings?.donation_fee_percent) || 0;
    const fixed = Number(settings?.donation_fee_fixed_usd) || 0;

    if (percent <= 0 && fixed <= 0) return "Gratis";
    if (percent > 0 && fixed > 0) return `${percent}% + ${formatUsd(fixed)}`;
    if (percent > 0) return `${percent}%`;
    return formatUsd(fixed);
}

function withdrawalFeeLabel(fee: { fee_percent: number; fee_fixed: number; currency: string; is_active: boolean }): string {
    if (!fee.is_active) return "Gratis";
    const percent = Number(fee.fee_percent) || 0;
    const fixed = Number(fee.fee_fixed) || 0;
    const fixedLabel = fee.currency === "BS" ? formatBs(fixed) : formatUsd(fixed);

    if (percent <= 0 && fixed <= 0) return "Gratis";
    if (percent > 0 && fixed > 0) return `${percent}% + ${fixedLabel}`;
    if (percent > 0) return `${percent}%`;
    return fixedLabel;
}

export default async function FeesPage() {
    // Lectura server-side con cliente admin: admin_config no es legible por anon,
    // pero estos campos puntuales son información pública de la plataforma.
    // Si algo falla (envs ausentes, BD caída) la página igual carga con defaults.
    let donationMethods: any[] = [];
    let withdrawalFees: any[] = [];
    let platformCommission = 5;
    let minWithdrawalUsd = 10;
    let minWithdrawalBs = 500;

    try {
        const adminSupabase = createAdminClient();

        const [methodsResult, withdrawalFeesResult, configResult] = await Promise.all([
            adminSupabase
                .from("payment_method_configs")
                .select("code, name, is_active, display_order, settings")
                .eq("is_active", true)
                .order("display_order", { ascending: true }),
            adminSupabase
                .from("withdrawal_fee_configs")
                .select("account_type, currency, fee_percent, fee_fixed, is_active")
                .order("currency", { ascending: true }),
            adminSupabase
                .from("admin_config")
                .select("platform_commission_percentage, min_withdrawal_usd, min_withdrawal_bs")
                .limit(1)
                .maybeSingle(),
        ]);

        donationMethods = methodsResult.data || [];
        withdrawalFees = withdrawalFeesResult.data || [];
        platformCommission = Number(configResult.data?.platform_commission_percentage) || 5;
        minWithdrawalUsd = Number(configResult.data?.min_withdrawal_usd) || 10;
        minWithdrawalBs = Number(configResult.data?.min_withdrawal_bs) || 500;
    } catch (error) {
        console.error("Error loading fees page data:", error);
    }

    return (
        <main className="flex flex-col min-h-screen bg-background">
            {/* Hero */}
            <section className="py-12 sm:py-16 px-4">
                <div className="max-w-3xl mx-auto text-center space-y-4">
                    <div className="inline-flex items-center gap-2 bg-primary/10 rounded-full px-4 py-2">
                        <Receipt className="w-4 h-4 text-primary" />
                        <span className="text-sm font-medium text-primary">
                            Transparencia total
                        </span>
                    </div>
                    <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-primary">
                        Comisiones y tarifas
                    </h1>
                    <p className="text-base sm:text-lg text-muted-foreground">
                        Sin sorpresas: estas son todas las comisiones que aplican en LaVaca.
                        Crear una campaña y donar siempre es gratis; los únicos costos son los
                        de las pasarelas de pago y la comisión de plataforma al retirar.
                    </p>
                </div>
            </section>

            {/* Comisión de plataforma */}
            <section className="py-6 px-4">
                <div className="max-w-3xl mx-auto">
                    <div className="flex items-start gap-3 mb-4">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                            <BadgePercent className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <h2 className="text-xl sm:text-2xl font-bold">Comisión de plataforma</h2>
                            <p className="text-sm text-muted-foreground">
                                Es lo que permite operar LaVaca: verificación de campañas, soporte y protección al donante.
                            </p>
                        </div>
                    </div>
                    <div className="rounded-lg border p-6 flex flex-col sm:flex-row items-center gap-4 justify-between">
                        <div>
                            <p className="text-3xl font-black text-primary">{platformCommission}%</p>
                            <p className="text-sm text-muted-foreground">
                                Se descuenta únicamente al momento del retiro, sobre el monto retirado.
                                Nunca se cobra por adelantado.
                            </p>
                        </div>
                        <div className="text-sm text-muted-foreground rounded-lg bg-muted/40 p-4">
                            <p>Mínimo de retiro: <strong className="text-foreground">{formatUsd(minWithdrawalUsd)}</strong> o <strong className="text-foreground">{formatBs(minWithdrawalBs)}</strong></p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Fees de donación */}
            <section className="py-6 px-4">
                <div className="max-w-3xl mx-auto">
                    <div className="flex items-start gap-3 mb-4">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                            <Heart className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <h2 className="text-xl sm:text-2xl font-bold">Al donar</h2>
                            <p className="text-sm text-muted-foreground">
                                Costo de la pasarela según el método de pago. Si el método es gratis,
                                la campaña recibe el 100% de tu donación.
                            </p>
                        </div>
                    </div>
                    <div className="rounded-lg border overflow-hidden">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Método de pago</TableHead>
                                    <TableHead>Moneda</TableHead>
                                    <TableHead className="text-right">Fee de pasarela</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {donationMethods.map((method: any) => (
                                    <TableRow key={method.code}>
                                        <TableCell className="font-medium">
                                            {method.name || DONATION_METHOD_LABELS[method.code] || method.code}
                                        </TableCell>
                                        <TableCell className="text-muted-foreground">
                                            {["pagomovil", "transfer", "chinchin"].includes(method.code) ? "Bolívares" : "Dólares"}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {donationFeeLabel(method.settings || {}) === "Gratis" ? (
                                                <span className="font-semibold text-primary">Gratis</span>
                                            ) : (
                                                donationFeeLabel(method.settings || {})
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                    <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-4 flex items-start gap-3">
                        <HandCoins className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                        <p className="text-sm text-foreground/80">
                            <strong className="text-foreground">¿Quieres que la campaña reciba el 100%?</strong>{" "}
                            Al donar puedes marcar la opción &quot;Cubrir comisiones&quot; y pagar el fee
                            de la pasarela aparte. La campaña acredita tu donación completa.
                        </p>
                    </div>
                </div>
            </section>

            {/* Fees de retiro */}
            <section className="py-6 px-4">
                <div className="max-w-3xl mx-auto">
                    <div className="flex items-start gap-3 mb-4">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                            <Wallet className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <h2 className="text-xl sm:text-2xl font-bold">Al retirar</h2>
                            <p className="text-sm text-muted-foreground">
                                Costo bancario o de pasarela según el destino del retiro, adicional a la
                                comisión de plataforma. Antes de confirmar cualquier retiro siempre ves
                                el desglose exacto y el neto que vas a recibir.
                            </p>
                        </div>
                    </div>
                    <div className="rounded-lg border overflow-hidden">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Destino del retiro</TableHead>
                                    <TableHead>Moneda</TableHead>
                                    <TableHead className="text-right">Fee</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {withdrawalFees.map((fee: any) => (
                                    <TableRow key={fee.account_type}>
                                        <TableCell className="font-medium">
                                            {WITHDRAWAL_ACCOUNT_LABELS[fee.account_type] || fee.account_type}
                                        </TableCell>
                                        <TableCell className="text-muted-foreground">
                                            {fee.currency === "BS" ? "Bolívares" : "Dólares"}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {withdrawalFeeLabel(fee) === "Gratis" ? (
                                                <span className="font-semibold text-primary">Gratis</span>
                                            ) : (
                                                withdrawalFeeLabel(fee)
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            </section>

            {/* CTA */}
            <section className="py-12 sm:py-16 px-4">
                <div className="max-w-3xl mx-auto">
                    <div className="rounded-2xl border border-primary/20 bg-primary/5 p-8 text-center space-y-4">
                        <h3 className="text-2xl font-bold">¿Tienes dudas sobre las comisiones?</h3>
                        <p className="text-muted-foreground">
                            Escríbenos y te respondemos en menos de 24 horas hábiles.
                        </p>
                        <div className="flex flex-wrap justify-center gap-3">
                            <Button asChild>
                                <Link href="/contact">Contactar al equipo</Link>
                            </Button>
                            <Button variant="outline" asChild>
                                <Link href="/faq">Ver preguntas frecuentes</Link>
                            </Button>
                        </div>
                    </div>
                </div>
            </section>
        </main>
    );
}
