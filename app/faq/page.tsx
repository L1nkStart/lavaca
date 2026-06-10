import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import {
    HelpCircle,
    Heart,
    Wallet,
    Shield,
    Sparkles,
    MessageCircle,
} from "lucide-react";

export const metadata = {
    title: "Preguntas frecuentes | LaVaca",
    description:
        "Resolvemos las dudas más comunes sobre donar, crear campañas, retiros y verificación KYC en LaVaca.",
};

interface FAQ {
    q: string;
    a: string;
}

interface Section {
    icon: typeof HelpCircle;
    title: string;
    description: string;
    items: FAQ[];
}

const SECTIONS: Section[] = [
    {
        icon: Heart,
        title: "Para donantes",
        description: "Cómo donar, recibos y métodos de pago.",
        items: [
            {
                q: "¿Cómo dono a una campaña?",
                a: "Entrá a la campaña que quieras apoyar, hacé click en 'Donar Ahora', elegí el monto y el método de pago. Aceptamos tarjeta, Zelle, PagoMóvil, transferencia bancaria y cripto (cuando los proveedores estén activos).",
            },
            {
                q: "¿Puedo donar de forma anónima?",
                a: "Sí. En el formulario de donación hay una casilla 'Donar de forma anónima'. Tu nombre no aparece públicamente, pero conservamos tu correo para enviarte el recibo y para prevención de fraude.",
            },
            {
                q: "¿Me dan recibo?",
                a: "Sí. Una vez que tu donación se confirma (automática o manualmente), te enviamos un recibo al correo que indicaste.",
            },
            {
                q: "¿Qué pasa si la campaña no llega a la meta?",
                a: "Las campañas en LaVaca son de tipo 'keep what you raise': lo recaudado se entrega al creador aunque no se alcance el 100% de la meta. El creador puede usar los fondos parciales para avanzar en su causa.",
            },
            {
                q: "¿Puedo recuperar mi donación?",
                a: "Sí, cubierto por nuestra garantía de un año en caso de fraude. Más detalle en la página de Garantía de donación.",
            },
        ],
    },
    {
        icon: Sparkles,
        title: "Para creadores",
        description: "Cómo crear, verificarte y publicar campañas.",
        items: [
            {
                q: "¿Cómo creo una campaña?",
                a: "Tenés que registrarte, completar tu perfil KYC (documento de identidad) y esperar verificación. Una vez verificado, vas a 'Crear campaña' y completás el título, historia, meta y documentos de soporte.",
            },
            {
                q: "¿Cuánto cuesta crear una campaña?",
                a: "Crear la campaña es gratis. LaVaca retiene una comisión del 5-8% sobre los fondos recaudados (depende del tipo de campaña y método de pago), que se descuenta en el momento del retiro.",
            },
            {
                q: "¿Cuánto tarda la verificación?",
                a: "Normalmente menos de 24 horas hábiles. Si necesitamos información adicional, te contactamos al correo de tu cuenta.",
            },
            {
                q: "¿Qué es un garante?",
                a: "Un garante es una persona u organización verificada (ONG, médico, profesional reconocido) que avala públicamente la veracidad de tu causa. Tener un garante aumenta drásticamente la confianza de los donantes.",
            },
            {
                q: "¿Cómo invito a un garante?",
                a: "Desde la página de edición de tu campaña hacés click en 'Invitar garante' y mandás la invitación a su email. El garante recibe la invitación en su panel y puede aceptar o rechazar.",
            },
        ],
    },
    {
        icon: Wallet,
        title: "Retiros y dinero",
        description: "Cuándo y cómo retirar lo recaudado.",
        items: [
            {
                q: "¿Cuándo puedo retirar los fondos?",
                a: "Podés solicitar retiro en cualquier momento, sin esperar a que termine la campaña. Lo retirado se descuenta del saldo disponible.",
            },
            {
                q: "¿A dónde llega el dinero?",
                a: "A las cuentas de retiro que configures en tu perfil: cuenta bancaria en Bs, PagoMóvil, Zelle, PayPal o wallet de cripto.",
            },
            {
                q: "¿Cuánto tarda el retiro?",
                a: "Una vez aprobado por el equipo de LaVaca, depende del método: Zelle y PagoMóvil en horas, transferencias bancarias en 1-2 días hábiles, cripto en minutos.",
            },
            {
                q: "¿Hay un monto mínimo de retiro?",
                a: "Sí, $10 USD para evitar que las comisiones de transferencia se coman el envío.",
            },
        ],
    },
    {
        icon: Shield,
        title: "Seguridad y confianza",
        description: "Cómo cuidamos a donantes y creadores.",
        items: [
            {
                q: "¿Cómo verifican que una campaña es real?",
                a: "Verificamos la identidad del creador (KYC con documento oficial), revisamos manualmente la historia y los documentos de soporte (informes médicos, presupuestos, etc.) y opcionalmente requerimos un garante.",
            },
            {
                q: "Detecté una campaña sospechosa, ¿qué hago?",
                a: "Usá el botón 'Reportar' en la campaña o escribinos a reportes@lavaca.com.ve. Revisamos cada reporte y suspendemos las campañas fraudulentas inmediatamente.",
            },
            {
                q: "¿Mis datos están seguros?",
                a: "Sí. Usamos encriptación de nivel bancario (256-bit SSL), los documentos KYC quedan en almacenamiento privado accesible sólo por vos y nuestro equipo, y nunca vendemos datos a terceros.",
            },
            {
                q: "¿LaVaca está regulada?",
                a: "Operamos como plataforma intermediaria. No somos un banco ni guardamos fondos por tiempo prolongado: lo recaudado se transfiere al creador en cuanto él lo solicita.",
            },
        ],
    },
];

export default function FAQPage() {
    return (
        <main className="flex flex-col min-h-screen bg-background">
            {/* Hero */}
            <section className="py-12 sm:py-16 px-4">
                <div className="max-w-3xl mx-auto text-center space-y-4">
                    <div className="inline-flex items-center gap-2 bg-primary/10 rounded-full px-4 py-2">
                        <HelpCircle className="w-4 h-4 text-primary" />
                        <span className="text-sm font-medium text-primary">
                            Preguntas frecuentes
                        </span>
                    </div>
                    <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-primary">
                        Resolvemos tus dudas
                    </h1>
                    <p className="text-base sm:text-lg text-muted-foreground">
                        Si no encontrás lo que buscás, escribinos directamente.
                    </p>
                </div>
            </section>

            {/* Secciones */}
            <section className="py-6 sm:py-8 px-4">
                <div className="max-w-3xl mx-auto space-y-10">
                    {SECTIONS.map((section) => (
                        <div key={section.title}>
                            <div className="flex items-start gap-3 mb-4">
                                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                    <section.icon className="h-5 w-5 text-primary" />
                                </div>
                                <div>
                                    <h2 className="text-xl sm:text-2xl font-bold">
                                        {section.title}
                                    </h2>
                                    <p className="text-sm text-muted-foreground">
                                        {section.description}
                                    </p>
                                </div>
                            </div>

                            <Accordion type="single" collapsible className="border rounded-lg">
                                {section.items.map((item, idx) => (
                                    <AccordionItem
                                        key={`${section.title}-${idx}`}
                                        value={`${section.title}-${idx}`}
                                        className="last:border-b-0"
                                    >
                                        <AccordionTrigger className="px-4 text-left">
                                            {item.q}
                                        </AccordionTrigger>
                                        <AccordionContent className="px-4 pb-4 text-muted-foreground leading-relaxed">
                                            {item.a}
                                        </AccordionContent>
                                    </AccordionItem>
                                ))}
                            </Accordion>
                        </div>
                    ))}
                </div>
            </section>

            {/* CTA Contacto */}
            <section className="py-12 sm:py-16 px-4">
                <div className="max-w-3xl mx-auto">
                    <div className="rounded-2xl border border-primary/20 bg-primary/5 p-8 text-center space-y-4">
                        <div className="inline-flex w-12 h-12 rounded-full bg-primary/10 items-center justify-center">
                            <MessageCircle className="h-6 w-6 text-primary" />
                        </div>
                        <h3 className="text-2xl font-bold">¿Tu pregunta no está aquí?</h3>
                        <p className="text-muted-foreground">
                            Escribinos. Respondemos en menos de 24 horas hábiles.
                        </p>
                        <Button asChild>
                            <Link href="/contact">Ir al formulario de contacto</Link>
                        </Button>
                    </div>
                </div>
            </section>
        </main>
    );
}
