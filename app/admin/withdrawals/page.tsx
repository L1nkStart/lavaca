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

    const [exchangeRateUsed, setExchangeRateUsed] = useState("")
    const [referenceNumber, setReferenceNumber] = useState("")
    const [rejectionReason, setRejectionReason] = useState("")

    useEffect(() => {
        fetchRequests()
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

        if (!referenceNumber.trim()) {
            alert('Debes ingresar el número de referencia del depósito')
            return
        }

        if (!exchangeRateUsed || Number.isNaN(exchangeRate) || exchangeRate <= 0) {
            alert('Debes ingresar una tasa de cambio válida en exchange_rate_used')
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
                    exchange_rate_used: exchangeRate,
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
        if (statusFilter === 'all') return requests
        return requests.filter((request) => request.status === statusFilter)
    }, [requests, statusFilter])

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
                    <div className="px-8 py-6">
                        <h1 className="text-3xl font-bold">Solicitudes de Retiro</h1>
                        <p className="text-muted-foreground mt-1">
                            {visibleRequests.length} de {requests.length} solicitudes
                        </p>
                    </div>
                </div>

                <div className="p-8 space-y-4">
                    {error && (
                        <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}

                    <Card>
                        <CardContent className="pt-6">
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

                            return (
                                <Card key={request.id}>
                                    <CardContent className="pt-6 space-y-4">
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="space-y-1">
                                                <p className="font-semibold text-lg flex items-center gap-2">
                                                    <Wallet className="h-5 w-5 text-primary" />
                                                    ${Number(request.amount_usd || 0).toFixed(2)} USD
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

                                        {(request.status === 'processed' || request.status === 'failed') && (
                                            <div className="rounded-lg border bg-muted/30 p-3 space-y-1 text-sm">
                                                {request.exchange_rate_used && (
                                                    <p><strong>Tasa usada:</strong> {Number(request.exchange_rate_used).toFixed(2)}</p>
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
                                                        <Button size="sm" onClick={() => setSelectedId(request.id)}>
                                                            Procesar / Fallar
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
                                                    <div className="space-y-2">
                                                        <label className="text-sm font-medium">Exchange rate used</label>
                                                        <Input
                                                            type="number"
                                                            min="0"
                                                            step="0.01"
                                                            value={exchangeRateUsed}
                                                            onChange={(event) => setExchangeRateUsed(event.target.value)}
                                                            placeholder="Ej: 43.50"
                                                            disabled={processingId === request.id}
                                                        />
                                                    </div>

                                                    <div className="space-y-2">
                                                        <label className="text-sm font-medium">Reference number</label>
                                                        <Input
                                                            value={referenceNumber}
                                                            onChange={(event) => setReferenceNumber(event.target.value)}
                                                            placeholder="Referencia del depósito"
                                                            disabled={processingId === request.id}
                                                        />
                                                    </div>
                                                </div>

                                                <div className="space-y-2">
                                                    <label className="text-sm font-medium">Rejection reason (si falla)</label>
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
