'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, Plus, Trash2, CheckCircle2, XCircle, Wallet, ExternalLink, Clock } from 'lucide-react'
import { formatBs, formatUsd } from '@/lib/fees'

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
}

const ACCOUNT_LABEL: Record<CrisisAccount['account_type'], string> = {
    pagomovil: 'PagoMóvil',
    zelle: 'Zelle',
    transfer: 'Transferencia bancaria',
    crypto: 'Cripto / Binance',
}

const EMPTY_FORM = {
    account_type: 'pagomovil' as CrisisAccount['account_type'],
    account_holder_name: '',
    phone_number: '',
    ci_number: '',
    bank_name: '',
    email: '',
    account_number: '',
    crypto_wallet_address: '',
    crypto_network: '',
    instructions: '',
}

export function CrisisManager({ campaignId, isCrisis }: { campaignId: string; isCrisis: boolean }) {
    const [accounts, setAccounts] = useState<CrisisAccount[]>([])
    const [donations, setDonations] = useState<DirectDonation[]>([])
    const [loading, setLoading] = useState(true)
    const [form, setForm] = useState(EMPTY_FORM)
    const [saving, setSaving] = useState(false)
    const [processingId, setProcessingId] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)

    const load = async () => {
        try {
            const [accRes, donRes] = await Promise.all([
                fetch(`/api/campaigns/${campaignId}/crisis-accounts`, { cache: 'no-store' }),
                fetch(`/api/campaigns/${campaignId}/direct-donations?status=pending`, { cache: 'no-store' }),
            ])
            const accData = await accRes.json()
            const donData = await donRes.json()
            if (accRes.ok) setAccounts(accData.accounts || [])
            if (donRes.ok) setDonations(donData.donations || [])
        } catch {
            setError('No se pudieron cargar los datos')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        load()
    }, [])

    const update = (field: string, value: string) => setForm((prev) => ({ ...prev, [field]: value }))

    const addAccount = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)
        setSuccess(null)
        setSaving(true)
        try {
            const response = await fetch(`/api/campaigns/${campaignId}/crisis-accounts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            })
            const result = await response.json()
            if (!response.ok) throw new Error(result?.error || 'No se pudo agregar la cuenta')
            setForm(EMPTY_FORM)
            setSuccess('Cuenta agregada')
            await load()
        } catch (err: any) {
            setError(err.message)
        } finally {
            setSaving(false)
        }
    }

    const toggleActive = async (account: CrisisAccount) => {
        await fetch(`/api/campaigns/${campaignId}/crisis-accounts/${account.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ is_active: !account.is_active }),
        })
        await load()
    }

    const deleteAccount = async (account: CrisisAccount) => {
        if (!confirm('¿Eliminar esta cuenta de recepción?')) return
        await fetch(`/api/campaigns/${campaignId}/crisis-accounts/${account.id}`, { method: 'DELETE' })
        await load()
    }

    const resolveDonation = async (donationId: string, action: 'confirm' | 'reject') => {
        if (action === 'reject' && !confirm('¿Rechazar este pago? No sumará a la campaña.')) return
        setProcessingId(donationId)
        try {
            const response = await fetch(`/api/campaigns/${campaignId}/direct-donations/${donationId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action }),
            })
            const result = await response.json()
            if (!response.ok) throw new Error(result?.error || 'No se pudo procesar')
            setSuccess(action === 'confirm' ? 'Pago confirmado: sumó a tu campaña.' : 'Pago rechazado.')
            await load()
        } catch (err: any) {
            setError(err.message)
        } finally {
            setProcessingId(null)
        }
    }

    const money = (d: DirectDonation) =>
        d.currency === 'BS' && d.amount_bs != null ? formatBs(Number(d.amount_bs)) : formatUsd(Number(d.amount_usd))

    if (loading) {
        return (
            <div className="flex justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
            {success && <Alert><AlertDescription>{success}</AlertDescription></Alert>}

            {/* PAGOS POR CONFIRMAR */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Wallet className="h-5 w-5 text-orange-500" />
                        Pagos por confirmar ({donations.length})
                    </CardTitle>
                    <CardDescription>
                        Confirma los pagos que recibiste para que suban a la barra de tu campaña. Solo confirma
                        los que de verdad llegaron a tu cuenta.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    {!isCrisis ? (
                        <p className="text-sm text-muted-foreground">El pago directo se activa cuando la campaña está en modo crisis.</p>
                    ) : donations.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No tienes pagos pendientes por confirmar.</p>
                    ) : (
                        donations.map((d) => (
                            <div key={d.id} className="rounded-lg border p-4 space-y-3">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <p className="font-semibold text-lg">{money(d)}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {d.is_anonymous ? 'Donante anónimo' : (d.donor_name || 'Donante')} · {d.email}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            {ACCOUNT_LABEL[d.payment_method as CrisisAccount['account_type']] || d.payment_method}
                                            {' · '}Ref: <span className="font-mono">{d.reference_number || '—'}</span>
                                        </p>
                                        <p className="text-xs text-muted-foreground">{new Date(d.created_at).toLocaleString('es-VE')}</p>
                                    </div>
                                    {d.capture_url && (
                                        <a href={d.capture_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline inline-flex items-center gap-1 shrink-0">
                                            Comprobante <ExternalLink className="h-3 w-3" />
                                        </a>
                                    )}
                                </div>
                                <div className="flex gap-2">
                                    <Button size="sm" onClick={() => resolveDonation(d.id, 'confirm')} disabled={processingId === d.id}>
                                        {processingId === d.id ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                                        Confirmar
                                    </Button>
                                    <Button size="sm" variant="outline" onClick={() => resolveDonation(d.id, 'reject')} disabled={processingId === d.id}>
                                        <XCircle className="h-4 w-4 mr-2" />
                                        Rechazar
                                    </Button>
                                </div>
                            </div>
                        ))
                    )}
                </CardContent>
            </Card>

            {/* MIS CUENTAS PARA RECIBIR */}
            <Card>
                <CardHeader>
                    <CardTitle>Mis cuentas para recibir</CardTitle>
                    <CardDescription>
                        Estos son los datos que verán los donantes para pagarte directo. Agrega solo cuentas tuyas y verificadas.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {accounts.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Aún no agregaste cuentas para recibir.</p>
                    ) : (
                        <div className="space-y-2">
                            {accounts.map((a) => (
                                <div key={a.id} className="rounded-lg border p-3 flex items-start justify-between gap-3">
                                    <div className="text-sm">
                                        <p className="font-medium flex items-center gap-2">
                                            {ACCOUNT_LABEL[a.account_type]}
                                            {!a.is_active && <Badge variant="secondary" className="text-[10px]"><Clock className="h-3 w-3 mr-1" /> Inactiva</Badge>}
                                        </p>
                                        <p className="text-xs text-muted-foreground">{a.account_holder_name}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {a.account_type === 'pagomovil' && `${a.bank_name || ''} · ${a.phone_number || ''} · ${a.ci_number || ''}`}
                                            {a.account_type === 'zelle' && a.email}
                                            {a.account_type === 'transfer' && `${a.bank_name || ''} · ${a.account_number || ''}`}
                                            {a.account_type === 'crypto' && `${a.crypto_network || ''} · ${a.crypto_wallet_address || ''}`}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <Switch checked={a.is_active} onCheckedChange={() => toggleActive(a)} />
                                        <Button size="sm" variant="ghost" onClick={() => deleteAccount(a)}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Form nueva cuenta */}
                    <form onSubmit={addAccount} className="space-y-3 border-t pt-4">
                        <p className="font-medium text-sm">Agregar cuenta</p>
                        <div className="grid sm:grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <Label>Tipo</Label>
                                <Select value={form.account_type} onValueChange={(v) => update('account_type', v)}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="pagomovil">PagoMóvil</SelectItem>
                                        <SelectItem value="zelle">Zelle</SelectItem>
                                        <SelectItem value="transfer">Transferencia bancaria</SelectItem>
                                        <SelectItem value="crypto">Cripto / Binance</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1">
                                <Label>Titular</Label>
                                <Input value={form.account_holder_name} onChange={(e) => update('account_holder_name', e.target.value)} placeholder="Nombre del titular" />
                            </div>
                        </div>

                        {form.account_type === 'pagomovil' && (
                            <div className="grid sm:grid-cols-3 gap-3">
                                <div className="space-y-1"><Label>Banco</Label><Input value={form.bank_name} onChange={(e) => update('bank_name', e.target.value)} placeholder="0102 - Banco de Venezuela" /></div>
                                <div className="space-y-1"><Label>Teléfono</Label><Input value={form.phone_number} onChange={(e) => update('phone_number', e.target.value)} placeholder="04121234567" /></div>
                                <div className="space-y-1"><Label>Cédula</Label><Input value={form.ci_number} onChange={(e) => update('ci_number', e.target.value)} placeholder="V-12345678" /></div>
                            </div>
                        )}
                        {form.account_type === 'zelle' && (
                            <div className="space-y-1"><Label>Correo Zelle</Label><Input value={form.email} onChange={(e) => update('email', e.target.value)} placeholder="correo@ejemplo.com" /></div>
                        )}
                        {form.account_type === 'transfer' && (
                            <div className="grid sm:grid-cols-2 gap-3">
                                <div className="space-y-1"><Label>Banco</Label><Input value={form.bank_name} onChange={(e) => update('bank_name', e.target.value)} placeholder="Banco" /></div>
                                <div className="space-y-1"><Label>Número de cuenta</Label><Input value={form.account_number} onChange={(e) => update('account_number', e.target.value)} placeholder="0102-..." /></div>
                            </div>
                        )}
                        {form.account_type === 'crypto' && (
                            <div className="grid sm:grid-cols-2 gap-3">
                                <div className="space-y-1"><Label>Red</Label><Input value={form.crypto_network} onChange={(e) => update('crypto_network', e.target.value)} placeholder="USDT (TRC20)" /></div>
                                <div className="space-y-1"><Label>Wallet</Label><Input value={form.crypto_wallet_address} onChange={(e) => update('crypto_wallet_address', e.target.value)} placeholder="Dirección de la wallet" /></div>
                            </div>
                        )}

                        <div className="space-y-1">
                            <Label>Instrucciones (opcional)</Label>
                            <Textarea rows={2} value={form.instructions} onChange={(e) => update('instructions', e.target.value)} placeholder="Ej: coloca tu nombre en el concepto" />
                        </div>

                        <Button type="submit" disabled={saving}>
                            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                            Agregar cuenta
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    )
}
