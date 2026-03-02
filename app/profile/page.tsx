import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ProfileForm } from '@/components/profile-form'
import { KYCFormImproved } from '@/components/kyc-form-improved'
import { WithdrawalAccountsForm } from '@/components/withdrawal-accounts-form'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { Shield, User, CreditCard, Info, Heart, TrendingUp, DollarSign, Calendar, Settings, LogOut, Plus, Eye } from 'lucide-react'
import Link from 'next/link'
import { CampaignCard } from '@/components/campaign-card'

export default async function ProfilePage({
    searchParams
}: {
    searchParams: Promise<{ verify?: string; becomeCreator?: string }>
}) {
    const params = await searchParams
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
            redirect('/auth/login')
        }

        profile = newProfile
    } else if (profileError) {
        redirect('/auth/login')
    }

    // Get user's donations
    const { data: donations } = await supabase
        .from('donations')
        .select(`
            *,
            campaigns (
                id,
                title,
                slug,
                main_image_url,
                goal_amount_usd,
                current_amount_usd
            )
        `)
        .eq('donor_id', user.id)
        .order('created_at', { ascending: false })

    // Get user's campaigns if creator
    const { data: campaigns } = await supabase
        .from('campaigns')
        .select(`
            id,
            title,
            story,
            main_image_url,
            goal_amount_usd,
            current_amount_usd,
            slug,
            status,
            created_at,
            categories (
                name,
                icon_emoji
            )
        `)
        .eq('creator_id', user.id)
        .order('created_at', { ascending: false })

    // Get withdrawal accounts
    const { data: withdrawalAccounts } = await supabase
        .from('withdrawal_accounts')
        .select('*')
        .eq('creator_id', user.id)
        .order('created_at', { ascending: false })

    // Calculate stats
    const totalDonated = donations?.reduce((sum, d) => sum + d.amount_usd, 0) || 0
    const totalCampaigns = campaigns?.length || 0
    const totalRaised = campaigns?.reduce((sum, c) => sum + (c.current_amount_usd || 0), 0) || 0
    const donationsCount = donations?.length || 0

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

    const showVerificationAlert = params.verify === 'true'
    const showCreatorAlert = params.becomeCreator === 'true'

    return (
        <div className="min-h-screen bg-muted/30">
            {/* Header with Profile Info */}
            <div className="bg-gradient-to-br from-primary/10 to-accent/10 border-b">
                <div className="max-w-7xl mx-auto px-4 py-8">
                    <div className="flex flex-col md:flex-row gap-6 items-start md:items-center">
                        <Avatar className="h-24 w-24 border-4 border-background">
                            <AvatarImage src={profile.avatar_url || ''} alt={profile.full_name} />
                            <AvatarFallback className="text-2xl">
                                {profile.full_name?.charAt(0).toUpperCase() || 'U'}
                            </AvatarFallback>
                        </Avatar>

                        <div className="flex-1">
                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                                <div>
                                    <h1 className="text-3xl font-bold">{profile.full_name}</h1>
                                    <p className="text-muted-foreground">{profile.email}</p>
                                    <div className="flex items-center gap-2 mt-2">
                                        <Badge variant="outline" className="capitalize">
                                            {profile.role === 'donor' ? 'Donante' :
                                                profile.role === 'creator' ? 'Creador' :
                                                    profile.role === 'guarantor' ? 'Garante' : 'Admin'}
                                        </Badge>
                                        <Badge className={getKYCStatusColor(profile.kyc_status)}>
                                            <Shield className="h-3 w-3 mr-1" />
                                            {getKYCStatusText(profile.kyc_status)}
                                        </Badge>
                                    </div>
                                </div>

                                <div className="flex gap-2">
                                    {profile.role === 'creator' && profile.kyc_status === 'verified' && (
                                        <Button asChild>
                                            <Link href="/creator/campaigns/create">
                                                <Plus className="h-4 w-4 mr-2" />
                                                Crear campaña
                                            </Link>
                                        </Button>
                                    )}
                                    <form action="/auth/signout" method="post">
                                        <Button variant="outline" type="submit">
                                            <LogOut className="h-4 w-4 mr-2" />
                                            Cerrar sesión
                                        </Button>
                                    </form>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Stats Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
                        <Card>
                            <CardContent className="pt-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-muted-foreground">Total donado</p>
                                        <p className="text-2xl font-bold">${totalDonated.toFixed(2)}</p>
                                    </div>
                                    <Heart className="h-8 w-8 text-primary" />
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="pt-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-muted-foreground">Donaciones</p>
                                        <p className="text-2xl font-bold">{donationsCount}</p>
                                    </div>
                                    <DollarSign className="h-8 w-8 text-green-500" />
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="pt-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-muted-foreground">Campañas</p>
                                        <p className="text-2xl font-bold">{totalCampaigns}</p>
                                    </div>
                                    <TrendingUp className="h-8 w-8 text-blue-500" />
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="pt-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-muted-foreground">Recaudado</p>
                                        <p className="text-2xl font-bold">${totalRaised.toFixed(2)}</p>
                                    </div>
                                    <Calendar className="h-8 w-8 text-purple-500" />
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-7xl mx-auto px-4 py-8">
                {/* Alerts */}
                {showVerificationAlert && (
                    <Alert className="mb-6">
                        <Info className="h-4 w-4" />
                        <AlertDescription>
                            Necesitas verificar tu identidad para acceder a esta función.
                            Ve a la pestaña "Verificación", completa el formulario de Identidad (KYC) y envía tus documentos.
                        </AlertDescription>
                    </Alert>
                )}

                {showCreatorAlert && (
                    <Alert className="mb-6">
                        <Info className="h-4 w-4" />
                        <AlertDescription>
                            Para crear campañas necesitas cambiar tu rol a "Creador" y verificar tu identidad.
                        </AlertDescription>
                    </Alert>
                )}

                <Tabs defaultValue="dashboard" className="w-full">
                    <TabsList className="grid w-full grid-cols-2 md:grid-cols-6 mb-8">
                        <TabsTrigger value="dashboard" className="flex items-center gap-2">
                            <TrendingUp className="h-4 w-4" />
                            <span className="hidden sm:inline">Dashboard</span>
                        </TabsTrigger>
                        <TabsTrigger value="donations" className="flex items-center gap-2">
                            <Heart className="h-4 w-4" />
                            <span className="hidden sm:inline">Donaciones</span>
                        </TabsTrigger>
                        <TabsTrigger value="campaigns" className="flex items-center gap-2">
                            <Eye className="h-4 w-4" />
                            <span className="hidden sm:inline">Campañas</span>
                        </TabsTrigger>
                        <TabsTrigger value="profile" className="flex items-center gap-2">
                            <User className="h-4 w-4" />
                            <span className="hidden sm:inline">Perfil</span>
                        </TabsTrigger>
                        <TabsTrigger value="kyc" className="flex items-center gap-2">
                            <Shield className="h-4 w-4" />
                            <span className="hidden sm:inline">Verificación</span>
                        </TabsTrigger>
                        <TabsTrigger value="withdrawal" className="flex items-center gap-2">
                            <CreditCard className="h-4 w-4" />
                            <span className="hidden sm:inline">Retiros</span>
                        </TabsTrigger>
                    </TabsList>

                    {/* Dashboard Tab */}
                    <TabsContent value="dashboard" className="space-y-6">
                        <div className="grid md:grid-cols-2 gap-6">
                            {/* Recent Donations */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <Heart className="h-5 w-5 text-primary" />
                                        Donaciones recientes
                                    </CardTitle>
                                    <CardDescription>
                                        Tus últimas contribuciones
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {donations && donations.length > 0 ? (
                                        <div className="space-y-4">
                                            {donations.slice(0, 5).map((donation: any) => (
                                                <div key={donation.id} className="flex items-start justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                                                    <div className="flex-1">
                                                        <Link
                                                            href={`/campaigns/${donation.campaigns?.slug || donation.campaign_id}`}
                                                            className="font-medium hover:text-primary line-clamp-1"
                                                        >
                                                            {donation.campaigns?.title || 'Campaña'}
                                                        </Link>
                                                        <p className="text-sm text-muted-foreground">
                                                            {new Date(donation.created_at).toLocaleDateString('es-ES', {
                                                                year: 'numeric',
                                                                month: 'short',
                                                                day: 'numeric'
                                                            })}
                                                        </p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="font-bold text-primary">${donation.amount_usd}</p>
                                                        <Badge variant="outline" className="text-xs">
                                                            {donation.payment_method}
                                                        </Badge>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-center py-8">
                                            <Heart className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                                            <p className="text-muted-foreground">No has realizado donaciones aún</p>
                                            <Button asChild className="mt-4" variant="outline">
                                                <Link href="/campaigns">Explorar campañas</Link>
                                            </Button>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            {/* Account Info */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <Settings className="h-5 w-5" />
                                        Información de cuenta
                                    </CardTitle>
                                    <CardDescription>
                                        Detalles y estado de tu cuenta
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="space-y-3">
                                        <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                                            <span className="text-sm font-medium">Tipo de cuenta</span>
                                            <Badge variant="outline" className="capitalize">
                                                {profile.role === 'donor' ? 'Donante' :
                                                    profile.role === 'creator' ? 'Creador' :
                                                        profile.role === 'guarantor' ? 'Garante' : 'Admin'}
                                            </Badge>
                                        </div>

                                        <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                                            <span className="text-sm font-medium">Estado KYC</span>
                                            <Badge className={getKYCStatusColor(profile.kyc_status)}>
                                                {getKYCStatusText(profile.kyc_status)}
                                            </Badge>
                                        </div>

                                        <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                                            <span className="text-sm font-medium">Miembro desde</span>
                                            <span className="text-sm">
                                                {new Date(profile.created_at).toLocaleDateString('es-ES', {
                                                    year: 'numeric',
                                                    month: 'long'
                                                })}
                                            </span>
                                        </div>

                                        {profile.role !== 'creator' && (
                                            <div className="pt-4 border-t">
                                                <Button asChild className="w-full" variant="outline">
                                                    <Link href="/profile?becomeCreator=true">
                                                        <Plus className="h-4 w-4 mr-2" />
                                                        Convertirse en creador
                                                    </Link>
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Quick Actions */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Acciones rápidas</CardTitle>
                                <CardDescription>
                                    Accesos directos a funciones principales
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4">
                                    <Button asChild variant="outline" className="h-auto py-4 flex-col gap-2">
                                        <Link href="/campaigns">
                                            <Eye className="h-6 w-6" />
                                            <span>Explorar campañas</span>
                                        </Link>
                                    </Button>

                                    {profile.role === 'creator' && profile.kyc_status === 'verified' && (
                                        <Button asChild variant="outline" className="h-auto py-4 flex-col gap-2">
                                            <Link href="/creator/campaigns/create">
                                                <Plus className="h-6 w-6" />
                                                <span>Nueva campaña</span>
                                            </Link>
                                        </Button>
                                    )}

                                    {profile.kyc_status !== 'verified' && (
                                        <Button asChild variant="outline" className="h-auto py-4 flex-col gap-2">
                                            <Link href="/profile?verify=true">
                                                <Shield className="h-6 w-6" />
                                                <span>Verificar identidad</span>
                                            </Link>
                                        </Button>
                                    )}

                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Donations Tab */}
                    <TabsContent value="donations">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Heart className="h-5 w-5 text-primary" />
                                    Mis donaciones
                                </CardTitle>
                                <CardDescription>
                                    Historial completo de tus contribuciones
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                {donations && donations.length > 0 ? (
                                    <div className="space-y-4">
                                        {donations.map((donation: any) => (
                                            <div key={donation.id} className="flex items-start gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                                                {donation.campaigns?.main_image_url && (
                                                    <img
                                                        src={donation.campaigns.main_image_url}
                                                        alt={donation.campaigns.title}
                                                        className="w-20 h-20 rounded-lg object-cover"
                                                    />
                                                )}
                                                <div className="flex-1">
                                                    <Link
                                                        href={`/campaigns/${donation.campaigns?.slug || donation.campaign_id}`}
                                                        className="font-semibold hover:text-primary"
                                                    >
                                                        {donation.campaigns?.title || 'Campaña'}
                                                    </Link>
                                                    <p className="text-sm text-muted-foreground mt-1">
                                                        Donado el {new Date(donation.created_at).toLocaleDateString('es-ES', {
                                                            year: 'numeric',
                                                            month: 'long',
                                                            day: 'numeric',
                                                            hour: '2-digit',
                                                            minute: '2-digit'
                                                        })}
                                                    </p>
                                                    <div className="flex items-center gap-2 mt-2">
                                                        <Badge variant="outline">{donation.payment_method}</Badge>
                                                        <Badge
                                                            variant={donation.status === 'completed' ? 'default' : 'secondary'}
                                                        >
                                                            {donation.status}
                                                        </Badge>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-2xl font-bold text-primary">${donation.amount_usd}</p>
                                                    <p className="text-sm text-muted-foreground">USD</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-12">
                                        <Heart className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                                        <h3 className="text-lg font-semibold mb-2">No has realizado donaciones</h3>
                                        <p className="text-muted-foreground mb-6">
                                            Explora campañas y apoya causas que te importen
                                        </p>
                                        <Button asChild>
                                            <Link href="/campaigns">
                                                Explorar campañas
                                            </Link>
                                        </Button>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Campaigns Tab */}
                    <TabsContent value="campaigns">
                        <Card>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <CardTitle className="flex items-center gap-2">
                                            <Eye className="h-5 w-5" />
                                            Mis campañas
                                        </CardTitle>
                                        <CardDescription>
                                            Campañas que has creado
                                        </CardDescription>
                                    </div>
                                    {profile.role === 'creator' && profile.kyc_status === 'verified' && (
                                        <Button asChild>
                                            <Link href="/creator/campaigns/create">
                                                <Plus className="h-4 w-4 mr-2" />
                                                Nueva campaña
                                            </Link>
                                        </Button>
                                    )}
                                </div>
                            </CardHeader>
                            <CardContent>
                                {campaigns && campaigns.length > 0 ? (
                                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                                        {campaigns.map((campaign: any) => (
                                            <CampaignCard
                                                key={campaign.id}
                                                id={campaign.id}
                                                title={campaign.title}
                                                description={campaign.story}
                                                image={campaign.main_image_url || '/placeholder.svg'}
                                                goalAmount={campaign.goal_amount_usd}
                                                raisedAmount={campaign.current_amount_usd}
                                                category={campaign.categories?.[0]?.name || 'General'}
                                                creator={profile.full_name}
                                                verified={profile.kyc_status === 'verified'}
                                                donorCount={0}
                                            />
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-12">
                                        <TrendingUp className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                                        <h3 className="text-lg font-semibold mb-2">No has creado campañas</h3>
                                        <p className="text-muted-foreground mb-6">
                                            {profile.role === 'creator' && profile.kyc_status === 'verified'
                                                ? 'Crea tu primera campaña y comienza a recaudar fondos'
                                                : 'Necesitas ser creador verificado para crear campañas'
                                            }
                                        </p>
                                        {profile.role === 'creator' && profile.kyc_status === 'verified' ? (
                                            <Button asChild>
                                                <Link href="/creator/campaigns/create">
                                                    <Plus className="h-4 w-4 mr-2" />
                                                    Crear primera campaña
                                                </Link>
                                            </Button>
                                        ) : (
                                            <Button asChild variant="outline">
                                                <Link href="/profile?becomeCreator=true">
                                                    Convertirse en creador
                                                </Link>
                                            </Button>
                                        )}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Profile Tab */}
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

                    {/* KYC Tab */}
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
                                <KYCFormImproved />
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Withdrawal Tab */}
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
                                        'Necesitas ser creador para gestionar cuentas de retiro'
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
                </Tabs>
            </div>
        </div>
    )
}
