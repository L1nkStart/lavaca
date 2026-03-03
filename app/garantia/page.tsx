import type { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Garantía de Donación | LaVaca'
}

export default function DonationGuaranteePage() {
    return (
        <main className="min-h-screen bg-background px-4 py-12">
            <div className="mx-auto max-w-4xl space-y-8">
                <h1 className="text-3xl font-bold">Garantía de Donación</h1>

                <p className="text-muted-foreground">
                    En LaVaca, la confianza es prioridad. Esta Garantía de Donación define cómo protegemos a los donantes,
                    cómo validamos campañas y bajo qué condiciones aplica un reembolso.
                </p>

                <section className="space-y-3">
                    <h2 className="text-xl font-semibold">1. El Escudo de Verificación (KYC)</h2>
                    <p className="text-muted-foreground">
                        Cada campaña en LaVaca pasa por un proceso de validación de identidad. Exigimos documentos oficiales
                        (Cédula, RIF o Pasaporte) y evidencias del caso (informes médicos, presupuestos o fotos reales)
                        antes de permitir el primer retiro.
                    </p>
                </section>

                <section className="space-y-3">
                    <h2 className="text-xl font-semibold">2. Custodia Segura de los Fondos</h2>
                    <p className="text-muted-foreground">
                        Los fondos recaudados se mantienen en cuentas segregadas de nuestra empresa en Estados Unidos y Venezuela o en
                        bóvedas institucionales de Binance, según el método de pago utilizado. El dinero no se mezcla con
                        los fondos operativos de la plataforma.
                    </p>
                </section>

                <section className="space-y-3">
                    <h2 className="text-xl font-semibold">3. Promesa de Reembolso (Safety Net)</h2>
                    <p className="text-muted-foreground">
                        Si nuestro equipo de seguridad detecta que una campaña es fraudulenta antes de que los fondos sean
                        entregados al creador, garantizamos el reembolso total de tu donación menos los costos de la
                        pasarela de pago.
                    </p>
                    <p className="text-muted-foreground">
                        Para procesar el reembolso debemos poder verificar la titularidad del método de pago o contactarte
                        mediante el correo electrónico proporcionado al momento de donar.
                    </p>
                    <p className="text-muted-foreground">
                        Una vez que los fondos han sido entregados al beneficiario, LaVaca no puede garantizar reembolsos
                        directos; sin embargo, podremos suspender la cuenta, bloquear futuros retiros y reportar el caso a
                        proveedores de pago y autoridades cuando corresponda.
                    </p>
                </section>

                <section className="space-y-3">
                    <h2 className="text-xl font-semibold">4. Reportes de Transparencia</h2>
                    <p className="text-muted-foreground">
                        Los creadores de campañas están obligados por contrato a subir actualizaciones y pruebas del uso de
                        los fondos (facturas, fotos del beneficio u otras evidencias verificables).
                    </p>
                    <p className="text-muted-foreground">
                        Si un creador no cumple con los reportes, su cuenta es suspendida y puede perder el acceso a la
                        plataforma y a futuros retiros.
                    </p>
                </section>

                <section className="space-y-3">
                    <h2 className="text-xl font-semibold">5. Alcance y límites de esta garantía</h2>
                    <p className="text-muted-foreground">
                        Esta garantía aplica a donaciones hechas dentro de LaVaca y está sujeta a revisión de cumplimiento,
                        trazabilidad de la operación, estado de los fondos y reglas de cada procesador de pago.
                    </p>
                    <p className="text-muted-foreground">
                        Al donar en LaVaca, aceptas nuestros Términos, Política de Privacidad y Política de Reembolso.
                    </p>
                </section>
            </div>
        </main>
    )
}
