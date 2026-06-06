"use client"

import { useEffect, useMemo, useState } from "react"
import { AdminSidebar } from "@/components/admin-sidebar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, AlertCircle, CheckCircle2, Trash2, Plus } from "lucide-react"

type MethodCode = "card" | "crypto" | "zelle" | "pagomovil" | "transfer"

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }

interface PaymentMethodConfig {
    code: MethodCode
    name: string
    description: string | null
    is_active: boolean
    display_order: number
    settings: Record<string, JsonValue>
    updated_at?: string
}

interface TransferAccount {
    id: string
    method_code: string
    bank_name: string
    account_holder: string
    account_number: string
    account_type: string | null
    document_id: string | null
    currency: string
    instructions: string | null
    is_active: boolean
    display_order: number
    updated_at?: string
}

const ORDERED_METHODS: MethodCode[] = ["card", "crypto", "zelle", "pagomovil", "transfer"]

const FALLBACK_METHODS: Record<MethodCode, PaymentMethodConfig> = {
    card: {
        code: "card",
        name: "Tarjeta de Crédito/Débito",
        description: "Pago internacional procesado por Stripe",
        is_active: true,
        display_order: 10,
        settings: { provider: "stripe" },
    },
    crypto: {
        code: "crypto",
        name: "Binance Pay",
        description: "Pago con criptoactivos usando Binance Pay",
        is_active: true,
        display_order: 20,
        settings: { provider: "binance", instructions: "" },
    },
    zelle: {
        code: "zelle",
        name: "Zelle",
        description: "Pago manual por Zelle",
        is_active: true,
        display_order: 30,
        settings: { email: "", accountName: "" },
    },
    pagomovil: {
        code: "pagomovil",
        name: "Pago Móvil",
        description: "Pago local venezolano",
        is_active: true,
        display_order: 40,
        settings: { bank: "", phone: "", cedula: "", qrImageUrl: "" },
    },
    transfer: {
        code: "transfer",
        name: "Transferencia Bancaria",
        description: "Transferencia bancaria manual",
        is_active: true,
        display_order: 50,
        settings: { notes: "" },
    },
}

function getErrorMessage(error: unknown) {
    if (error instanceof Error) return error.message
    return "Error inesperado"
}

export default function AdminPaymentMethodsPage() {
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [notice, setNotice] = useState<string | null>(null)

    const [methods, setMethods] = useState<Record<MethodCode, PaymentMethodConfig>>(FALLBACK_METHODS)
    const [savingMethodCode, setSavingMethodCode] = useState<MethodCode | null>(null)

    const [transferAccounts, setTransferAccounts] = useState<TransferAccount[]>([])
    const [savingAccountId, setSavingAccountId] = useState<string | null>(null)
    const [creatingAccount, setCreatingAccount] = useState(false)

    const [newAccount, setNewAccount] = useState({
        bank_name: "",
        account_holder: "",
        account_number: "",
        account_type: "",
        document_id: "",
        currency: "BS",
        instructions: "",
        is_active: true,
        display_order: 0,
    })

    const orderedMethods = useMemo(
        () => ORDERED_METHODS.map((code) => methods[code]).filter(Boolean),
        [methods],
    )

    useEffect(() => {
        void fetchData()
    }, [])

    const fetchData = async () => {
        try {
            setLoading(true)
            setError(null)

            const response = await fetch("/api/admin/payment-methods", {
                method: "GET",
                cache: "no-store",
            })

            const result = await response.json()

            if (!response.ok) {
                throw new Error(result?.error || result?.details || "No se pudo cargar la configuración")
            }

            const map = { ...FALLBACK_METHODS }
                ; (result.methods || []).forEach((method: PaymentMethodConfig) => {
                    map[method.code] = {
                        ...map[method.code],
                        ...method,
                        settings: {
                            ...(map[method.code]?.settings || {}),
                            ...(method.settings || {}),
                        },
                    }
                })

            setMethods(map)
            setTransferAccounts(result.transferAccounts || [])
        } catch (err) {
            console.error("Error loading payment methods:", err)
            setError(getErrorMessage(err))
        } finally {
            setLoading(false)
        }
    }

    const updateMethodField = (code: MethodCode, field: keyof PaymentMethodConfig, value: unknown) => {
        setMethods((prev) => ({
            ...prev,
            [code]: {
                ...prev[code],
                [field]: value,
            },
        }))
    }

    const updateMethodSetting = (code: MethodCode, key: string, value: JsonValue) => {
        setMethods((prev) => ({
            ...prev,
            [code]: {
                ...prev[code],
                settings: {
                    ...(prev[code]?.settings || {}),
                    [key]: value,
                },
            },
        }))
    }

    const saveMethod = async (code: MethodCode) => {
        try {
            setSavingMethodCode(code)
            setNotice(null)

            const method = methods[code]

            const response = await fetch(`/api/admin/payment-methods/${code}`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    name: method.name,
                    description: method.description,
                    is_active: method.is_active,
                    display_order: method.display_order,
                    settings: method.settings,
                }),
            })

            const result = await response.json()
            if (!response.ok) {
                throw new Error(result?.error || result?.details || "No se pudo guardar")
            }

            setNotice(`Configuración de ${method.name} guardada correctamente.`)
            setError(null)
        } catch (err) {
            console.error("Error saving method:", err)
            setError(getErrorMessage(err))
        } finally {
            setSavingMethodCode(null)
        }
    }

    const saveTransferAccount = async (account: TransferAccount) => {
        try {
            setSavingAccountId(account.id)
            setNotice(null)

            const response = await fetch(`/api/admin/payment-methods/accounts/${account.id}`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(account),
            })

            const result = await response.json()
            if (!response.ok) {
                throw new Error(result?.error || result?.details || "No se pudo guardar la cuenta")
            }

            setNotice("Cuenta bancaria actualizada correctamente.")
            setError(null)
        } catch (err) {
            console.error("Error saving account:", err)
            setError(getErrorMessage(err))
        } finally {
            setSavingAccountId(null)
        }
    }

    const createTransferAccount = async () => {
        try {
            setCreatingAccount(true)
            setNotice(null)

            const response = await fetch("/api/admin/payment-methods/accounts", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(newAccount),
            })

            const result = await response.json()
            if (!response.ok) {
                throw new Error(result?.error || result?.details || "No se pudo crear la cuenta")
            }

            setTransferAccounts((prev) => [...prev, result.account])
            setNewAccount({
                bank_name: "",
                account_holder: "",
                account_number: "",
                account_type: "",
                document_id: "",
                currency: "BS",
                instructions: "",
                is_active: true,
                display_order: 0,
            })
            setNotice("Cuenta bancaria agregada correctamente.")
            setError(null)
        } catch (err) {
            console.error("Error creating account:", err)
            setError(getErrorMessage(err))
        } finally {
            setCreatingAccount(false)
        }
    }

    const deleteTransferAccount = async (id: string) => {
        try {
            setSavingAccountId(id)
            setNotice(null)

            const response = await fetch(`/api/admin/payment-methods/accounts/${id}`, {
                method: "DELETE",
            })

            const result = await response.json()
            if (!response.ok) {
                throw new Error(result?.error || result?.details || "No se pudo eliminar la cuenta")
            }

            setTransferAccounts((prev) => prev.filter((item) => item.id !== id))
            setNotice("Cuenta bancaria eliminada.")
            setError(null)
        } catch (err) {
            console.error("Error deleting account:", err)
            setError(getErrorMessage(err))
        } finally {
            setSavingAccountId(null)
        }
    }

    if (loading) {
        return (
            <div className="flex min-h-screen bg-background">
                <AdminSidebar />
                <main className="flex-1 flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin" />
                </main>
            </div>
        )
    }

    return (
        <div className="flex min-h-screen bg-background">
            <AdminSidebar />

            <main className="flex-1 overflow-auto">
                <div className="border-b border-border bg-card sticky top-0 z-40">
                    <div className="px-4 sm:px-8 py-4 sm:py-6">
                        <h1 className="text-3xl font-bold">Métodos de Pago</h1>
                        <p className="text-muted-foreground mt-1">
                            Activa, desactiva y configura los datos de cobro que verá el donante.
                        </p>
                    </div>
                </div>

                <div className="p-4 sm:p-8 space-y-4 sm:space-y-6">
                    {error && (
                        <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}

                    {notice && (
                        <Alert>
                            <CheckCircle2 className="h-4 w-4" />
                            <AlertDescription>{notice}</AlertDescription>
                        </Alert>
                    )}

                    {orderedMethods.map((method) => (
                        <Card key={method.code}>
                            <CardHeader className="pb-3">
                                <div className="flex items-center justify-between gap-4">
                                    <CardTitle>{method.name}</CardTitle>
                                    <div className="flex items-center gap-2">
                                        <Label htmlFor={`active-${method.code}`}>Activo</Label>
                                        <Switch
                                            id={`active-${method.code}`}
                                            checked={method.is_active}
                                            onCheckedChange={(checked) => updateMethodField(method.code, "is_active", checked)}
                                        />
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid md:grid-cols-2 gap-4">
                                    <div>
                                        <Label>Nombre mostrado</Label>
                                        <Input
                                            value={method.name}
                                            onChange={(e) => updateMethodField(method.code, "name", e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <Label>Orden</Label>
                                        <Input
                                            type="number"
                                            value={method.display_order}
                                            onChange={(e) => updateMethodField(method.code, "display_order", Number(e.target.value) || 0)}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <Label>Descripción</Label>
                                    <Textarea
                                        rows={2}
                                        value={method.description || ""}
                                        onChange={(e) => updateMethodField(method.code, "description", e.target.value)}
                                    />
                                </div>

                                {method.code === "zelle" && (
                                    <div className="grid md:grid-cols-2 gap-4">
                                        <div>
                                            <Label>Email de cobro Zelle</Label>
                                            <Input
                                                value={String(method.settings.email || "")}
                                                onChange={(e) => updateMethodSetting(method.code, "email", e.target.value)}
                                                placeholder="cobros@tudominio.com"
                                            />
                                        </div>
                                        <div>
                                            <Label>Nombre del titular</Label>
                                            <Input
                                                value={String(method.settings.accountName || "")}
                                                onChange={(e) => updateMethodSetting(method.code, "accountName", e.target.value)}
                                                placeholder="Nombre del titular"
                                            />
                                        </div>
                                    </div>
                                )}

                                {method.code === "pagomovil" && (
                                    <>
                                        <div className="grid md:grid-cols-3 gap-4">
                                            <div>
                                                <Label>Banco receptor</Label>
                                                <Input
                                                    value={String(method.settings.bank || "")}
                                                    onChange={(e) => updateMethodSetting(method.code, "bank", e.target.value)}
                                                    placeholder="0102 - Banco de Venezuela"
                                                />
                                            </div>
                                            <div>
                                                <Label>Teléfono receptor</Label>
                                                <Input
                                                    value={String(method.settings.phone || "")}
                                                    onChange={(e) => updateMethodSetting(method.code, "phone", e.target.value)}
                                                    placeholder="0412XXXXXXX"
                                                />
                                            </div>
                                            <div>
                                                <Label>Cédula/RIF receptor</Label>
                                                <Input
                                                    value={String(method.settings.cedula || "")}
                                                    onChange={(e) => updateMethodSetting(method.code, "cedula", e.target.value)}
                                                    placeholder="V-12345678"
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <Label>URL de imagen QR</Label>
                                            <Input
                                                value={String(method.settings.qrImageUrl || "")}
                                                onChange={(e) => updateMethodSetting(method.code, "qrImageUrl", e.target.value)}
                                                placeholder="https://.../qr-pagomovil.png"
                                            />
                                        </div>
                                    </>
                                )}

                                {method.code === "crypto" && (
                                    <div>
                                        <Label>Instrucciones para el donante</Label>
                                        <Textarea
                                            rows={2}
                                            value={String(method.settings.instructions || "")}
                                            onChange={(e) => updateMethodSetting(method.code, "instructions", e.target.value)}
                                            placeholder="Notas opcionales para mostrar en checkout"
                                        />
                                    </div>
                                )}

                                {method.code === "transfer" && (
                                    <div>
                                        <Label>Notas generales para transferencias</Label>
                                        <Textarea
                                            rows={2}
                                            value={String(method.settings.notes || "")}
                                            onChange={(e) => updateMethodSetting(method.code, "notes", e.target.value)}
                                            placeholder="Ej: enviar comprobante por WhatsApp"
                                        />
                                    </div>
                                )}

                                <div className="flex justify-end">
                                    <Button onClick={() => saveMethod(method.code)} disabled={savingMethodCode === method.code}>
                                        {savingMethodCode === method.code ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                                        Guardar configuración
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}

                    <Card>
                        <CardHeader>
                            <CardTitle>Cuentas para Transferencia Bancaria</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {transferAccounts.length === 0 ? (
                                <p className="text-sm text-muted-foreground">No hay cuentas creadas.</p>
                            ) : (
                                transferAccounts.map((account) => (
                                    <div key={account.id} className="border rounded-lg p-4 space-y-3">
                                        <div className="grid md:grid-cols-3 gap-3">
                                            <div>
                                                <Label>Banco</Label>
                                                <Input
                                                    value={account.bank_name}
                                                    onChange={(e) => setTransferAccounts((prev) => prev.map((item) => item.id === account.id ? { ...item, bank_name: e.target.value } : item))}
                                                />
                                            </div>
                                            <div>
                                                <Label>Titular</Label>
                                                <Input
                                                    value={account.account_holder}
                                                    onChange={(e) => setTransferAccounts((prev) => prev.map((item) => item.id === account.id ? { ...item, account_holder: e.target.value } : item))}
                                                />
                                            </div>
                                            <div>
                                                <Label>Número de cuenta</Label>
                                                <Input
                                                    value={account.account_number}
                                                    onChange={(e) => setTransferAccounts((prev) => prev.map((item) => item.id === account.id ? { ...item, account_number: e.target.value } : item))}
                                                />
                                            </div>
                                        </div>

                                        <div className="grid md:grid-cols-4 gap-3">
                                            <div>
                                                <Label>Tipo</Label>
                                                <Input
                                                    value={account.account_type || ""}
                                                    onChange={(e) => setTransferAccounts((prev) => prev.map((item) => item.id === account.id ? { ...item, account_type: e.target.value } : item))}
                                                />
                                            </div>
                                            <div>
                                                <Label>Documento</Label>
                                                <Input
                                                    value={account.document_id || ""}
                                                    onChange={(e) => setTransferAccounts((prev) => prev.map((item) => item.id === account.id ? { ...item, document_id: e.target.value } : item))}
                                                />
                                            </div>
                                            <div>
                                                <Label>Moneda</Label>
                                                <Input
                                                    value={account.currency}
                                                    onChange={(e) => setTransferAccounts((prev) => prev.map((item) => item.id === account.id ? { ...item, currency: e.target.value } : item))}
                                                />
                                            </div>
                                            <div>
                                                <Label>Orden</Label>
                                                <Input
                                                    type="number"
                                                    value={account.display_order}
                                                    onChange={(e) => setTransferAccounts((prev) => prev.map((item) => item.id === account.id ? { ...item, display_order: Number(e.target.value) || 0 } : item))}
                                                />
                                            </div>
                                        </div>

                                        <div className="grid md:grid-cols-2 gap-3 items-end">
                                            <div>
                                                <Label>Instrucciones</Label>
                                                <Textarea
                                                    rows={2}
                                                    value={account.instructions || ""}
                                                    onChange={(e) => setTransferAccounts((prev) => prev.map((item) => item.id === account.id ? { ...item, instructions: e.target.value } : item))}
                                                />
                                            </div>
                                            <div className="flex items-center justify-between gap-3">
                                                <div className="flex items-center gap-2">
                                                    <Label htmlFor={`active-account-${account.id}`}>Activa</Label>
                                                    <Switch
                                                        id={`active-account-${account.id}`}
                                                        checked={account.is_active}
                                                        onCheckedChange={(checked) => setTransferAccounts((prev) => prev.map((item) => item.id === account.id ? { ...item, is_active: checked } : item))}
                                                    />
                                                </div>
                                                <div className="flex gap-2">
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => saveTransferAccount(account)}
                                                        disabled={savingAccountId === account.id}
                                                    >
                                                        {savingAccountId === account.id ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                                                        Guardar
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="destructive"
                                                        onClick={() => deleteTransferAccount(account.id)}
                                                        disabled={savingAccountId === account.id}
                                                    >
                                                        <Trash2 className="w-4 h-4 mr-2" />
                                                        Eliminar
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}

                            <div className="border-t pt-4 space-y-3">
                                <h3 className="font-semibold">Agregar nueva cuenta</h3>
                                <div className="grid md:grid-cols-3 gap-3">
                                    <Input
                                        placeholder="Banco"
                                        value={newAccount.bank_name}
                                        onChange={(e) => setNewAccount((prev) => ({ ...prev, bank_name: e.target.value }))}
                                    />
                                    <Input
                                        placeholder="Titular"
                                        value={newAccount.account_holder}
                                        onChange={(e) => setNewAccount((prev) => ({ ...prev, account_holder: e.target.value }))}
                                    />
                                    <Input
                                        placeholder="Número de cuenta"
                                        value={newAccount.account_number}
                                        onChange={(e) => setNewAccount((prev) => ({ ...prev, account_number: e.target.value }))}
                                    />
                                </div>
                                <div className="grid md:grid-cols-4 gap-3">
                                    <Input
                                        placeholder="Tipo de cuenta"
                                        value={newAccount.account_type}
                                        onChange={(e) => setNewAccount((prev) => ({ ...prev, account_type: e.target.value }))}
                                    />
                                    <Input
                                        placeholder="Documento"
                                        value={newAccount.document_id}
                                        onChange={(e) => setNewAccount((prev) => ({ ...prev, document_id: e.target.value }))}
                                    />
                                    <Input
                                        placeholder="Moneda"
                                        value={newAccount.currency}
                                        onChange={(e) => setNewAccount((prev) => ({ ...prev, currency: e.target.value }))}
                                    />
                                    <Input
                                        type="number"
                                        placeholder="Orden"
                                        value={newAccount.display_order}
                                        onChange={(e) => setNewAccount((prev) => ({ ...prev, display_order: Number(e.target.value) || 0 }))}
                                    />
                                </div>
                                <Textarea
                                    rows={2}
                                    placeholder="Instrucciones opcionales"
                                    value={newAccount.instructions}
                                    onChange={(e) => setNewAccount((prev) => ({ ...prev, instructions: e.target.value }))}
                                />
                                <div className="flex justify-end">
                                    <Button onClick={createTransferAccount} disabled={creatingAccount}>
                                        {creatingAccount ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                                        Agregar cuenta
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </main>
        </div>
    )
}
