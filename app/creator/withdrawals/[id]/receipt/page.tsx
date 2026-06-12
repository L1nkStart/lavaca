import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { PrintButton } from '@/components/print-button'
import { ArrowLeft, CheckCircle2 } from 'lucide-react'

/**
 * Constancia de retiro imprimible (P3).
 * Página limpia pensada para imprimir o guardar como PDF, con el desglose
 * completo del retiro, la tasa usada y la referencia del depósito.
 */

const formatBs = (value: number) =>
    `Bs ${new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value || 0)}`

const formatUsd = (value: number) =>
    `$${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value || 0)}`

const formatAccountType = (type: string) => {
    switch (type) {
        case 'bank_bs': return 'Cuenta Bancaria (Bs.)'
        case 'pagomovil': return 'PagoMóvil'
        case 'zelle': return 'Zelle'
        case 'paypal': return 'PayPal'
        case 'crypto': return 'Criptomoneda'
        default: return type
    }
}

export default async function WithdrawalReceiptPage({
    params,
}: {
    params: Promise<{ id: string }>
}) {
    const { id } = await params
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
        redirect('/auth/login')
    }

    const { data: withdrawal } = await supabase
        .from('withdrawal_requests')
        .select(`
            id,
            creator_id,
            currency,
            amount_usd,
            amount_bs,
            platform_fee,
            gateway_fee,
            net_amount,
            status,
            exchange_rate_used,
            indexed_usd_value,
            fx_loss_usd,
            reference_number,
            created_at,
            processed_at,
            campaigns ( title ),
            withdrawal_accounts ( account_type, account_holder_name )
        `)
        .eq('id', id)
        .maybeSingle()

    if (!withdrawal) {
        notFound()
    }

    // Solo el dueño del retiro o un admin pueden ver la constancia
    if (withdrawal.creator_id !== user.id) {
        const { data: profile } = await supabase
            .from('users')
            .select('role')
            .eq('id', user.id)
            .maybeSingle()

        if (profile?.role !== 'admin') {
            notFound()
        }
    }

    if (withdrawal.status !== 'processed') {
        redirect('/creator/dashboard')
    }

    const isBs = withdrawal.currency === 'BS'
    const formatMoney = (value: number) => (isBs ? formatBs(value) : formatUsd(value))
    const grossAmount = isBs ? Number(withdrawal.amount_bs || 0) : Number(withdrawal.amount_usd || 0)
    const campaign = Array.isArray(withdrawal.campaigns) ? withdrawal.campaigns[0] : withdrawal.campaigns
    const account = Array.isArray(withdrawal.withdrawal_accounts)
        ? withdrawal.withdrawal_accounts[0]
        : withdrawal.withdrawal_accounts

    return (
        <main className="min-h-screen bg-muted/30 print:bg-white py-8 px-4">
            <div className="max-w-2xl mx-auto space-y-6">
                {/* Acciones (no se imprimen) */}
                <div className="flex items-center justify-between print:hidden">
                    <Button variant="outline" asChild>
                        <Link href="/creator/dashboard">
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Volver al panel
                        </Link>
                    </Button>
                    <PrintButton />
                </div>

                {/* Constancia */}
                <div className="bg-white dark:bg-card print:shadow-none shadow-sm rounded-xl border p-8 space-y-6">
                    <div className="flex items-start justify-between gap-4 border-b pb-6">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center text-white font-bold text-sm">
                                LV
                            </div>
                            <div>
                                <p className="font-bold text-lg leading-tight">LaVaca</p>
                                <p className="text-xs text-muted-foreground">lavaca.com.ve</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="font-semibold">Constancia de retiro</p>
                            <p className="text-xs text-muted-foreground">N° {withdrawal.id.slice(0, 8).toUpperCase()}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                        <CheckCircle2 className="h-5 w-5" />
                        <p className="font-semibold">Retiro procesado exitosamente</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                        <div>
                            <p className="text-xs text-muted-foreground">Campaña</p>
                            <p className="font-medium">{campaign?.title || 'Campaña'}</p>
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">Moneda</p>
                            <p className="font-medium">{isBs ? 'Bolívares (Bs)' : 'Dólares (USD)'}</p>
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">Cuenta destino</p>
                            <p className="font-medium">
                                {formatAccountType(account?.account_type || '')} · {account?.account_holder_name || ''}
                            </p>
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">Referencia del depósito</p>
                            <p className="font-medium">{withdrawal.reference_number || '—'}</p>
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">Solicitado</p>
                            <p className="font-medium">{new Date(withdrawal.created_at).toLocaleString('es-VE')}</p>
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">Procesado</p>
                            <p className="font-medium">
                                {withdrawal.processed_at ? new Date(withdrawal.processed_at).toLocaleString('es-VE') : '—'}
                            </p>
                        </div>
                    </div>

                    {/* Desglose */}
                    <div className="rounded-lg border p-4 space-y-2 text-sm">
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Monto solicitado</span>
                            <span className="font-medium">{formatMoney(grossAmount)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Comisión LaVaca</span>
                            <span className="font-medium">−{formatMoney(Number(withdrawal.platform_fee || 0))}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Fee bancario / pasarela</span>
                            <span className="font-medium">−{formatMoney(Number(withdrawal.gateway_fee || 0))}</span>
                        </div>
                        <div className="flex items-center justify-between border-t pt-2 text-base">
                            <span className="font-semibold">Neto transferido</span>
                            <span className="font-bold">{formatMoney(Number(withdrawal.net_amount ?? grossAmount))}</span>
                        </div>
                    </div>

                    {/* Datos cambiarios (solo retiros Bs) */}
                    {isBs && withdrawal.exchange_rate_used && (
                        <div className="rounded-lg border bg-muted/20 p-4 space-y-1 text-sm">
                            <p className="font-semibold text-xs uppercase tracking-wide text-muted-foreground">
                                Información cambiaria
                            </p>
                            <p>
                                Tasa del retiro: <strong>{Number(withdrawal.exchange_rate_used).toFixed(2)} Bs/USD</strong>
                            </p>
                            {withdrawal.indexed_usd_value != null && (
                                <p>
                                    Valor indexado (costo promedio): <strong>{formatUsd(Number(withdrawal.indexed_usd_value))}</strong>
                                </p>
                            )}
                            {withdrawal.fx_loss_usd != null && Number(withdrawal.fx_loss_usd) !== 0 && (
                                <p>
                                    Diferencial cambiario: <strong>
                                        {Number(withdrawal.fx_loss_usd) > 0 ? '−' : '+'}
                                        {formatUsd(Math.abs(Number(withdrawal.fx_loss_usd)))}
                                    </strong>
                                </p>
                            )}
                        </div>
                    )}

                    <p className="text-xs text-muted-foreground border-t pt-4">
                        Esta constancia certifica que LaVaca procesó la transferencia indicada a la
                        cuenta del creador de la campaña. Documento generado el{' '}
                        {new Date().toLocaleDateString('es-VE')}. Para cualquier consulta escribe a
                        soporte@lavaca.com.ve indicando el número de constancia.
                    </p>
                </div>
            </div>
        </main>
    )
}
