import type { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Términos y Condiciones | LaVaca'
}

export default function TermsPage() {
    return (
        <main className="min-h-screen bg-background px-4 py-12">
            <div className="mx-auto max-w-4xl space-y-8">
                <h1 className="text-3xl font-bold">Términos y Condiciones</h1>

                <p className="text-muted-foreground">
                    Estos términos regulan el uso de LaVaca como plataforma tecnológica de recaudación.
                    Al registrarte, crear campañas o realizar donaciones, aceptas este documento junto con la
                    Política de Privacidad, la Política de Reembolso y la Garantía de Donación.
                </p>

                <section className="space-y-3">
                    <h2 className="text-xl font-semibold">1. Naturaleza de la plataforma</h2>
                    <p className="text-muted-foreground">
                        LaVaca es una plataforma tecnológica de crowdfunding operada por la entidad legal correspondiente en EE. UU.
                        LaVaca no es banco, custodio financiero ni asesor de inversión. LaVaca facilita la conexión entre creadores y donantes.
                    </p>
                </section>

                <section className="space-y-3">
                    <h2 className="text-xl font-semibold">2. Verificación de campañas (Escudo KYC)</h2>
                    <p className="text-muted-foreground">
                        Cada campaña puede ser sometida a validación de identidad y legitimidad. LaVaca puede exigir documentos
                        oficiales (Cédula, RIF o Pasaporte), evidencias del caso, información de beneficiario final y cualquier
                        soporte adicional antes de habilitar retiros.
                    </p>
                    <p className="text-muted-foreground">
                        LaVaca puede rechazar, pausar o cancelar campañas y cuentas cuando detecte inconsistencias, riesgo de fraude
                        o incumplimiento normativo.
                    </p>
                </section>

                <section className="space-y-3">
                    <h2 className="text-xl font-semibold">3. Custodia y segregación de fondos</h2>
                    <p className="text-muted-foreground">
                        Los fondos recaudados se mantienen en cuentas segregadas de la empresa operadora o en infraestructuras
                        institucionales de terceros de pago/cripto según el método elegido. Estos fondos no se mezclan con gastos
                        operativos ordinarios de la plataforma.
                    </p>
                </section>

                <section className="space-y-3">
                    <h2 className="text-xl font-semibold">4. Donaciones, contacto y anonimato público</h2>
                    <p className="text-muted-foreground">
                        Para donar, el usuario debe proporcionar información de contacto válida, incluyendo correo electrónico.
                        LaVaca puede requerir nombre de contacto y referencia de pago en métodos manuales para prevención de fraude,
                        conciliación y soporte de reembolsos.
                    </p>
                    <p className="text-muted-foreground">
                        La opción de donación anónima oculta el nombre públicamente en la campaña, pero no elimina la obligación de
                        conservar datos de contacto para recibos, trazabilidad y resolución de disputas.
                    </p>
                </section>

                <section className="space-y-3">
                    <h2 className="text-xl font-semibold">5. Reembolsos y límites de responsabilidad</h2>
                    <p className="text-muted-foreground">
                        Si LaVaca detecta fraude antes de entregar fondos al creador, podrá gestionar reembolso total de la donación
                        menos los costos de pasarela aplicables, siempre sujeto a verificación de titularidad o contacto válido del donante.
                    </p>
                    <p className="text-muted-foreground">
                        Una vez entregados los fondos al beneficiario/creador, LaVaca no garantiza reembolso directo. En esos casos,
                        podrá suspender cuentas, congelar retiros futuros y colaborar con procesadores y autoridades.
                    </p>
                </section>

                <section className="space-y-3">
                    <h2 className="text-xl font-semibold">6. Responsabilidad del creador y transparencia</h2>
                    <p className="text-muted-foreground">
                        Cada creador es el único responsable legal por la veracidad de su campaña, el uso de los fondos recaudados y
                        el cumplimiento de las leyes aplicables en su jurisdicción.
                    </p>
                    <p className="text-muted-foreground">
                        Los creadores aceptan la obligación de publicar actualizaciones y evidencias del uso de fondos (facturas,
                        reportes, fotos u otros soportes verificables). El incumplimiento puede derivar en suspensión o cierre de cuenta.
                    </p>
                </section>

                <section className="space-y-3">
                    <h2 className="text-xl font-semibold">7. KYC/AML y enforcement</h2>
                    <p className="text-muted-foreground">
                        LaVaca puede requerir verificación de identidad (KYC), documentación adicional y revisión manual antes de activar una campaña.
                        La plataforma podrá suspender campañas o cuentas cuando existan señales de fraude, actividades ilícitas o incumplimientos.
                    </p>
                </section>

                <section className="space-y-3">
                    <h2 className="text-xl font-semibold">8. Modo crisis y pagos directos al organizador</h2>
                    <p className="text-muted-foreground">
                        En situaciones de contingencia o emergencia, LaVaca puede habilitar el &quot;modo crisis&quot; para agilizar
                        la ayuda. Bajo este modo, determinadas campañas pueden recibir aportes mediante pago directo a las cuentas
                        del propio organizador. En estos pagos directos, LaVaca actúa únicamente como canal de difusión y registro:
                        no intermedia, no procesa ni custodia los fondos, los cuales se transfieren directamente del donante al organizador.
                    </p>
                    <p className="text-muted-foreground">
                        Aunque LaVaca realiza sus mejores esfuerzos razonables para verificar la identidad de los organizadores y la
                        legitimidad de las campañas, no puede garantizar la veracidad de cada caso ni el destino final de los fondos.
                        En consecuencia, durante el modo crisis y respecto de los pagos directos, LaVaca no asume responsabilidad por
                        fraudes, estafas, tergiversaciones o uso indebido de los aportes. El donante reconoce y acepta que dichos
                        aportes se realizan bajo su propia responsabilidad y criterio.
                    </p>
                    <p className="text-muted-foreground">
                        LaVaca no cobra comisión por las campañas en modo crisis y mantiene sus mecanismos de prevención
                        (verificación de identidad, moderación de contenido y la facultad de suspender campañas ante señales de
                        fraude). No obstante, estos mecanismos no constituyen una garantía de resultado. Se recomienda a los donantes
                        conservar sus comprobantes de pago y reportar cualquier irregularidad a través de los canales de contacto.
                    </p>
                </section>

                <section className="space-y-3">
                    <h2 className="text-xl font-semibold">9. Documentos complementarios</h2>
                    <p className="text-muted-foreground">
                        Estos Términos se interpretan en conjunto con la Garantía de Donación, Política de Reembolso,
                        Política de Privacidad y Política de Actividades Prohibidas. En caso de conflicto, prevalecerán
                        las reglas específicas del proceso de pagos, cumplimiento y reembolso aplicables al caso concreto.
                    </p>
                </section>
            </div>
        </main>
    )
}
