import type { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Términos y Condiciones | LaVaca'
}

export default function TermsPage() {
    return (
        <main className="min-h-screen bg-background px-4 py-12">
            <div className="mx-auto max-w-4xl space-y-8">
                <h1 className="text-3xl font-bold">Términos y Condiciones</h1>

                <section className="space-y-3">
                    <h2 className="text-xl font-semibold">1. Naturaleza de la plataforma</h2>
                    <p className="text-muted-foreground">
                        LaVaca es una plataforma tecnológica de crowdfunding operada por la entidad legal correspondiente en EE. UU.
                        LaVaca no es banco, custodio financiero ni asesor de inversión. LaVaca facilita la conexión entre creadores y donantes.
                    </p>
                </section>

                <section className="space-y-3">
                    <h2 className="text-xl font-semibold">2. Responsabilidad del creador</h2>
                    <p className="text-muted-foreground">
                        Cada creador es el único responsable legal por la veracidad de su campaña, el uso de los fondos recaudados y
                        el cumplimiento de las leyes aplicables en su jurisdicción.
                    </p>
                </section>

                <section className="space-y-3">
                    <h2 className="text-xl font-semibold">3. KYC/AML y revisión manual</h2>
                    <p className="text-muted-foreground">
                        LaVaca puede requerir verificación de identidad (KYC), documentación adicional y revisión manual antes de activar una campaña.
                        La plataforma podrá suspender campañas o cuentas cuando existan señales de fraude, actividades ilícitas o incumplimientos.
                    </p>
                </section>
            </div>
        </main>
    )
}
