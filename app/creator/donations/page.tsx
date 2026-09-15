"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Loader2, AlertCircle, ExternalLink, Receipt, ArrowLeft, HandHeart, CheckCircle2, XCircle, FileText } from "lucide-react"
import { toast } from "sonner"
import { formatBs, formatUsd } from "@/lib/format"
import { RECEIVING_ACCOUNT_LABEL, type ReceivingAccountType } from "@/lib/venezuela"

type Donation = {
    id: string
    campaign_id: string
    campaign_title: string
    amount_usd: number
    amount_bs: number | null
    currency: 'USD' | 'BS' | null
    payment_method: string
    payment_status: string
    reference_number: string | null
    capture_url: string | null
    donor_name: string | null
    email: string | null
    is_anonymous: boolean
    is_direct: boolean
    created_at: string
    completed_at: string | null
}

type StatusFilter = 'all' | 'completed' | 'pending' | 'failed'
const STATUS_FILTERS: StatusFilter[] = ['all', 'pending', 'completed', 'failed']

const METHOD_LABEL: Record<string, string> = {
    ...RECEIVING_ACCOUNT_LABEL,
    card: 'Tarjeta',
    paypal: 'PayPal',
    chinchin: 'ChinChin',
    binance: 'Binance Pay',
}

const isImageUrl = (url: string) => /\.(png|jpe?g|webp|gif)(\?|$)/i.test(url)

const statusBadge = (status: string) => {
    switch (status) {
        case 'completed': return <Badge className="bg-primary">Confirmada</Badge>
        case 'pending': return <Badge variant="secondary">En revisión</Badge>
        case 'failed': return <Badge variant="destructive">Rechazada</Badge>
        default: return <Badge variant="outline">{status}</Badge>
    }
}

export default function CreatorDonationsHistoryPage() {
    const [donations, setDonations] = useState<Donation[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [status, setStatus] = useState<StatusFilter>('all')
    const [search, setSearch] = useState("")
    const [processingId, setProcessingId] = useState<string | null>(null)
    const [rejectTarget, setRejectTarget] = useState<Donation | null>(null)
    const [initialized, setInitialized] = useState(false)

    // ?status=pending desde el panel o "Mis campañas" abre directo la cola de
    // confirmación. Se lee del URL sin useSearchParams para no exigir Suspense.
    useEffect(() => {
        try {
            const param = new URLSearchParams(window.location.search).get('status')
            if (param && (STATUS_FILTERS as string[]).includes(param)) setStatus(param as StatusFilter)
        } catch { /* noop */ }
        setInitialized(true)
    }, [])

    const fetchDonations = async () => {
        try {
            setLoading(true)
            setError(null)
            const response = await fetch(`/api/creator/donations?status=${status}`, { cache: 'no-store' })
            const result = await response.json()
            if (!response.ok) throw new Error(result?.error || 'No se pudo cargar el historial')
            setDonations(result.donations || [])
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (!initialized) return
        fetchDonations()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [status, initialized])

    // Confirmar / rechazar un pago directo (modo crisis) desde aquí.
    const resolveDirect = async (d: Donation, action: 'confirm' | 'reject') => {
        setProcessingId(d.id)
        try {
            const res = await fetch(`/api/campaigns/${d.campaign_id}/direct-donations/${d.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action }),
            })
            const result = await res.json()
            if (!res.ok) throw new Error(result?.error || 'No se pudo procesar')
            if (action === 'confirm') {
                toast.success(`Pago de ${money(d)} confirmado`, { description: `Ya suma a "${d.campaign_title}".` })
            } else {
                toast('Pago rechazado', { description: 'No sumará a la campaña.' })
            }
            await fetchDonations()
        } catch (err: any) {
            setError(err.message)
        } finally {
            setProcessingId(null)
        }
    }

    const pendingDirectCount = donations.filter((d) => d.is_direct && d.payment_status === 'pending').length

    const visible = useMemo(() => {
        const q = search.trim().toLowerCase()
        if (!q) return donations
        return donations.filter((d) =>
            (d.campaign_title || '').toLowerCase().includes(q) ||
            (d.donor_name || '').toLowerCase().includes(q) ||
            (d.email || '').toLowerCase().includes(q) ||
            (d.reference_number || '').toLowerCase().includes(q)
        )
    }, [donations, search])

    const money = (d: Donation) => d.currency === 'BS' && d.amount_bs != null ? formatBs(Number(d.amount_bs)) : formatUsd(Number(d.amount_usd))

    const filterLabel = (s: StatusFilter) =>
        s === 'all' ? 'Todas' : s === 'completed' ? 'Confirmadas' : s === 'pending' ? 'Por confirmar' : 'Rechazadas'

    return (
        <div className="min-h-screen bg-muted/30">
            <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-bold">Donaciones</h1>
                        <p className="text-sm text-muted-foreground">Todo lo que recibieron tus campañas, con sus comprobantes.</p>
                    </div>
                    <Button variant="outline" asChild>
                        <Link href="/creator/dashboard"><ArrowLeft className="h-4 w-4 mr-2" />Volver</Link>
                    </Button>
                </div>

                {error && (
                    <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>
                )}

                {pendingDirectCount > 0 && status !== 'pending' && (
                    <Alert className="border-orange-300 bg-orange-50/60 dark:bg-orange-950/30 dark:border-orange-800">
                        <HandHeart className="h-4 w-4 text-orange-600" />
                        <AlertDescription className="text-foreground">
                            Tienes <strong>{pendingDirectCount}</strong> pago{pendingDirectCount === 1 ? '' : 's'} directo{pendingDirectCount === 1 ? '' : 's'} por confirmar.{' '}
                            <button type="button" onClick={() => setStatus('pending')} className="underline font-medium">Ver solo pendientes</button>
                        </AlertDescription>
                    </Alert>
                )}

                <Card>
                    <CardContent className="pt-6 space-y-3">
                        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filtrar por estado">
                            {STATUS_FILTERS.map((s) => (
                                <Button
                                    key={s}
                                    size="sm"
                                    role="tab"
                                    aria-selected={status === s}
                                    variant={status === s ? 'default' : 'outline'}
                                    className="min-h-[36px]"
                                    onClick={() => setStatus(s)}
                                >
                                    {filterLabel(s)}
                                    {s === 'pending' && pendingDirectCount > 0 && status !== 'pending' && (
                                        <span className="ml-1.5 rounded-full bg-orange-500 px-1.5 text-[10px] font-semibold text-white">{pendingDirectCount}</span>
                                    )}
                                </Button>
                            ))}
                        </div>
                        <Input placeholder="Buscar por campaña, donante, correo o referencia…" value={search} onChange={(e) => setSearch(e.target.value)} />
                    </CardContent>
                </Card>

                {loading ? (
                    <div className="flex justify-center py-12" role="status" aria-label="Cargando"><Loader2 className="h-8 w-8 animate-spin" /></div>
                ) : visible.length === 0 ? (
                    <Card>
                        <CardContent className="py-12 text-center text-muted-foreground">
                            <Receipt className="h-12 w-12 mx-auto mb-4 opacity-50" />
                            {status === 'pending' ? 'No tienes pagos por confirmar. ¡Todo al día!' : 'No hay donaciones para este filtro.'}
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-3">
                        {visible.map((d) => {
                            const isPendingDirect = d.is_direct && d.payment_status === 'pending'
                            const hasImage = !!d.capture_url && isImageUrl(d.capture_url)
                            return (
                                <Card key={d.id} className={isPendingDirect ? 'border-orange-300 dark:border-orange-800' : undefined}>
                                    <CardContent className="pt-6">
                                        <div className="flex gap-4">
                                            {d.capture_url && (
                                                <a
                                                    href={d.capture_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="group relative block h-20 w-16 shrink-0 overflow-hidden rounded-md border bg-muted"
                                                    aria-label="Abrir comprobante"
                                                >
                                                    {hasImage ? (
                                                        // eslint-disable-next-line @next/next/no-img-element
                                                        <img src={d.capture_url} alt="Comprobante" loading="lazy" className="h-full w-full object-cover" />
                                                    ) : (
                                                        <span className="flex h-full w-full items-center justify-center text-muted-foreground"><FileText className="h-6 w-6" /></span>
                                                    )}
                                                    <span className="absolute bottom-1 right-1 rounded bg-background/90 p-0.5"><ExternalLink className="h-3 w-3" /></span>
                                                </a>
                                            )}
                                            <div className="min-w-0 flex-1 flex items-start justify-between gap-4">
                                                <div className="space-y-1 min-w-0">
                                                    <p className="font-semibold text-lg flex flex-wrap items-center gap-2">
                                                        <span className="font-mono">{money(d)}</span>
                                                        <Badge variant="outline" className="text-[10px]">{METHOD_LABEL[d.payment_method] || d.payment_method}</Badge>
                                                        {d.is_direct && (
                                                            <Badge className="bg-orange-500 text-[10px] hover:bg-orange-500"><HandHeart className="h-3 w-3 mr-1" /> Pago directo</Badge>
                                                        )}
                                                    </p>
                                                    <p className="text-sm text-muted-foreground truncate">{d.campaign_title}</p>
                                                    <p className="text-xs text-muted-foreground truncate">
                                                        {d.is_anonymous ? 'Donante anónimo' : (d.donor_name || 'Donante')}{d.email ? ` · ${d.email}` : ''}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground">
                                                        Ref: <span className="font-mono">{d.reference_number || '—'}</span>
                                                        {' · '}{new Date(d.created_at).toLocaleString('es-VE')}
                                                    </p>
                                                </div>
                                                <div className="text-right space-y-1 shrink-0">
                                                    {statusBadge(d.payment_status)}
                                                    {d.completed_at && <p className="text-xs text-muted-foreground">{new Date(d.completed_at).toLocaleDateString('es-VE')}</p>}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Pago directo pendiente: confirmar / rechazar aquí mismo */}
                                        {isPendingDirect && (
                                            <div className="mt-4 flex flex-col gap-2 border-t pt-4 sm:flex-row sm:items-center">
                                                <p className="text-sm text-foreground/80 sm:flex-1">¿Este pago llegó a tu cuenta?</p>
                                                <div className="flex gap-2">
                                                    <Button size="sm" className="min-h-[44px] flex-1 sm:flex-none sm:min-w-[140px]" onClick={() => resolveDirect(d, 'confirm')} disabled={processingId === d.id}>
                                                        {processingId === d.id ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                                                        Sí, confirmar
                                                    </Button>
                                                    <Button size="sm" variant="outline" className="min-h-[44px] flex-1 sm:flex-none" onClick={() => setRejectTarget(d)} disabled={processingId === d.id}>
                                                        <XCircle className="h-4 w-4 mr-2" />
                                                        No llegó
                                                    </Button>
                                                </div>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            )
                        })}
                    </div>
                )}
            </div>

            <AlertDialog open={!!rejectTarget} onOpenChange={(open) => !open && setRejectTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Rechazar este pago?</AlertDialogTitle>
                        <AlertDialogDescription>
                            {rejectTarget && (
                                <>
                                    El pago de <strong>{money(rejectTarget)}</strong>
                                    {rejectTarget.reference_number && <> (ref. {rejectTarget.reference_number})</>} no sumará a
                                    "{rejectTarget.campaign_title}". Hazlo solo si revisaste tu cuenta y el dinero no llegó.
                                </>
                            )}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Volver</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-white hover:bg-destructive/90"
                            onClick={() => {
                                const target = rejectTarget
                                setRejectTarget(null)
                                if (target) resolveDirect(target, 'reject')
                            }}
                        >
                            Sí, rechazar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
