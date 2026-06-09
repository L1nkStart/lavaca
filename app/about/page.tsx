import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
    Heart,
    Shield,
    Users,
    Target,
    Sparkles,
    Globe2,
    HandshakeIcon,
    Eye,
    ArrowRight,
} from "lucide-react";

export const metadata = {
    title: "Acerca de | LaVaca",
    description:
        "Somos una plataforma venezolana que conecta a personas que necesitan ayuda con donantes que quieren marcar la diferencia.",
};

export default function AboutPage() {
    return (
        <main className="flex flex-col min-h-screen bg-background">
            {/* Hero */}
            <section className="border-b border-border bg-muted/40 py-16 sm:py-20 px-4">
                <div className="max-w-5xl mx-auto text-center">
                    <div className="inline-flex items-center gap-2 bg-primary/10 rounded-full px-4 py-2 mb-6">
                        <Sparkles className="w-4 h-4 text-primary" />
                        <span className="text-sm font-medium text-primary">
                            Crowdfunding hecho en Venezuela
                        </span>
                    </div>
                    <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight mb-6 text-primary">
                        Acerca de LaVaca
                    </h1>
                    <p className="text-lg sm:text-xl text-foreground/70 max-w-3xl mx-auto leading-relaxed text-pretty">
                        Construimos la plataforma de recaudación de fondos
                        más transparente y confiable para Venezuela.
                        Aquí cada bolívar y cada dólar tiene un destino claro.
                    </p>
                </div>
            </section>

            {/* Misión / Visión */}
            <section className="py-12 sm:py-16 px-4">
                <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-6">
                    <Card className="border-primary/20">
                        <CardContent className="pt-6 space-y-3">
                            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                                <Target className="h-6 w-6 text-primary" />
                            </div>
                            <h2 className="text-2xl font-bold">Nuestra misión</h2>
                            <p className="text-muted-foreground leading-relaxed">
                                Resolver el problema más doloroso de la solidaridad en
                                Venezuela: la falta de confianza. Verificamos identidades,
                                acompañamos a creadores con garantes y dejamos cada
                                transacción a la vista del público.
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="border-accent/20">
                        <CardContent className="pt-6 space-y-3">
                            <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center">
                                <Eye className="h-6 w-6 text-accent" />
                            </div>
                            <h2 className="text-2xl font-bold">Nuestra visión</h2>
                            <p className="text-muted-foreground leading-relaxed">
                                Que cuando un venezolano necesite ayuda (para un
                                tratamiento, un negocio, una causa comunitaria),
                                LaVaca sea el primer lugar al que recurra, y que
                                cualquiera del mundo pueda apoyarlo en segundos.
                            </p>
                        </CardContent>
                    </Card>
                </div>
            </section>

            {/* Valores */}
            <section className="py-12 sm:py-16 px-4 bg-muted/30">
                <div className="max-w-6xl mx-auto">
                    <div className="text-center mb-10">
                        <h2 className="text-3xl sm:text-4xl font-bold mb-3">
                            En qué creemos
                        </h2>
                        <p className="text-muted-foreground max-w-2xl mx-auto">
                            Estos cuatro principios definen cada decisión que tomamos.
                        </p>
                    </div>

                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {[
                            {
                                icon: Shield,
                                title: "Transparencia",
                                text:
                                    "Cada campaña muestra meta, progreso, donantes y actualizaciones públicas. Sin letra chica.",
                            },
                            {
                                icon: Heart,
                                title: "Confianza",
                                text:
                                    "KYC obligatorio para crear campañas y sistema de garantes para avales públicos.",
                            },
                            {
                                icon: HandshakeIcon,
                                title: "Cercanía",
                                text:
                                    "Soportamos pagos locales (PagoMóvil, Zelle, transferencias) y divisas internacionales.",
                            },
                            {
                                icon: Globe2,
                                title: "Sin fronteras",
                                text:
                                    "Tu campaña puede recibir apoyo desde cualquier país del mundo, en USD o cripto.",
                            },
                        ].map((value) => (
                            <Card key={value.title}>
                                <CardContent className="pt-6 space-y-3">
                                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                        <value.icon className="h-5 w-5 text-primary" />
                                    </div>
                                    <h3 className="font-semibold">{value.title}</h3>
                                    <p className="text-sm text-muted-foreground">
                                        {value.text}
                                    </p>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            </section>

            {/* Quiénes somos */}
            <section className="py-12 sm:py-16 px-4">
                <div className="max-w-4xl mx-auto text-center">
                    <div className="inline-flex w-14 h-14 rounded-full bg-primary/10 items-center justify-center mb-6">
                        <Users className="h-7 w-7 text-primary" />
                    </div>
                    <h2 className="text-3xl sm:text-4xl font-bold mb-4">
                        Un equipo pequeño con una idea grande
                    </h2>
                    <p className="text-muted-foreground text-lg leading-relaxed mb-6">
                        LaVaca nace en 2026 de la necesidad de tener una alternativa
                        local, sin comisiones desproporcionadas y con un equipo humano
                        que verifica cada caso. Somos venezolanos construyendo para
                        venezolanos.
                    </p>
                    <p className="text-muted-foreground">
                        ¿Querés saber más, sumarte como aliado o ser garante?
                    </p>
                    <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
                        <Button asChild>
                            <Link href="/contact">
                                Contáctanos
                                <ArrowRight className="ml-2 h-4 w-4" />
                            </Link>
                        </Button>
                        <Button asChild variant="outline">
                            <Link href="/how-it-works">Cómo funciona</Link>
                        </Button>
                    </div>
                </div>
            </section>

            {/* CTA final */}
            <section className="py-12 sm:py-16 px-4 bg-primary text-primary-foreground">
                <div className="max-w-4xl mx-auto text-center space-y-4">
                    <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold">
                        Sé parte del cambio
                    </h2>
                    <p className="text-base sm:text-lg opacity-90">
                        Apoya una causa o crea la tuya. Hoy mismo.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
                        <Button
                            size="lg"
                            className="bg-primary-foreground text-primary hover:bg-primary-foreground/90"
                            asChild
                        >
                            <Link href="/campaigns">Explorar campañas</Link>
                        </Button>
                        <Button
                            size="lg"
                            variant="outline"
                            className="border-primary-foreground/40 text-primary-foreground hover:bg-primary-foreground/10"
                            asChild
                        >
                            <Link href="/creator/campaigns/create">Crear campaña</Link>
                        </Button>
                    </div>
                </div>
            </section>
        </main>
    );
}
