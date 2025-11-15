'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Loader2, Plus, CreditCard, Trash2, Check, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Profile {
    id: string
    full_name: string
    email: string
    role: string
    kyc_status: string
}

interface WithdrawalAccount {
    id: string
    creator_id: string
    account_type: string
    account_holder_name: string
    account_number: string | null
    phone_number: string | null
    ci_number: string | null
    bank_code: string | null
    zelle_email: string | null
    paypal_email: string | null
    crypto_wallet_address: string | null
    crypto_network: string | null
    is_primary: boolean
    verified: boolean
    created_at: string
}

interface WithdrawalAccountsFormProps {
    profile: Profile
    accounts: WithdrawalAccount[]
}

export function WithdrawalAccountsForm({ profile, accounts }: WithdrawalAccountsFormProps) {
    const [showAddDialog, setShowAddDialog] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)

    const [formData, setFormData] = useState({
        account_type: 'bank_bs',
        account_holder_name: profile.full_name || '',
        account_number: '',
        phone_number: '',
        ci_number: '',
        bank_code: '',
        zelle_email: '',
        paypal_email: '',
        crypto_wallet_address: '',
        crypto_network: 'BEP20'
    })

    const router = useRouter()
    const supabase = createClient()

    const bankCodes = [
        { code: '0102', name: 'Banco de Venezuela' },
        { code: '0104', name: 'Venezolano de Crédito' },
        { code: '0105', name: 'Banco Mercantil' },
        { code: '0108', name: 'Banco Provincial' },
        { code: '0114', name: 'Bancaribe' },
        { code: '0115', name: 'Banco Exterior' },
        { code: '0128', name: 'Banco Caroní' },
        { code: '0134', name: 'Banesco' },
        { code: '0137', name: 'Banco Sofitasa' },
        { code: '0138', name: 'Banco Plaza' },
        { code: '0151', name: 'BFC Banco Fondo Común' },
        { code: '0156', name: '100% Banco' },
        { code: '0166', name: 'Banco Agrícola de Venezuela' },
        { code: '0168', name: 'Bancrecer' },
        { code: '0169', name: 'Mi Banco' },
        { code: '0171', name: 'Banco Activo' },
        { code: '0172', name: 'Bancamiga' },
        { code: '0174', name: 'Banplus' },
        { code: '0175', name: 'Banco Bicentenario' },
        { code: '0191', name: 'Banco Nacional de Crédito' }
    ]

    const updateFormData = (field: string, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }))
    }

    const resetForm = () => {
        setFormData({
            account_type: 'bank_bs',
            account_holder_name: profile.full_name || '',
            account_number: '',
            phone_number: '',
            ci_number: '',
            bank_code: '',
            zelle_email: '',
            paypal_email: '',
            crypto_wallet_address: '',
            crypto_network: 'BEP20'
        })
        setError(null)
        setSuccess(null)
    }

    const validateForm = () => {
        if (!formData.account_holder_name.trim()) {
            setError('El nombre del titular es requerido')
            return false
        }

        switch (formData.account_type) {
            case 'bank_bs':
                if (!formData.account_number || !formData.bank_code || !formData.ci_number) {
                    setError('Para cuentas bancarias se requiere: número de cuenta, banco y cédula')
                    return false
                }
                break
            case 'pagomovil':
                if (!formData.phone_number || !formData.ci_number || !formData.bank_code) {
                    setError('Para PagoMóvil se requiere: teléfono, cédula y banco')
                    return false
                }
                break
            case 'zelle':
                if (!formData.zelle_email) {
                    setError('Para Zelle se requiere el email registrado')
                    return false
                }
                break
            case 'paypal':
                if (!formData.paypal_email) {
                    setError('Para PayPal se requiere el email registrado')
                    return false
                }
                break
            case 'crypto':
                if (!formData.crypto_wallet_address || !formData.crypto_network) {
                    setError('Para crypto se requiere la dirección de wallet y red')
                    return false
                }
                break
        }
        return true
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!validateForm()) return

        setLoading(true)
        setError(null)

        try {
            // Check if this will be the first/primary account
            const isPrimary = accounts.length === 0

            const { error: insertError } = await supabase
                .from('withdrawal_accounts')
                .insert({
                    creator_id: profile.id,
                    account_type: formData.account_type,
                    account_holder_name: formData.account_holder_name,
                    account_number: formData.account_number || null,
                    phone_number: formData.phone_number || null,
                    ci_number: formData.ci_number || null,
                    bank_code: formData.bank_code || null,
                    zelle_email: formData.zelle_email || null,
                    paypal_email: formData.paypal_email || null,
                    crypto_wallet_address: formData.crypto_wallet_address || null,
                    crypto_network: formData.crypto_network || null,
                    is_primary: isPrimary,
                    verified: false
                })

            if (insertError) {
                setError(insertError.message)
                return
            }

            setSuccess('Cuenta agregada correctamente')
            resetForm()
            setShowAddDialog(false)

            setTimeout(() => {
                router.refresh()
            }, 1000)

        } catch (err) {
            console.error('Account creation error:', err)
            setError('Ocurrió un error inesperado')
        } finally {
            setLoading(false)
        }
    }

    const handleDelete = async (accountId: string) => {
        if (!confirm('¿Estás seguro que deseas eliminar esta cuenta?')) return

        setLoading(true)
        setError(null)

        try {
            const { error: deleteError } = await supabase
                .from('withdrawal_accounts')
                .delete()
                .eq('id', accountId)

            if (deleteError) {
                setError(deleteError.message)
                return
            }

            setSuccess('Cuenta eliminada correctamente')

            setTimeout(() => {
                router.refresh()
            }, 1000)

        } catch (err) {
            console.error('Account deletion error:', err)
            setError('Ocurrió un error inesperado')
        } finally {
            setLoading(false)
        }
    }

    const getAccountTypeLabel = (type: string) => {
        switch (type) {
            case 'bank_bs': return 'Cuenta Bancaria (Bs.)'
            case 'pagomovil': return 'PagoMóvil'
            case 'zelle': return 'Zelle'
            case 'paypal': return 'PayPal'
            case 'crypto': return 'Criptomoneda'
            default: return type
        }
    }

    const getAccountDetails = (account: WithdrawalAccount) => {
        switch (account.account_type) {
            case 'bank_bs':
                const bank = bankCodes.find(b => b.code === account.bank_code)
                return `${bank?.name || 'Banco'} - ${account.account_number}`
            case 'pagomovil':
                const pmBank = bankCodes.find(b => b.code === account.bank_code)
                return `${pmBank?.name || 'Banco'} - ${account.phone_number}`
            case 'zelle':
                return account.zelle_email
            case 'paypal':
                return account.paypal_email
            case 'crypto':
                return `${account.crypto_network}: ${account.crypto_wallet_address?.substring(0, 10)}...`
            default:
                return 'Información no disponible'
        }
    }

    const canAddAccounts = profile.role === 'creator' || profile.role === 'admin'

    if (!canAddAccounts) {
        return (
            <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                    Solo los creadores de campañas pueden gestionar cuentas de retiro.
                    Cambia tu rol a "Creador" en la pestaña de Perfil.
                </AlertDescription>
            </Alert>
        )
    }

    return (
        <div className="space-y-6">
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

            {/* Existing Accounts */}
            <div className="space-y-4">
                {accounts.length > 0 ? (
                    accounts.map((account) => (
                        <Card key={account.id}>
                            <CardContent className="pt-6">
                                <div className="flex items-center justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <CreditCard className="h-5 w-5 text-muted-foreground" />
                                            <h4 className="font-medium">{getAccountTypeLabel(account.account_type)}</h4>
                                            {account.is_primary && (
                                                <Badge variant="outline" className="text-xs">Principal</Badge>
                                            )}
                                            {account.verified ? (
                                                <Badge className="bg-green-500 text-xs">
                                                    <Check className="h-3 w-3 mr-1" />
                                                    Verificado
                                                </Badge>
                                            ) : (
                                                <Badge variant="secondary" className="text-xs">Pendiente</Badge>
                                            )}
                                        </div>

                                        <p className="text-sm text-muted-foreground mb-1">
                                            <strong>Titular:</strong> {account.account_holder_name}
                                        </p>
                                        <p className="text-sm text-muted-foreground">
                                            <strong>Detalles:</strong> {getAccountDetails(account)}
                                        </p>
                                    </div>

                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleDelete(account.id)}
                                        disabled={loading}
                                        className="text-destructive hover:text-destructive"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))
                ) : (
                    <Card>
                        <CardContent className="pt-6">
                            <div className="text-center text-muted-foreground">
                                <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                <p>No tienes cuentas de retiro configuradas</p>
                                <p className="text-sm">Agrega al menos una cuenta para recibir fondos</p>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>

            {/* Add Account Dialog */}
            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                <DialogTrigger asChild>
                    <Button onClick={resetForm} className="w-full">
                        <Plus className="h-4 w-4 mr-2" />
                        Agregar cuenta de retiro
                    </Button>
                </DialogTrigger>

                <DialogContent className="sm:max-w-[500px] max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Agregar cuenta de retiro</DialogTitle>
                        <DialogDescription>
                            Configura una cuenta donde recibirás los fondos de tus campañas
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="account_type">Tipo de cuenta</Label>
                            <Select
                                value={formData.account_type}
                                onValueChange={(value) => updateFormData('account_type', value)}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="bank_bs">Cuenta Bancaria (Bolívares)</SelectItem>
                                    <SelectItem value="pagomovil">PagoMóvil</SelectItem>
                                    <SelectItem value="zelle">Zelle</SelectItem>
                                    <SelectItem value="paypal">PayPal</SelectItem>
                                    <SelectItem value="crypto">Criptomoneda (USDT)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="account_holder_name">Nombre del titular *</Label>
                            <Input
                                id="account_holder_name"
                                value={formData.account_holder_name}
                                onChange={(e) => updateFormData('account_holder_name', e.target.value)}
                                placeholder="Nombre completo del titular"
                                required
                            />
                        </div>

                        {/* Bank Account Fields */}
                        {formData.account_type === 'bank_bs' && (
                            <>
                                <div className="space-y-2">
                                    <Label htmlFor="bank_code">Banco *</Label>
                                    <Select
                                        value={formData.bank_code}
                                        onValueChange={(value) => updateFormData('bank_code', value)}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Selecciona el banco" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {bankCodes.map((bank) => (
                                                <SelectItem key={bank.code} value={bank.code}>
                                                    {bank.name} ({bank.code})
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="account_number">Número de cuenta *</Label>
                                    <Input
                                        id="account_number"
                                        value={formData.account_number}
                                        onChange={(e) => updateFormData('account_number', e.target.value)}
                                        placeholder="20 dígitos"
                                        maxLength={20}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="ci_number">Cédula del titular *</Label>
                                    <Input
                                        id="ci_number"
                                        value={formData.ci_number}
                                        onChange={(e) => updateFormData('ci_number', e.target.value)}
                                        placeholder="V12345678"
                                    />
                                </div>
                            </>
                        )}

                        {/* PagoMóvil Fields */}
                        {formData.account_type === 'pagomovil' && (
                            <>
                                <div className="space-y-2">
                                    <Label htmlFor="bank_code">Banco *</Label>
                                    <Select
                                        value={formData.bank_code}
                                        onValueChange={(value) => updateFormData('bank_code', value)}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Selecciona el banco" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {bankCodes.map((bank) => (
                                                <SelectItem key={bank.code} value={bank.code}>
                                                    {bank.name} ({bank.code})
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="phone_number">Teléfono *</Label>
                                    <Input
                                        id="phone_number"
                                        value={formData.phone_number}
                                        onChange={(e) => updateFormData('phone_number', e.target.value)}
                                        placeholder="04241234567"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="ci_number">Cédula *</Label>
                                    <Input
                                        id="ci_number"
                                        value={formData.ci_number}
                                        onChange={(e) => updateFormData('ci_number', e.target.value)}
                                        placeholder="V12345678"
                                    />
                                </div>
                            </>
                        )}

                        {/* Zelle Fields */}
                        {formData.account_type === 'zelle' && (
                            <div className="space-y-2">
                                <Label htmlFor="zelle_email">Email de Zelle *</Label>
                                <Input
                                    id="zelle_email"
                                    type="email"
                                    value={formData.zelle_email}
                                    onChange={(e) => updateFormData('zelle_email', e.target.value)}
                                    placeholder="tu@email.com"
                                />
                            </div>
                        )}

                        {/* PayPal Fields */}
                        {formData.account_type === 'paypal' && (
                            <div className="space-y-2">
                                <Label htmlFor="paypal_email">Email de PayPal *</Label>
                                <Input
                                    id="paypal_email"
                                    type="email"
                                    value={formData.paypal_email}
                                    onChange={(e) => updateFormData('paypal_email', e.target.value)}
                                    placeholder="tu@email.com"
                                />
                            </div>
                        )}

                        {/* Crypto Fields */}
                        {formData.account_type === 'crypto' && (
                            <>
                                <div className="space-y-2">
                                    <Label htmlFor="crypto_network">Red *</Label>
                                    <Select
                                        value={formData.crypto_network}
                                        onValueChange={(value) => updateFormData('crypto_network', value)}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="BEP20">BEP20 (Binance Smart Chain)</SelectItem>
                                            <SelectItem value="TRC20">TRC20 (Tron)</SelectItem>
                                            <SelectItem value="ERC20">ERC20 (Ethereum)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="crypto_wallet_address">Dirección de Wallet *</Label>
                                    <Input
                                        id="crypto_wallet_address"
                                        value={formData.crypto_wallet_address}
                                        onChange={(e) => updateFormData('crypto_wallet_address', e.target.value)}
                                        placeholder="0x..."
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        Asegúrate de que la dirección sea correcta. Solo USDT.
                                    </p>
                                </div>
                            </>
                        )}

                        <DialogFooter className="gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setShowAddDialog(false)}
                            >
                                Cancelar
                            </Button>
                            <Button type="submit" disabled={loading}>
                                {loading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Agregando...
                                    </>
                                ) : (
                                    'Agregar cuenta'
                                )}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Info */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-blue-900 mb-2">Información importante:</h4>
                <ul className="text-sm text-blue-800 space-y-1">
                    <li>• Las cuentas deben verificarse antes de poder recibir fondos</li>
                    <li>• Solo puedes tener una cuenta principal por tipo</li>
                    <li>• Asegúrate de que los datos sean correctos</li>
                    <li>• Los retiros se procesan manualmente por el equipo</li>
                </ul>
            </div>
        </div>
    )
}
