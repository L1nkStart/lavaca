'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Loader2, HandHeart, CheckCircle2, Copy, Check, Clock, ClipboardCopy, Camera } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CampaignShare } from '@/components/campaign-share'
import { SupportLavacaModal } from '@/components/support-lavaca-modal'
import { getClientBaseUrl } from '@/lib/url'
import { isLavacaCampaign, readStoredRef } from '@/lib/lavaca-campaign'
import {
    RECEIVING_ACCOUNT_LABEL,
    RECEIVING_ACCOUNT_TYPES,
    receivingAccountLines,
    receivingAccountClipboardText,
    receivingAccountSummary,
    type ReceivingAccountInput,
} from '@/lib/venezuela'

type CrisisAccount = ReceivingAccountInput & { id: string }

interface CrisisDirectDonateProps {
    campaignId: string
    /** Para el mensaje de compartir después de registrar el pago. */
    campaignTitle?: string
    showEmptyState?: boolean
}

export function CrisisDirectDonate({ campaignId, campaignTitle, showEmptyState = false }: CrisisDirectDonateProps) {
    const supabase = createClient()
    const [accounts, setAccounts] = useState<CrisisAccount[]>([])
    const [accountId, setAccountId] = useState('')
    const [currency, setCurrency] = useState<'USD' | 'BS'>('BS')
    const [amount, setAmount] = useState('')
    const [reference, setReference] = useState('')
    const [donorEmail, setDonorEmail] = useState('')
    const [donorName, setDonorName] = useState('')
    const [isAnonymous, setIsAnonymous] = useState(false)
    const [captureUrl, setCaptureUrl] = useState<string | null>(null)
    const [captureName, setCaptureName] = useState<string | null>(null)
    const [uploading, setUploading] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
    const [done, setDone] = useState(false)
    const [loaded, setLoaded] = useState(false)
    const [copied, setCopied] = useState<string | null>(null)
    const [supportOpen, setSupportOpen] = useState(false)

    // Justo después de registrar el pago, invitación a apoyar a LaVaca
    // (nunca si esta ya es la campaña de LaVaca).
    useEffect(() => {
        if (!done || isLavacaCampaign(campaignId)) return
        const timer = setTimeout(() => setSupportOpen(true), 700)
        return () => clearTimeout(timer)
    }, [done, campaignId])

    useEffect(() => {
        const load = async () => {
            const { data } = await supabase
                .from('campaign_crisis_accounts')
                .select('*')
                .eq('campaign_id', campaignId)
                .eq('is_active', true)
                .order('display_order', { ascending: true })
            const list = (data as CrisisAccount[]) || []
            setAccounts(list)
            if (list.length > 0) {
                setAccountId(list[0].id)
                // Moneda por defecto según la cuenta: PagoMóvil/transferencia → Bs.
                setCurrency(list[0].account_type === 'pagomovil' || list[0].account_type === 'transfer' ? 'BS' : 'USD')
            }
            setLoaded(true)
        }
        load()
        supabase.auth.getUser().then(({ data }) => {
            if (data.user?.email) setDonorEmail(data.user.email)
        })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [campaignId])

    const selected = useMemo(() => accounts.find((a) => a.id === accountId) || null, [accounts, accountId])

    const chooseAccount = (a: CrisisAccount) => {
        setAccountId(a.id)
        setCurrency(a.account_type === 'pagomovil' || a.account_type === 'transfer' ? 'BS' : 'USD')
    }

    const copyText = async (text: string, key: string) => {
        try {
            await navigator.clipboard.writeText(text)
            setCopied(key)
            setTimeout(() => setCopied(null), 1500)
        } catch {
            // sin portapapeles: el texto sigue visible para copiarlo a mano
        }
    }

    const handleCapture = async (file: File | null) => {
        if (!file) return
        setUploading(true)
        setError(null)
        try {
            const fd = new FormData()
            fd.append('file', file)
            fd.append('campaignId', campaignId)
            const res = await fetch('/api/donations/capture-upload', { method: 'POST', body: fd })
            const data = await res.json()
            if (!res.ok) throw new Error(data?.error || 'No se pudo subir el comprobante')
            setCaptureUrl(data.url || null)
            setCaptureName(file.name)
        } catch (err: any) {
            setError(err.message)
        } finally {
            setUploading(false)
        }
    }

    const submit = async () => {
        setError(null)
        const errs: Record<string, string> = {}
        const amt = Number(amount)
        if (!accountId) errs.account = 'Selecciona la cuenta a la que pagaste'
        if (!Number.isFinite(amt) || amt <= 0) errs.amount = 'Escribe el monto que pagaste'
        if (!reference.trim()) errs.reference = 'La referencia aparece en el comprobante de tu banco'
        if (!donorEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(donorEmail.trim())) {
            errs.email = 'Necesitamos un correo válido para avisarte cuando confirmen tu aporte'
        }
        setFieldErrors(errs)
        const first = Object.keys(errs)[0]
        if (first) {
            requestAnimationFrame(() => document.getElementById(`direct-${first}`)?.focus())
            return
        }

        setSubmitting(true)
        try {
            const res = await fetch(`/api/campaigns/${campaignId}/direct-donation`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    amount: amt,
                    currency,
                    accountId,
                    reference: reference.trim(),
                    captureUrl,
                    donorEmail: donorEmail.trim(),
                    donorName: donorName.trim() || null,
                    isAnonymous,
                    referralCode: readStoredRef(campaignId),
                }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data?.error || 'No se pudo registrar el pago')
            setDone(true)
        } catch (err: any) {
            setError(err.message)
        } finally {
            setSubmitting(false)
        }
    }

    const clearFieldError = (key: string) =>
        setFieldErrors((prev) => {
            if (!prev[key]) return prev
            const next = { ...prev }
            delete next[key]
            return next
        })

    if (accounts.length === 0) {
        // En el sidebar no estorbamos (null). En la página de donar mostramos
        // un mensaje claro mientras el organizador no haya cargado cuentas.
        if (showEmptyState && loaded) {
            return (
                <Card className="border-orange-200 dark:border-orange-800">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                            <HandHeart className="h-5 w-5 text-orange-500" />
                            Pagar directo al organizador
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Alert>
                            <Clock className="h-4 w-4" />
                            <AlertDescription className="text-sm">
                                El organizador aún no publicó sus cuentas para recibir pagos directos.
                                Vuelve en un momento o contáctalo para coordinar tu aporte.
                            </AlertDescription>
                        </Alert>
                    </CardContent>
                </Card>
            )
        }
        return null
    }

    if (done) {
        const shareUrl = `${getClientBaseUrl()}/campaigns/${campaignId}`
        return (
            <>
            <SupportLavacaModal open={supportOpen} onOpenChange={setSupportOpen} />
            <Card className="border-orange-200 bg-orange-50/50 dark:bg-orange-950/20 dark:border-orange-800">
                <CardContent className="pt-6 space-y-4">
                    <div className="flex items-start gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orange-500 text-white">
                            <CheckCircle2 className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="font-semibold">¡Gracias! Registramos tu pago</p>
                            <p className="mt-1 text-sm text-foreground/75">
                                El organizador lo confirmará en cuanto lo vea en su cuenta y tu aporte aparecerá en la barra.
                                Te avisamos por correo.
                            </p>
                        </div>
                    </div>
                    {campaignTitle && (
                        <div className="rounded-lg border bg-background p-3 text-center space-y-2">
                            <p className="text-sm font-medium">Tu aporte vale el doble si lo compartes</p>
                            <p className="text-xs text-muted-foreground">
                                Mándalo al grupo de la familia o del trabajo: la mayoría de las donaciones llegan por WhatsApp.
                            </p>
                            <CampaignShare
                                campaignId={campaignId}
                                campaignTitle={campaignTitle}
                                campaignUrl={shareUrl}
                                variant="full"
                            />
                        </div>
                    )}
                </CardContent>
            </Card>
            </>
        )
    }

    const stepBadge = (n: number) => (
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-orange-500 text-xs font-bold text-white">
            {n}
        </span>
    )

    return (
        <Card className="border-orange-200 dark:border-orange-800">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                    <HandHeart className="h-5 w-5 text-orange-500" />
                    Pagar directo al organizador
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                    Pagas desde tu banco o app a la cuenta del organizador y luego registras el pago aquí. Él lo confirma y
                    suma a la barra. Sin comisión: el 100% llega.
                </p>
            </CardHeader>
            <CardContent className="space-y-5">
                {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

                {/* PASO 1: elegir cuenta y pagar */}
                <section className="space-y-3" aria-labelledby="direct-step-1">
                    <h3 id="direct-step-1" className="flex items-center gap-2 text-sm font-semibold">
                        {stepBadge(1)} Paga a esta cuenta
                    </h3>

                    {accounts.length > 1 && (
                        <div role="radiogroup" aria-label="Cuenta del organizador" className="grid grid-cols-2 gap-2">
                            {accounts.map((a) => {
                                const type = RECEIVING_ACCOUNT_TYPES.find((t) => t.value === a.account_type)
                                const isSel = a.id === accountId
                                return (
                                    <button
                                        key={a.id}
                                        type="button"
                                        role="radio"
                                        aria-checked={isSel}
                                        onClick={() => chooseAccount(a)}
                                        className={cn(
                                            'min-h-[48px] rounded-lg border px-3 py-2 text-left text-sm transition-colors',
                                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                                            isSel ? 'border-orange-500 bg-orange-50/60 ring-1 ring-orange-500 dark:bg-orange-950/30' : 'border-border hover:border-muted-foreground/50'
                                        )}
                                    >
                                        <span className="flex items-center gap-2">
                                            <span aria-hidden="true">{type?.emoji}</span>
                                            <span className="min-w-0">
                                                <span className="block font-medium leading-tight">{RECEIVING_ACCOUNT_LABEL[a.account_type]}</span>
                                                <span className="block truncate text-[11px] text-muted-foreground">{a.bank_name || receivingAccountSummary(a)}</span>
                                            </span>
                                        </span>
                                    </button>
                                )
                            })}
                        </div>
                    )}

                    {selected && (
                        <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                            <div className="flex items-center justify-between gap-2">
                                <p className="text-sm font-medium">
                                    {RECEIVING_ACCOUNT_TYPES.find((t) => t.value === selected.account_type)?.emoji}{' '}
                                    {RECEIVING_ACCOUNT_LABEL[selected.account_type]}
                                </p>
                                <button
                                    type="button"
                                    onClick={() => copyText(receivingAccountClipboardText(selected), 'all')}
                                    className="inline-flex min-h-[32px] items-center gap-1 rounded-md border bg-background px-2 text-xs font-medium hover:bg-muted"
                                >
                                    {copied === 'all' ? <Check className="h-3 w-3" /> : <ClipboardCopy className="h-3 w-3" />}
                                    {copied === 'all' ? 'Copiado' : 'Copiar todo'}
                                </button>
                            </div>
                            <dl className="space-y-1">
                                {receivingAccountLines(selected).map((l) => (
                                    <div key={l.label} className="flex items-center justify-between gap-2 text-sm">
                                        <dt className="text-muted-foreground">{l.label}</dt>
                                        <dd>
                                            <button
                                                type="button"
                                                onClick={() => copyText(l.value, l.label)}
                                                className="inline-flex max-w-full items-center gap-1 text-right font-mono font-medium hover:text-primary"
                                                title="Copiar"
                                            >
                                                <span className="break-all">{l.value}</span>
                                                {copied === l.label ? <Check className="h-3 w-3 shrink-0 text-primary" /> : <Copy className="h-3 w-3 shrink-0 opacity-60" />}
                                            </button>
                                        </dd>
                                    </div>
                                ))}
                            </dl>
                            {selected.instructions && (
                                <p className="border-t pt-2 text-xs text-muted-foreground">“{selected.instructions}”</p>
                            )}
                        </div>
                    )}
                    {fieldErrors.account && <p className="text-xs text-destructive">{fieldErrors.account}</p>}
                </section>

                {/* PASO 2: registrar el pago */}
                <section className="space-y-3 border-t pt-4" aria-labelledby="direct-step-2">
                    <h3 id="direct-step-2" className="flex items-center gap-2 text-sm font-semibold">
                        {stepBadge(2)} Ya pagué, registrar mi pago
                    </h3>

                    <Tabs value={currency} onValueChange={(v) => setCurrency(v as 'USD' | 'BS')}>
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="BS">Pagué en bolívares</TabsTrigger>
                            <TabsTrigger value="USD">Pagué en dólares</TabsTrigger>
                        </TabsList>
                    </Tabs>

                    <div className="space-y-1">
                        <Label htmlFor="direct-amount">Monto que pagaste ({currency === 'USD' ? '$' : 'Bs'})</Label>
                        <Input
                            id="direct-amount"
                            type="number"
                            inputMode="decimal"
                            min="0"
                            step="0.01"
                            value={amount}
                            onChange={(e) => { setAmount(e.target.value); clearFieldError('amount') }}
                            placeholder={currency === 'USD' ? 'Ej: 20.00' : 'Ej: 1500.00'}
                            className="h-11 font-mono"
                            aria-invalid={!!fieldErrors.amount}
                        />
                        {fieldErrors.amount && <p className="text-xs text-destructive">{fieldErrors.amount}</p>}
                    </div>

                    <div className="space-y-1">
                        <Label htmlFor="direct-reference">Referencia del pago</Label>
                        <Input
                            id="direct-reference"
                            inputMode="numeric"
                            value={reference}
                            onChange={(e) => { setReference(e.target.value); clearFieldError('reference') }}
                            placeholder="Número de referencia o confirmación"
                            className="h-11 font-mono"
                            aria-invalid={!!fieldErrors.reference}
                        />
                        {fieldErrors.reference && <p className="text-xs text-destructive">{fieldErrors.reference}</p>}
                        <p className="text-xs text-muted-foreground">Con los últimos 4 a 6 dígitos el organizador ya lo ubica.</p>
                    </div>

                    <div className="space-y-1">
                        <Label htmlFor="direct-capture">
                            Captura del comprobante <span className="font-normal text-muted-foreground">(recomendado)</span>
                        </Label>
                        <label
                            htmlFor="direct-capture"
                            className={cn(
                                'flex min-h-[44px] cursor-pointer items-center gap-2 rounded-md border border-dashed px-3 py-2 text-sm',
                                captureUrl ? 'border-primary/50 bg-primary/5' : 'border-muted-foreground/30 hover:border-muted-foreground/60'
                            )}
                        >
                            {uploading ? (
                                <><Loader2 className="h-4 w-4 animate-spin" /> Subiendo…</>
                            ) : captureUrl ? (
                                <><CheckCircle2 className="h-4 w-4 text-primary" /> <span className="truncate">{captureName || 'Comprobante listo'}</span> <span className="ml-auto text-xs text-muted-foreground">Cambiar</span></>
                            ) : (
                                <><Camera className="h-4 w-4 text-muted-foreground" /> Tomar foto o elegir captura</>
                            )}
                        </label>
                        <input
                            id="direct-capture"
                            type="file"
                            accept="image/jpeg,image/png,image/webp,application/pdf"
                            className="sr-only"
                            disabled={uploading}
                            onChange={(e) => handleCapture(e.target.files?.[0] || null)}
                        />
                        <p className="text-xs text-muted-foreground">Ayuda a que te confirmen más rápido.</p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1">
                            <Label htmlFor="direct-email">Tu correo</Label>
                            <Input
                                id="direct-email"
                                type="email"
                                inputMode="email"
                                autoComplete="email"
                                value={donorEmail}
                                onChange={(e) => { setDonorEmail(e.target.value); clearFieldError('email') }}
                                placeholder="tu@email.com"
                                className="h-11"
                                aria-invalid={!!fieldErrors.email}
                            />
                            {fieldErrors.email && <p className="text-xs text-destructive">{fieldErrors.email}</p>}
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="direct-name">Tu nombre <span className="font-normal text-muted-foreground">(opcional)</span></Label>
                            <Input
                                id="direct-name"
                                autoComplete="name"
                                value={donorName}
                                onChange={(e) => setDonorName(e.target.value)}
                                placeholder="Como quieres aparecer"
                                className="h-11"
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <Checkbox id="crisis-anon" checked={isAnonymous} onCheckedChange={(c) => setIsAnonymous(c as boolean)} />
                        <Label htmlFor="crisis-anon" className="text-sm font-normal cursor-pointer">No mostrar mi nombre en la lista de donantes</Label>
                    </div>

                    <Button onClick={submit} disabled={submitting || uploading} className="w-full min-h-[48px] text-base">
                        {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Registrando…</> : 'Registrar mi pago'}
                    </Button>

                    <Alert className="border-orange-200 bg-orange-50/50 dark:bg-orange-950/20">
                        <Clock className="h-4 w-4 text-orange-500" />
                        <AlertDescription className="text-xs">
                            Tu aporte queda "en revisión" hasta que el organizador confirme que le llegó. Suele ser el mismo día.
                        </AlertDescription>
                    </Alert>

                    <p className="text-[11px] leading-relaxed text-muted-foreground">
                        Este es un <strong>pago directo</strong> a la cuenta del organizador: LaVaca no intermedia ni
                        custodia estos fondos. Si bien hacemos nuestro mayor esfuerzo por validar las campañas, no nos es posible garantizar devoluciones de dinero ni asumir responsabilidad por fraudes o estafas. Todo aporte se realiza bajo tu propio consentimiento y riesgo. Te sugerimos conservar tu comprobante y consultar los{' '}
                        <a href="/terms" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">Términos y Condiciones</a>.
                    </p>
                </section>
            </CardContent>
        </Card>
    )
}
