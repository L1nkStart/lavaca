import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    Newspaper,
    Sparkles,
    Mail,
    ArrowRight,
    Megaphone,
    TrendingUp,
    Heart,
} from "lucide-react";

export const metadata = {
    title: "Blog | LaVaca",
    description:
        "Historias, guías y novedades sobre crowdfunding, transparencia y campañas exitosas en Venezuela.",
};

const PLACEHOLDER_POSTS = [
    {
        icon: Megaphone,
        category: "Anuncios",
        title: "Pronto: las primeras historias de LaVaca",
        excerpt:
            "Estamos preparando los primeros artículos con guías de buenas prácticas, historias de campañas exitosas y consejos para creadores. Mantente atento.",
    },
    {
        icon: TrendingUp,
        category: "Educación",
        title: "Cómo escribir una campaña que conecte con tus donantes",
        excerpt:
            "Las campañas que más recaudan no son las que piden más dinero, son las que cuentan mejor su historia. Una guía paso a paso (en preparación).",
    },
    {
        icon: Heart,
        category: "Historias",
        title: "Casos reales: campañas que cambiaron una vida",
        excerpt:
            "Cada mes destacaremos una campaña verificada que logró su meta y contaremos su impacto real. Próximamente.",
    },
];

export default function BlogPage() {
    return (
        <main className="flex flex-col min-h-screen bg-gradient-to-b from-background via-background to-muted/20">
            {/* Hero */}
            <section className="py-16 sm:py-20 px-4">
                <div className="max-w-5xl mx-auto text-center space-y-5">
                    <div className="inline-flex items-center gap-2 bg-primary/10 rounded-full px-4 py-2">
                        <Sparkles className="w-4 h-4 text-primary" />
                        <span className="text-sm font-medium text-primary">
                            Blog en construcción
                        </span>
                    </div>
                    <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                        Blog LaVaca
                    </h1>
                    <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                        Historias, guías y novedades del mundo del crowdfunding
                        venezolano. Pronto vas a poder leer aquí los primeros artículos.
                    </p>
                </div>
            </section>

            {/* Placeholder posts */}
            <section className="py-8 sm:py-12 px-4">
                <div className="max-w-6xl mx-auto">
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {PLACEHOLDER_POSTS.map((post) => (
                            <Card
                                key={post.title}
                                className="hover:border-primary/40 transition-colors"
                            >
                                <CardContent className="pt-6 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                            <post.icon className="h-5 w-5 text-primary" />
                                        </div>
                                        <Badge variant="secondary" className="text-xs">
                                            {post.category}
                                        </Badge>
                                    </div>
                                    <h3 className="font-semibold text-lg leading-snug">
                                        {post.title}
                                    </h3>
                                    <p className="text-sm text-muted-foreground leading-relaxed">
                                        {post.excerpt}
                                    </p>
                                    <Badge variant="outline" className="text-xs">
                                        Próximamente
                                    </Badge>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            </section>

            {/* Newsletter / CTA */}
            <section className="py-12 sm:py-16 px-4">
                <div className="max-w-4xl mx-auto">
                    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5">
                        <CardContent className="pt-8 pb-8 text-center space-y-5">
                            <div className="inline-flex w-14 h-14 rounded-full bg-primary/10 items-center justify-center">
                                <Mail className="h-7 w-7 text-primary" />
                            </div>
                            <h2 className="text-2xl sm:text-3xl font-bold">
                                Avísame cuando publiquemos
                            </h2>
                            <p className="text-muted-foreground max-w-xl mx-auto">
                                Mientras tanto, podés explorar las campañas activas y ver
                                cómo funcionamos. Vamos a notificarte por email cuando
                                publiquemos el primer artículo.
                            </p>
                            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
                                <Button asChild>
                                    <Link href="/contact">
                                        Dejarme tu email
                                        <ArrowRight className="ml-2 h-4 w-4" />
                                    </Link>
                                </Button>
                                <Button asChild variant="outline">
                                    <Link href="/campaigns">Ver campañas</Link>
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </section>
        </main>
    );
}
