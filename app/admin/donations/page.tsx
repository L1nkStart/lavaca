"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { AdminSidebar } from "@/components/admin-sidebar"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, AlertCircle, ExternalLink, Receipt } from "lucide-react"

type Donation = {
    id: string
    campaign_id: string
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
    created_at: string
    completed_at: string | null
    campaigns: { title: string; slug: string | null } | null
}

const fmtBs = (v: number) => `Bs ${new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v || 0)}`
const fmtUsd = (v: number) => `$${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v || 0)}`

const statusBadge = (status: string) => {
    switch (status) {
        case 'completed': return <Badge className="bg-green-600">Aprobada</Badge>
        case 'pending': return <Badge variant="secondary">Pendiente</Badge>
        case 'failed': return <Badge variant="destructive">Rechazada</Badge>
        default: return <Badge variant="outline">{status}</Badge>
    }
}

export default function AdminDonationsHistoryPage() {
    const [donations, setDonations] = useState<Donation[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [status, setStatus] = useState<'all' | 'completed' | 'pending' | 'failed'>('all')
    const [search, setSearch] = useState("")

    useEffect(() => {
        fetchDonations()
    }, [status])

    const fetchDonations = async () => {
        try {
            setLoading(true)
            setError(null)
            const response = await fetch(`/api/admin/donations?status=${status}`, { cache: 'no-store' })
            const result = await response.json()
            if (!response.ok) throw new Error(result?.error || 'No se pudo cargar el historial')
            setDonations(result.donations || [])
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    const visible = useMemo(() => {
        const q = search.trim().toLowerCase()
        if (!q) return donations
        return donations.filter((d) =>
            (d.campaigns?.title || '').toLowerCase().includes(q) ||
            (d.donor_name || '').toLowerCase().includes(q) ||
            (d.email || '').toLowerCase().includes(q) ||
            (d.reference_number || '').toLowerCase().includes(q)
        )
    }, [donations, search])

    const money = (d: Donation) => d.currency === 'BS' && d.amount_bs != null ? fmtBs(Number(d.amount_bs)) : fmtUsd(Number(d.amount_usd))

    return (
        <div className="flex min-h-screen bg-background">
            <AdminSidebar />
            <main className="flex-1 overflow-auto">
                <div className="border-b border-border bg-card sticky top-0 z-40">
                    <div className="px-4 sm:px-8 py-4 sm:py-6">
                        <h1 className="text-3xl font-bold">Historial de donaciones</h1>
                        <p className="text-muted-foreground mt-1">
                            Donaciones del método de plataforma (las que apruebas en Pagos manuales), con sus soportes.
                        </p>
                    </div>
                </div>

                <div className="p-4 sm:p-8 space-y-4">
                    {error && (
                        <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>
                    )}

                    <Card>
                        <CardContent className="pt-6 space-y-3">
                            <div className="flex flex-wrap gap-2">
                                {(['all', 'completed', 'pending', 'failed'] as const).map((s) => (
                                    <Button key={s} size="sm" variant={status === s ? 'default' : 'outline'} onClick={() => setStatus(s)}>
                                        {s === 'all' ? 'Todas' : s === 'completed' ? 'Aprobadas' : s === 'pending' ? 'Pendientes' : 'Rechazadas'}
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
                        visible.map((d) => (
                            <Card key={d.id}>
                                <CardContent className="pt-6">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="space-y-1">
                                            <p className="font-semibold text-lg flex items-center gap-2">
                                                {money(d)}
                                                <Badge variant="outline" className="text-[10px]">{d.payment_method}</Badge>
                                            </p>
                                            <p className="text-sm text-muted-foreground">
                                                {d.campaigns?.title || 'Campaña'}
                                                {d.campaigns?.slug && (
                                                    <a href={`/campaigns/${d.campaigns.slug}`} target="_blank" rel="noopener noreferrer" className="ml-2 inline-flex items-center gap-1 text-primary hover:underline">
                                                        ver <ExternalLink className="h-3 w-3" />
                                                    </a>
                                                )}
                                            </p>
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
                                            {d.completed_at && <p className="text-xs text-muted-foreground">Aprobada: {new Date(d.completed_at).toLocaleDateString('es-VE')}</p>}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))
                    )}
                </div>
            </main>
        </div>
    )
}
