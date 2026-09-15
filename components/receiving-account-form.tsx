'use client'

import { useId, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, Plus, Check, Copy } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
    VE_BANKS,
    CEDULA_PREFIXES,
    CRYPTO_NETWORKS,
    RECEIVING_ACCOUNT_TYPES,
    RECEIVING_ACCOUNT_LABEL,
    normalizeVePhone,
    splitCedula,
    formatCedula,
    bankNameByCode,
    validateReceivingAccount,
    receivingAccountLines,
    receivingAccountClipboardText,
    type ReceivingAccountInput,
    type ReceivingAccountType,
} from '@/lib/venezuela'

/* ------------------------------------------------------------------ */
/* Formulario: una cuenta a la vez                                     */
/* ------------------------------------------------------------------ */

interface ReceivingAccountFormProps {
    /** Nombre con el que se prellena "Titular" (normalmente el del perfil). */
    defaultHolderName?: string
    /** Se llama con el payload ya validado y normalizado. Puede ser async. */
    onAdd: (account: ReceivingAccountInput) => Promise<void> | void
    /** Deshabilita el botón mientras el padre guarda. */
    submitting?: boolean
    submitLabel?: string
    /** Tipo inicial seleccionado. */
    initialType?: ReceivingAccountType
    className?: string
}

type Draft = {
    account_type: ReceivingAccountType
    account_holder_name: string
    bank_code: string
    phone_number: string
    ci_prefix: string
    ci_digits: string
    email: string
    account_number: string
    crypto_network: string
    crypto_wallet_address: string
    instructions: string
}

const emptyDraft = (holder: string, type: ReceivingAccountType): Draft => ({
    account_type: type,
    account_holder_name: holder,
    bank_code: '',
    phone_number: '',
    ci_prefix: 'V',
    ci_digits: '',
    email: '',
    account_number: '',
    crypto_network: 'USDT (TRC20)',
    crypto_wallet_address: '',
    instructions: '',
})

function draftToInput(d: Draft): ReceivingAccountInput {
    const base: ReceivingAccountInput = {
        account_type: d.account_type,
        account_holder_name: d.account_holder_name.trim().replace(/\s+/g, ' '),
        instructions: d.instructions.trim() || null,
    }
    switch (d.account_type) {
        case 'pagomovil':
            return {
                ...base,
                bank_code: d.bank_code || null,
                bank_name: bankNameByCode(d.bank_code),
                phone_number: normalizeVePhone(d.phone_number),
                ci_number: formatCedula(d.ci_prefix, d.ci_digits.replace(/\D/g, '')),
            }
        case 'zelle':
            return { ...base, email: d.email.trim() }
        case 'transfer':
            return {
                ...base,
                bank_code: d.bank_code || null,
                bank_name: bankNameByCode(d.bank_code),
                account_number: d.account_number.replace(/\D/g, ''),
                ci_number: d.ci_digits ? formatCedula(d.ci_prefix, d.ci_digits.replace(/\D/g, '')) : null,
            }
        case 'crypto':
            return {
                ...base,
                crypto_network: d.crypto_network,
                crypto_wallet_address: d.crypto_wallet_address.trim(),
            }
    }
}

export function ReceivingAccountForm({
    defaultHolderName = '',
    onAdd,
    submitting = false,
    submitLabel = 'Agregar cuenta',
    initialType = 'pagomovil',
    className,
}: ReceivingAccountFormProps) {
    const uid = useId()
    const [draft, setDraft] = useState<Draft>(() => emptyDraft(defaultHolderName, initialType))
    const [errors, setErrors] = useState<Record<string, string>>({})
    const [busy, setBusy] = useState(false)

    const set = <K extends keyof Draft>(field: K, value: Draft[K]) => {
        setDraft((prev) => ({ ...prev, [field]: value }))
        setErrors((prev) => {
            if (!prev[field as string]) return prev
            const next = { ...prev }
            delete next[field as string]
            return next
        })
    }

    // No es un <form>: este bloque vive dentro del formulario del asistente de
    // creación y los <form> anidados rompen la hidratación. El botón es
    // type="button" y Enter dentro de un input dispara "agregar".
    const handleSubmit = async (e?: React.SyntheticEvent) => {
        e?.preventDefault()
        e?.stopPropagation()
        const input = draftToInput(draft)
        // Los errores del validador usan las llaves del payload; mapeamos las
        // dos que en el draft tienen otro nombre (cédula).
        const errs = validateReceivingAccount(input)
        if (errs.ci_number) {
            errs.ci_digits = errs.ci_number
            delete errs.ci_number
        }
        setErrors(errs)
        if (Object.keys(errs).length > 0) {
            const first = Object.keys(errs)[0]
            requestAnimationFrame(() => document.getElementById(`${uid}-${first}`)?.focus())
            return
        }
        setBusy(true)
        try {
            await onAdd(input)
            // Conservamos tipo y titular: agregar una segunda cuenta es un paso más corto.
            setDraft((prev) => ({ ...emptyDraft(prev.account_holder_name, prev.account_type) }))
        } finally {
            setBusy(false)
        }
    }

    const disabled = busy || submitting
    const fieldId = (name: string) => `${uid}-${name}`
    const err = (name: string) =>
        errors[name] ? (
            <p id={`${fieldId(name)}-error`} className="text-xs text-destructive">
                {errors[name]}
            </p>
        ) : null
    const aria = (name: string) => ({
        'aria-invalid': !!errors[name],
        'aria-describedby': errors[name] ? `${fieldId(name)}-error` : undefined,
    })

    const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.key !== 'Enter') return
        const tag = (e.target as HTMLElement).tagName
        if (tag === 'INPUT') {
            e.preventDefault()
            e.stopPropagation()
            void handleSubmit()
        }
    }

    return (
        <div role="group" aria-label="Nueva cuenta para recibir" onKeyDown={onKeyDown} className={cn('space-y-4', className)}>
            {/* Tipo: botones grandes tocables, no un select. */}
            <div className="space-y-2">
                <Label>¿Por dónde te pueden pagar?</Label>
                <div role="radiogroup" aria-label="Tipo de cuenta" className="grid grid-cols-2 gap-2">
                    {RECEIVING_ACCOUNT_TYPES.map((t) => {
                        const selected = draft.account_type === t.value
                        return (
                            <button
                                key={t.value}
                                type="button"
                                role="radio"
                                aria-checked={selected}
                                disabled={disabled}
                                onClick={() => set('account_type', t.value)}
                                className={cn(
                                    'min-h-[56px] rounded-lg border px-3 py-2 text-left transition-colors',
                                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                                    selected
                                        ? 'border-primary bg-primary/5 ring-1 ring-primary'
                                        : 'border-border bg-background hover:border-muted-foreground/50',
                                    disabled && 'opacity-50 cursor-not-allowed'
                                )}
                            >
                                <span className="flex items-center gap-2">
                                    <span aria-hidden="true" className="text-lg leading-none">{t.emoji}</span>
                                    <span className="min-w-0">
                                        <span className="block text-sm font-medium leading-tight">{t.label}</span>
                                        <span className="block text-[11px] leading-tight text-muted-foreground">{t.hint}</span>
                                    </span>
                                    {selected && <Check className="ml-auto h-4 w-4 shrink-0 text-primary" />}
                                </span>
                            </button>
                        )
                    })}
                </div>
            </div>

            {/* Campos por tipo */}
            {draft.account_type === 'pagomovil' && (
                <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1 sm:col-span-2">
                        <Label htmlFor={fieldId('bank_code')}>Banco</Label>
                        <Select value={draft.bank_code} onValueChange={(v) => set('bank_code', v)} disabled={disabled}>
                            <SelectTrigger id={fieldId('bank_code')} className="h-11" {...aria('bank_code')}>
                                <SelectValue placeholder="Selecciona tu banco" />
                            </SelectTrigger>
                            <SelectContent>
                                {VE_BANKS.map((b) => (
                                    <SelectItem key={b.code} value={b.code} className="py-2">
                                        <span className="font-mono text-xs text-muted-foreground mr-2">{b.code}</span>
                                        {b.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {err('bank_code')}
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor={fieldId('phone_number')}>Teléfono</Label>
                        <Input
                            id={fieldId('phone_number')}
                            type="tel"
                            inputMode="numeric"
                            autoComplete="tel-national"
                            placeholder="04121234567"
                            maxLength={14}
                            value={draft.phone_number}
                            onChange={(e) => set('phone_number', e.target.value)}
                            disabled={disabled}
                            className="h-11"
                            {...aria('phone_number')}
                        />
                        {err('phone_number')}
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor={fieldId('ci_digits')}>Cédula</Label>
                        <div className="flex gap-2">
                            <Select value={draft.ci_prefix} onValueChange={(v) => set('ci_prefix', v)} disabled={disabled}>
                                <SelectTrigger className="h-11 w-[72px] shrink-0" aria-label="Tipo de cédula">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {CEDULA_PREFIXES.map((p) => (
                                        <SelectItem key={p} value={p}>{p}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Input
                                id={fieldId('ci_digits')}
                                inputMode="numeric"
                                placeholder="12345678"
                                maxLength={9}
                                value={draft.ci_digits}
                                onChange={(e) => set('ci_digits', e.target.value.replace(/\D/g, ''))}
                                disabled={disabled}
                                className="h-11"
                                {...aria('ci_digits')}
                            />
                        </div>
                        {err('ci_digits')}
                    </div>
                </div>
            )}

            {draft.account_type === 'zelle' && (
                <div className="space-y-1">
                    <Label htmlFor={fieldId('email')}>Correo o teléfono de Zelle</Label>
                    <Input
                        id={fieldId('email')}
                        type="text"
                        inputMode="email"
                        autoComplete="email"
                        placeholder="correo@ejemplo.com"
                        value={draft.email}
                        onChange={(e) => set('email', e.target.value)}
                        disabled={disabled}
                        className="h-11"
                        {...aria('email')}
                    />
                    {err('email')}
                    <p className="text-xs text-muted-foreground">Tal como está registrado en tu banco de EE. UU.</p>
                </div>
            )}

            {draft.account_type === 'transfer' && (
                <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1 sm:col-span-2">
                        <Label htmlFor={fieldId('bank_code')}>Banco</Label>
                        <Select value={draft.bank_code} onValueChange={(v) => set('bank_code', v)} disabled={disabled}>
                            <SelectTrigger id={fieldId('bank_code')} className="h-11" {...aria('bank_code')}>
                                <SelectValue placeholder="Selecciona el banco" />
                            </SelectTrigger>
                            <SelectContent>
                                {VE_BANKS.map((b) => (
                                    <SelectItem key={b.code} value={b.code} className="py-2">
                                        <span className="font-mono text-xs text-muted-foreground mr-2">{b.code}</span>
                                        {b.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {err('bank_code')}
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                        <Label htmlFor={fieldId('account_number')}>Número de cuenta (20 dígitos)</Label>
                        <Input
                            id={fieldId('account_number')}
                            inputMode="numeric"
                            placeholder="01020123456789012345"
                            maxLength={24}
                            value={draft.account_number}
                            onChange={(e) => set('account_number', e.target.value.replace(/[^\d\s-]/g, ''))}
                            disabled={disabled}
                            className="h-11 font-mono"
                            {...aria('account_number')}
                        />
                        {err('account_number')}
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor={fieldId('ci_digits')}>Cédula o RIF del titular</Label>
                        <div className="flex gap-2">
                            <Select value={draft.ci_prefix} onValueChange={(v) => set('ci_prefix', v)} disabled={disabled}>
                                <SelectTrigger className="h-11 w-[72px] shrink-0" aria-label="Tipo de documento">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {CEDULA_PREFIXES.map((p) => (
                                        <SelectItem key={p} value={p}>{p}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Input
                                id={fieldId('ci_digits')}
                                inputMode="numeric"
                                placeholder="12345678"
                                maxLength={9}
                                value={draft.ci_digits}
                                onChange={(e) => set('ci_digits', e.target.value.replace(/\D/g, ''))}
                                disabled={disabled}
                                className="h-11"
                                {...aria('ci_digits')}
                            />
                        </div>
                        {err('ci_digits')}
                        <p className="text-xs text-muted-foreground">Los bancos lo piden para transferir.</p>
                    </div>
                </div>
            )}

            {draft.account_type === 'crypto' && (
                <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                        <Label htmlFor={fieldId('crypto_network')}>Red</Label>
                        <Select value={draft.crypto_network} onValueChange={(v) => set('crypto_network', v)} disabled={disabled}>
                            <SelectTrigger id={fieldId('crypto_network')} className="h-11" {...aria('crypto_network')}>
                                <SelectValue placeholder="Selecciona la red" />
                            </SelectTrigger>
                            <SelectContent>
                                {CRYPTO_NETWORKS.map((n) => (
                                    <SelectItem key={n.value} value={n.value} className="py-2">{n.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {err('crypto_network')}
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor={fieldId('crypto_wallet_address')}>
                            {draft.crypto_network === 'Binance Pay' ? 'ID o correo de Binance Pay' : 'Dirección de la wallet'}
                        </Label>
                        <Input
                            id={fieldId('crypto_wallet_address')}
                            placeholder={draft.crypto_network === 'Binance Pay' ? '123456789' : 'T…'}
                            value={draft.crypto_wallet_address}
                            onChange={(e) => set('crypto_wallet_address', e.target.value)}
                            disabled={disabled}
                            className="h-11 font-mono"
                            autoComplete="off"
                            spellCheck={false}
                            {...aria('crypto_wallet_address')}
                        />
                        {err('crypto_wallet_address')}
                    </div>
                </div>
            )}

            <div className="space-y-1">
                <Label htmlFor={fieldId('account_holder_name')}>Titular de la cuenta</Label>
                <Input
                    id={fieldId('account_holder_name')}
                    autoComplete="name"
                    placeholder="Nombre como aparece en el banco"
                    value={draft.account_holder_name}
                    onChange={(e) => set('account_holder_name', e.target.value)}
                    disabled={disabled}
                    className="h-11"
                    {...aria('account_holder_name')}
                />
                {err('account_holder_name')}
            </div>

            <div className="space-y-1">
                <Label htmlFor={fieldId('instructions')}>
                    Nota para el donante <span className="font-normal text-muted-foreground">(opcional)</span>
                </Label>
                <Textarea
                    id={fieldId('instructions')}
                    rows={2}
                    maxLength={200}
                    placeholder="Ej: coloca tu nombre en el concepto del pago"
                    value={draft.instructions}
                    onChange={(e) => set('instructions', e.target.value)}
                    disabled={disabled}
                />
            </div>

            <Button type="button" onClick={handleSubmit} disabled={disabled} className="w-full sm:w-auto min-h-[44px]">
                {busy || submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                {submitLabel}
            </Button>
        </div>
    )
}

/* ------------------------------------------------------------------ */
/* Tarjeta de cuenta: cómo se ve una cuenta ya agregada                */
/* ------------------------------------------------------------------ */

interface ReceivingAccountItemProps {
    account: ReceivingAccountInput & { is_active?: boolean }
    /** Botones a la derecha (eliminar, activar/desactivar…). */
    actions?: React.ReactNode
    /** Muestra un botón "Copiar datos" (útil para pegar en WhatsApp). */
    copyable?: boolean
    className?: string
}

export function ReceivingAccountItem({ account, actions, copyable = false, className }: ReceivingAccountItemProps) {
    const [copied, setCopied] = useState(false)
    const type = RECEIVING_ACCOUNT_TYPES.find((t) => t.value === account.account_type)
    const lines = receivingAccountLines(account)
    const inactive = account.is_active === false

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(receivingAccountClipboardText(account))
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        } catch {
            // portapapeles no disponible: no bloqueamos nada
        }
    }

    return (
        <div
            className={cn(
                'rounded-lg border bg-card p-3 flex items-start gap-3',
                inactive && 'opacity-60',
                className
            )}
        >
            <span aria-hidden="true" className="text-xl leading-none mt-0.5 shrink-0">{type?.emoji}</span>
            <div className="min-w-0 flex-1 text-sm">
                <p className="font-medium flex flex-wrap items-center gap-2">
                    {RECEIVING_ACCOUNT_LABEL[account.account_type]}
                    {inactive && <Badge variant="secondary" className="text-[10px]">Oculta a los donantes</Badge>}
                </p>
                <dl className="mt-1 space-y-0.5">
                    {lines.map((l) => (
                        <div key={l.label} className="flex gap-2 text-xs">
                            <dt className="w-16 shrink-0 text-muted-foreground">{l.label}</dt>
                            <dd className="min-w-0 break-all font-mono text-foreground">{l.value}</dd>
                        </div>
                    ))}
                </dl>
                {account.instructions && (
                    <p className="mt-1 text-xs text-muted-foreground">“{account.instructions}”</p>
                )}
                {copyable && (
                    <button
                        type="button"
                        onClick={copy}
                        className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                    >
                        {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                        {copied ? 'Copiado' : 'Copiar datos'}
                    </button>
                )}
            </div>
            {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
        </div>
    )
}
