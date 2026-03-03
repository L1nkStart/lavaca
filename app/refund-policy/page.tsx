import type { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Política de Reembolso | LaVaca'
}

export default function RefundPolicyPage() {
    return (
        <main className="min-h-screen bg-background px-4 py-12">
            <div className="mx-auto max-w-4xl space-y-8">
                <h1 className="text-3xl font-bold">Política de Reembolso</h1>

                <p className="text-muted-foreground">
                    Esta política forma parte de los Términos y Condiciones y de la Garantía de Donación.
                    Define cuándo aplica un reembolso y cuáles son sus límites operativos.
                </p>

                <section className="space-y-3">
                    <h2 className="text-xl font-semibold">1. Regla general</h2>
                    <p className="text-muted-foreground">
                        Las donaciones son voluntarias. Por regla general, no son reembolsables una vez que los fondos
                        han sido entregados o liquidados al creador/beneficiario.
                    </p>
                </section>

                <section className="space-y-3">
                    <h2 className="text-xl font-semibold">2. Reembolso por fraude antes de la entrega de fondos</h2>
                    <p className="text-muted-foreground">
                        Si el equipo de seguridad de LaVaca detecta fraude antes de que los fondos sean entregados al creador,
                        podrá gestionarse un reembolso de la donación menos los costos de pasarela aplicables.
                    </p>
                    <p className="text-muted-foreground">
                        Para procesar el reembolso se requiere verificar titularidad del método de pago o contar con datos
                        de contacto válidos del donante (correo electrónico registrado en la donación).
                    </p>
                </section>

                <section className="space-y-3">
                    <h2 className="text-xl font-semibold">3. Casos sin reembolso directo por LaVaca</h2>
                    <p className="text-muted-foreground">
                        Si los fondos ya fueron entregados al beneficiario, LaVaca no garantiza reembolso directo.
                        En ese escenario, podrá suspender cuentas, congelar retiros futuros y colaborar con
                        procesadores de pago y autoridades.
                    </p>
                </section>

                <section className="space-y-3">
                    <h2 className="text-xl font-semibold">4. Criterios operativos y cumplimiento</h2>
                    <p className="text-muted-foreground">
                        Toda excepción de reembolso está sujeta a revisión interna, trazabilidad de la operación,
                        disponibilidad de fondos, reglas del procesador de pago y normativa aplicable.
                    </p>
                </section>
            </div>
        </main>
    )
}
