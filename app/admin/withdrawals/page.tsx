"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { AdminSidebar } from "@/components/admin-sidebar"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, AlertCircle, CheckCircle2, XCircle, Wallet, ExternalLink } from "lucide-react"

type WithdrawalRequest = {
    id: string
    creator_id: string
    campaign_id: string | null
    account_id: string
    amount_usd: number
    amount_bs: number | null
    currency: 'USD' | 'BS' | null
    platform_fee: number | null
    gateway_fee: number | null
    net_amount: number | null
    indexed_usd_value: number | null
    fx_loss_usd: number | null
    status: 'pending' | 'processed' | 'failed'
    exchange_rate_used: number | null
    reference_number: string | null
    rejection_reason: string | null
    created_at: string
    processed_at: string | null
    campaigns: {
        title: string
    } | null
    users: {
        full_name: string
        email: string
    } | null
    withdrawal_accounts: {
        account_type: string
        account_holder_name: string
    } | null
}

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

const formatBsAmount = (value: number) =>
    `Bs ${new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value || 0)}`

const formatUsdAmount = (value: number) =>
    `$${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value || 0)}`

const formatByCurrency = (value: number, currency: 'USD' | 'BS') =>
    currency === 'BS' ? formatBsAmount(value) : formatUsdAmount(value)

const getStatusBadge = (status: string) => {
    switch (status) {
        case 'pending':
            return <Badge variant="secondary">Pendiente</Badge>
        case 'processed':
            return <Badge className="bg-green-600">Procesado</Badge>
        case 'failed':
            return <Badge variant="destructive">Fallido</Badge>
        default:
            return <Badge variant="outline">{status}</Badge>
    }
}

export default function AdminWithdrawalsPage() {
    const [requests, setRequests] = useState<WithdrawalRequest[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [processingId, setProcessingId] = useState<string | null>(null)
    const [selectedId, setSelectedId] = useState<string | null>(null)
    const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'processed' | 'failed'>('pending')
    const [currencyFilter, setCurrencyFilter] = useState<'all' | 'BS' | 'USD'>('all')

    const [exchangeRateUsed, setExchangeRateUsed] = useState("")
    const [referenceNumber, setReferenceNumber] = useState("")
    const [rejectionReason, setRejectionReason] = useState("")
    const [activeRate, setActiveRate] = useState<number | null>(null)

    useEffect(() => {
        fetchRequests()
        // Tasa activa del día para auto-llenar el campo al procesar retiros Bs
        fetch('/api/exchange-rate', { cache: 'no-store' })
            .then((response) => response.json())
            .then((data) => {
                if (data?.rate) setActiveRate(Number(data.rate))
            })
            .catch(() => { })
    }, [])

    const fetchRequests = async () => {
        try {
            setLoading(true)
            setError(null)

            const response = await fetch('/api/admin/withdrawals', {
                method: 'GET',
                cache: 'no-store',
            })

            const result = await response.json()

            if (!response.ok) {
                throw new Error(result?.error || result?.details || 'No se pudieron cargar las solicitudes de retiro')
            }

            setRequests(result?.requests || [])
        } catch (err: any) {
            setError(err.message || 'No se pudieron cargar las solicitudes de retiro')
        } finally {
            setLoading(false)
        }
    }

    const clearActionForm = () => {
        setSelectedId(null)
        setExchangeRateUsed("")
        setReferenceNumber("")
        setRejectionReason("")
    }

    const handleMarkProcessed = async (request: WithdrawalRequest) => {
        const exchangeRate = Number(exchangeRateUsed)
        const isBs = request.currency === 'BS'

        if (!referenceNumber.trim()) {
            alert('Debes ingresar el número de referencia del depósito')
            return
        }

        // La tasa solo es obligatoria para retiros en bolívares (con ella se
        // congela la pérdida cambiaria de ese retiro).
        if (isBs && (!exchangeRateUsed || Number.isNaN(exchangeRate) || exchangeRate <= 0)) {
            alert('Debes ingresar una tasa de cambio válida para retiros en bolívares')
            return
        }

        if (!confirm('¿Confirmas marcar esta solicitud como procesada?')) return

        try {
            setProcessingId(request.id)

            const response = await fetch(`/api/admin/withdrawals/${request.id}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    status: 'processed',
                    exchange_rate_used: Number.isFinite(exchangeRate) && exchangeRate > 0 ? exchangeRate : null,
                    reference_number: referenceNumber.trim(),
                }),
            })

            const result = await response.json()

            if (!response.ok) {
                throw new Error(result?.error || result?.details || 'No se pudo procesar la solicitud')
            }

            alert('✅ Solicitud marcada como procesada')
            clearActionForm()
            fetchRequests()
        } catch (err: any) {
            alert(`Error al procesar: ${err.message}`)
        } finally {
            setProcessingId(null)
        }
    }

    const handleMarkFailed = async (request: WithdrawalRequest) => {
        if (!rejectionReason.trim()) {
            alert('Debes agregar un motivo de rechazo')
            return
        }

        if (!confirm('¿Confirmas marcar esta solicitud como fallida?')) return

        try {
            setProcessingId(request.id)

            const response = await fetch(`/api/admin/withdrawals/${request.id}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    status: 'failed',
                    rejection_reason: rejectionReason.trim(),
                }),
            })

            const result = await response.json()

            if (!response.ok) {
                throw new Error(result?.error || result?.details || 'No se pudo actualizar la solicitud')
            }

            alert('❌ Solicitud marcada como fallida')
            clearActionForm()
            fetchRequests()
        } catch (err: any) {
            alert(`Error al actualizar: ${err.message}`)
        } finally {
            setProcessingId(null)
        }
    }

    const visibleRequests = useMemo(() => {
        return requests.filter((request) => {
            if (statusFilter !== 'all' && request.status !== statusFilter) return false
            if (currencyFilter !== 'all' && (request.currency || 'USD') !== currencyFilter) return false
            return true
        })
    }, [requests, statusFilter, currencyFilter])

    const pendingBsCount = requests.filter((request) => request.status === 'pending' && request.currency === 'BS').length
    const pendingUsdCount = requests.filter((request) => request.status === 'pending' && (request.currency || 'USD') === 'USD').length

    // Al abrir el formulario de un retiro Bs, auto-llenamos la tasa activa
    const handleSelectRequest = (request: WithdrawalRequest) => {
        setSelectedId(request.id)
        if (request.currency === 'BS' && activeRate && activeRate > 0) {
            setExchangeRateUsed(String(activeRate.toFixed(2)))
        } else {
            setExchangeRateUsed("")
        }
    }

    if (loading) {
        return (
            <div className="flex min-h-screen bg-background">
                <AdminSidebar />
                <main className="flex-1 flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin" />
                </main>
            </div>
        )
    }

    return (
        <div className="flex min-h-screen bg-background">
            <AdminSidebar />

            <main className="flex-1 overflow-auto">
                <div className="border-b border-border bg-card sticky top-0 z-40">
                    <div className="px-4 sm:px-8 py-4 sm:py-6">
                        <h1 className="text-3xl font-bold">Solicitudes de Retiro</h1>
                        <p className="text-muted-foreground mt-1">
                            {visibleRequests.length} de {requests.length} solicitudes
                        </p>
                    </div>
                </div>

                <div className="p-4 sm:p-8 space-y-4">
                    {error && (
                        <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}

                    <Card>
                        <CardContent className="pt-6">
                            <div className="space-y-3">
                                {/* Filtro por moneda */}
                                <div className="flex flex-wrap gap-2">
                                    <Button size="sm" variant={currencyFilter === 'BS' ? 'default' : 'outline'} onClick={() => setCurrencyFilter('BS')}>
                                        🇻🇪 Bolívares ({pendingBsCount} pend.)
                                    </Button>
                                    <Button size="sm" variant={currencyFilter === 'USD' ? 'default' : 'outline'} onClick={() => setCurrencyFilter('USD')}>
                                        💵 Dólares ({pendingUsdCount} pend.)
                                    </Button>
                                    <Button size="sm" variant={currencyFilter === 'all' ? 'default' : 'outline'} onClick={() => setCurrencyFilter('all')}>
                                        Todas las monedas
                                    </Button>
                                </div>

                                {/* Filtro por estado */}
                                <div className="flex flex-wrap gap-2">
                                    <Button size="sm" variant={statusFilter === 'all' ? 'default' : 'outline'} onClick={() => setStatusFilter('all')}>
                                        Todos ({requests.length})
                                    </Button>
                                    <Button size="sm" variant={statusFilter === 'pending' ? 'default' : 'outline'} onClick={() => setStatusFilter('pending')}>
                                        Pendientes ({requests.filter((request) => request.status === 'pending').length})
                                    </Button>
                                    <Button size="sm" variant={statusFilter === 'processed' ? 'default' : 'outline'} onClick={() => setStatusFilter('processed')}>
                                        Procesados ({requests.filter((request) => request.status === 'processed').length})
                                    </Button>
                                    <Button size="sm" variant={statusFilter === 'failed' ? 'default' : 'outline'} onClick={() => setStatusFilter('failed')}>
                                        Fallidos ({requests.filter((request) => request.status === 'failed').length})
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {visibleRequests.length === 0 ? (
                        <Card>
                            <CardContent className="py-12 text-center text-muted-foreground">
                                <CheckCircle2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                No hay solicitudes para este filtro.
                            </CardContent>
                        </Card>
                    ) : (
                        visibleRequests.map((request) => {
                            const isSelected = selectedId === request.id
                            const isPending = request.status === 'pending'
                            const requestCurrency: 'USD' | 'BS' = request.currency === 'BS' ? 'BS' : 'USD'
                            const grossAmount = requestCurrency === 'BS'
                                ? Number(request.amount_bs || 0)
                                : Number(request.amount_usd || 0)
                            const hasBreakdown = request.net_amount != null

                            return (
                                <Card key={request.id}>
                                    <CardContent className="pt-6 space-y-4">
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="space-y-1">
                                                <p className="font-semibold text-lg flex items-center gap-2">
                                                    <Wallet className="h-5 w-5 text-primary" />
                                                    {formatByCurrency(grossAmount, requestCurrency)}
                                                    <Badge variant={requestCurrency === 'BS' ? 'secondary' : 'outline'}>
                                                        {requestCurrency === 'BS' ? 'Bolívares' : 'Dólares'}
                                                    </Badge>
                                                </p>
                                                <p className="text-sm text-muted-foreground">
                                                    Campaña: {request.campaigns?.title || 'Campaña'}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    Creador: {request.users?.full_name || 'Usuario'} • {request.users?.email || 'sin email'}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    Destino: {formatAccountType(request.withdrawal_accounts?.account_type || 'cuenta')} • {request.withdrawal_accounts?.account_holder_name || 'Sin titular'}
                                                </p>
                                            </div>

                                            <div className="text-right space-y-1">
                                                {getStatusBadge(request.status)}
                                                <p className="text-xs text-muted-foreground">{new Date(request.created_at).toLocaleString('es-VE')}</p>
                                            </div>
                                        </div>

                                        {/* Desglose: cuánto transferir exactamente */}
                                        {hasBreakdown && (
                                            <div className="rounded-lg border p-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                                                <div>
                                                    <p className="text-xs text-muted-foreground">Bruto solicitado</p>
                                                    <p className="font-medium">{formatByCurrency(grossAmount, requestCurrency)}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-muted-foreground">Comisión LaVaca</p>
                                                    <p className="font-medium">−{formatByCurrency(Number(request.platform_fee || 0), requestCurrency)}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-muted-foreground">Fee de pasarela</p>
                                                    <p className="font-medium">−{formatByCurrency(Number(request.gateway_fee || 0), requestCurrency)}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-muted-foreground">Neto a transferir</p>
                                                    <p className="font-bold text-primary">{formatByCurrency(Number(request.net_amount || 0), requestCurrency)}</p>
                                                </div>
                                            </div>
                                        )}

                                        {(request.status === 'processed' || request.status === 'failed') && (
                                            <div className="rounded-lg border bg-muted/30 p-3 space-y-1 text-sm">
                                                {request.exchange_rate_used && (
                                                    <p><strong>Tasa usada:</strong> {Number(request.exchange_rate_used).toFixed(2)}</p>
                                                )}
                                                {requestCurrency === 'BS' && request.indexed_usd_value != null && (
                                                    <p><strong>Valor indexado:</strong> {formatUsdAmount(Number(request.indexed_usd_value))}</p>
                                                )}
                                                {requestCurrency === 'BS' && request.fx_loss_usd != null && Number(request.fx_loss_usd) !== 0 && (
                                                    <p className={Number(request.fx_loss_usd) > 0 ? 'text-destructive' : 'text-green-600'}>
                                                        <strong>Diferencial cambiario congelado:</strong>{' '}
                                                        {Number(request.fx_loss_usd) > 0 ? '−' : '+'}{formatUsdAmount(Math.abs(Number(request.fx_loss_usd)))}
                                                    </p>
                                                )}
                                                {request.reference_number && (
                                                    <p><strong>Referencia:</strong> {request.reference_number}</p>
                                                )}
                                                {request.processed_at && (
                                                    <p><strong>Procesado:</strong> {new Date(request.processed_at).toLocaleString('es-VE')}</p>
                                                )}
                                                {request.status === 'failed' && request.rejection_reason && (
                                                    <p className="text-destructive"><strong>Motivo:</strong> {request.rejection_reason}</p>
                                                )}
                                            </div>
                                        )}

                                        {isPending && (
                                            <div className="flex flex-wrap gap-2 pt-2 border-t">
                                                <Button size="sm" variant="outline" asChild>
                                                    <Link href="/admin/payments">
                                                        <ExternalLink className="h-4 w-4 mr-2" />
                                                        Ver pagos
                                                    </Link>
                                                </Button>

                                                {!isSelected ? (
                                                    <>
                                                        <Button size="sm" onClick={() => handleSelectRequest(request)}>
                                                            Procesar / Rechazar
                                                        </Button>
                                                    </>
                                                ) : (
                                                    <Button size="sm" variant="ghost" onClick={clearActionForm}>
                                                        Cancelar
                                                    </Button>
                                                )}
                                            </div>
                                        )}

                                        {isSelected && isPending && (
                                            <div className="rounded-lg border p-4 space-y-4 bg-muted/20">
                                                <div className="grid md:grid-cols-2 gap-4">
                                                    {requestCurrency === 'BS' && (
                                                        <div className="space-y-2">
                                                            <label className="text-sm font-medium">Tasa de cambio del retiro (Bs/USD)</label>
                                                            <Input
                                                                type="number"
                                                                min="0"
                                                                step="0.01"
                                                                value={exchangeRateUsed}
                                                                onChange={(event) => setExchangeRateUsed(event.target.value)}
                                                                placeholder="Ej: 545.50"
                                                                disabled={processingId === request.id}
                                                            />
                                                            <p className="text-xs text-muted-foreground">
                                                                Auto-llenada con la tasa activa del día (editable). Con ella se
                                                                congela la pérdida cambiaria de este retiro.
                                                            </p>
                                                        </div>
                                                    )}

                                                    <div className="space-y-2">
                                                        <label className="text-sm font-medium">Referencia del depósito</label>
                                                        <Input
                                                            value={referenceNumber}
                                                            onChange={(event) => setReferenceNumber(event.target.value)}
                                                            placeholder="Referencia de la transferencia realizada"
                                                            disabled={processingId === request.id}
                                                        />
                                                    </div>
                                                </div>

                                                <div className="space-y-2">
                                                    <label className="text-sm font-medium">Motivo de rechazo (solo si rechazas)</label>
                                                    <Textarea
                                                        value={rejectionReason}
                                                        onChange={(event) => setRejectionReason(event.target.value)}
                                                        placeholder="Explica por qué no se pudo procesar el retiro"
                                                        disabled={processingId === request.id}
                                                    />
                                                </div>

                                                <div className="flex flex-wrap gap-2">
                                                    <Button
                                                        size="sm"
                                                        onClick={() => handleMarkProcessed(request)}
                                                        disabled={processingId === request.id}
                                                    >
                                                        {processingId === request.id ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                                                        Marcar como procesado
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="destructive"
                                                        onClick={() => handleMarkFailed(request)}
                                                        disabled={processingId === request.id}
                                                    >
                                                        {processingId === request.id ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <XCircle className="h-4 w-4 mr-2" />}
                                                        Marcar como fallido
                                                    </Button>
                                                </div>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            )
                        })
                    )}
                </div>
            </main>
        </div>
    )
}
