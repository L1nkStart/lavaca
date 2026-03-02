import type { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Política de Reembolso | LaVaca'
}

export default function RefundPolicyPage() {
    return (
        <main className="min-h-screen bg-background px-4 py-12">
            <div className="mx-auto max-w-4xl space-y-8">
                <h1 className="text-3xl font-bold">Política de Reembolso</h1>

                <section className="space-y-3">
                    <h2 className="text-xl font-semibold">1. Donaciones no reembolsables</h2>
                    <p className="text-muted-foreground">
                        Las donaciones son voluntarias y, por regla general, no son reembolsables por parte de LaVaca una vez
                        que los fondos han sido liquidados al creador de la campaña.
                    </p>
                </section>

                <section className="space-y-3">
                    <h2 className="text-xl font-semibold">2. Disputas y fraude</h2>
                    <p className="text-muted-foreground">
                        Si se reporta una posible estafa o incumplimiento grave, LaVaca investigará el caso, podrá suspender la cuenta,
                        bloquear retiros pendientes y colaborar con el procesador de pagos y autoridades competentes.
                    </p>
                </section>

                <section className="space-y-3">
                    <h2 className="text-xl font-semibold">3. Criterios excepcionales</h2>
                    <p className="text-muted-foreground">
                        Cualquier excepción de reembolso estará sujeta a revisión interna, trazabilidad documental y disponibilidad de fondos,
                        según las reglas del procesador de pagos y la normativa aplicable.
                    </p>
                </section>
            </div>
        </main>
    )
}
