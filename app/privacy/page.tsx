import type { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Política de Privacidad | LaVaca'
}

export default function PrivacyPage() {
    return (
        <main className="min-h-screen bg-background px-4 py-12">
            <div className="mx-auto max-w-4xl space-y-8">
                <h1 className="text-3xl font-bold">Política de Privacidad</h1>

                <section className="space-y-3">
                    <h2 className="text-xl font-semibold">1. Datos que recopilamos</h2>
                    <p className="text-muted-foreground">
                        Recopilamos datos de cuenta, documentos de identidad, información de campañas y actividad transaccional
                        para operar la plataforma y cumplir obligaciones de seguridad y prevención de fraude.
                    </p>
                </section>

                <section className="space-y-3">
                    <h2 className="text-xl font-semibold">2. Uso de documentos KYC</h2>
                    <p className="text-muted-foreground">
                        Los documentos de cédula, pasaporte o RIF se almacenan en infraestructura segura y se usan exclusivamente
                        para procesos de verificación, auditoría, cumplimiento legal y prevención de lavado de dinero.
                    </p>
                </section>

                <section className="space-y-3">
                    <h2 className="text-xl font-semibold">3. Retención y divulgación</h2>
                    <p className="text-muted-foreground">
                        Conservamos los datos el tiempo necesario para obligaciones contractuales, fiscales y regulatorias.
                        Podremos divulgar información cuando exista requerimiento legal válido o investigación por fraude.
                    </p>
                </section>
            </div>
        </main>
    )
}
