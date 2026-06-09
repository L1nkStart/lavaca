import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
    CheckCircle2,
    Heart,
    Shield,
    Users,
    TrendingUp,
    Zap,
    Globe,
    Wallet,
    FileCheck,
    MessageCircle,
    ArrowRight,
    Sparkles
} from 'lucide-react';

export default function HowItWorksPage() {
    return (
        <main className="flex flex-col min-h-screen bg-background">
            {/* Hero Section */}
            <section className="border-b border-border bg-muted/40 py-20 px-4">
                <div className="max-w-6xl mx-auto">
                    <div className="text-center mb-12">
                        <div className="inline-flex items-center gap-2 bg-primary/10 rounded-full px-4 py-2 mb-6">
                            <Sparkles className="w-4 h-4 text-primary" />
                            <span className="text-sm font-medium text-primary">Crowdfunding Para Venezuela</span>
                        </div>
                        <h1 className="text-5xl md:text-6xl font-black tracking-tight mb-6 text-primary">
                            ¿Cómo Funciona LaVaca?
                        </h1>
                        <p className="text-xl text-foreground/70 max-w-3xl mx-auto leading-relaxed text-pretty">
                            La plataforma de crowdfunding más confiable de Venezuela.
                            Conectamos personas que necesitan ayuda con donantes que quieren hacer la diferencia.
                        </p>
                    </div>
                </div>
            </section>

            {/* Main Steps */}
            <section className="py-16 px-4 bg-muted/30">
                <div className="max-w-6xl mx-auto">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl md:text-4xl font-bold mb-4">
                            Tres Pasos Simples
                        </h2>
                        <p className="text-lg text-muted-foreground">
                            Ya sea que necesites ayuda o quieras donar, el proceso es fácil y seguro
                        </p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8">
                        {/* Step 1 */}
                        <Card className="relative overflow-hidden border-2 hover:border-primary/50 transition-all">
                            <div className="absolute top-0 right-0 w-20 h-20 bg-primary/10 rounded-bl-full" />
                            <CardContent className="pt-8">
                                <div className="flex items-center gap-4 mb-6">
                                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                                        <span className="text-2xl font-bold text-primary">1</span>
                                    </div>
                                    <Heart className="w-8 h-8 text-primary" />
                                </div>
                                <h3 className="text-2xl font-bold mb-4">Crea tu Campaña</h3>
                                <p className="text-muted-foreground mb-6">
                                    Cuenta tu historia, establece tu meta y comparte por qué necesitas apoyo.
                                    Es gratis crear tu campaña y no hay tarifas ocultas.
                                </p>
                                <ul className="space-y-2">
                                    <li className="flex items-start gap-2">
                                        <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                                        <span className="text-sm">Sin costos iniciales</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                                        <span className="text-sm">Agrega fotos y videos</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                                        <span className="text-sm">Recibe en USD o Bs</span>
                                    </li>
                                </ul>
                            </CardContent>
                        </Card>

                        {/* Step 2 */}
                        <Card className="relative overflow-hidden border-2 hover:border-primary/50 transition-all">
                            <div className="absolute top-0 right-0 w-20 h-20 bg-primary/10 rounded-bl-full" />
                            <CardContent className="pt-8">
                                <div className="flex items-center gap-4 mb-6">
                                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                                        <span className="text-2xl font-bold text-primary">2</span>
                                    </div>
                                    <Users className="w-8 h-8 text-primary" />
                                </div>
                                <h3 className="text-2xl font-bold mb-4">Comparte y Difunde</h3>
                                <p className="text-muted-foreground mb-6">
                                    Comparte tu campaña en redes sociales, WhatsApp y con amigos.
                                    Mientras más personas la vean, más apoyo recibirás.
                                </p>
                                <ul className="space-y-2">
                                    <li className="flex items-start gap-2">
                                        <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                                        <span className="text-sm">Herramientas de compartir</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                                        <span className="text-sm">Actualizaciones en tiempo real</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                                        <span className="text-sm">Mensajes de agradecimiento</span>
                                    </li>
                                </ul>
                            </CardContent>
                        </Card>

                        {/* Step 3 */}
                        <Card className="relative overflow-hidden border-2 hover:border-primary/50 transition-all">
                            <div className="absolute top-0 right-0 w-20 h-20 bg-primary/10 rounded-bl-full" />
                            <CardContent className="pt-8">
                                <div className="flex items-center gap-4 mb-6">
                                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                                        <span className="text-2xl font-bold text-primary">3</span>
                                    </div>
                                    <TrendingUp className="w-8 h-8 text-primary" />
                                </div>
                                <h3 className="text-2xl font-bold mb-4">Recibe tus Fondos</h3>
                                <p className="text-muted-foreground mb-6">
                                    Retira tu dinero cuando lo necesites. Transferimos directamente a tu cuenta
                                    bancaria en Venezuela o al exterior.
                                </p>
                                <ul className="space-y-2">
                                    <li className="flex items-start gap-2">
                                        <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                                        <span className="text-sm">Retiros rápidos</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                                        <span className="text-sm">Múltiples métodos de pago</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                                        <span className="text-sm">Soporte 24/7</span>
                                    </li>
                                </ul>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </section>

            {/* For Donors Section */}
            <section className="py-16 px-4">
                <div className="max-w-6xl mx-auto">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl md:text-4xl font-bold mb-4">
                            ¿Quieres Donar?
                        </h2>
                        <p className="text-lg text-muted-foreground">
                            Apoya causas que te importan de forma segura y transparente
                        </p>
                    </div>

                    <div className="grid md:grid-cols-2 gap-8">
                        <Card>
                            <CardContent className="pt-6">
                                <Wallet className="w-12 h-12 text-primary mb-4" />
                                <h3 className="text-xl font-bold mb-3">Múltiples Formas de Pago</h3>
                                <p className="text-muted-foreground mb-4">
                                    Dona con tarjeta de crédito, PayPal, Zelle, Pago Móvil,
                                    transferencia bancaria o criptomonedas. Tú eliges cómo ayudar.
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    <span className="text-xs bg-muted px-3 py-1 rounded-full">💳 Tarjetas</span>
                                    <span className="text-xs bg-muted px-3 py-1 rounded-full">🅿️ PayPal</span>
                                    <span className="text-xs bg-muted px-3 py-1 rounded-full">💵 Zelle</span>
                                    <span className="text-xs bg-muted px-3 py-1 rounded-full">📱 Pago Móvil</span>
                                    <span className="text-xs bg-muted px-3 py-1 rounded-full">₿ Cripto</span>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="pt-6">
                                <Shield className="w-12 h-12 text-primary mb-4" />
                                <h3 className="text-xl font-bold mb-3">100% Seguro y Transparente</h3>
                                <p className="text-muted-foreground mb-4">
                                    Cada campaña es verificada. Usamos encriptación de nivel bancario
                                    y ves exactamente a dónde va tu donación.
                                </p>
                                <ul className="space-y-2">
                                    <li className="flex items-start gap-2">
                                        <CheckCircle2 className="w-5 h-5 text-primary mt-0.5" />
                                        <span className="text-sm">Verificación KYC</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <CheckCircle2 className="w-5 h-5 text-primary mt-0.5" />
                                        <span className="text-sm">Sistema de garantes</span>
                                    </li>
                                </ul>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </section>

            {/* Why LaVaca */}
            <section className="py-16 px-4 bg-muted/30">
                <div className="max-w-6xl mx-auto">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl md:text-4xl font-bold mb-4">
                            ¿Por Qué LaVaca?
                        </h2>
                        <p className="text-lg text-muted-foreground">
                            La plataforma hecha especialmente para venezolanos
                        </p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-6">
                        <Card>
                            <CardContent className="pt-6 text-center">
                                <Globe className="w-10 h-10 text-primary mx-auto mb-4" />
                                <h3 className="font-bold mb-2">Para Venezuela</h3>
                                <p className="text-sm text-muted-foreground">
                                    Entendemos la realidad venezolana. Soporte en Bs y USD,
                                    con métodos de pago locales.
                                </p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="pt-6 text-center">
                                <Zap className="w-10 h-10 text-primary mx-auto mb-4" />
                                <h3 className="font-bold mb-2">Rápido y Fácil</h3>
                                <p className="text-sm text-muted-foreground">
                                    Crea tu campaña en minutos. Sin papeleo complicado,
                                    sin esperas innecesarias.
                                </p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="pt-6 text-center">
                                <MessageCircle className="w-10 h-10 text-primary mx-auto mb-4" />
                                <h3 className="font-bold mb-2">Soporte en Español</h3>
                                <p className="text-sm text-muted-foreground">
                                    Equipo venezolano listo para ayudarte en cada paso
                                    del camino.
                                </p>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </section>

            {/* Categories */}
            <section className="py-16 px-4">
                <div className="max-w-6xl mx-auto">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl md:text-4xl font-bold mb-4">
                            ¿Para Qué Puedes Recaudar?
                        </h2>
                        <p className="text-lg text-muted-foreground">
                            LaVaca apoya todo tipo de causas importantes
                        </p>
                    </div>

                    <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4">
                        {[
                            { icon: '🏥', title: 'Salud', desc: 'Tratamientos y medicinas' },
                            { icon: '📚', title: 'Educación', desc: 'Estudios y formación' },
                            { icon: '💼', title: 'Emprendimientos', desc: 'Negocios e ideas' },
                            { icon: '🏠', title: 'Vivienda', desc: 'Reparaciones y mejoras' },
                            { icon: '🎭', title: 'Arte y Cultura', desc: 'Proyectos creativos' },
                            { icon: '🐕', title: 'Animales', desc: 'Rescate y cuidado' },
                            { icon: '⚡', title: 'Emergencias', desc: 'Ayuda urgente' },
                            { icon: '🌍', title: 'Comunidad', desc: 'Proyectos sociales' },
                        ].map((category) => (
                            <Card key={category.title} className="hover:border-primary/50 transition-all">
                                <CardContent className="pt-6 text-center">
                                    <div className="text-4xl mb-2">{category.icon}</div>
                                    <h3 className="font-bold mb-1">{category.title}</h3>
                                    <p className="text-xs text-muted-foreground">{category.desc}</p>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="border-t border-border bg-muted/40 py-20 px-4">
                <div className="max-w-4xl mx-auto text-center">
                    <h2 className="text-3xl md:text-4xl font-bold mb-6 text-balance">
                        ¿Listo para comenzar?
                    </h2>
                    <p className="text-xl text-foreground/70 mb-8 text-pretty">
                        Únete a miles de venezolanos que ya están haciendo la diferencia
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <Button size="lg" asChild className="h-12">
                            <Link href="/creator/campaigns/create">
                                Crear Campaña Gratis
                                <ArrowRight className="w-4 h-4 ml-2" />
                            </Link>
                        </Button>
                        <Button size="lg" variant="outline" asChild className="h-12">
                            <Link href="/campaigns">
                                Explorar Campañas
                            </Link>
                        </Button>
                    </div>
                </div>
            </section>

            {/* FAQ Preview */}
            <section className="py-16 px-4">
                <div className="max-w-4xl mx-auto">
                    <div className="text-center mb-12">
                        <h2 className="text-3xl md:text-4xl font-bold mb-4">
                            Preguntas Frecuentes
                        </h2>
                    </div>

                    <div className="space-y-4">
                        {[
                            {
                                q: '¿Cuánto cuesta crear una campaña?',
                                a: 'Crear una campaña es completamente GRATIS. Solo cobramos una pequeña comisión del 5% + costos de procesamiento cuando recibes donaciones.'
                            },
                            {
                                q: '¿Cuánto tiempo tarda en llegar el dinero?',
                                a: 'Una vez que solicitas el retiro, los fondos llegan a tu cuenta en 2-5 días hábiles dependiendo del método de pago seleccionado.'
                            },
                            {
                                q: '¿Puedo donar de forma anónima?',
                                a: 'Sí, puedes elegir donar de forma anónima. Tu nombre no aparecerá públicamente en la campaña.'
                            },
                            {
                                q: '¿Qué pasa si no llego a mi meta?',
                                a: 'No hay problema. Puedes retirar cualquier cantidad que hayas recaudado, sin importar si llegaste o no a tu meta.'
                            },
                        ].map((faq, i) => (
                            <Card key={i}>
                                <CardContent className="pt-6">
                                    <h3 className="font-bold mb-2 flex items-start gap-2">
                                        <FileCheck className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                                        {faq.q}
                                    </h3>
                                    <p className="text-muted-foreground pl-7">{faq.a}</p>
                                </CardContent>
                            </Card>
                        ))}
                    </div>

                    <div className="text-center mt-8">
                        <Button variant="ghost" asChild>
                            <Link href="/faq">
                                Ver Todas las Preguntas
                                <ArrowRight className="w-4 h-4 ml-2" />
                            </Link>
                        </Button>
                    </div>
                </div>
            </section>
        </main>
    );
}
