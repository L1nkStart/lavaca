"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, Loader2 } from "lucide-react";

type Topic = "general" | "campana" | "donacion" | "garante" | "reporte" | "prensa" | "otro";

const TOPIC_LABELS: Record<Topic, string> = {
    general: "Consulta general",
    campana: "Tengo dudas sobre mi campaña",
    donacion: "Mi donación / recibo",
    garante: "Quiero ser garante",
    reporte: "Reportar una campaña",
    prensa: "Prensa o alianzas",
    otro: "Otro",
};

export function ContactForm() {
    const [topic, setTopic] = useState<Topic>("general");
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [message, setMessage] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        const trimmedName = name.trim();
        const trimmedEmail = email.trim().toLowerCase();
        const trimmedMessage = message.trim();

        if (trimmedName.length < 2) {
            setError("Tu nombre debe tener al menos 2 caracteres.");
            return;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
            setError("Email inválido.");
            return;
        }
        if (trimmedMessage.length < 10) {
            setError("Cuéntanos un poco más (mínimo 10 caracteres).");
            return;
        }

        setSubmitting(true);
        try {
            const response = await fetch("/api/contact", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    topic,
                    name: trimmedName,
                    email: trimmedEmail,
                    message: trimmedMessage,
                }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data?.error || "Error al enviar");

            setSubmitted(true);
            setName("");
            setEmail("");
            setMessage("");
            setTopic("general");
        } catch (err: any) {
            setError(err?.message || "No se pudo enviar el mensaje");
        } finally {
            setSubmitting(false);
        }
    };

    if (submitted) {
        return (
            <Alert className="bg-primary/5 border-primary/30">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                <AlertDescription className="text-sm">
                    <p className="font-medium">¡Mensaje enviado!</p>
                    <p className="text-muted-foreground mt-1">
                        Te respondemos a <strong>{email || "tu correo"}</strong> en
                        menos de 24 horas hábiles.
                    </p>
                    <Button
                        type="button"
                        variant="link"
                        size="sm"
                        className="px-0 mt-2"
                        onClick={() => setSubmitted(false)}
                    >
                        Enviar otro mensaje
                    </Button>
                </AlertDescription>
            </Alert>
        );
    }

    return (
        <form onSubmit={submit} className="space-y-4">
            {error && (
                <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                    <Label htmlFor="contact-name">Nombre</Label>
                    <Input
                        id="contact-name"
                        placeholder="Tu nombre"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        maxLength={120}
                    />
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor="contact-email">Email</Label>
                    <Input
                        id="contact-email"
                        type="email"
                        placeholder="tu@correo.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                    />
                </div>
            </div>

            <div className="space-y-1.5">
                <Label htmlFor="contact-topic">¿Sobre qué nos escribes?</Label>
                <Select value={topic} onValueChange={(v) => setTopic(v as Topic)}>
                    <SelectTrigger id="contact-topic">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {Object.entries(TOPIC_LABELS).map(([value, label]) => (
                            <SelectItem key={value} value={value}>
                                {label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="space-y-1.5">
                <Label htmlFor="contact-message">Mensaje</Label>
                <Textarea
                    id="contact-message"
                    placeholder="Cuéntanos en qué te podemos ayudar…"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={6}
                    required
                    maxLength={2000}
                />
                <p className="text-xs text-muted-foreground">
                    {message.length}/2000 caracteres
                </p>
            </div>

            <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
                {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Enviar mensaje
            </Button>
        </form>
    );
}
