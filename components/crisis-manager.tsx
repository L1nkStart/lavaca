'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
    Loader2,
    Plus,
    Trash2,
    CheckCircle2,
    XCircle,
    Wallet,
    ExternalLink,
    HandHeart,
    ChevronDown,
    Copy,
    Check,
    FileText,
    Bell,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { toast } from 'sonner'
import { formatBs, formatUsd } from '@/lib/format'
import { cn } from '@/lib/utils'
import { ReceivingAccountForm, ReceivingAccountItem } from '@/components/receiving-account-form'
import { RECEIVING_ACCOUNT_LABEL, receivingAccountSummary, type ReceivingAccountInput, type ReceivingAccountType } from '@/lib/venezuela'

type CrisisAccount = ReceivingAccountInput & {
    id: string
    is_active: boolean
}

type DirectDonation = {
    id: string
    amount_usd: number
    amount_bs: number | null
    currency: 'USD' | 'BS' | null
    payment_method: string
    reference_number: string | null
    capture_url: string | null
    donor_name: string | null
    email: string | null
    is_anonymous: boolean
    payment_status: string
    created_at: string
    confirmed_at: string | null
    crisis_account_id: string | null
}

interface CrisisManagerProps {
    campaignId: string
    isCrisis: boolean
    /** Nombre del perfil para prellenar "Titular". */
    defaultHolderName?: string
}

const isImageUrl = (url: string) => /\.(png|jpe?g|webp|gif)(\?|$)/i.test(url)

export function CrisisManager({ campaignId, isCrisis, defaultHolderName = '' }: CrisisManagerProps) {
    const [accounts, setAccounts] = useState<CrisisAccount[]>([])
    const [donations, setDonations] = useState<DirectDonation[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [processingId, setProcessingId] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [showAddForm, setShowAddForm] = useState(false)
    const [rejectTarget, setRejectTarget] = useState<DirectDonation | null>(null)
    const [deleteTarget, setDeleteTarget] = useState<CrisisAccount | null>(null)
    const [historyOpen, setHistoryOpen] = useState(false)
    const [copiedRef, setCopiedRef] = useState<string | null>(null)

    const load = async () => {
        try {
            const [accRes, donRes] = await Promise.all([
                fetch(`/api/campaigns/${campaignId}/crisis-accounts`, { cache: 'no-store' }),
                fetch(`/api/campaigns/${campaignId}/direct-donations?status=all`, { cache: 'no-store' }),
            ])
            const accData = await accRes.json()
            const donData = await donRes.json()
            if (accRes.ok) setAccounts(accData.accounts || [])
            if (donRes.ok) setDonations(donData.donations || [])
            if (!accRes.ok || !donRes.ok) setError(accData?.error || donData?.error || 'No se pudieron cargar los datos')
        } catch {
            setError('No se pudieron cargar los datos. Revisa tu conexión e intenta de nuevo.')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        load()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [campaignId])

    const pending = useMemo(() => donations.filter((d) => d.payment_status === 'pending'), [donations])
    const history = useMemo(
        () => donations.filter((d) => d.payment_status !== 'pending').slice(0, 15),
        [donations]
    )
    const activeAccounts = accounts.filter((a) => a.is_active)
    const accountById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts])

    const addAccount = async (account: ReceivingAccountInput) => {
        setError(null)
        setSaving(true)
        try {
            const response = await fetch(`/api/campaigns/${campaignId}/crisis-accounts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(account),
            })
            const result = await response.json()
            if (!response.ok) throw new Error(result?.error || 'No se pudo agregar la cuenta')
            toast.success('Cuenta agregada', { description: 'Los donantes ya pueden verla en tu campaña.' })
            setShowAddForm(false)
            await load()
        } catch (err: any) {
            setError(err.message)
            throw err
        } finally {
            setSaving(false)
        }
    }

    const toggleActive = async (account: CrisisAccount) => {
        // Optimista: el switch responde al toque, y si falla se revierte.
        setAccounts((prev) => prev.map((a) => (a.id === account.id ? { ...a, is_active: !a.is_active } : a)))
        const res = await fetch(`/api/campaigns/${campaignId}/crisis-accounts/${account.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ is_active: !account.is_active }),
        })
        if (!res.ok) {
            setAccounts((prev) => prev.map((a) => (a.id === account.id ? { ...a, is_active: account.is_active } : a)))
            toast.error('No se pudo cambiar la visibilidad de la cuenta')
            return
        }
        toast.success(account.is_active ? 'Cuenta oculta a los donantes' : 'Cuenta visible para los donantes')
    }

    const deleteAccount = async () => {
        if (!deleteTarget) return
        const target = deleteTarget
        setDeleteTarget(null)
        const res = await fetch(`/api/campaigns/${campaignId}/crisis-accounts/${target.id}`, { method: 'DELETE' })
        if (!res.ok) {
            toast.error('No se pudo eliminar la cuenta')
            return
        }
        toast.success('Cuenta eliminada')
        await load()
    }

    const resolveDonation = async (donation: DirectDonation, action: 'confirm' | 'reject') => {
        setProcessingId(donation.id)
        setError(null)
        try {
            const response = await fetch(`/api/campaigns/${campaignId}/direct-donations/${donation.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action }),
            })
            const result = await response.json()
            if (!response.ok) throw new Error(result?.error || 'No se pudo procesar')
            if (action === 'confirm') {
                toast.success(`Pago de ${money(donation)} confirmado`, {
                    description: 'Ya suma a la barra de tu campaña.',
                })
            } else {
                toast('Pago rechazado', { description: 'No sumará a la campaña.' })
            }
            await load()
        } catch (err: any) {
            setError(err.message)
        } finally {
            setProcessingId(null)
        }
    }

    const money = (d: DirectDonation) =>
        d.currency === 'BS' && d.amount_bs != null ? formatBs(Number(d.amount_bs)) : formatUsd(Number(d.amount_usd))

    const secondaryMoney = (d: DirectDonation) =>
        d.currency === 'BS' && d.amount_bs != null ? `≈ ${formatUsd(Number(d.amount_usd))}` : null

    const copyRef = async (ref: string) => {
        try {
            await navigator.clipboard.writeText(ref)
            setCopiedRef(ref)
            setTimeout(() => setCopiedRef(null), 1500)
        } catch {
            // sin portapapeles: nada que hacer
        }
    }

    const whereItLanded = (d: DirectDonation) => {
        const acc = d.crisis_account_id ? accountById.get(d.crisis_account_id) : null
        if (acc) return `${RECEIVING_ACCOUNT_LABEL[acc.account_type]} · ${receivingAccountSummary(acc)}`
        return RECEIVING_ACCOUNT_LABEL[d.payment_method as ReceivingAccountType] || d.payment_method
    }

    const timeAgo = (iso: string) => {
        try {
            return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: es })
        } catch {
            return ''
        }
    }

    if (loading) {
        return (
            <div className="flex justify-center py-10" role="status" aria-label="Cargando">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        )
    }

    const noAccounts = accounts.length === 0
    const noActiveAccounts = !noAccounts && activeAccounts.length === 0

    /* ---------------- Sección: cuentas ---------------- */
    const accountsSection = (
        <Card className={cn(noAccounts && isCrisis && 'border-accent/50')}>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Wallet className="h-5 w-5 text-primary" />
                    Mis cuentas para recibir
                    {!noAccounts && (
                        <Badge variant="secondary" className="ml-1">{activeAccounts.length} visible{activeAccounts.length === 1 ? '' : 's'}</Badge>
                    )}
                </CardTitle>
                <CardDescription>
                    Estos datos se muestran a los donantes para que te paguen directo. Agrega solo cuentas tuyas.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {noAccounts ? (
                    <div className="rounded-lg border border-dashed border-accent/50 bg-accent/5 p-4">
                        <p className="font-medium">Tu campaña todavía no puede recibir donaciones</p>
                        <p className="mt-1 text-sm text-foreground/75">
                            Nadie puede pagarte hasta que agregues al menos una cuenta. Empieza por PagoMóvil, es lo que
                            más usan los donantes.
                        </p>
                    </div>
                ) : (
                    <>
                        {noActiveAccounts && (
                            <Alert className="border-accent/40 bg-accent/10">
                                <AlertDescription className="text-foreground">
                                    Todas tus cuentas están ocultas: los donantes no ven ninguna. Activa al menos una.
                                </AlertDescription>
                            </Alert>
                        )}
                        <ul className="space-y-2">
                            {accounts.map((a) => (
                                <li key={a.id}>
                                    <ReceivingAccountItem
                                        account={a}
                                        copyable
                                        actions={
                                            <>
                                                <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                                    <span className="hidden sm:inline">{a.is_active ? 'Visible' : 'Oculta'}</span>
                                                    <Switch
                                                        checked={a.is_active}
                                                        onCheckedChange={() => toggleActive(a)}
                                                        aria-label={a.is_active ? 'Ocultar cuenta a los donantes' : 'Mostrar cuenta a los donantes'}
                                                    />
                                                </label>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="h-9 w-9 p-0 text-muted-foreground hover:text-destructive"
                                                    onClick={() => setDeleteTarget(a)}
                                                    aria-label="Eliminar cuenta"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </>
                                        }
                                    />
                                </li>
                            ))}
                        </ul>
                    </>
                )}

                {noAccounts || showAddForm ? (
                    <div className="rounded-lg border bg-muted/30 p-4">
                        <div className="mb-3 flex items-center justify-between">
                            <p className="text-sm font-medium">{noAccounts ? 'Agregar mi primera cuenta' : 'Nueva cuenta'}</p>
                            {!noAccounts && (
                                <Button type="button" variant="ghost" size="sm" onClick={() => setShowAddForm(false)}>
                                    Cancelar
                                </Button>
                            )}
                        </div>
                        <ReceivingAccountForm
                            defaultHolderName={defaultHolderName}
                            onAdd={addAccount}
                            submitting={saving}
                            submitLabel="Guardar cuenta"
                        />
                    </div>
                ) : (
                    <Button type="button" variant="outline" onClick={() => setShowAddForm(true)} className="min-h-[44px]">
                        <Plus className="mr-2 h-4 w-4" />
                        Agregar otra cuenta
                    </Button>
                )}
            </CardContent>
        </Card>
    )

    /* ---------------- Sección: pagos por confirmar ---------------- */
    const pendingSection = (
        <Card className={cn(pending.length > 0 && 'border-orange-300 dark:border-orange-800')}>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <HandHeart className="h-5 w-5 text-orange-500" />
                    Pagos por confirmar
                    {pending.length > 0 && (
                        <Badge className="ml-1 bg-orange-500 text-white hover:bg-orange-500">{pending.length}</Badge>
                    )}
                </CardTitle>
                <CardDescription>
                    Cada pago que registra un donante aparece aquí. Revisa tu banco o tu app y confirma solo los que de verdad
                    llegaron: al confirmar, el monto sube a la barra de tu campaña.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
                {!isCrisis ? (
                    <p className="text-sm text-muted-foreground">
                        El pago directo se activa cuando la campaña está en modo crisis.
                    </p>
                ) : pending.length === 0 ? (
                    <div className="flex items-start gap-3 rounded-lg border bg-muted/30 p-4 text-sm">
                        <Bell className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                        <div>
                            <p className="font-medium">No tienes pagos pendientes</p>
                            <p className="text-muted-foreground">
                                Cuando alguien registre un pago te avisamos aquí y en la campana de notificaciones.
                            </p>
                        </div>
                    </div>
                ) : (
                    pending.map((d) => {
                        const busy = processingId === d.id
                        const hasImage = !!d.capture_url && isImageUrl(d.capture_url)
                        return (
                            <div key={d.id} className="rounded-lg border bg-card p-4">
                                <div className="flex gap-4">
                                    {/* Comprobante: la imagen a la vista, no un enlace escondido */}
                                    {d.capture_url ? (
                                        <a
                                            href={d.capture_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="group relative block h-24 w-20 shrink-0 overflow-hidden rounded-md border bg-muted"
                                            aria-label="Abrir comprobante en otra pestaña"
                                        >
                                            {hasImage ? (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img
                                                    src={d.capture_url}
                                                    alt="Comprobante de pago"
                                                    loading="lazy"
                                                    className="h-full w-full object-cover transition-transform group-hover:scale-105"
                                                />
                                            ) : (
                                                <span className="flex h-full w-full flex-col items-center justify-center gap-1 text-[10px] text-muted-foreground">
                                                    <FileText className="h-6 w-6" />
                                                    PDF
                                                </span>
                                            )}
                                            <span className="absolute bottom-1 right-1 rounded bg-background/90 p-0.5">
                                                <ExternalLink className="h-3 w-3" />
                                            </span>
                                        </a>
                                    ) : (
                                        <div className="flex h-24 w-20 shrink-0 items-center justify-center rounded-md border border-dashed bg-muted/40 text-center text-[10px] text-muted-foreground">
                                            Sin comprobante
                                        </div>
                                    )}

                                    <div className="min-w-0 flex-1 space-y-1">
                                        <div className="flex flex-wrap items-baseline gap-x-2">
                                            <p className="font-mono text-2xl font-bold leading-none text-primary">{money(d)}</p>
                                            {secondaryMoney(d) && (
                                                <p className="font-mono text-xs text-muted-foreground">{secondaryMoney(d)}</p>
                                            )}
                                        </div>
                                        <p className="text-sm">
                                            <span className="font-medium">{d.is_anonymous ? 'Donante anónimo' : (d.donor_name || 'Donante')}</span>
                                            {d.email && <span className="text-muted-foreground"> · {d.email}</span>}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            A tu <span className="font-medium text-foreground">{whereItLanded(d)}</span>
                                        </p>
                                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                            <span className="inline-flex items-center gap-1">
                                                Ref:{' '}
                                                <span className="font-mono text-foreground">{d.reference_number || '—'}</span>
                                                {d.reference_number && (
                                                    <button
                                                        type="button"
                                                        onClick={() => copyRef(d.reference_number!)}
                                                        className="rounded p-0.5 hover:text-primary"
                                                        aria-label="Copiar referencia"
                                                    >
                                                        {copiedRef === d.reference_number ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                                                    </button>
                                                )}
                                            </span>
                                            <span title={new Date(d.created_at).toLocaleString('es-VE')}>{timeAgo(d.created_at)}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-3 flex flex-col gap-2 border-t pt-3 sm:flex-row sm:items-center">
                                    <p className="text-sm text-foreground/80 sm:flex-1">¿Este pago llegó a tu cuenta?</p>
                                    <div className="flex gap-2">
                                        <Button
                                            size="sm"
                                            className="min-h-[44px] flex-1 sm:flex-none sm:min-w-[140px]"
                                            onClick={() => resolveDonation(d, 'confirm')}
                                            disabled={busy}
                                        >
                                            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                                            Sí, confirmar
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="min-h-[44px] flex-1 sm:flex-none"
                                            onClick={() => setRejectTarget(d)}
                                            disabled={busy}
                                        >
                                            <XCircle className="mr-2 h-4 w-4" />
                                            No llegó
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )
                    })
                )}
            </CardContent>
        </Card>
    )

    /* ---------------- Sección: historial ---------------- */
    const historySection = history.length > 0 && (
        <Collapsible open={historyOpen} onOpenChange={setHistoryOpen}>
            <Card>
                <CollapsibleTrigger asChild>
                    <button
                        type="button"
                        className="flex w-full items-center justify-between px-6 py-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl"
                    >
                        <span>
                            <span className="font-semibold">Pagos ya revisados</span>
                            <span className="ml-2 text-sm text-muted-foreground">últimos {history.length}</span>
                        </span>
                        <ChevronDown className={cn('h-4 w-4 transition-transform', historyOpen && 'rotate-180')} />
                    </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                    <CardContent className="space-y-2 pt-0">
                        {history.map((d) => (
                            <div key={d.id} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm">
                                <div className="min-w-0">
                                    <p className="truncate">
                                        <span className="font-mono font-semibold">{money(d)}</span>
                                        <span className="text-muted-foreground"> · {d.is_anonymous ? 'Anónimo' : (d.donor_name || 'Donante')}</span>
                                    </p>
                                    <p className="truncate text-xs text-muted-foreground">
                                        Ref: <span className="font-mono">{d.reference_number || '—'}</span> · {timeAgo(d.confirmed_at || d.created_at)}
                                    </p>
                                </div>
                                {d.payment_status === 'completed' ? (
                                    <Badge className="shrink-0 bg-primary">
                                        <CheckCircle2 className="mr-1 h-3 w-3" /> Confirmado
                                    </Badge>
                                ) : (
                                    <Badge variant="destructive" className="shrink-0">Rechazado</Badge>
                                )}
                            </div>
                        ))}
                    </CardContent>
                </CollapsibleContent>
            </Card>
        </Collapsible>
    )

    return (
        <div className="space-y-6">
            {error && (
                <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            {/* Orden según lo que urge: sin cuentas → primero cuentas; con cuentas → primero pagos. */}
            {noAccounts ? (
                <>
                    {accountsSection}
                    {pendingSection}
                </>
            ) : (
                <>
                    {pendingSection}
                    {accountsSection}
                </>
            )}
            {historySection}

            {/* Rechazar pago */}
            <AlertDialog open={!!rejectTarget} onOpenChange={(open) => !open && setRejectTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Rechazar este pago?</AlertDialogTitle>
                        <AlertDialogDescription>
                            {rejectTarget && (
                                <>
                                    El pago de <strong>{money(rejectTarget)}</strong>
                                    {rejectTarget.reference_number && <> (ref. {rejectTarget.reference_number})</>} no sumará a
                                    tu campaña. Hazlo solo si revisaste tu cuenta y el dinero no llegó.
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
                                if (target) resolveDonation(target, 'reject')
                            }}
                        >
                            Sí, rechazar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Eliminar cuenta */}
            <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar esta cuenta?</AlertDialogTitle>
                        <AlertDialogDescription>
                            {deleteTarget && (
                                <>
                                    {RECEIVING_ACCOUNT_LABEL[deleteTarget.account_type]} · {receivingAccountSummary(deleteTarget)}.
                                    Los donantes dejarán de verla. Si solo quieres pausarla, usa el interruptor "Visible".
                                </>
                            )}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction className="bg-destructive text-white hover:bg-destructive/90" onClick={deleteAccount}>
                            Eliminar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
