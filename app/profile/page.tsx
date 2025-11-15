import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ProfileForm } from '@/components/profile-form'
import { KYCForm } from '@/components/kyc-form'
import { WithdrawalAccountsForm } from '@/components/withdrawal-accounts-form'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Shield, User, CreditCard, Info } from 'lucide-react'

export default async function ProfilePage({
    searchParams
}: {
    searchParams: { verify?: string; becomeCreator?: string }
}) {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
        redirect('/auth/login')
    }

    // Get user profile
    let { data: profile, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single()

    // If profile doesn't exist, create it
    if (profileError?.code === 'PGRST116' || !profile) {
        console.log('Profile not found, creating new profile for user:', user.id)

        const { data: newProfile, error: createError } = await supabase
            .from('users')
            .insert({
                id: user.id,
                email: user.email!,
                full_name: user.user_metadata?.full_name || user.user_metadata?.name || 'Usuario',
                avatar_url: user.user_metadata?.avatar_url,
                role: 'donor',
                kyc_status: 'pending',
            })
            .select()
            .single()

        if (createError) {
            console.error('Error creating profile:', createError)
            redirect('/auth/login')
        }

        profile = newProfile
    } else if (profileError) {
        console.error('Profile error:', profileError)
        redirect('/auth/login')
    }

    // Get withdrawal accounts
    const { data: withdrawalAccounts } = await supabase
        .from('withdrawal_accounts')
        .select('*')
        .eq('creator_id', user.id)
        .order('created_at', { ascending: false })

    const getKYCStatusColor = (status: string) => {
        switch (status) {
            case 'verified': return 'bg-green-500'
            case 'rejected': return 'bg-red-500'
            case 'pending': return 'bg-yellow-500'
            default: return 'bg-gray-500'
        }
    }

    const getKYCStatusText = (status: string) => {
        switch (status) {
            case 'verified': return 'Verificado'
            case 'rejected': return 'Rechazado'
            case 'pending': return 'Pendiente'
            default: return 'Sin verificar'
        }
    }

    const showVerificationAlert = searchParams.verify === 'true'
    const showCreatorAlert = searchParams.becomeCreator === 'true'

    return (
        <div className="min-h-screen bg-background p-4">
            <div className="max-w-4xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="space-y-1">
                        <h1 className="text-2xl font-bold">Mi Perfil</h1>
                        <p className="text-muted-foreground">
                            Gestiona tu información personal y configuración de cuenta
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Badge variant="outline" className="capitalize">
                            {profile.role === 'donor' ? 'Donante' :
                                profile.role === 'creator' ? 'Creador' :
                                    profile.role === 'guarantor' ? 'Garante' : 'Admin'}
                        </Badge>
                        <Badge className={getKYCStatusColor(profile.kyc_status)}>
                            {getKYCStatusText(profile.kyc_status)}
                        </Badge>
                    </div>
                </div>

                {/* Alerts */}
                {showVerificationAlert && (
                    <Alert>
                        <Info className="h-4 w-4" />
                        <AlertDescription>
                            Necesitas verificar tu identidad para acceder a esta función.
                            Por favor completa tu KYC en la pestaña "Verificación".
                        </AlertDescription>
                    </Alert>
                )}

                {showCreatorAlert && (
                    <Alert>
                        <Info className="h-4 w-4" />
                        <AlertDescription>
                            Para crear campañas necesitas cambiar tu rol a "Creador" y verificar tu identidad.
                        </AlertDescription>
                    </Alert>
                )}

                <Tabs defaultValue="profile" className="w-full">
                    <TabsList className="grid w-full grid-cols-4">
                        <TabsTrigger value="profile" className="flex items-center gap-2">
                            <User className="h-4 w-4" />
                            Perfil
                        </TabsTrigger>
                        <TabsTrigger value="kyc" className="flex items-center gap-2">
                            <Shield className="h-4 w-4" />
                            Verificación
                        </TabsTrigger>
                        <TabsTrigger value="withdrawal" className="flex items-center gap-2">
                            <CreditCard className="h-4 w-4" />
                            Cuentas de Retiro
                        </TabsTrigger>
                        <TabsTrigger value="activity" className="flex items-center gap-2">
                            <Info className="h-4 w-4" />
                            Actividad
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="profile">
                        <Card>
                            <CardHeader>
                                <CardTitle>Información Personal</CardTitle>
                                <CardDescription>
                                    Actualiza tu información personal básica
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <ProfileForm profile={profile} />
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="kyc">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Shield className="h-5 w-5" />
                                    Verificación de Identidad (KYC)
                                </CardTitle>
                                <CardDescription>
                                    Verifica tu identidad para crear campañas y acceder a funciones avanzadas
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <KYCForm profile={profile} />
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="withdrawal">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <CreditCard className="h-5 w-5" />
                                    Cuentas de Retiro
                                </CardTitle>
                                <CardDescription>
                                    {profile.role === 'creator' ?
                                        'Configura las cuentas donde recibirás los fondos de tus campañas' :
                                        'Crea una campaña primero para gestionar tus cuentas de retiro'
                                    }
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <WithdrawalAccountsForm
                                    profile={profile}
                                    accounts={withdrawalAccounts || []}
                                />
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="activity">
                        <Card>
                            <CardHeader>
                                <CardTitle>Actividad de la Cuenta</CardTitle>
                                <CardDescription>
                                    Historia de acciones y cambios en tu cuenta
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between p-4 border rounded-lg">
                                        <div>
                                            <h4 className="font-medium">Cuenta creada</h4>
                                            <p className="text-sm text-muted-foreground">
                                                Te registraste en LaVaca
                                            </p>
                                        </div>
                                        <span className="text-sm text-muted-foreground">
                                            {new Date(profile.created_at).toLocaleDateString('es-ES')}
                                        </span>
                                    </div>

                                    {profile.kyc_status !== 'pending' && (
                                        <div className="flex items-center justify-between p-4 border rounded-lg">
                                            <div>
                                                <h4 className="font-medium">Estado KYC actualizado</h4>
                                                <p className="text-sm text-muted-foreground">
                                                    Tu verificación fue {profile.kyc_status === 'verified' ? 'aprobada' : 'rechazada'}
                                                </p>
                                            </div>
                                            <span className="text-sm text-muted-foreground">
                                                {new Date(profile.updated_at).toLocaleDateString('es-ES')}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    )
}
