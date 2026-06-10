import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Mail, MessageCircle, ShieldQuestion, Sparkles } from "lucide-react";
import { ContactForm } from "@/components/contact-form";

export const metadata = {
    title: "Contacto | LaVaca",
    description:
        "Escribinos. Atendemos consultas de donantes, creadores, garantes y prensa.",
};

const CHANNELS = [
    {
        icon: Mail,
        title: "Soporte general",
        value: "soporte@lavaca.com.ve",
        href: "mailto:soporte@lavaca.com.ve",
        description: "Para dudas sobre tu cuenta, donaciones o KYC.",
    },
    {
        icon: ShieldQuestion,
        title: "Reportar campaña",
        value: "reportes@lavaca.com.ve",
        href: "mailto:reportes@lavaca.com.ve",
        description: "Si detectaste una campaña sospechosa.",
    },
    {
        icon: MessageCircle,
        title: "Prensa y alianzas",
        value: "hola@lavaca.com.ve",
        href: "mailto:hola@lavaca.com.ve",
        description: "ONGs, medios, partners y propuestas de integración.",
    },
];

export default function ContactPage() {
    return (
        <main className="flex flex-col min-h-screen bg-background">
            {/* Hero */}
            <section className="py-12 sm:py-16 px-4">
                <div className="max-w-3xl mx-auto text-center space-y-4">
                    <div className="inline-flex items-center gap-2 bg-primary/10 rounded-full px-4 py-2">
                        <Sparkles className="w-4 h-4 text-primary" />
                        <span className="text-sm font-medium text-primary">
                            Estamos para ayudarte
                        </span>
                    </div>
                    <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-primary">
                        Contacto
                    </h1>
                    <p className="text-base sm:text-lg text-muted-foreground">
                        Respondemos en menos de 24 horas en días hábiles.
                        Antes de escribir, revisa nuestras{" "}
                        <Link href="/faq" className="text-primary hover:underline">
                            preguntas frecuentes
                        </Link>
                        .
                    </p>
                </div>
            </section>

            {/* Canales */}
            <section className="py-6 sm:py-8 px-4">
                <div className="max-w-5xl mx-auto grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {CHANNELS.map((channel) => (
                        <Card key={channel.title} className="hover:border-primary/40 transition-colors">
                            <CardContent className="pt-6 space-y-3">
                                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                    <channel.icon className="h-5 w-5 text-primary" />
                                </div>
                                <h3 className="font-semibold">{channel.title}</h3>
                                <p className="text-xs text-muted-foreground">
                                    {channel.description}
                                </p>
                                <a
                                    href={channel.href}
                                    className="block text-sm font-medium text-primary hover:underline break-all"
                                >
                                    {channel.value}
                                </a>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </section>

            {/* Formulario */}
            <section className="py-10 sm:py-14 px-4">
                <div className="max-w-3xl mx-auto">
                    <Card>
                        <CardContent className="pt-8 pb-8">
                            <div className="space-y-2 mb-6">
                                <h2 className="text-2xl sm:text-3xl font-bold">
                                    Escribinos directamente
                                </h2>
                                <p className="text-sm text-muted-foreground">
                                    Completá el formulario y te respondemos al correo
                                    que nos dejes.
                                </p>
                            </div>
                            <ContactForm />
                        </CardContent>
                    </Card>
                </div>
            </section>
        </main>
    );
}
