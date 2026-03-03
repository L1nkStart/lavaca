'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Loader2, Wallet, AlertCircle, LifeBuoy } from 'lucide-react'

type WithdrawalAccountOption = {
    id: string
    account_type: string
    account_holder_name: string
    is_primary: boolean
    verified: boolean
}

type RequestWithdrawalDialogProps = {
    campaignId: string
    campaignTitle: string
    availableAmountUsd: number
    accounts: WithdrawalAccountOption[]
    hasPendingRequest?: boolean
}

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

export function RequestWithdrawalDialog({
    campaignId,
    campaignTitle,
    availableAmountUsd,
    accounts,
    hasPendingRequest = false,
}: RequestWithdrawalDialogProps) {
    const router = useRouter()
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)
    const [amountUsd, setAmountUsd] = useState('')
    const [accountId, setAccountId] = useState('')

    const hasAccounts = accounts.length > 0
    const hasAvailableFunds = availableAmountUsd > 0
    const isWithdrawalTemporarilyBlocked = hasPendingRequest

    const selectedAccount = useMemo(
        () => accounts.find((account) => account.id === accountId) || null,
        [accounts, accountId]
    )

    const resetState = () => {
        setError(null)
        setSuccess(null)
        setAmountUsd('')
        setAccountId('')
    }

    const handleOpenChange = (nextOpen: boolean) => {
        setOpen(nextOpen)
        if (!nextOpen) {
            resetState()
        }
    }

    const validate = () => {
        const amount = Number(amountUsd)

        if (!hasAccounts) {
            setError('Debes configurar al menos una cuenta de retiro para solicitar fondos.')
            return false
        }

        if (isWithdrawalTemporarilyBlocked) {
            setError('Ya tienes una solicitud pendiente para esta campaña. Debes esperar revisión.')
            return false
        }

        if (!accountId) {
            setError('Selecciona una cuenta de retiro de destino.')
            return false
        }

        if (!amountUsd || Number.isNaN(amount) || amount <= 0) {
            setError('Ingresa un monto válido mayor a 0.')
            return false
        }

        if (amount > availableAmountUsd) {
            setError('El monto solicitado no puede superar el saldo disponible de esta campaña.')
            return false
        }

        return true
    }

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault()
        setError(null)
        setSuccess(null)

        if (!validate()) return

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
                    amountUsd: Number(amountUsd),
                }),
            })

            const result = await response.json()

            if (!response.ok) {
                throw new Error(result?.error || 'No se pudo registrar la solicitud de retiro.')
            }

            setSuccess('Solicitud de retiro enviada. El equipo la revisará en breve.')
            setTimeout(() => {
                setOpen(false)
                router.refresh()
            }, 900)
        } catch (submitError: any) {
            setError(submitError?.message || 'Ocurrió un error inesperado al enviar la solicitud.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 md:flex-none"
                    disabled={!hasAvailableFunds || isWithdrawalTemporarilyBlocked}
                    title={
                        isWithdrawalTemporarilyBlocked
                            ? 'Ya existe una solicitud pendiente para esta campaña'
                            : !hasAvailableFunds
                                ? 'No hay fondos disponibles para retirar en esta campaña'
                                : undefined
                    }
                >
                    <Wallet className="h-4 w-4 mr-1" />
                    {isWithdrawalTemporarilyBlocked ? 'Retiro en revisión' : 'Solicitar retiro'}
                </Button>
            </DialogTrigger>

            <DialogContent className="sm:max-w-[560px]">
                <DialogHeader>
                    <DialogTitle>Solicitar retiro de fondos</DialogTitle>
                    <DialogDescription>
                        Campaña: {campaignTitle}
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
                    <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                            No tienes cuentas de retiro configuradas. Ve a tu perfil, agrega una cuenta en la sección de retiros y vuelve a intentarlo.
                        </AlertDescription>
                    </Alert>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
                            <p className="text-xs text-muted-foreground">Saldo disponible en la campaña</p>
                            <p className="text-lg font-semibold">${availableAmountUsd.toFixed(2)} USD</p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="withdrawal-amount">Monto a retirar (USD)</Label>
                            <Input
                                id="withdrawal-amount"
                                type="number"
                                min="0.01"
                                step="0.01"
                                max={availableAmountUsd}
                                value={amountUsd}
                                onChange={(event) => setAmountUsd(event.target.value)}
                                placeholder="Ej: 120.00"
                                disabled={loading}
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="withdrawal-account">Cuenta de retiro</Label>
                            <Select value={accountId} onValueChange={setAccountId} disabled={loading}>
                                <SelectTrigger id="withdrawal-account">
                                    <SelectValue placeholder="Selecciona una cuenta" />
                                </SelectTrigger>
                                <SelectContent>
                                    {accounts.map((account) => (
                                        <SelectItem key={account.id} value={account.id}>
                                            <div className="flex items-center gap-2">
                                                <span>{formatAccountType(account.account_type)}</span>
                                                {account.is_primary && <Badge variant="outline" className="text-[10px]">Principal</Badge>}
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {selectedAccount && (
                                <p className="text-xs text-muted-foreground">
                                    Titular: {selectedAccount.account_holder_name}
                                </p>
                            )}
                        </div>

                        <DialogFooter className="gap-2">
                            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
                                Cancelar
                            </Button>
                            <Button type="submit" disabled={loading}>
                                {loading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Enviando...
                                    </>
                                ) : (
                                    'Enviar solicitud'
                                )}
                            </Button>
                        </DialogFooter>
                    </form>
                )}

                <div className="pt-2 border-t">
                    <Button variant="outline" className="w-full" asChild>
                        <Link href="/contact">
                            <LifeBuoy className="h-4 w-4 mr-2" />
                            Necesito asistencia personalizada
                        </Link>
                    </Button>
                    {!hasAccounts && (
                        <Button variant="secondary" className="w-full mt-2" asChild>
                            <Link href="/profile">Configurar cuentas de retiro</Link>
                        </Button>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}
