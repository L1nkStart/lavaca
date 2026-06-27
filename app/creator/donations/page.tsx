"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, AlertCircle, ExternalLink, Receipt, ArrowLeft, HandHeart, CheckCircle2, XCircle } from "lucide-react"

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

const fmtBs = (v: number) => `Bs ${new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v || 0)}`
const fmtUsd = (v: number) => `$${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v || 0)}`

const statusBadge = (status: string) => {
    switch (status) {
        case 'completed': return <Badge className="bg-green-600">Confirmada</Badge>
        case 'pending': return <Badge variant="secondary">En revisión</Badge>
        case 'failed': return <Badge variant="destructive">Rechazada</Badge>
        default: return <Badge variant="outline">{status}</Badge>
    }
}

export default function CreatorDonationsHistoryPage() {
    const [donations, setDonations] = useState<Donation[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [status, setStatus] = useState<'all' | 'completed' | 'pending' | 'failed'>('all')
    const [search, setSearch] = useState("")
    const [processingId, setProcessingId] = useState<string | null>(null)

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
        fetchDonations()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [status])

    // Confirmar / rechazar un pago directo (modo crisis) desde aquí.
    const resolveDirect = async (d: Donation, action: 'confirm' | 'reject') => {
        if (action === 'reject' && !confirm('¿Rechazar este pago? No sumará a la campaña.')) return
        setProcessingId(d.id)
        try {
            const res = await fetch(`/api/campaigns/${d.campaign_id}/direct-donations/${d.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action }),
            })
            const result = await res.json()
            if (!res.ok) throw new Error(result?.error || 'No se pudo procesar')
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

    const money = (d: Donation) => d.currency === 'BS' && d.amount_bs != null ? fmtBs(Number(d.amount_bs)) : fmtUsd(Number(d.amount_usd))

    return (
        <div className="min-h-screen bg-muted/30">
            <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-bold">Historial de donaciones</h1>
                        <p className="text-sm text-muted-foreground">Todas las donaciones de tus campañas, con sus soportes de pago.</p>
                    </div>
                    <Button variant="outline" asChild>
                        <Link href="/creator/dashboard"><ArrowLeft className="h-4 w-4 mr-2" />Volver</Link>
                    </Button>
                </div>

                {error && (
                    <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>
                )}

                {pendingDirectCount > 0 && (
                    <Alert className="border-orange-300 bg-orange-50/60 dark:bg-orange-950/30 dark:border-orange-800">
                        <HandHeart className="h-4 w-4 text-orange-600" />
                        <AlertDescription className="text-orange-900 dark:text-orange-100">
                            Tienes <strong>{pendingDirectCount}</strong> pago{pendingDirectCount === 1 ? '' : 's'} directo{pendingDirectCount === 1 ? '' : 's'} por confirmar.
                            Revísalos y confírmalos para que sumen a tus campañas.{' '}
                            <button type="button" onClick={() => setStatus('pending')} className="underline font-medium">Ver pendientes</button>
                        </AlertDescription>
                    </Alert>
                )}

                <Card>
                    <CardContent className="pt-6 space-y-3">
                        <div className="flex flex-wrap gap-2">
                            {(['all', 'completed', 'pending', 'failed'] as const).map((s) => (
                                <Button key={s} size="sm" variant={status === s ? 'default' : 'outline'} onClick={() => setStatus(s)}>
                                    {s === 'all' ? 'Todas' : s === 'completed' ? 'Confirmadas' : s === 'pending' ? 'En revisión' : 'Rechazadas'}
                                </Button>
                            ))}
                        </div>
                        <Input placeholder="Buscar por campaña, donante, correo o referencia…" value={search} onChange={(e) => setSearch(e.target.value)} />
                    </CardContent>
                </Card>

                {loading ? (
                    <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>
                ) : visible.length === 0 ? (
                    <Card><CardContent className="py-12 text-center text-muted-foreground"><Receipt className="h-12 w-12 mx-auto mb-4 opacity-50" />No hay donaciones para este filtro.</CardContent></Card>
                ) : (
                    <div className="space-y-3">
                        {visible.map((d) => (
                            <Card key={d.id}>
                                <CardContent className="pt-6">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="space-y-1">
                                            <p className="font-semibold text-lg flex items-center gap-2">
                                                {money(d)}
                                                <Badge variant="outline" className="text-[10px]">{d.payment_method}</Badge>
                                                {d.is_direct && (
                                                    <Badge className="bg-orange-500 text-[10px]"><HandHeart className="h-3 w-3 mr-1" /> Pago directo</Badge>
                                                )}
                                            </p>
                                            <p className="text-sm text-muted-foreground">{d.campaign_title}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {d.is_anonymous ? 'Donante anónimo' : (d.donor_name || 'Donante')} · {d.email}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                Ref: <span className="font-mono">{d.reference_number || '—'}</span>
                                                {' · '}{new Date(d.created_at).toLocaleString('es-VE')}
                                            </p>
                                            {d.capture_url && (
                                                <a href={d.capture_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline inline-flex items-center gap-1">
                                                    Ver soporte de pago <ExternalLink className="h-3 w-3" />
                                                </a>
                                            )}
                                        </div>
                                        <div className="text-right space-y-1">
                                            {statusBadge(d.payment_status)}
                                            {d.completed_at && <p className="text-xs text-muted-foreground">{new Date(d.completed_at).toLocaleDateString('es-VE')}</p>}
                                        </div>
                                    </div>

                                    {/* Pago directo pendiente: confirmar / rechazar aquí mismo */}
                                    {d.is_direct && d.payment_status === 'pending' && (
                                        <div className="flex gap-2 mt-4 pt-4 border-t">
                                            <Button size="sm" onClick={() => resolveDirect(d, 'confirm')} disabled={processingId === d.id}>
                                                {processingId === d.id ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                                                Confirmar
                                            </Button>
                                            <Button size="sm" variant="outline" onClick={() => resolveDirect(d, 'reject')} disabled={processingId === d.id}>
                                                <XCircle className="h-4 w-4 mr-2" />
                                                Rechazar
                                            </Button>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
