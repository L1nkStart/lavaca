'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Loader2, Wallet, AlertCircle, LifeBuoy, ArrowLeft, ArrowRight, Banknote, DollarSign } from 'lucide-react'
import { cn } from '@/lib/utils'

type BalanceCurrency = 'USD' | 'BS'

type WithdrawalAccountOption = {
    id: string
    account_type: string
    account_holder_name: string
    is_primary: boolean
    verified: boolean
}

type WithdrawalBalancesSnapshot = {
    saldo_bs: number
    saldo_usd: number
    has_pending_bs: boolean
    has_pending_usd: boolean
}

type WithdrawalQuoteResponse = {
    quote: {
        currency: BalanceCurrency
        amount: number
        platformFee: number
        platformFeePercent: number
        gatewayFee: number
        gatewayFeePercent: number
        gatewayFeeFixed: number
        netAmount: number
    }
    currency: BalanceCurrency
    available: number
    minimum: number
    exceedsAvailable: boolean
    belowMinimum: boolean
}

type RequestWithdrawalDialogProps = {
    campaignId: string
    campaignTitle: string
    balances: WithdrawalBalancesSnapshot
    accounts: WithdrawalAccountOption[]
    minimums: { minUsd: number; minBs: number }
    initialCurrency?: BalanceCurrency
    triggerLabel?: string
    triggerClassName?: string
}

const BS_ACCOUNT_TYPES = new Set(['bank_bs', 'pagomovil'])

const formatAccountType = (type: string) => {
    switch (type) {
        case 'bank_bs':
            return 'Cuenta Bancaria (Bs.)'
        case 'pagomovil':
            return 'PagoMóvil'
        case 'zelle':
            return 'Zelle'
        case 'paypal':
            return 'PayPal'
        case 'crypto':
            return 'Criptomoneda'
        default:
            return type
    }
}

const formatBs = (value: number) =>
    `Bs ${new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value || 0)}`

const formatUsd = (value: number) =>
    `$${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value || 0)}`

const formatByCurrency = (value: number, currency: BalanceCurrency) =>
    currency === 'BS' ? formatBs(value) : formatUsd(value)

export function RequestWithdrawalDialog({
    campaignId,
    campaignTitle,
    balances,
    accounts,
    minimums,
    initialCurrency,
    triggerLabel,
    triggerClassName,
}: RequestWithdrawalDialogProps) {
    const router = useRouter()
    const [open, setOpen] = useState(false)
    const [step, setStep] = useState<1 | 2 | 3>(1)
    const [currency, setCurrency] = useState<BalanceCurrency | null>(null)
    const [amount, setAmount] = useState('')
    const [accountId, setAccountId] = useState('')
    const [loading, setLoading] = useState(false)
    const [quoteLoading, setQuoteLoading] = useState(false)
    const [quoteData, setQuoteData] = useState<WithdrawalQuoteResponse | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)

    const hasAccounts = accounts.length > 0

    const bsAvailable = balances.saldo_bs > 0 && !balances.has_pending_bs
    const usdAvailable = balances.saldo_usd > 0 && !balances.has_pending_usd
    const canWithdrawAnything = bsAvailable || usdAvailable

    const accountsForCurrency = useMemo(() => {
        if (!currency) return []
        return accounts.filter((account) =>
            currency === 'BS'
                ? BS_ACCOUNT_TYPES.has(account.account_type)
                : !BS_ACCOUNT_TYPES.has(account.account_type)
        )
    }, [accounts, currency])

    const selectedAccount = useMemo(
        () => accounts.find((account) => account.id === accountId) || null,
        [accounts, accountId]
    )

    const availableForCurrency = currency === 'BS' ? balances.saldo_bs : balances.saldo_usd
    const minimumForCurrency = currency === 'BS' ? minimums.minBs : minimums.minUsd

    const resetState = () => {
        setStep(1)
        setCurrency(null)
        setAmount('')
        setAccountId('')
        setQuoteData(null)
        setError(null)
        setSuccess(null)
    }

    const handleOpenChange = (nextOpen: boolean) => {
        setOpen(nextOpen)
        if (nextOpen) {
            // Si viene preseleccionada una moneda con saldo, saltamos el paso 1.
            if (initialCurrency === 'BS' && bsAvailable) {
                setCurrency('BS')
                setStep(2)
            } else if (initialCurrency === 'USD' && usdAvailable) {
                setCurrency('USD')
                setStep(2)
            }
        } else {
            resetState()
        }
    }

    const selectCurrency = (selected: BalanceCurrency) => {
        setCurrency(selected)
        setAmount('')
        setAccountId('')
        setError(null)
        setStep(2)
    }

    const validateStep2 = () => {
        const parsed = Number(amount)

        if (!accountId) {
            setError('Selecciona una cuenta de retiro de destino.')
            return false
        }

        if (!amount || Number.isNaN(parsed) || parsed <= 0) {
            setError('Ingresa un monto válido mayor a 0.')
            return false
        }

        if (parsed < minimumForCurrency) {
            setError(`El monto mínimo de retiro es ${formatByCurrency(minimumForCurrency, currency!)}.`)
            return false
        }

        if (parsed > availableForCurrency) {
            setError('El monto solicitado supera el saldo disponible en esta moneda.')
            return false
        }

        return true
    }

    const goToSummary = async () => {
        setError(null)
        if (!validateStep2()) return

        try {
            setQuoteLoading(true)
            const params = new URLSearchParams({
                campaignId,
                accountId,
                amount: String(Number(amount)),
            })
            const response = await fetch(`/api/withdrawals/quote?${params.toString()}`)
            const result = await response.json()

            if (!response.ok) {
                throw new Error(result?.error || 'No se pudo calcular el desglose del retiro.')
            }

            setQuoteData(result as WithdrawalQuoteResponse)
            setStep(3)
        } catch (quoteError: any) {
            setError(quoteError?.message || 'No se pudo calcular el desglose del retiro.')
        } finally {
            setQuoteLoading(false)
        }
    }

    const handleConfirm = async () => {
        setError(null)
        setSuccess(null)

        try {
            setLoading(true)

            const response = await fetch('/api/withdrawals/request', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    campaignId,
                    accountId,
                    amount: Number(amount),
                }),
            })

            const result = await response.json()

            if (!response.ok) {
                throw new Error(result?.error || 'No se pudo registrar la solicitud de retiro.')
            }

            setSuccess('Solicitud de retiro enviada. El equipo la revisará en breve.')
            setTimeout(() => {
                setOpen(false)
                resetState()
                router.refresh()
            }, 1100)
        } catch (submitError: any) {
            setError(submitError?.message || 'Ocurrió un error inesperado al enviar la solicitud.')
        } finally {
            setLoading(false)
        }
    }

    // Si la cuenta seleccionada deja de ser compatible (cambio de moneda), se limpia.
    useEffect(() => {
        if (accountId && !accountsForCurrency.some((account) => account.id === accountId)) {
            setAccountId('')
        }
    }, [accountsForCurrency, accountId])

    const stepTitle = step === 1
        ? '¿Qué saldo quieres retirar?'
        : step === 2
            ? `Retiro en ${currency === 'BS' ? 'bolívares' : 'dólares'}`
            : 'Confirma tu retiro'

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                <Button
                    size="sm"
                    variant="outline"
                    className={cn('flex-1 md:flex-none', triggerClassName)}
                    disabled={!canWithdrawAnything}
                    title={
                        !canWithdrawAnything
                            ? 'No hay saldo disponible para retirar (o ya tienes solicitudes pendientes en ambas monedas)'
                            : undefined
                    }
                >
                    <Wallet className="h-4 w-4 mr-1" />
                    {triggerLabel || 'Solicitar retiro'}
                </Button>
            </DialogTrigger>

            <DialogContent className="sm:max-w-[560px]">
                <DialogHeader>
                    <DialogTitle>{stepTitle}</DialogTitle>
                    <DialogDescription>
                        Campaña: {campaignTitle} · Paso {step} de 3
                    </DialogDescription>
                </DialogHeader>

                {error && (
                    <Alert variant="destructive">
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}

                {success && (
                    <Alert className="bg-green-50 text-green-800 border-green-200">
                        <AlertDescription>{success}</AlertDescription>
                    </Alert>
                )}

                {!hasAccounts ? (
                    <>
                        <Alert>
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>
                                No tienes cuentas de retiro configuradas. Ve a tu perfil, agrega una cuenta en la sección de retiros y vuelve a intentarlo.
                            </AlertDescription>
                        </Alert>
                        <Button variant="secondary" className="w-full" asChild>
                            <Link href="/profile">Configurar cuentas de retiro</Link>
                        </Button>
                    </>
                ) : (
                    <>
                        {/* PASO 1: Moneda */}
                        {step === 1 && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <button
                                    type="button"
                                    onClick={() => selectCurrency('BS')}
                                    disabled={!bsAvailable}
                                    className={cn(
                                        'rounded-lg border-2 p-4 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                        bsAvailable
                                            ? 'border-border hover:border-primary/60 cursor-pointer'
                                            : 'border-border opacity-50 cursor-not-allowed'
                                    )}
                                >
                                    <Banknote className="h-6 w-6 text-primary mb-2" />
                                    <p className="font-semibold">Bolívares</p>
                                    <p className="text-lg font-bold">{formatBs(balances.saldo_bs)}</p>
                                    {balances.has_pending_bs ? (
                                        <p className="text-xs text-amber-600 mt-1">Ya tienes un retiro Bs pendiente</p>
                                    ) : balances.saldo_bs <= 0 ? (
                                        <p className="text-xs text-muted-foreground mt-1">Sin saldo disponible</p>
                                    ) : (
                                        <p className="text-xs text-muted-foreground mt-1">Cuenta Bs o PagoMóvil</p>
                                    )}
                                </button>

                                <button
                                    type="button"
                                    onClick={() => selectCurrency('USD')}
                                    disabled={!usdAvailable}
                                    className={cn(
                                        'rounded-lg border-2 p-4 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                        usdAvailable
                                            ? 'border-border hover:border-primary/60 cursor-pointer'
                                            : 'border-border opacity-50 cursor-not-allowed'
                                    )}
                                >
                                    <DollarSign className="h-6 w-6 text-primary mb-2" />
                                    <p className="font-semibold">Dólares</p>
                                    <p className="text-lg font-bold">{formatUsd(balances.saldo_usd)}</p>
                                    {balances.has_pending_usd ? (
                                        <p className="text-xs text-amber-600 mt-1">Ya tienes un retiro USD pendiente</p>
                                    ) : balances.saldo_usd <= 0 ? (
                                        <p className="text-xs text-muted-foreground mt-1">Sin saldo disponible</p>
                                    ) : (
                                        <p className="text-xs text-muted-foreground mt-1">Zelle, PayPal o cripto</p>
                                    )}
                                </button>
                            </div>
                        )}

                        {/* PASO 2: Monto + cuenta */}
                        {step === 2 && currency && (
                            <div className="space-y-4">
                                <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
                                    <p className="text-xs text-muted-foreground">
                                        Saldo disponible en {currency === 'BS' ? 'bolívares' : 'dólares'}
                                    </p>
                                    <p className="text-lg font-semibold">{formatByCurrency(availableForCurrency, currency)}</p>
                                    <p className="text-xs text-muted-foreground">
                                        Mínimo de retiro: {formatByCurrency(minimumForCurrency, currency)}
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="withdrawal-amount">
                                        Monto a retirar ({currency === 'BS' ? 'Bs' : 'USD'})
                                    </Label>
                                    <Input
                                        id="withdrawal-amount"
                                        type="number"
                                        min={minimumForCurrency}
                                        step="0.01"
                                        max={availableForCurrency}
                                        value={amount}
                                        onChange={(event) => setAmount(event.target.value)}
                                        placeholder={currency === 'BS' ? 'Ej: 5000.00' : 'Ej: 120.00'}
                                        disabled={quoteLoading}
                                        required
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="withdrawal-account">Cuenta de retiro</Label>
                                    {accountsForCurrency.length === 0 ? (
                                        <Alert>
                                            <AlertCircle className="h-4 w-4" />
                                            <AlertDescription>
                                                No tienes cuentas compatibles con retiros en {currency === 'BS' ? 'bolívares (cuenta bancaria Bs o PagoMóvil)' : 'dólares (Zelle, PayPal o cripto)'}.
                                                {' '}
                                                <Link href="/profile" className="underline font-medium">Agregar cuenta</Link>
                                            </AlertDescription>
                                        </Alert>
                                    ) : (
                                        <Select value={accountId} onValueChange={setAccountId} disabled={quoteLoading}>
                                            <SelectTrigger id="withdrawal-account">
                                                <SelectValue placeholder="Selecciona una cuenta" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {accountsForCurrency.map((account) => (
                                                    <SelectItem key={account.id} value={account.id}>
                                                        <div className="flex items-center gap-2">
                                                            <span>{formatAccountType(account.account_type)}</span>
                                                            {account.is_primary && <Badge variant="outline" className="text-[10px]">Principal</Badge>}
                                                        </div>
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    )}
                                    {selectedAccount && (
                                        <p className="text-xs text-muted-foreground">
                                            Titular: {selectedAccount.account_holder_name}
                                        </p>
                                    )}
                                </div>

                                <DialogFooter className="gap-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => { setStep(1); setError(null) }}
                                        disabled={quoteLoading}
                                    >
                                        <ArrowLeft className="h-4 w-4 mr-1" />
                                        Atrás
                                    </Button>
                                    <Button
                                        type="button"
                                        onClick={goToSummary}
                                        disabled={quoteLoading || accountsForCurrency.length === 0}
                                    >
                                        {quoteLoading ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                Calculando…
                                            </>
                                        ) : (
                                            <>
                                                Continuar
                                                <ArrowRight className="h-4 w-4 ml-1" />
                                            </>
                                        )}
                                    </Button>
                                </DialogFooter>
                            </div>
                        )}

                        {/* PASO 3: Resumen con desglose exacto */}
                        {step === 3 && currency && quoteData && (
                            <div className="space-y-4">
                                <div className="rounded-lg border p-4 space-y-2 text-sm">
                                    <div className="flex items-center justify-between">
                                        <span className="text-muted-foreground">Monto solicitado</span>
                                        <span className="font-medium">{formatByCurrency(quoteData.quote.amount, currency)}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-muted-foreground">
                                            Comisión LaVaca ({quoteData.quote.platformFeePercent}%)
                                        </span>
                                        <span className="font-medium text-destructive">
                                            −{formatByCurrency(quoteData.quote.platformFee, currency)}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-muted-foreground">
                                            Fee de {formatAccountType(selectedAccount?.account_type || '')}
                                            {quoteData.quote.gatewayFeePercent > 0 && ` (${quoteData.quote.gatewayFeePercent}%)`}
                                            {quoteData.quote.gatewayFeeFixed > 0 && ` (+${formatByCurrency(quoteData.quote.gatewayFeeFixed, currency)} fijo)`}
                                        </span>
                                        <span className="font-medium text-destructive">
                                            −{formatByCurrency(quoteData.quote.gatewayFee, currency)}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between border-t pt-2 text-base">
                                        <span className="font-semibold">Recibirás</span>
                                        <span className="font-bold text-primary">
                                            {formatByCurrency(quoteData.quote.netAmount, currency)}
                                        </span>
                                    </div>
                                </div>

                                <div className="rounded-lg border bg-muted/30 p-3 space-y-1 text-xs text-muted-foreground">
                                    <p>
                                        Cuenta destino: <strong className="text-foreground">{formatAccountType(selectedAccount?.account_type || '')}</strong>
                                        {' '}· {selectedAccount?.account_holder_name}
                                    </p>
                                    <p>Tiempo estimado: 1-3 días hábiles después de la aprobación</p>
                                    {currency === 'BS' && (
                                        <p>
                                            Sugerencia: retira tus bolívares pronto. Mientras más tiempo pasen sin retirar,
                                            más valor pueden perder por la variación de la tasa.
                                        </p>
                                    )}
                                </div>

                                <DialogFooter className="gap-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => { setStep(2); setQuoteData(null); setError(null) }}
                                        disabled={loading}
                                    >
                                        <ArrowLeft className="h-4 w-4 mr-1" />
                                        Atrás
                                    </Button>
                                    <Button type="button" onClick={handleConfirm} disabled={loading}>
                                        {loading ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                Enviando…
                                            </>
                                        ) : (
                                            'Confirmar solicitud'
                                        )}
                                    </Button>
                                </DialogFooter>
                            </div>
                        )}
                    </>
                )}

                <div className="pt-2 border-t">
                    <Button variant="outline" className="w-full" asChild>
                        <Link href="/contact">
                            <LifeBuoy className="h-4 w-4 mr-2" />
                            Necesito asistencia personalizada
                        </Link>
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
