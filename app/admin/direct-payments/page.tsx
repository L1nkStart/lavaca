"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { formatDistanceToNow } from "date-fns"
import { es } from "date-fns/locale"
import { toast } from "sonner"
import { AdminSidebar } from "@/components/admin-sidebar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    AlertCircle,
    AlertTriangle,
    ArrowLeft,
    Bell,
    CheckCircle2,
    Clock,
    Copy,
    ExternalLink,
    FileText,
    HandHeart,
    Loader2,
    Mail,
    MessageCircle,
    MessageSquarePlus,
    RotateCcw,
    ShieldAlert,
    Undo2,
    XCircle,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { formatUsd } from "@/lib/format"
import { directDonationMoneyLabel, whatsappLink } from "@/lib/direct-payments"
import {
    RECEIVING_ACCOUNT_LABEL,
    prettyVePhone,
    receivingAccountLines,
    type ReceivingAccountInput,
    type ReceivingAccountType,
} from "@/lib/venezuela"

/* ------------------------------------------------------------------ */
/* Tipos                                                               */
/* ------------------------------------------------------------------ */

type Person = { full_name: string | null; email: string | null; phone?: string | null } | null

type CampaignSummary = {
    campaign_id: string
    title: string
    slug: string | null
    status: string
    campaign_type: string
    current_amount_usd: number
    creator: Person
    active_accounts: number
    pending: number
    completed: number
    failed: number
    stale: number
    duplicates: number
    confirmed_usd: number
    pending_usd: number
    rejected_usd: number
    oldest_pending_at: string | null
    last_activity_at: string | null
}

type Totals = {
    campaigns: number
    pending: number
    stale: number
    completed: number
    failed: number
    duplicates: number
    confirmed_usd: number
    pending_usd: number
    without_accounts: number
}

type CrisisAccount = ReceivingAccountInput & { id: string; is_active: boolean }

type DirectPayment = {
    id: string
    campaign_id: string
    donor_id: string | null
    amount_usd: number
    amount_bs: number | null
    currency: "USD" | "BS" | null
    payment_method: string
    payment_status: "pending" | "completed" | "failed" | string
    reference_number: string | null
    capture_url: string | null
    donor_name: string | null
    email: string | null
    is_anonymous: boolean
    created_at: string
    completed_at: string | null
    confirmed_at: string | null
    confirmed_by: string | null
    crisis_account_id: string | null
    admin_notes: string | null
    referral_code: string | null
    donor: Person
    confirmer: Person
    account?: CrisisAccount | null
    campaigns?: { title: string; slug: string | null } | null
    duplicate_reference: boolean
    duplicate_in_other_campaign?: boolean
    stale: boolean
}

type AuditEntry = {
    id: string
    action: string
    target_id: string
    reason: string | null
    changes: Record<string, any> | null
    created_at: string
    admin: { full_name: string | null } | null
}

type CampaignDetail = {
    campaign: {
        id: string
        title: string
        slug: string | null
        status: string
        campaign_type: string
        current_amount_usd: number
        goal_amount_usd: number
        is_open_ended: boolean | null
        created_at: string
    }
    creator: (Person & { kyc_status?: string | null }) | null
    accounts: CrisisAccount[]
    donations: DirectPayment[]
    audit: AuditEntry[]
}

type MediationAction = "note" | "remind" | "reopen" | "annul"

/* ------------------------------------------------------------------ */
/* Helpers de presentación                                             */
/* ------------------------------------------------------------------ */

const timeAgo = (iso: string | null | undefined) => {
    if (!iso) return ""
    try {
        return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: es })
    } catch {
        return ""
    }
}

const fullDate = (iso: string | null | undefined) =>
    iso ? new Date(iso).toLocaleString("es-VE", { dateStyle: "medium", timeStyle: "short" }) : ""

const isAnnulledByLavaca = (d: DirectPayment) => d.payment_status === "failed" && (d.admin_notes || "").startsWith("Anulado por LaVaca")

function statusBadge(d: DirectPayment) {
    if (d.payment_status === "completed") {
        return <Badge className="bg-primary text-primary-foreground">Confirmado por el organizador</Badge>
    }
    if (d.payment_status === "pending") {
        return <Badge variant="secondary">Por confirmar (organizador)</Badge>
    }
    if (isAnnulledByLavaca(d)) return <Badge variant="destructive">Anulado por LaVaca</Badge>
    return <Badge variant="destructive">Rechazado por el organizador</Badge>
}

const CAMPAIGN_STATUS_LABEL: Record<string, string> = {
    active: "Activa",
    pending_review: "En revisión",
    draft: "Borrador",
    paused: "Pausada",
    completed: "Finalizada",
    cancelled: "Cancelada",
    rejected: "Rechazada",
}

const AUDIT_LABEL: Record<string, string> = {
    direct_payment_note: "Nota de LaVaca",
    direct_payment_remind: "Recordatorio enviado al organizador",
    direct_payment_reopen: "Reabierto por LaVaca",
    direct_payment_annul: "Anulado por LaVaca",
}

const ACTION_COPY: Record<MediationAction, { title: string; description: string; confirm: string; placeholder: string; required: boolean }> = {
    note: {
        title: "Agregar nota de mediación",
        description: "Queda en la bitácora del pago (solo la ve el equipo de LaVaca). Úsala para registrar con quién hablaste y qué se acordó.",
        confirm: "Guardar nota",
        placeholder: "Ej: Hablé con el organizador por WhatsApp; revisará su banco hoy en la tarde.",
        required: true,
    },
    remind: {
        title: "Recordar al organizador",
        description: "Le llega una notificación al organizador pidiéndole que confirme o rechace este pago. Puedes añadir una nota opcional.",
        confirm: "Enviar recordatorio",
        placeholder: "Opcional: el donante nos escribió preguntando por su pago.",
        required: false,
    },
    reopen: {
        title: "Devolver a \"por confirmar\"",
        description: "El pago rechazado vuelve a la lista del organizador para que lo revise otra vez (por ejemplo, si el donante demostró que sí pagó). LaVaca no lo confirma: decide el organizador.",
        confirm: "Reabrir pago",
        placeholder: "Ej: El donante envió el comprobante del banco; el organizador acordó revisarlo de nuevo.",
        required: true,
    },
    annul: {
        title: "Anular pago confirmado",
        description: "El pago deja de sumar a la barra de la campaña y se avisa al organizador y al donante. Úsalo solo si se comprobó que el pago no existe, está duplicado o se confirmó por error.",
        confirm: "Anular pago",
        placeholder: "Ej: Referencia duplicada: es el mismo comprobante del pago del 12/11.",
        required: true,
    },
}

const CAMPAIGN_FILTERS = [
    { key: "all", label: "Todas" },
    { key: "pending", label: "Con pendientes" },
    { key: "stale", label: "Sin respuesta" },
    { key: "alerts", label: "Referencias repetidas" },
    { key: "no_accounts", label: "Sin cuentas" },
] as const
type CampaignFilter = (typeof CAMPAIGN_FILTERS)[number]["key"]

const PAYMENT_FILTERS = [
    { key: "all", label: "Todos" },
    { key: "pending", label: "Por confirmar" },
    { key: "completed", label: "Confirmados" },
    { key: "failed", label: "Rechazados / anulados" },
    { key: "alerts", label: "Con alertas" },
] as const
type PaymentFilter = (typeof PAYMENT_FILTERS)[number]["key"]

const filterPayments = (rows: DirectPayment[], filter: PaymentFilter, search: string) => {
    const q = search.trim().toLowerCase()
    return rows.filter((d) => {
        if (filter === "alerts" && !(d.stale || d.duplicate_reference)) return false
        if (filter !== "all" && filter !== "alerts" && d.payment_status !== filter) return false
        if (!q) return true
        return [d.reference_number, d.donor_name, d.email, d.donor?.full_name, d.campaigns?.title]
            .some((v) => (v || "").toLowerCase().includes(q))
    })
}

/** Lee/escribe ?campaign= sin useSearchParams (evita exigir Suspense). */
const readCampaignParam = () => {
    if (typeof window === "undefined") return null
    return new URLSearchParams(window.location.search).get("campaign")
}
const writeCampaignParam = (id: string | null) => {
    if (typeof window === "undefined") return
    const url = new URL(window.location.href)
    if (id) url.searchParams.set("campaign", id)
    else url.searchParams.delete("campaign")
    window.history.replaceState(null, "", url.toString())
}

/* ------------------------------------------------------------------ */
/* Página                                                              */
/* ------------------------------------------------------------------ */

export default function AdminDirectPaymentsPage() {
    const [tab, setTab] = useState<"campaigns" | "list">("campaigns")
    const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null)

    const [summary, setSummary] = useState<{ campaigns: CampaignSummary[]; totals: Totals; staleHours: number } | null>(null)
    const [summaryLoading, setSummaryLoading] = useState(true)
    const [summaryError, setSummaryError] = useState<string | null>(null)
    const [campaignFilter, setCampaignFilter] = useState<CampaignFilter>("all")
    const [campaignSearch, setCampaignSearch] = useState("")

    const [mediation, setMediation] = useState<{ payment: DirectPayment; action: MediationAction; campaignTitle: string } | null>(null)
    const [refreshKey, setRefreshKey] = useState(0)

    useEffect(() => {
        const fromUrl = readCampaignParam()
        if (fromUrl) setSelectedCampaignId(fromUrl)
    }, [])

    const loadSummary = useCallback(async () => {
        try {
            setSummaryLoading(true)
            setSummaryError(null)
            const res = await fetch("/api/admin/direct-payments", { cache: "no-store" })
            const data = await res.json()
            if (!res.ok) throw new Error(data?.details || data?.error || "No se pudo cargar")
            setSummary(data)
        } catch (err: any) {
            setSummaryError(err.message)
        } finally {
            setSummaryLoading(false)
        }
    }, [])

    useEffect(() => {
        loadSummary()
    }, [loadSummary, refreshKey])

    const openCampaign = (id: string) => {
        setSelectedCampaignId(id)
        setTab("campaigns")
        writeCampaignParam(id)
        window.scrollTo({ top: 0 })
    }
    const closeCampaign = () => {
        setSelectedCampaignId(null)
        writeCampaignParam(null)
    }

    const visibleCampaigns = useMemo(() => {
        const list = summary?.campaigns || []
        const q = campaignSearch.trim().toLowerCase()
        return list.filter((c) => {
            if (campaignFilter === "pending" && c.pending === 0) return false
            if (campaignFilter === "stale" && c.stale === 0) return false
            if (campaignFilter === "alerts" && c.duplicates === 0) return false
            if (campaignFilter === "no_accounts" && !(c.status === "active" && c.active_accounts === 0)) return false
            if (!q) return true
            return [c.title, c.creator?.full_name, c.creator?.email].some((v) => (v || "").toLowerCase().includes(q))
        })
    }, [summary, campaignFilter, campaignSearch])

    const totals = summary?.totals
    const staleHours = summary?.staleHours || 72

    return (
        <div className="flex flex-col md:flex-row min-h-screen bg-background">
            <AdminSidebar />
            <main className="flex-1 min-w-0 overflow-auto">
                <div className="border-b border-border bg-card">
                    <div className="px-4 sm:px-8 py-4 sm:py-6">
                        <h1 className="text-2xl sm:text-3xl font-bold">Pagos directos</h1>
                        <p className="text-sm sm:text-base text-muted-foreground mt-1">
                            Historial por campaña de los pagos que los donantes hacen directo al organizador (modo crisis).
                        </p>
                    </div>
                </div>

                <div className="p-4 sm:p-8 space-y-4">
                    <Alert>
                        <ShieldAlert className="h-4 w-4" />
                        <AlertDescription>
                            Estos pagos llegan a las cuentas del organizador, así que <strong>solo el organizador puede confirmarlos</strong>.
                            Aquí LaVaca audita y media si hay un conflicto: contactar a las partes, dejar notas, recordar, reabrir un pago
                            rechazado o anular uno confirmado que resultó falso.
                        </AlertDescription>
                    </Alert>

                    {/* Resumen */}
                    {totals && !selectedCampaignId && (
                        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                            <StatTile label="Campañas" value={String(totals.campaigns)} />
                            <StatTile label="Por confirmar" value={String(totals.pending)} hint={formatUsd(totals.pending_usd)} />
                            <StatTile
                                label={`Sin respuesta +${staleHours} h`}
                                value={String(totals.stale)}
                                tone={totals.stale > 0 ? "warn" : undefined}
                            />
                            <StatTile label="Confirmado" value={formatUsd(totals.confirmed_usd)} hint={`${totals.completed} pagos`} />
                            <StatTile
                                label="Referencias repetidas"
                                value={String(totals.duplicates)}
                                tone={totals.duplicates > 0 ? "danger" : undefined}
                                className="col-span-2 lg:col-span-1"
                            />
                        </div>
                    )}

                    {/* Vista */}
                    {!selectedCampaignId && (
                        <div className="inline-flex w-full sm:w-auto rounded-lg border bg-muted/40 p-1" role="tablist" aria-label="Vista">
                            {([
                                ["campaigns", "Por campaña"],
                                ["list", "Todos los pagos"],
                            ] as const).map(([key, label]) => (
                                <button
                                    key={key}
                                    type="button"
                                    role="tab"
                                    aria-selected={tab === key}
                                    onClick={() => setTab(key)}
                                    className={cn(
                                        "flex-1 sm:flex-none min-h-10 rounded-md px-4 text-sm font-medium transition-colors",
                                        tab === key ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    )}

                    {selectedCampaignId ? (
                        <CampaignDetailView
                            campaignId={selectedCampaignId}
                            refreshKey={refreshKey}
                            onBack={closeCampaign}
                            onMediate={(payment, action, campaignTitle) => setMediation({ payment, action, campaignTitle })}
                        />
                    ) : tab === "campaigns" ? (
                        <>
                            <Card>
                                <CardContent className="pt-6 px-4 sm:px-6 space-y-3">
                                    <div className="flex flex-wrap gap-2">
                                        {CAMPAIGN_FILTERS.map((f) => (
                                            <Button
                                                key={f.key}
                                                size="sm"
                                                variant={campaignFilter === f.key ? "default" : "outline"}
                                                onClick={() => setCampaignFilter(f.key)}
                                            >
                                                {f.key === "stale" ? `Sin respuesta +${staleHours} h` : f.label}
                                            </Button>
                                        ))}
                                    </div>
                                    <Input
                                        placeholder="Buscar por campaña u organizador…"
                                        value={campaignSearch}
                                        onChange={(e) => setCampaignSearch(e.target.value)}
                                        aria-label="Buscar campaña"
                                    />
                                </CardContent>
                            </Card>

                            {summaryError && (
                                <Alert variant="destructive">
                                    <AlertCircle className="h-4 w-4" />
                                    <AlertDescription>Error al cargar: {summaryError}</AlertDescription>
                                </Alert>
                            )}

                            {summaryLoading && !summary ? (
                                <div className="flex justify-center py-12" role="status" aria-label="Cargando">
                                    <Loader2 className="h-8 w-8 animate-spin" />
                                </div>
                            ) : visibleCampaigns.length === 0 ? (
                                <Card>
                                    <CardContent className="py-12 text-center text-muted-foreground">
                                        <HandHeart className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                        No hay campañas para este filtro.
                                    </CardContent>
                                </Card>
                            ) : (
                                <div className="space-y-3">
                                    {visibleCampaigns.map((c) => (
                                        <CampaignSummaryCard key={c.campaign_id} c={c} staleHours={staleHours} onOpen={() => openCampaign(c.campaign_id)} />
                                    ))}
                                </div>
                            )}
                        </>
                    ) : (
                        <AllPaymentsView
                            refreshKey={refreshKey}
                            staleHours={staleHours}
                            onOpenCampaign={openCampaign}
                            onMediate={(payment, action, campaignTitle) => setMediation({ payment, action, campaignTitle })}
                        />
                    )}
                </div>
            </main>

            <MediationDialog
                state={mediation}
                onClose={() => setMediation(null)}
                onDone={() => {
                    setMediation(null)
                    setRefreshKey((k) => k + 1)
                }}
            />
        </div>
    )
}

/* ------------------------------------------------------------------ */
/* Piezas                                                              */
/* ------------------------------------------------------------------ */

function StatTile({ label, value, hint, tone, className }: { label: string; value: string; hint?: string; tone?: "warn" | "danger"; className?: string }) {
    return (
        <div
            className={cn(
                "rounded-lg border bg-card p-3 sm:p-4 min-w-0",
                tone === "warn" && "border-accent/50 bg-accent/5",
                tone === "danger" && "border-destructive/40 bg-destructive/5",
                className
            )}
        >
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-1 text-lg sm:text-xl font-bold font-mono truncate">{value}</p>
            {hint && <p className="text-xs text-muted-foreground truncate">{hint}</p>}
        </div>
    )
}

function CampaignSummaryCard({ c, staleHours, onOpen }: { c: CampaignSummary; staleHours: number; onOpen: () => void }) {
    const total = c.pending + c.completed + c.failed
    return (
        <Card className={cn(c.stale > 0 && "border-accent/50", c.duplicates > 0 && "border-destructive/40")}>
            <CardContent className="pt-6 px-4 sm:px-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-semibold text-base sm:text-lg break-words">{c.title}</h3>
                            <Badge variant="outline">{CAMPAIGN_STATUS_LABEL[c.status] || c.status}</Badge>
                            {c.campaign_type !== "crisis" && <Badge variant="outline">Ya no es crisis</Badge>}
                        </div>
                        <p className="text-sm text-muted-foreground break-words">
                            Organizador: {c.creator?.full_name || "—"}
                            {c.creator?.email && <span className="break-all"> · {c.creator.email}</span>}
                        </p>
                        <div className="flex flex-wrap gap-1.5 pt-1">
                            {c.pending > 0 && <Badge variant="secondary"><Clock className="mr-1 h-3 w-3" />{c.pending} por confirmar</Badge>}
                            {c.stale > 0 && (
                                <Badge className="bg-accent text-accent-foreground">
                                    <AlertTriangle className="mr-1 h-3 w-3" />{c.stale} sin respuesta +{staleHours} h
                                </Badge>
                            )}
                            {c.duplicates > 0 && (
                                <Badge variant="destructive"><ShieldAlert className="mr-1 h-3 w-3" />{c.duplicates} ref. repetida{c.duplicates === 1 ? "" : "s"}</Badge>
                            )}
                            {c.status === "active" && c.active_accounts === 0 && (
                                <Badge variant="outline" className="border-accent text-accent">Sin cuentas para recibir</Badge>
                            )}
                            {total === 0 && <Badge variant="outline">Sin pagos aún</Badge>}
                        </div>
                    </div>
                    <div className="flex items-end justify-between gap-3 sm:flex-col sm:items-end sm:text-right sm:shrink-0">
                        <div>
                            <p className="text-xs text-muted-foreground">Confirmado</p>
                            <p className="text-lg font-bold font-mono">{formatUsd(c.confirmed_usd)}</p>
                            <p className="text-xs text-muted-foreground">
                                {c.completed} ok · {c.failed} rech.{c.last_activity_at ? ` · ${timeAgo(c.last_activity_at)}` : ""}
                            </p>
                        </div>
                        <Button size="sm" variant="outline" onClick={onOpen} className="min-h-10 shrink-0">
                            Ver historial
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}

function ContactLinks({ person, waText, mailSubject }: { person: Person; waText: string; mailSubject: string }) {
    if (!person) return null
    const wa = whatsappLink(person.phone, waText)
    return (
        <div className="flex flex-wrap gap-2">
            {person.email && (
                <Button asChild size="sm" variant="outline" className="min-h-10">
                    <a href={`mailto:${person.email}?subject=${encodeURIComponent(mailSubject)}`}>
                        <Mail className="mr-1.5 h-4 w-4" /> Correo
                    </a>
                </Button>
            )}
            {wa && (
                <Button asChild size="sm" variant="outline" className="min-h-10">
                    <a href={wa} target="_blank" rel="noopener noreferrer">
                        <MessageCircle className="mr-1.5 h-4 w-4" /> WhatsApp
                    </a>
                </Button>
            )}
        </div>
    )
}

function AccountLines({ account }: { account: CrisisAccount }) {
    return (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
            {receivingAccountLines(account).map((l) => (
                <div key={l.label} className="contents">
                    <dt className="text-muted-foreground">{l.label}</dt>
                    <dd className="font-mono break-all">{l.value}</dd>
                </div>
            ))}
        </dl>
    )
}

function CampaignDetailView({
    campaignId,
    refreshKey,
    onBack,
    onMediate,
}: {
    campaignId: string
    refreshKey: number
    onBack: () => void
    onMediate: (payment: DirectPayment, action: MediationAction, campaignTitle: string) => void
}) {
    const [detail, setDetail] = useState<CampaignDetail | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [filter, setFilter] = useState<PaymentFilter>("all")
    const [search, setSearch] = useState("")

    useEffect(() => {
        let cancelled = false
        const load = async () => {
            try {
                setLoading(true)
                setError(null)
                const res = await fetch(`/api/admin/direct-payments?campaignId=${encodeURIComponent(campaignId)}`, { cache: "no-store" })
                const data = await res.json()
                if (!res.ok) throw new Error(data?.details || data?.error || "No se pudo cargar")
                if (!cancelled) setDetail(data)
            } catch (err: any) {
                if (!cancelled) setError(err.message)
            } finally {
                if (!cancelled) setLoading(false)
            }
        }
        load()
        return () => {
            cancelled = true
        }
    }, [campaignId, refreshKey])

    const auditByDonation = useMemo(() => {
        const map = new Map<string, AuditEntry[]>()
        for (const entry of detail?.audit || []) {
            const list = map.get(entry.target_id) || []
            list.push(entry)
            map.set(entry.target_id, list)
        }
        return map
    }, [detail])

    const rows = useMemo(() => filterPayments(detail?.donations || [], filter, search), [detail, filter, search])

    if (loading && !detail) {
        return (
            <div className="flex justify-center py-12" role="status" aria-label="Cargando">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        )
    }

    if (error || !detail) {
        return (
            <div className="space-y-3">
                <Button variant="outline" size="sm" onClick={onBack} className="min-h-10">
                    <ArrowLeft className="mr-2 h-4 w-4" /> Volver a campañas
                </Button>
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error || "No se pudo cargar la campaña"}</AlertDescription>
                </Alert>
            </div>
        )
    }

    const { campaign, creator, accounts, donations } = detail
    const confirmedUsd = donations.filter((d) => d.payment_status === "completed").reduce((s, d) => s + Number(d.amount_usd || 0), 0)
    const pendingCount = donations.filter((d) => d.payment_status === "pending").length
    const failedCount = donations.filter((d) => d.payment_status === "failed").length
    const creatorWa = `Hola ${creator?.full_name?.split(" ")[0] || ""}, te escribimos de LaVaca sobre los pagos directos de tu campaña "${campaign.title}".`

    return (
        <div className="space-y-4">
            <Button variant="outline" size="sm" onClick={onBack} className="min-h-10">
                <ArrowLeft className="mr-2 h-4 w-4" /> Volver a campañas
            </Button>

            <Card>
                <CardContent className="pt-6 px-4 sm:px-6 space-y-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                                <h2 className="text-lg sm:text-xl font-bold break-words">{campaign.title}</h2>
                                <Badge variant="outline">{CAMPAIGN_STATUS_LABEL[campaign.status] || campaign.status}</Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">Creada {timeAgo(campaign.created_at)}</p>
                        </div>
                        <Button asChild size="sm" variant="outline" className="min-h-10 self-start">
                            <Link href={`/campaigns/${campaign.slug || campaign.id}`} target="_blank">
                                Ver campaña <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                            </Link>
                        </Button>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <StatTile label="Confirmado (directo)" value={formatUsd(confirmedUsd)} />
                        <StatTile label="Barra actual" value={formatUsd(campaign.current_amount_usd)} />
                        <StatTile label="Por confirmar" value={String(pendingCount)} />
                        <StatTile label="Rechazados / anulados" value={String(failedCount)} />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                        <div className="rounded-lg border p-3 sm:p-4 space-y-2 min-w-0">
                            <p className="text-sm font-semibold">Organizador</p>
                            <p className="text-sm break-words">{creator?.full_name || "—"}</p>
                            <p className="text-xs text-muted-foreground break-all">
                                {creator?.email || "Sin correo"}
                                {creator?.phone ? ` · ${prettyVePhone(creator.phone)}` : " · Sin teléfono"}
                            </p>
                            {creator?.kyc_status && (
                                <p className="text-xs text-muted-foreground">KYC: {creator.kyc_status}</p>
                            )}
                            <ContactLinks person={creator} waText={creatorWa} mailSubject={`LaVaca · pagos directos de "${campaign.title}"`} />
                        </div>

                        <div className="rounded-lg border p-3 sm:p-4 space-y-2 min-w-0">
                            <p className="text-sm font-semibold">Cuentas para recibir ({accounts.length})</p>
                            {accounts.length === 0 ? (
                                <p className="text-sm text-muted-foreground">El organizador no ha cargado cuentas.</p>
                            ) : (
                                <ul className="space-y-2">
                                    {accounts.map((a) => (
                                        <li key={a.id} className="rounded-md bg-muted/40 p-2.5 space-y-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="text-xs font-medium">{RECEIVING_ACCOUNT_LABEL[a.account_type as ReceivingAccountType] || a.account_type}</span>
                                                {!a.is_active && <Badge variant="outline" className="text-[10px]">Oculta</Badge>}
                                            </div>
                                            <AccountLines account={a} />
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="px-4 sm:px-6">
                    <CardTitle className="text-base sm:text-lg">Historial de pagos directos ({donations.length})</CardTitle>
                </CardHeader>
                <CardContent className="px-4 sm:px-6 space-y-3">
                    <div className="flex flex-wrap gap-2">
                        {PAYMENT_FILTERS.map((f) => (
                            <Button key={f.key} size="sm" variant={filter === f.key ? "default" : "outline"} onClick={() => setFilter(f.key)}>
                                {f.label}
                            </Button>
                        ))}
                    </div>
                    <Input
                        placeholder="Buscar por referencia, donante o correo…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        aria-label="Buscar pago"
                    />
                </CardContent>
            </Card>

            {rows.length === 0 ? (
                <Card>
                    <CardContent className="py-10 text-center text-muted-foreground">No hay pagos para este filtro.</CardContent>
                </Card>
            ) : (
                <div className="space-y-3">
                    {rows.map((d) => (
                        <DirectPaymentCard
                            key={d.id}
                            d={d}
                            campaignTitle={campaign.title}
                            audit={auditByDonation.get(d.id) || []}
                            onMediate={(action) => onMediate(d, action, campaign.title)}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}

function AllPaymentsView({
    refreshKey,
    staleHours,
    onOpenCampaign,
    onMediate,
}: {
    refreshKey: number
    staleHours: number
    onOpenCampaign: (id: string) => void
    onMediate: (payment: DirectPayment, action: MediationAction, campaignTitle: string) => void
}) {
    const [status, setStatus] = useState<"all" | "pending" | "completed" | "failed" | "stale">("all")
    const [rows, setRows] = useState<DirectPayment[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [search, setSearch] = useState("")

    useEffect(() => {
        let cancelled = false
        const load = async () => {
            try {
                setLoading(true)
                setError(null)
                const qs = status === "stale" ? "view=list&stale=1" : `view=list&status=${status}`
                const res = await fetch(`/api/admin/direct-payments?${qs}`, { cache: "no-store" })
                const data = await res.json()
                if (!res.ok) throw new Error(data?.details || data?.error || "No se pudo cargar")
                if (!cancelled) setRows(data.donations || [])
            } catch (err: any) {
                if (!cancelled) setError(err.message)
            } finally {
                if (!cancelled) setLoading(false)
            }
        }
        load()
        return () => {
            cancelled = true
        }
    }, [status, refreshKey])

    const visible = useMemo(() => filterPayments(rows, "all", search), [rows, search])

    return (
        <div className="space-y-4">
            <Card>
                <CardContent className="pt-6 px-4 sm:px-6 space-y-3">
                    <div className="flex flex-wrap gap-2">
                        {([
                            ["all", "Todos"],
                            ["pending", "Por confirmar"],
                            ["stale", `Sin respuesta +${staleHours} h`],
                            ["completed", "Confirmados"],
                            ["failed", "Rechazados / anulados"],
                        ] as const).map(([key, label]) => (
                            <Button key={key} size="sm" variant={status === key ? "default" : "outline"} onClick={() => setStatus(key)}>
                                {label}
                            </Button>
                        ))}
                    </div>
                    <Input
                        placeholder="Buscar por campaña, referencia, donante o correo…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        aria-label="Buscar pago"
                    />
                    <p className="text-xs text-muted-foreground">Se muestran los 300 más recientes del filtro. Para el historial completo, abre la campaña.</p>
                </CardContent>
            </Card>

            {error && (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            {loading ? (
                <div className="flex justify-center py-12" role="status" aria-label="Cargando">
                    <Loader2 className="h-8 w-8 animate-spin" />
                </div>
            ) : visible.length === 0 ? (
                <Card>
                    <CardContent className="py-10 text-center text-muted-foreground">No hay pagos para este filtro.</CardContent>
                </Card>
            ) : (
                <div className="space-y-3">
                    {visible.map((d) => (
                        <DirectPaymentCard
                            key={d.id}
                            d={d}
                            campaignTitle={d.campaigns?.title || "Campaña"}
                            showCampaign
                            onOpenCampaign={() => onOpenCampaign(d.campaign_id)}
                            onMediate={(action) => onMediate(d, action, d.campaigns?.title || "la campaña")}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}

function DirectPaymentCard({
    d,
    campaignTitle,
    audit = [],
    showCampaign = false,
    onOpenCampaign,
    onMediate,
}: {
    d: DirectPayment
    campaignTitle: string
    audit?: AuditEntry[]
    showCampaign?: boolean
    onOpenCampaign?: () => void
    onMediate: (action: MediationAction) => void
}) {
    const [copied, setCopied] = useState(false)
    const amount = directDonationMoneyLabel(d)
    const donorName = d.is_anonymous ? `Anónimo (${d.donor_name || d.donor?.full_name || "sin nombre"})` : d.donor_name || d.donor?.full_name || "Donante"
    const donorEmail = d.email || d.donor?.email || null
    const isImage = d.capture_url && /\.(jpe?g|png|webp)(\?|$)/i.test(d.capture_url)

    const copyRef = async () => {
        if (!d.reference_number) return
        try {
            await navigator.clipboard.writeText(d.reference_number)
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
        } catch {
            // sin portapapeles
        }
    }

    // Línea de tiempo: registro → decisión del organizador → acciones de LaVaca.
    const timeline: { at: string; icon: React.ReactNode; title: string; detail?: string | null }[] = [
        { at: d.created_at, icon: <FileText className="h-3.5 w-3.5" />, title: "El donante registró el pago" },
    ]
    if (d.confirmed_at && d.payment_status !== "pending") {
        const who = d.confirmer?.full_name || "el organizador"
        // Un pago anulado por LaVaca había sido CONFIRMADO por el organizador.
        const wasConfirmed = d.payment_status === "completed" || isAnnulledByLavaca(d)
        timeline.push({
            at: d.confirmed_at,
            icon: wasConfirmed ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />,
            title: wasConfirmed ? `Confirmado por ${who}` : `Rechazado por ${who}`,
            detail: !wasConfirmed && d.admin_notes?.startsWith("Pago directo rechazado por el organizador:")
                ? d.admin_notes.replace("Pago directo rechazado por el organizador:", "Motivo:")
                : null,
        })
    }
    for (const a of audit) {
        timeline.push({
            at: a.created_at,
            icon: a.action === "direct_payment_annul" ? <Undo2 className="h-3.5 w-3.5" /> : a.action === "direct_payment_reopen" ? <RotateCcw className="h-3.5 w-3.5" /> : a.action === "direct_payment_remind" ? <Bell className="h-3.5 w-3.5" /> : <MessageSquarePlus className="h-3.5 w-3.5" />,
            title: `${AUDIT_LABEL[a.action] || a.action}${a.admin?.full_name ? ` · ${a.admin.full_name}` : ""}`,
            detail: a.reason,
        })
    }
    timeline.sort((a, b) => a.at.localeCompare(b.at))

    const donorWa = `Hola, te escribimos de LaVaca sobre tu pago de ${amount}${d.reference_number ? ` (ref. ${d.reference_number})` : ""} a la campaña "${campaignTitle}".`

    return (
        <Card className={cn(d.duplicate_reference && "border-destructive/40", !d.duplicate_reference && d.stale && "border-accent/50")}>
            <CardContent className="pt-6 px-4 sm:px-6 space-y-4">
                {/* Encabezado */}
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 space-y-1">
                        <p className="flex flex-wrap items-center gap-2">
                            <span className="text-xl font-bold font-mono">{amount}</span>
                            {d.currency === "BS" && d.amount_bs != null && (
                                <span className="text-xs text-muted-foreground">≈ {formatUsd(d.amount_usd)}</span>
                            )}
                        </p>
                        {showCampaign && (
                            <button type="button" onClick={onOpenCampaign} className="text-left text-sm font-medium text-primary hover:underline break-words">
                                {campaignTitle}
                            </button>
                        )}
                        <p className="text-xs text-muted-foreground">
                            Registrado {timeAgo(d.created_at)} · {fullDate(d.created_at)}
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5 sm:justify-end sm:shrink-0">{statusBadge(d)}</div>
                </div>

                {/* Alertas */}
                {(d.stale || d.duplicate_reference) && (
                    <div className="space-y-2">
                        {d.stale && (
                            <div className="flex items-start gap-2 rounded-md border border-accent/40 bg-accent/10 p-2.5 text-xs">
                                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                                <span>El organizador no ha respondido este pago desde {timeAgo(d.created_at)}. Considera recordarle o contactarlo.</span>
                            </div>
                        )}
                        {d.duplicate_reference && (
                            <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-2.5 text-xs">
                                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                                <span>
                                    Esta referencia aparece en otro pago no rechazado
                                    {d.duplicate_in_other_campaign ? " de OTRA campaña" : ""}. Puede ser un comprobante reutilizado o un doble registro.
                                </span>
                            </div>
                        )}
                    </div>
                )}

                {/* Datos */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="rounded-lg bg-muted/50 p-3 space-y-1.5 min-w-0">
                        <p className="text-xs font-semibold text-muted-foreground">Donante</p>
                        <p className="text-sm font-medium break-words">{donorName}</p>
                        <p className="text-xs text-muted-foreground break-all">
                            {donorEmail || "Sin correo"}
                            {d.donor?.phone ? ` · ${prettyVePhone(d.donor.phone)}` : ""}
                            {!d.donor_id && " · sin cuenta en LaVaca"}
                        </p>
                        <ContactLinks
                            person={{ full_name: donorName, email: donorEmail, phone: d.donor?.phone || null }}
                            waText={donorWa}
                            mailSubject={`LaVaca · tu pago a "${campaignTitle}"`}
                        />
                    </div>

                    <div className="rounded-lg bg-muted/50 p-3 space-y-1.5 min-w-0">
                        <p className="text-xs font-semibold text-muted-foreground">
                            Pagó a: {RECEIVING_ACCOUNT_LABEL[(d.account?.account_type || d.payment_method) as ReceivingAccountType] || d.payment_method}
                            {d.account && !d.account.is_active && " (cuenta oculta hoy)"}
                        </p>
                        {d.account ? <AccountLines account={d.account} /> : <p className="text-xs text-muted-foreground">La cuenta ya no existe.</p>}
                        <div className="pt-1">
                            <p className="text-xs text-muted-foreground">Referencia</p>
                            <div className="flex items-center gap-2 min-w-0">
                                <span className="font-mono text-sm break-all">{d.reference_number || "—"}</span>
                                {d.reference_number && (
                                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={copyRef} aria-label="Copiar referencia">
                                        {copied ? <CheckCircle2 className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Comprobante */}
                {d.capture_url ? (
                    <div>
                        <a href={d.capture_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline">
                            <ExternalLink className="h-3 w-3" /> Ver comprobante
                        </a>
                        {isImage && (
                            <a href={d.capture_url} target="_blank" rel="noopener noreferrer" className="mt-2 block">
                                <img
                                    src={d.capture_url}
                                    alt="Comprobante del pago"
                                    loading="lazy"
                                    className="max-h-48 sm:max-h-64 max-w-full rounded border border-border bg-muted/30 object-contain"
                                />
                            </a>
                        )}
                    </div>
                ) : (
                    <p className="text-xs text-muted-foreground">El donante no adjuntó comprobante.</p>
                )}

                {/* Bitácora */}
                <div className="border-t pt-3">
                    <p className="text-xs font-semibold text-muted-foreground mb-2">Bitácora</p>
                    <ol className="space-y-2">
                        {timeline.map((t, i) => (
                            <li key={`${t.at}-${i}`} className="flex gap-2 text-xs">
                                <span className="mt-0.5 shrink-0 text-muted-foreground">{t.icon}</span>
                                <div className="min-w-0">
                                    <p className="font-medium break-words">{t.title}</p>
                                    {t.detail && <p className="text-muted-foreground break-words">{t.detail}</p>}
                                    <p className="text-muted-foreground">{fullDate(t.at)}</p>
                                </div>
                            </li>
                        ))}
                    </ol>
                    {showCampaign && (
                        <p className="mt-2 text-[11px] text-muted-foreground">Las notas de mediación se ven en el historial de la campaña.</p>
                    )}
                </div>

                {/* Mediación */}
                <div className="flex flex-col gap-2 border-t pt-3 sm:flex-row sm:flex-wrap [&>button]:min-h-11 sm:[&>button]:min-h-9">
                    <Button size="sm" variant="outline" onClick={() => onMediate("note")}>
                        <MessageSquarePlus className="mr-2 h-4 w-4" /> Nota de mediación
                    </Button>
                    {d.payment_status === "pending" && (
                        <Button size="sm" variant="outline" onClick={() => onMediate("remind")}>
                            <Bell className="mr-2 h-4 w-4" /> Recordar al organizador
                        </Button>
                    )}
                    {d.payment_status === "failed" && (
                        <Button size="sm" variant="outline" onClick={() => onMediate("reopen")}>
                            <RotateCcw className="mr-2 h-4 w-4" /> Devolver a "por confirmar"
                        </Button>
                    )}
                    {d.payment_status === "completed" && (
                        <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={() => onMediate("annul")}>
                            <Undo2 className="mr-2 h-4 w-4" /> Anular pago
                        </Button>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}

function MediationDialog({
    state,
    onClose,
    onDone,
}: {
    state: { payment: DirectPayment; action: MediationAction; campaignTitle: string } | null
    onClose: () => void
    onDone: () => void
}) {
    const [reason, setReason] = useState("")
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        setReason("")
        setError(null)
    }, [state])

    if (!state) return null
    const copy = ACTION_COPY[state.action]
    const tooShort = copy.required && reason.trim().length < 5

    const submit = async () => {
        if (tooShort) {
            setError("Describe brevemente el motivo (mínimo 5 caracteres)")
            return
        }
        setSubmitting(true)
        setError(null)
        try {
            const res = await fetch(`/api/admin/direct-payments/${state.payment.id}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: state.action, reason: reason.trim() }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data?.error || data?.details || "No se pudo completar")
            if (state.action === "annul" && data?.barAdjusted === false) {
                toast.warning("Pago anulado, pero no se pudo descontar de la barra", { description: data?.barError })
            } else {
                toast.success(
                    state.action === "note" ? "Nota guardada" :
                        state.action === "remind" ? "Recordatorio enviado al organizador" :
                            state.action === "reopen" ? "El pago volvió a \"por confirmar\"" :
                                "Pago anulado y descontado de la barra"
                )
            }
            onDone()
        } catch (err: any) {
            setError(err.message)
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <Dialog open onOpenChange={(open) => !open && !submitting && onClose()}>
            <DialogContent className="w-[calc(100vw-2rem)] max-w-lg">
                <DialogHeader>
                    <DialogTitle>{copy.title}</DialogTitle>
                    <DialogDescription>{copy.description}</DialogDescription>
                </DialogHeader>
                <div className="rounded-md bg-muted/50 p-3 text-sm">
                    <p className="font-mono font-semibold">{directDonationMoneyLabel(state.payment)}</p>
                    <p className="text-xs text-muted-foreground break-words">
                        {state.campaignTitle}
                        {state.payment.reference_number ? ` · ref. ${state.payment.reference_number}` : ""}
                    </p>
                </div>
                <Textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder={copy.placeholder}
                    rows={4}
                    maxLength={1000}
                    aria-label={copy.required ? "Motivo" : "Nota opcional"}
                />
                {error && (
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}
                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={submitting} className="min-h-11 sm:min-h-9">
                        Cancelar
                    </Button>
                    <Button
                        onClick={submit}
                        disabled={submitting || tooShort}
                        variant={state.action === "annul" ? "destructive" : "default"}
                        className="min-h-11 sm:min-h-9"
                    >
                        {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {copy.confirm}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
