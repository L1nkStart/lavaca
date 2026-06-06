"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, ShieldCheck, X, CheckCircle2, Clock, Inbox } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

interface Invitation {
    id: string;
    campaign_id: string;
    invited_by: string;
    invited_email: string;
    invited_name: string | null;
    message: string | null;
    status: string;
    rejection_reason: string | null;
    expires_at: string;
    created_at: string;
    responded_at: string | null;
    campaigns: {
        id: string;
        title: string;
        slug: string | null;
        main_image_url: string | null;
        goal_amount_usd: number;
        current_amount_usd: number;
    } | null;
    inviter: {
        id: string;
        full_name: string;
        email: string;
    } | null;
}

export default function GuarantorDashboardPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [invitations, setInvitations] = useState<Invitation[]>([]);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [rejectReason, setRejectReason] = useState<Record<string, string>>({});
    const [authChecked, setAuthChecked] = useState(false);
    const [userEmail, setUserEmail] = useState<string | null>(null);

    useEffect(() => {
        const checkAuth = async () => {
            const supabase = createClient();
            const { data, error } = await supabase.auth.getUser();
            if (error || !data?.user) {
                router.replace("/auth/login?next=/guarantor/dashboard");
                return;
            }
            setUserEmail(data.user.email || null);
            setAuthChecked(true);
        };
        checkAuth();
    }, [router]);

    useEffect(() => {
        if (authChecked) loadInvitations();
    }, [authChecked]);

    const loadInvitations = async () => {
        setLoading(true);
        try {
            const response = await fetch("/api/guarantor/invitations?as=invitee", {
                cache: "no-store",
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data?.error || "Error");
            setInvitations(data.invitations || []);
        } catch (error: any) {
            toast.error(error?.message || "Error al cargar invitaciones");
        } finally {
            setLoading(false);
        }
    };

    const respond = async (id: string, action: "accept" | "reject") => {
        setProcessingId(id);
        try {
            const response = await fetch(`/api/guarantor/invitations/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action,
                    reason: action === "reject" ? rejectReason[id] || null : null,
                }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data?.error || "Error");

            toast.success(
                action === "accept" ? "Invitación aceptada" : "Invitación rechazada"
            );
            loadInvitations();
        } catch (error: any) {
            toast.error(error?.message || "Error al responder");
        } finally {
            setProcessingId(null);
        }
    };

    const pending = invitations.filter((i) => i.status === "pending");
    const history = invitations.filter((i) => i.status !== "pending");

    if (!authChecked) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <main className="min-h-screen bg-muted/30">
            <div className="max-w-5xl mx-auto px-4 py-6 sm:py-10 space-y-6">
                <div className="space-y-2">
                    <div className="flex items-center gap-2">
                        <ShieldCheck className="h-6 w-6 text-primary" />
                        <h1 className="text-2xl sm:text-3xl font-bold">Panel del Garante</h1>
                    </div>
                    <p className="text-muted-foreground text-sm">
                        Aquí ves las invitaciones que te hacen creadores para avalar sus campañas.
                        Tu correo: <strong>{userEmail || "—"}</strong>
                    </p>
                </div>

                <Alert>
                    <ShieldCheck className="h-4 w-4" />
                    <AlertDescription className="text-sm">
                        Antes de que tu aval aparezca públicamente, debes completar la
                        verificación de garante (KYC) desde tu <Link href="/profile" className="underline">perfil</Link>.
                    </AlertDescription>
                </Alert>

                <Tabs defaultValue="pending" className="space-y-4">
                    <TabsList className="grid w-full grid-cols-2 sm:w-auto sm:inline-grid">
                        <TabsTrigger value="pending">
                            <Clock className="h-4 w-4 mr-2" />
                            Pendientes ({pending.length})
                        </TabsTrigger>
                        <TabsTrigger value="history">
                            <Inbox className="h-4 w-4 mr-2" />
                            Historial ({history.length})
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="pending">
                        {loading ? (
                            <div className="py-10 flex justify-center">
                                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                            </div>
                        ) : pending.length === 0 ? (
                            <Card>
                                <CardContent className="py-10 text-center">
                                    <Inbox className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                                    <p className="text-muted-foreground">
                                        No tienes invitaciones pendientes.
                                    </p>
                                </CardContent>
                            </Card>
                        ) : (
                            <div className="space-y-4">
                                {pending.map((inv) => (
                                    <Card key={inv.id}>
                                        <CardHeader>
                                            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                                                <div className="min-w-0">
                                                    <CardTitle className="text-base sm:text-lg line-clamp-2">
                                                        {inv.campaigns?.title || "Campaña"}
                                                    </CardTitle>
                                                    <CardDescription>
                                                        Invitado por <strong>{inv.inviter?.full_name || "—"}</strong>
                                                    </CardDescription>
                                                </div>
                                                <Badge variant="outline" className="shrink-0">
                                                    Expira {new Date(inv.expires_at).toLocaleDateString("es-VE")}
                                                </Badge>
                                            </div>
                                        </CardHeader>
                                        <CardContent className="space-y-3">
                                            {inv.message && (
                                                <div className="p-3 bg-muted/50 rounded text-sm">
                                                    <p className="text-xs text-muted-foreground mb-1">Mensaje:</p>
                                                    <p className="whitespace-pre-wrap">{inv.message}</p>
                                                </div>
                                            )}

                                            {inv.campaigns && (
                                                <div className="text-xs text-muted-foreground">
                                                    Meta: ${inv.campaigns.goal_amount_usd.toLocaleString()} ·
                                                    Recaudado: ${inv.campaigns.current_amount_usd.toLocaleString()}
                                                </div>
                                            )}

                                            <div className="flex flex-col sm:flex-row gap-2">
                                                {inv.campaigns?.id && (
                                                    <Button variant="outline" size="sm" asChild className="sm:flex-1">
                                                        <Link href={`/campaigns/${inv.campaigns.id}`}>
                                                            Ver campaña
                                                        </Link>
                                                    </Button>
                                                )}
                                                <Button
                                                    size="sm"
                                                    onClick={() => respond(inv.id, "accept")}
                                                    disabled={processingId === inv.id}
                                                    className="sm:flex-1"
                                                >
                                                    {processingId === inv.id ? (
                                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                    ) : (
                                                        <CheckCircle2 className="h-4 w-4 mr-2" />
                                                    )}
                                                    Aceptar
                                                </Button>
                                            </div>

                                            <details className="text-sm">
                                                <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                                                    Rechazar invitación
                                                </summary>
                                                <div className="mt-2 space-y-2">
                                                    <Textarea
                                                        placeholder="Motivo (opcional)"
                                                        value={rejectReason[inv.id] || ""}
                                                        onChange={(e) =>
                                                            setRejectReason((prev) => ({
                                                                ...prev,
                                                                [inv.id]: e.target.value,
                                                            }))
                                                        }
                                                        rows={2}
                                                    />
                                                    <Button
                                                        variant="destructive"
                                                        size="sm"
                                                        onClick={() => respond(inv.id, "reject")}
                                                        disabled={processingId === inv.id}
                                                    >
                                                        <X className="h-4 w-4 mr-2" />
                                                        Confirmar rechazo
                                                    </Button>
                                                </div>
                                            </details>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </TabsContent>

                    <TabsContent value="history">
                        {loading ? (
                            <div className="py-10 flex justify-center">
                                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                            </div>
                        ) : history.length === 0 ? (
                            <Card>
                                <CardContent className="py-10 text-center">
                                    <p className="text-muted-foreground">Sin historial.</p>
                                </CardContent>
                            </Card>
                        ) : (
                            <div className="space-y-3">
                                {history.map((inv) => (
                                    <Card key={inv.id}>
                                        <CardContent className="pt-4">
                                            <div className="flex items-center justify-between gap-3">
                                                <div className="min-w-0">
                                                    <p className="font-medium line-clamp-1">
                                                        {inv.campaigns?.title || "Campaña"}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {new Date(
                                                            inv.responded_at || inv.created_at
                                                        ).toLocaleDateString("es-VE")}
                                                    </p>
                                                </div>
                                                <Badge
                                                    variant={
                                                        inv.status === "accepted" ? "default" : "secondary"
                                                    }
                                                    className="capitalize shrink-0"
                                                >
                                                    {inv.status}
                                                </Badge>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </TabsContent>
                </Tabs>
            </div>
        </main>
    );
}
