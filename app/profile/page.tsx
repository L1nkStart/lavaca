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
import { Shield, User, CreditCard, Info, Heart, TrendingUp, DollarSign, Settings, LogOut, Plus, Eye } from 'lucide-react'
import Link from 'next/link'
import { CampaignCard } from '@/components/campaign-card'
import { formatUsd, formatBs } from '@/lib/format'

const ROLE_LABELS: Record<string, string> = {
    donor: 'Donante',
    creator: 'Creador',
    guarantor: 'Garante',
    admin: 'Admin',
}
const roleLabel = (role: string) => ROLE_LABELS[role] ?? 'Admin'

const PAYMENT_METHOD_LABELS: Record<string, string> = {
    card: 'Tarjeta',
    paypal: 'PayPal',
    pagomovil: 'PagoMóvil',
    zelle: 'Zelle',
    transfer: 'Transferencia',
    crypto: 'Cripto',
}
const paymentMethodLabel = (method: string) => PAYMENT_METHOD_LABELS[method] ?? method

// Monto de una donación en su moneda original (Bs si aplica, USD si no).
const donationAmountLabel = (donation: { currency?: string | null; amount_bs?: number | null; amount_usd?: number | null }) =>
    donation.currency === 'BS' && donation.amount_bs != null
        ? formatBs(Number(donation.amount_bs))
        : formatUsd(Number(donation.amount_usd || 0))

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
            is_open_ended,
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
    // Solo donaciones completadas (las pendientes/rechazadas no cuentan)
    const totalDonated = donations
        ?.filter((d) => d.payment_status === 'completed')
        .reduce((sum, d) => sum + (d.amount_usd || 0), 0) || 0
    const totalCampaigns = campaigns?.length || 0
    const totalRaised = campaigns?.reduce((sum, c) => sum + (c.current_amount_usd || 0), 0) || 0
    const donationsCount = donations?.length || 0

    // Estado KYC en tokens de marca: verificado = Verde Confianza (primary),
    // la única señal de "verificado" del producto; rechazado = destructive;
    // pendiente = terracota (atención); sin verificar = neutro.
    const getKYCStatusColor = (status: string) => {
        switch (status) {
            case 'verified': return 'bg-primary text-primary-foreground'
            case 'rejected': return 'bg-destructive text-white'
            case 'pending': return 'bg-accent text-accent-foreground'
            default: return 'bg-muted text-muted-foreground'
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
    const isCreatorOrAdmin = profile.role === 'creator' || profile.role === 'admin'
    const canCreateCampaign = isCreatorOrAdmin && profile.kyc_status === 'verified'

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
                                            {roleLabel(profile.role)}
                                        </Badge>
                                        <Badge className={getKYCStatusColor(profile.kyc_status)}>
                                            <Shield className="h-3 w-3 mr-1" />
                                            {getKYCStatusText(profile.kyc_status)}
                                        </Badge>
                                    </div>
                                </div>

                                <div className="flex gap-2">
                                    {isCreatorOrAdmin && (
                                        canCreateCampaign ? (
                                            <Button asChild>
                                                <Link href="/creator/campaigns/create">
                                                    <Plus className="h-4 w-4 mr-2" />
                                                    Crear campaña
                                                </Link>
                                            </Button>
                                        ) : (
                                            <Button disabled variant="outline" className="text-muted-foreground border-muted-foreground/30">
                                                <Plus className="h-4 w-4 mr-2" />
                                                Crear campaña
                                            </Button>
                                        )
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

                    {/* Stats Cards: las métricas de creador solo aplican a creadores. */}
                    <div className={`grid grid-cols-2 gap-4 mt-8 ${isCreatorOrAdmin ? 'md:grid-cols-4' : 'md:grid-cols-2'}`}>
                        <Card>
                            <CardContent className="pt-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-muted-foreground">Total donado</p>
                                        <p className="text-2xl font-bold font-mono text-primary">{formatUsd(totalDonated)}</p>
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
                                    <Heart className="h-8 w-8 text-muted-foreground" />
                                </div>
                            </CardContent>
                        </Card>

                        {isCreatorOrAdmin && (
                            <>
                                <Card>
                                    <CardContent className="pt-6">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-sm text-muted-foreground">Campañas</p>
                                                <p className="text-2xl font-bold">{totalCampaigns}</p>
                                            </div>
                                            <TrendingUp className="h-8 w-8 text-muted-foreground" />
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardContent className="pt-6">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-sm text-muted-foreground">Recaudado</p>
                                                <p className="text-2xl font-bold font-mono text-primary">{formatUsd(totalRaised)}</p>
                                            </div>
                                            <DollarSign className="h-8 w-8 text-primary" />
                                        </div>
                                    </CardContent>
                                </Card>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-7xl mx-auto px-4 py-8">
                {/* Alerts */}
                {showVerificationAlert && (
                    <Alert className="mb-6 border-destructive/30 bg-destructive/10 text-destructive">
                        <Info className="h-4 w-4 text-destructive" />
                        <AlertDescription>
                            Necesitas verificar tu identidad para acceder a esta función.
                            Ve a la pestaña "Verificación", completa el formulario de identidad (KYC) y envía tus documentos.
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
                    <TabsList className="grid w-full grid-cols-3 sm:grid-cols-6 h-auto mb-8">
                        <TabsTrigger value="dashboard" aria-label="Inicio" className="flex items-center gap-2">
                            <TrendingUp className="h-4 w-4 shrink-0" />
                            <span>Inicio</span>
                        </TabsTrigger>
                        <TabsTrigger value="donations" aria-label="Donaciones" className="flex items-center gap-2">
                            <Heart className="h-4 w-4 shrink-0" />
                            <span>Donaciones</span>
                        </TabsTrigger>
                        <TabsTrigger value="campaigns" aria-label="Campañas" className="flex items-center gap-2">
                            <Eye className="h-4 w-4 shrink-0" />
                            <span>Campañas</span>
                        </TabsTrigger>
                        <TabsTrigger value="profile" aria-label="Perfil" className="flex items-center gap-2">
                            <User className="h-4 w-4 shrink-0" />
                            <span>Perfil</span>
                        </TabsTrigger>
                        <TabsTrigger value="kyc" aria-label="Verificación de identidad" className="flex items-center gap-2">
                            <Shield className="h-4 w-4 shrink-0" />
                            <span>KYC</span>
                        </TabsTrigger>
                        <TabsTrigger value="withdrawal" aria-label="Retiros" className="flex items-center gap-2">
                            <CreditCard className="h-4 w-4 shrink-0" />
                            <span>Retiros</span>
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
                                                        <p className="font-bold text-primary font-mono">
                                                            {donationAmountLabel(donation)}
                                                        </p>
                                                        <Badge variant="outline" className="text-xs">
                                                            {paymentMethodLabel(donation.payment_method)}
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
                                                {roleLabel(profile.role)}
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

                                    {isCreatorOrAdmin && (
                                        canCreateCampaign ? (
                                            <Button asChild variant="outline" className="h-auto py-4 flex-col gap-2">
                                                <Link href="/creator/campaigns/create">
                                                    <Plus className="h-6 w-6" />
                                                    <span>Nueva campaña</span>
                                                </Link>
                                            </Button>
                                        ) : (
                                            <Button disabled variant="outline" className="h-auto py-4 flex-col gap-2 text-muted-foreground border-muted-foreground/30">
                                                <Plus className="h-6 w-6" />
                                                <span>Nueva campaña</span>
                                            </Button>
                                        )
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
                                                        <Badge variant="outline">{paymentMethodLabel(donation.payment_method)}</Badge>
                                                        <Badge
                                                            variant={donation.payment_status === 'completed' ? 'default' : 'secondary'}
                                                        >
                                                            {donation.payment_status === 'completed'
                                                                ? 'Completada'
                                                                : donation.payment_status === 'pending'
                                                                    ? 'En revisión'
                                                                    : donation.payment_status === 'failed'
                                                                        ? 'Rechazada'
                                                                        : donation.payment_status}
                                                        </Badge>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    {donation.currency === 'BS' && donation.amount_bs != null ? (
                                                        <>
                                                            <p className="text-2xl font-bold text-primary font-mono">
                                                                {formatBs(Number(donation.amount_bs))}
                                                            </p>
                                                            <p className="text-sm text-muted-foreground font-mono">≈ {formatUsd(Number(donation.amount_usd || 0))} USD</p>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <p className="text-2xl font-bold text-primary font-mono">{formatUsd(Number(donation.amount_usd || 0))}</p>
                                                            <p className="text-sm text-muted-foreground">USD</p>
                                                        </>
                                                    )}
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
                                    {isCreatorOrAdmin && (
                                        canCreateCampaign ? (
                                            <Button asChild>
                                                <Link href="/creator/campaigns/create">
                                                    <Plus className="h-4 w-4 mr-2" />
                                                    Nueva campaña
                                                </Link>
                                            </Button>
                                        ) : (
                                            <Button disabled variant="outline" className="text-muted-foreground border-muted-foreground/30">
                                                <Plus className="h-4 w-4 mr-2" />
                                                Nueva campaña
                                            </Button>
                                        )
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
                                                openEnded={Boolean((campaign as any).is_open_ended)}
                                                category={(Array.isArray(campaign.categories) ? campaign.categories[0]?.name : campaign.categories?.name) || 'General'}
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
                                        {isCreatorOrAdmin ? (
                                            canCreateCampaign ? (
                                                <Button asChild>
                                                    <Link href="/creator/campaigns/create">
                                                        <Plus className="h-4 w-4 mr-2" />
                                                        Crear primera campaña
                                                    </Link>
                                                </Button>
                                            ) : (
                                                <Button disabled variant="outline" className="text-muted-foreground border-muted-foreground/30">
                                                    <Plus className="h-4 w-4 mr-2" />
                                                    Crear primera campaña
                                                </Button>
                                            )
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
                                <CardTitle>Información personal</CardTitle>
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
                                    Verificación de identidad (KYC)
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
                                    Cuentas de retiro
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
