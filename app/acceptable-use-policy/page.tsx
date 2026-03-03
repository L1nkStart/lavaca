import type { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Actividades Prohibidas | LaVaca'
}

export default function AcceptableUsePolicyPage() {
    return (
        <main className="min-h-screen bg-background px-4 py-12">
            <div className="mx-auto max-w-4xl space-y-8">
                <h1 className="text-3xl font-bold">Política de Actividades Prohibidas</h1>

                <p className="text-muted-foreground">
                    Esta política define conductas no permitidas en LaVaca y complementa los Términos y Condiciones,
                    la Garantía de Donación y la Política de Reembolso.
                </p>

                <section className="space-y-3">
                    <h2 className="text-xl font-semibold">1. Usos prohibidos</h2>
                    <p className="text-muted-foreground">
                        Está prohibido financiar o promover actividades ilícitas, incluyendo armas ilegales, drogas, trata de personas,
                        fraude financiero, esquemas ponzi, lavado de dinero o terrorismo.
                    </p>
                </section>

                <section className="space-y-3">
                    <h2 className="text-xl font-semibold">2. Sorteos y rifas no autorizadas</h2>
                    <p className="text-muted-foreground">
                        No se permiten campañas para sorteos, rifas o juegos de azar que no cuenten con los permisos legales requeridos.
                    </p>
                </section>

                <section className="space-y-3">
                    <h2 className="text-xl font-semibold">3. Falsedad, suplantación y ocultamiento</h2>
                    <p className="text-muted-foreground">
                        Está prohibido publicar campañas con información falsa, manipular evidencias, suplantar identidad,
                        ocultar beneficiarios reales o usar métodos de pago de terceros sin autorización.
                    </p>
                </section>

                <section className="space-y-3">
                    <h2 className="text-xl font-semibold">4. Medidas de enforcement</h2>
                    <p className="text-muted-foreground">
                        LaVaca podrá rechazar campañas, suspender cuentas, congelar fondos y reportar información a proveedores de pago
                        y autoridades cuando detecte incumplimientos de esta política.
                    </p>
                    <p className="text-muted-foreground">
                        LaVaca también podrá solicitar documentación KYC/AML adicional, pausar retiros y limitar funcionalidades
                        de la cuenta mientras se realiza la investigación de seguridad.
                    </p>
                </section>
            </div>
        </main>
    )
}
