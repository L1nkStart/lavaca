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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, HandHeart, CheckCircle2, Copy, Clock } from 'lucide-react'

type CrisisAccount = {
    id: string
    account_type: 'pagomovil' | 'zelle' | 'transfer' | 'crypto'
    account_holder_name: string
    phone_number: string | null
    ci_number: string | null
    bank_name: string | null
    email: string | null
    account_number: string | null
    crypto_wallet_address: string | null
    crypto_network: string | null
    instructions: string | null
}

const ACCOUNT_LABEL: Record<CrisisAccount['account_type'], string> = {
    pagomovil: 'PagoMóvil',
    zelle: 'Zelle',
    transfer: 'Transferencia bancaria',
    crypto: 'Cripto / Binance',
}

function accountLines(a: CrisisAccount): { label: string; value: string }[] {
    switch (a.account_type) {
        case 'pagomovil':
            return [
                { label: 'Banco', value: a.bank_name || '' },
                { label: 'Teléfono', value: a.phone_number || '' },
                { label: 'Cédula', value: a.ci_number || '' },
                { label: 'Titular', value: a.account_holder_name },
            ]
        case 'zelle':
            return [
                { label: 'Correo', value: a.email || '' },
                { label: 'Titular', value: a.account_holder_name },
            ]
        case 'transfer':
            return [
                { label: 'Banco', value: a.bank_name || '' },
                { label: 'Cuenta', value: a.account_number || '' },
                { label: 'Titular', value: a.account_holder_name },
            ]
        case 'crypto':
            return [
                { label: 'Red', value: a.crypto_network || '' },
                { label: 'Wallet', value: a.crypto_wallet_address || '' },
                { label: 'Titular', value: a.account_holder_name },
            ]
    }
}

export function CrisisDirectDonate({ campaignId }: { campaignId: string }) {
    const supabase = createClient()
    const [accounts, setAccounts] = useState<CrisisAccount[]>([])
    const [accountId, setAccountId] = useState('')
    const [currency, setCurrency] = useState<'USD' | 'BS'>('USD')
    const [amount, setAmount] = useState('')
    const [reference, setReference] = useState('')
    const [donorEmail, setDonorEmail] = useState('')
    const [donorName, setDonorName] = useState('')
    const [isAnonymous, setIsAnonymous] = useState(false)
    const [captureUrl, setCaptureUrl] = useState<string | null>(null)
    const [uploading, setUploading] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [done, setDone] = useState(false)

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
            if (list.length > 0) setAccountId(list[0].id)
        }
        load()
        supabase.auth.getUser().then(({ data }) => {
            if (data.user?.email) setDonorEmail(data.user.email)
        })
    }, [campaignId])

    const selected = useMemo(() => accounts.find((a) => a.id === accountId) || null, [accounts, accountId])

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
            if (!res.ok) throw new Error(data?.error || 'No se pudo subir')
            setCaptureUrl(data.url || null)
        } catch (err: any) {
            setError(err.message)
        } finally {
            setUploading(false)
        }
    }

    const submit = async () => {
        setError(null)
        const amt = Number(amount)
        if (!accountId) { setError('Selecciona la cuenta a la que pagaste'); return }
        if (!Number.isFinite(amt) || amt <= 0) { setError('Ingresa el monto que pagaste'); return }
        if (!reference.trim()) { setError('La referencia del pago es obligatoria'); return }
        if (!donorEmail.trim()) { setError('Tu correo es obligatorio para confirmarte el aporte'); return }

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

    if (accounts.length === 0) return null

    if (done) {
        return (
            <Card className="border-orange-200 bg-orange-50/50 dark:bg-orange-950/20 dark:border-orange-800">
                <CardContent className="pt-6 space-y-2">
                    <div className="flex items-center gap-2 text-orange-700 dark:text-orange-300">
                        <CheckCircle2 className="h-5 w-5" />
                        <p className="font-semibold">Registramos tu pago</p>
                    </div>
                    <p className="text-sm text-muted-foreground">
                        El organizador confirmará tu aporte y aparecerá en la barra de la campaña. ¡Gracias por ayudar!
                    </p>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card className="border-orange-200 dark:border-orange-800">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                    <HandHeart className="h-5 w-5 text-orange-500" />
                    Pagar directo al organizador
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <p className="text-xs text-muted-foreground">
                    En esta campaña de emergencia puedes pagarle directo al organizador. Paga por fuera y luego
                    registra tu pago aquí; el organizador lo confirmará y sumará a la barra.
                </p>

                {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

                {/* Seleccionar cuenta y ver datos */}
                <div className="space-y-2">
                    <Label>¿A qué cuenta pagaste?</Label>
                    <Select value={accountId} onValueChange={setAccountId}>
                        <SelectTrigger><SelectValue placeholder="Selecciona una cuenta" /></SelectTrigger>
                        <SelectContent>
                            {accounts.map((a) => (
                                <SelectItem key={a.id} value={a.id}>{ACCOUNT_LABEL[a.account_type]} · {a.account_holder_name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {selected && (
                    <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
                        {accountLines(selected).filter((l) => l.value).map((l) => (
                            <div key={l.label} className="flex items-center justify-between gap-2 text-sm">
                                <span className="text-muted-foreground">{l.label}:</span>
                                <button
                                    type="button"
                                    onClick={() => navigator.clipboard?.writeText(l.value)}
                                    className="font-medium inline-flex items-center gap-1 hover:text-primary text-right"
                                    title="Copiar"
                                >
                                    <span className="break-all">{l.value}</span>
                                    <Copy className="h-3 w-3 shrink-0" />
                                </button>
                            </div>
                        ))}
                        {selected.instructions && (
                            <p className="text-xs text-muted-foreground pt-1">{selected.instructions}</p>
                        )}
                    </div>
                )}

                {/* Registrar el pago */}
                <div className="space-y-3 border-t pt-3">
                    <p className="text-sm font-medium">Registra tu pago</p>

                    <Tabs value={currency} onValueChange={(v) => setCurrency(v as 'USD' | 'BS')}>
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="USD">Dólares (USD)</TabsTrigger>
                            <TabsTrigger value="BS">Bolívares (Bs)</TabsTrigger>
                        </TabsList>
                    </Tabs>

                    <div className="space-y-1">
                        <Label>Monto que pagaste ({currency === 'USD' ? '$' : 'Bs'})</Label>
                        <Input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={currency === 'USD' ? 'Ej: 20.00' : 'Ej: 1000.00'} />
                    </div>

                    <div className="space-y-1">
                        <Label>Referencia del pago</Label>
                        <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Número de referencia / confirmación" />
                    </div>

                    <div className="space-y-1">
                        <Label>Comprobante (opcional)</Label>
                        <Input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" disabled={uploading} onChange={(e) => handleCapture(e.target.files?.[0] || null)} />
                        {uploading && <p className="text-xs text-muted-foreground flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Subiendo…</p>}
                        {captureUrl && !uploading && <p className="text-xs text-primary flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Comprobante listo</p>}
                    </div>

                    <div className="space-y-1">
                        <Label>Tu correo</Label>
                        <Input type="email" value={donorEmail} onChange={(e) => setDonorEmail(e.target.value)} placeholder="tu@email.com" />
                    </div>

                    <div className="space-y-1">
                        <Label>Tu nombre (opcional)</Label>
                        <Input value={donorName} onChange={(e) => setDonorName(e.target.value)} placeholder="Tu nombre" />
                    </div>

                    <div className="flex items-center gap-2">
                        <Checkbox id="crisis-anon" checked={isAnonymous} onCheckedChange={(c) => setIsAnonymous(c as boolean)} />
                        <Label htmlFor="crisis-anon" className="text-sm font-normal cursor-pointer">Registrar como anónimo</Label>
                    </div>

                    <Alert className="border-orange-200 bg-orange-50/50 dark:bg-orange-950/20">
                        <Clock className="h-4 w-4 text-orange-500" />
                        <AlertDescription className="text-xs">
                            Tu aporte quedará en revisión hasta que el organizador lo confirme.
                        </AlertDescription>
                    </Alert>

                    <Button onClick={submit} disabled={submitting || uploading} className="w-full">
                        {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Registrando…</> : 'Registrar mi pago'}
                    </Button>
                </div>
            </CardContent>
        </Card>
    )
}
