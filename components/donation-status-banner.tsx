"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
    CheckCircle2,
    Clock,
    XCircle,
    AlertCircle,
    Heart,
    HelpCircle,
    X,
} from "lucide-react";

type Status = "pending" | "success" | "cancelled" | "failed" | null;

/**
 * Banner que se muestra arriba de la campaña cuando el donante vuelve del
 * checkout. Cubre 4 escenarios:
 *
 *   ?donation=success    → pago automático confirmado, gracias.
 *   ?donation=pending    → pago manual (Zelle, PagoMóvil, transferencia,
 *                          o automatizado sin credenciales). Explicamos
 *                          que está en revisión y aparecerá cuando se
 *                          apruebe, para evitar el "¿dónde fue mi pago?".
 *   ?donation=cancelled  → el donante volvió desde Stripe/PayPal sin pagar.
 *   ?donation=failed     → el pago falló o fue rechazado.
 */
export function DonationStatusBanner() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();
    const [dismissed, setDismissed] = useState(false);

    const status = (searchParams.get("donation") as Status) || null;

    useEffect(() => {
        // Si el usuario navega manualmente a otra URL sin el param, reseteamos
        // el estado dismissed (otro flujo de donación podría ocurrir).
        if (!status) setDismissed(false);
    }, [status]);

    if (!status || dismissed) return null;

    const dismiss = () => {
        setDismissed(true);
        // Limpia el query param para que un reload no vuelva a mostrar el banner.
        const params = new URLSearchParams(searchParams.toString());
        params.delete("donation");
        const qs = params.toString();
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    };

    if (status === "success") {
        return (
            <BannerShell
                variant="success"
                icon={<CheckCircle2 className="h-5 w-5" />}
                title="¡Gracias por tu donación! 🎉"
                onClose={dismiss}
            >
                <p className="text-sm">
                    Tu aporte fue recibido y ya está acreditado a la campaña.
                    Te enviamos el recibo al correo que registraste. Si querés
                    ver el detalle, revisá tu{" "}
                    <Link href="/profile" className="font-semibold underline">
                        historial de donaciones
                    </Link>
                    .
                </p>
            </BannerShell>
        );
    }

    if (status === "pending") {
        return (
            <BannerShell
                variant="pending"
                icon={<Clock className="h-5 w-5" />}
                title="Tu donación está en revisión"
                onClose={dismiss}
            >
                <div className="text-sm space-y-2">
                    <p>
                        Recibimos tu reporte de pago. Nuestro equipo lo está
                        verificando manualmente: una vez confirmado, tu donación{" "}
                        <strong>aparecerá automáticamente en esta página</strong>{" "}
                        y el monto sumará a la meta de la campaña.
                    </p>
                    <p className="text-xs opacity-90">
                        Tiempo estimado de aprobación: <strong>menos de 24 horas hábiles</strong>.
                        Te avisaremos por correo cuando esté lista.
                    </p>
                    <div className="flex flex-wrap gap-2 pt-2">
                        <Button
                            asChild
                            size="sm"
                            variant="outline"
                            className="bg-background/50"
                        >
                            <Link href="/profile">
                                <Heart className="h-3.5 w-3.5 mr-2" />
                                Ver mis donaciones
                            </Link>
                        </Button>
                        <Button
                            asChild
                            size="sm"
                            variant="ghost"
                        >
                            <Link href="/contact">
                                <HelpCircle className="h-3.5 w-3.5 mr-2" />
                                ¿Tenés una duda?
                            </Link>
                        </Button>
                    </div>
                </div>
            </BannerShell>
        );
    }

    if (status === "cancelled") {
        return (
            <BannerShell
                variant="info"
                icon={<AlertCircle className="h-5 w-5" />}
                title="Donación cancelada"
                onClose={dismiss}
            >
                <p className="text-sm">
                    No completaste el pago. Si querés intentar de nuevo, hacé click
                    en "Donar Ahora". Si tuviste un problema, contanos en{" "}
                    <Link href="/contact" className="font-semibold underline">
                        contacto
                    </Link>{" "}
                    y te ayudamos.
                </p>
            </BannerShell>
        );
    }

    // failed
    return (
        <BannerShell
            variant="error"
            icon={<XCircle className="h-5 w-5" />}
            title="No pudimos procesar tu donación"
            onClose={dismiss}
        >
            <p className="text-sm">
                El pago no se completó. Si el dinero salió de tu cuenta,{" "}
                <strong>contactanos en menos de 24 horas</strong> y lo resolvemos.
                Probá con otro método de pago o escribinos a{" "}
                <Link href="/contact" className="font-semibold underline">
                    /contact
                </Link>
                .
            </p>
        </BannerShell>
    );
}

interface BannerShellProps {
    variant: "success" | "pending" | "info" | "error";
    icon: React.ReactNode;
    title: string;
    children: React.ReactNode;
    onClose: () => void;
}

const VARIANT_CLASSES: Record<BannerShellProps["variant"], string> = {
    success:
        "bg-primary/10 border-primary/30 text-primary-foreground [&_*]:text-foreground",
    pending:
        "bg-amber-50 border-amber-300 dark:bg-amber-950/40 dark:border-amber-800 text-amber-900 dark:text-amber-100",
    info:
        "bg-blue-50 border-blue-200 dark:bg-blue-950/40 dark:border-blue-800 text-blue-900 dark:text-blue-100",
    error:
        "bg-destructive/10 border-destructive/30 text-destructive [&_*]:text-foreground",
};

const ICON_BG: Record<BannerShellProps["variant"], string> = {
    success: "bg-primary/20 text-primary",
    pending: "bg-amber-200/70 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300",
    info: "bg-blue-200/70 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300",
    error: "bg-destructive/20 text-destructive",
};

function BannerShell({ variant, icon, title, children, onClose }: BannerShellProps) {
    return (
        <div
            className={`relative rounded-lg border-2 px-4 py-3 sm:px-5 sm:py-4 ${VARIANT_CLASSES[variant]}`}
            role="status"
            aria-live="polite"
        >
            <button
                onClick={onClose}
                className="absolute top-2 right-2 p-1 rounded hover:bg-foreground/10 transition-colors"
                aria-label="Cerrar"
            >
                <X className="h-4 w-4" />
            </button>
            <div className="flex items-start gap-3 pr-6">
                <div
                    className={`shrink-0 mt-0.5 rounded-full w-9 h-9 flex items-center justify-center ${ICON_BG[variant]}`}
                >
                    {icon}
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                    <h3 className="font-bold text-sm sm:text-base">{title}</h3>
                    {children}
                </div>
            </div>
        </div>
    );
}
