'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Save } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Profile {
    id: string
    full_name: string
    email: string
    phone: string | null
    bio: string | null
    location: string | null
    role: string
    kyc_status: string
    avatar_url: string | null
}

interface ProfileFormProps {
    profile: Profile
}

export function ProfileForm({ profile }: ProfileFormProps) {
    const [formData, setFormData] = useState({
        full_name: profile.full_name || '',
        phone: profile.phone || '',
        bio: profile.bio || '',
        location: profile.location || ''
    })
    const [loading, setLoading] = useState(false)
    const [upgradingRole, setUpgradingRole] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)

    const router = useRouter()
    const supabase = createClient()

    const updateFormData = (field: string, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }))
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)
        setSuccess(null)

        try {
            const { error: updateError } = await supabase
                .from('users')
                .update({
                    full_name: formData.full_name,
                    phone: formData.phone || null,
                    bio: formData.bio || null,
                    location: formData.location || null,
                    updated_at: new Date().toISOString()
                })
                .eq('id', profile.id)

            if (updateError) {
                setError(updateError.message)
                return
            }

            setSuccess('Perfil actualizado correctamente')

            // Refresh the page after a delay to show updated data
            setTimeout(() => {
                router.refresh()
            }, 1500)

        } catch (err) {
            console.error('Profile update error:', err)
            setError('Ocurrió un error inesperado')
        } finally {
            setLoading(false)
        }
    }

    const handleBecomeCreator = async () => {
        if (profile.role === 'creator') return

        setUpgradingRole(true)
        setError(null)
        setSuccess(null)

        try {
            const { error: upgradeError } = await supabase
                .from('users')
                .update({
                    role: 'creator',
                    updated_at: new Date().toISOString()
                })
                .eq('id', profile.id)

            if (upgradeError) {
                setError(upgradeError.message)
                return
            }

            setSuccess('Tu cuenta ahora es Creador de Campañas. Recargando...')
            setTimeout(() => {
                window.location.reload()
            }, 900)
        } catch (err) {
            console.error('Role upgrade error:', err)
            setError('No se pudo actualizar el tipo de cuenta')
        } finally {
            setUpgradingRole(false)
        }
    }

    const getRoleDisplayName = (role: string) => {
        switch (role) {
            case 'donor': return 'Donante'
            case 'creator': return 'Creador de Campañas'
            case 'guarantor': return 'Garante/Veedor'
            default: return role
        }
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
                <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            {success && (
                <Alert className="border-primary/30 bg-primary/5">
                    <AlertDescription className="text-foreground">{success}</AlertDescription>
                </Alert>
            )}

            <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="full_name">Nombre completo *</Label>
                    <Input
                        id="full_name"
                        type="text"
                        value={formData.full_name}
                        onChange={(e) => updateFormData('full_name', e.target.value)}
                        placeholder="Tu nombre completo"
                        required
                        disabled={loading}
                    />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                        id="email"
                        type="email"
                        value={profile.email}
                        disabled
                        className="bg-muted"
                    />
                    <p className="text-xs text-muted-foreground">
                        El email no se puede cambiar. Contacta soporte si necesitas cambiarlo.
                    </p>
                </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="phone">Teléfono</Label>
                    <Input
                        id="phone"
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => updateFormData('phone', e.target.value)}
                        placeholder="+58 424 123 4567"
                        disabled={loading}
                    />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="location">Ubicación</Label>
                    <Input
                        id="location"
                        type="text"
                        value={formData.location}
                        onChange={(e) => updateFormData('location', e.target.value)}
                        placeholder="Ciudad, Estado"
                        disabled={loading}
                    />
                </div>
            </div>

            <div className="space-y-2">
                <Label>Tipo de cuenta</Label>
                <div className="rounded-lg border border-border p-4 space-y-3 bg-muted/30">
                    <p className="text-sm">
                        <strong>Estado actual:</strong> {getRoleDisplayName(profile.role)}
                    </p>

                    {profile.role !== 'creator' ? (
                        <>
                            <p className="text-sm text-muted-foreground">
                                Puedes cambiar tu cuenta a <strong>Creador de Campañas</strong> para habilitar funciones de recaudación.
                            </p>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={handleBecomeCreator}
                                disabled={upgradingRole || loading}
                            >
                                {upgradingRole ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Actualizando...
                                    </>
                                ) : (
                                    'Cambiar a Creador de Campañas'
                                )}
                            </Button>
                            <p className="text-xs text-muted-foreground">
                                Al cambiar, la página se recargará para activar las funciones de creador.
                            </p>
                        </>
                    ) : (
                        <p className="text-sm text-muted-foreground">
                            Tu cuenta ya tiene habilitadas las funciones de creador.
                        </p>
                    )}
                </div>
            </div>

            <div className="space-y-2">
                <Label htmlFor="bio">Biografía</Label>
                <Textarea
                    id="bio"
                    value={formData.bio}
                    onChange={(e) => updateFormData('bio', e.target.value)}
                    placeholder="Cuéntanos un poco sobre ti..."
                    rows={4}
                    maxLength={500}
                    disabled={loading}
                    className="resize-none"
                />
                <p className="text-xs text-muted-foreground">
                    {formData.bio.length}/500 caracteres
                </p>
            </div>

            <div className="flex items-center justify-between pt-4 border-t">
                <div className="text-sm text-muted-foreground">
                    <strong>Estado actual:</strong> {getRoleDisplayName(profile.role)}
                    {profile.kyc_status === 'verified' && (
                        <span className="ml-2 text-primary">• Verificado</span>
                    )}
                </div>

                <Button type="submit" disabled={loading}>
                    {loading ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Guardando...
                        </>
                    ) : (
                        <>
                            <Save className="mr-2 h-4 w-4" />
                            Guardar cambios
                        </>
                    )}
                </Button>
            </div>
        </form>
    )
}
