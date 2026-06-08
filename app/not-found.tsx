import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
    Heart,
    Home,
    Search,
    MessageCircle,
    HelpCircle,
    ArrowRight,
    Compass,
} from "lucide-react";

export const metadata = {
    title: "Página no encontrada | LaVaca",
    description: "La página que buscás no existe o fue movida.",
};

const SUGGESTIONS = [
    {
        icon: Search,
        title: "Explorar campañas",
        description: "Descubrí las causas que están recaudando ahora",
        href: "/campaigns",
    },
    {
        icon: Home,
        title: "Volver al inicio",
        description: "La página principal con campañas destacadas",
        href: "/",
    },
    {
        icon: HelpCircle,
        title: "Preguntas frecuentes",
        description: "Quizás encuentres lo que buscás aquí",
        href: "/faq",
    },
    {
        icon: MessageCircle,
        title: "Contáctanos",
        description: "Si necesitás ayuda, escribinos",
        href: "/contact",
    },
];

export default function NotFound() {
    return (
        <main className="flex-1 flex flex-col items-center justify-center py-16 sm:py-24 px-4 bg-gradient-to-b from-background via-background to-muted/20">
            <div className="max-w-3xl w-full mx-auto text-center space-y-8">
                {/* 404 ilustración */}
                <div className="relative inline-block">
                    <div className="text-[10rem] sm:text-[14rem] font-bold leading-none bg-gradient-to-br from-primary via-primary/70 to-accent bg-clip-text text-transparent select-none">
                        404
                    </div>
                    <div className="absolute -top-2 -right-2 sm:-top-4 sm:-right-4">
                        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-primary/10 flex items-center justify-center animate-pulse">
                            <Compass className="w-8 h-8 sm:w-10 sm:h-10 text-primary" />
                        </div>
                    </div>
                </div>

                {/* Mensaje principal */}
                <div className="space-y-3">
                    <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold">
                        Esta página se nos perdió 🐄
                    </h1>
                    <p className="text-base sm:text-lg text-muted-foreground max-w-xl mx-auto">
                        La dirección que buscás no existe, fue movida o quizás
                        escribiste algo distinto. No te preocupes, tenemos varios
                        caminos para reencontrarte.
                    </p>
                </div>

                {/* CTA principal */}
                <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
                    <Button size="lg" asChild>
                        <Link href="/">
                            <Home className="w-4 h-4 mr-2" />
                            Ir al inicio
                        </Link>
                    </Button>
                    <Button size="lg" variant="outline" asChild>
                        <Link href="/campaigns">
                            <Heart className="w-4 h-4 mr-2" />
                            Explorar campañas
                            <ArrowRight className="w-4 h-4 ml-2" />
                        </Link>
                    </Button>
                </div>

                {/* Sugerencias */}
                <div className="pt-8 sm:pt-12">
                    <p className="text-sm font-medium text-muted-foreground mb-4">
                        O quizás te interese
                    </p>
                    <div className="grid sm:grid-cols-2 gap-3">
                        {SUGGESTIONS.map((s) => (
                            <Link
                                key={s.title}
                                href={s.href}
                                className="group block text-left"
                            >
                                <Card className="hover:border-primary/40 hover:shadow-sm transition-all h-full">
                                    <CardContent className="p-4 flex items-start gap-3">
                                        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                                            <s.icon className="w-4 h-4 text-primary" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="font-semibold text-sm group-hover:text-primary transition-colors">
                                                {s.title}
                                            </p>
                                            <p className="text-xs text-muted-foreground line-clamp-2">
                                                {s.description}
                                            </p>
                                        </div>
                                    </CardContent>
                                </Card>
                            </Link>
                        ))}
                    </div>
                </div>
            </div>
        </main>
    );
}
