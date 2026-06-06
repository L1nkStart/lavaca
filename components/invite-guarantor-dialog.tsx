"use client";

import { useEffect, useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, ShieldCheck, X } from "lucide-react";

interface Invitation {
    id: string;
    invited_email: string;
    invited_name: string | null;
    status: string;
    created_at: string;
    expires_at: string;
}

interface InviteGuarantorDialogProps {
    campaignId: string;
    triggerLabel?: string;
    triggerVariant?: "default" | "outline" | "ghost" | "secondary";
}

export function InviteGuarantorDialog({
    campaignId,
    triggerLabel = "Invitar garante",
    triggerVariant = "outline",
}: InviteGuarantorDialogProps) {
    const [open, setOpen] = useState(false);
    const [email, setEmail] = useState("");
    const [name, setName] = useState("");
    const [message, setMessage] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [invitations, setInvitations] = useState<Invitation[]>([]);
    const [loadingList, setLoadingList] = useState(false);

    const loadInvitations = async () => {
        setLoadingList(true);
        try {
            const response = await fetch("/api/guarantor/invitations?as=owner", {
                cache: "no-store",
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data?.error || "Error");
            const filtered = (data.invitations || []).filter(
                (inv: any) => inv.campaign_id === campaignId
            );
            setInvitations(filtered);
        } catch (error: any) {
            toast.error(error?.message || "No se pudieron cargar invitaciones");
        } finally {
            setLoadingList(false);
        }
    };

    useEffect(() => {
        if (open) {
            loadInvitations();
        }
    }, [open]);

    const submit = async () => {
        const trimmedEmail = email.trim().toLowerCase();
        if (!trimmedEmail) {
            toast.error("El email es obligatorio");
            return;
        }

        setSubmitting(true);
        try {
            const response = await fetch("/api/guarantor/invitations", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    campaign_id: campaignId,
                    invited_email: trimmedEmail,
                    invited_name: name.trim() || null,
                    message: message.trim() || null,
                }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data?.error || "Error");

            toast.success("Invitación enviada");
            setEmail("");
            setName("");
            setMessage("");
            loadInvitations();
        } catch (error: any) {
            toast.error(error?.message || "No se pudo enviar la invitación");
        } finally {
            setSubmitting(false);
        }
    };

    const cancel = async (id: string) => {
        if (!confirm("¿Cancelar esta invitación?")) return;

        try {
            const response = await fetch(`/api/guarantor/invitations/${id}`, {
                method: "DELETE",
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data?.error || "Error");
            toast.success("Invitación cancelada");
            loadInvitations();
        } catch (error: any) {
            toast.error(error?.message || "Error al cancelar");
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant={triggerVariant} size="sm">
                    <ShieldCheck className="h-4 w-4 mr-2" />
                    {triggerLabel}
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg w-[calc(100vw-2rem)] sm:w-full">
                <DialogHeader>
                    <DialogTitle>Invitar garante</DialogTitle>
                    <DialogDescription>
                        Un garante es una persona u organización verificada (ONG, médico, etc.)
                        que avala públicamente la veracidad de tu campaña.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-3">
                    <div>
                        <Label htmlFor="guarantor-email">Email del garante</Label>
                        <Input
                            id="guarantor-email"
                            type="email"
                            placeholder="garante@ejemplo.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>
                    <div>
                        <Label htmlFor="guarantor-name">Nombre (opcional)</Label>
                        <Input
                            id="guarantor-name"
                            placeholder="Dr. María Pérez"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />
                    </div>
                    <div>
                        <Label htmlFor="guarantor-message">Mensaje (opcional)</Label>
                        <Textarea
                            id="guarantor-message"
                            placeholder="Cuéntale por qué necesitas su aval..."
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            rows={3}
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button onClick={submit} disabled={submitting}>
                        {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        Enviar invitación
                    </Button>
                </DialogFooter>

                <div className="border-t border-border pt-3 mt-2">
                    <p className="text-xs font-semibold text-muted-foreground mb-2">
                        Invitaciones enviadas
                    </p>
                    {loadingList ? (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    ) : invitations.length === 0 ? (
                        <p className="text-xs text-muted-foreground">Aún no has enviado invitaciones.</p>
                    ) : (
                        <div className="space-y-1 max-h-40 overflow-y-auto">
                            {invitations.map((inv) => (
                                <div
                                    key={inv.id}
                                    className="flex items-center justify-between text-xs bg-muted/40 rounded p-2 gap-2"
                                >
                                    <div className="min-w-0">
                                        <p className="truncate font-medium">{inv.invited_email}</p>
                                        <p className="text-muted-foreground capitalize">{inv.status}</p>
                                    </div>
                                    {inv.status === "pending" && (
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            className="h-6 w-6 shrink-0"
                                            onClick={() => cancel(inv.id)}
                                            aria-label="Cancelar invitación"
                                        >
                                            <X className="h-3.5 w-3.5" />
                                        </Button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
