import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CampaignBalancePanel } from '@/components/campaign-balance-panel'
import { getBalancesForCampaigns, EMPTY_BALANCES } from '@/lib/balances'
import { getWithdrawalMinimums } from '@/lib/fees'
import { formatUsd } from '@/lib/format'
import {
  PlusCircle,
  Eye,
  Heart,
  DollarSign,
  Clock,
  Edit,
  ExternalLink,
  AlertCircle,
  CheckCircle,
  XCircle,
  Trophy,
  Camera,
  ShieldAlert
} from 'lucide-react'
import Link from 'next/link'

interface Campaign {
  id: string
  title: string
  slug: string
  story: string
  review_notes: string | null
  goal_amount_usd: number
  current_amount_usd: number
  status: 'draft' | 'pending_review' | 'active' | 'closed' | 'completed' | 'rejected'
  campaign_type?: string
  is_open_ended?: boolean
  urgency_level: 'low' | 'medium' | 'high' | 'critical'
  main_image_url: string | null
  location: string | null
  created_at: string
  updated_at: string
  categories: {
    name: string
    icon_emoji: string | null
  } | null
}

export default async function CreatorCampaignsPage() {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect('/auth/login')
  }

  // Get user profile
  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    console.error('Profile error:', profileError)
    redirect('/auth/login')
  }

  // Check if user is verified and can create campaigns
  if (profile.kyc_status !== 'verified') {
    redirect('/profile?verify=true&becomeCreator=true')
  }

  if (profile.role !== 'creator' && profile.role !== 'admin') {
    redirect('/profile?becomeCreator=true')
  }

  // Get user's campaigns with category info
  const { data: campaigns, error: campaignsError } = await supabase
    .from('campaigns')
    .select(`
            *,
            categories (
                name,
                icon_emoji
            )
        `)
    .eq('creator_id', user.id)
    .order('created_at', { ascending: false })

  if (campaignsError) {
    console.error('Campaigns error:', campaignsError)
  }

  const campaignIds = (campaigns || []).map((campaign: Campaign) => campaign.id)

  const { data: withdrawalAccounts } = await supabase
    .from('withdrawal_accounts')
    .select('id, account_type, account_holder_name, is_primary, verified')
    .eq('creator_id', user.id)
    .order('is_primary', { ascending: false })
    .order('created_at', { ascending: false })

  const creatorWithdrawalAccounts = withdrawalAccounts || []
  const hasWithdrawalAccounts = creatorWithdrawalAccounts.length > 0

  // Saldos multi-moneda por campaña (RPC) + mínimos de retiro configurados
  const [balancesByCampaign, withdrawalMinimums] = await Promise.all([
    getBalancesForCampaigns(supabase, campaignIds),
    getWithdrawalMinimums(supabase),
  ])

  // Modo crisis global: si está activo, las campañas crisis no usan saldo ni retiros.
  let crisisEnabled = false
  try {
    const { data: cfg } = await createAdminClient()
      .from('admin_config')
      .select('crisis_mode_enabled')
      .limit(1)
      .maybeSingle()
    crisisEnabled = Boolean(cfg?.crisis_mode_enabled)
  } catch {
    crisisEnabled = false
  }

  // Get campaign statistics
  const stats = {
    total: campaigns?.length || 0,
    active: campaigns?.filter(c => c.status === 'active').length || 0,
    pending: campaigns?.filter(c => c.status === 'pending_review').length || 0,
    totalRaised: campaigns?.reduce((sum, c) => sum + c.current_amount_usd, 0) || 0
  }

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'active': return 'default'
      case 'pending_review': return 'secondary'
      case 'draft': return 'outline'
      case 'completed': return 'outline'
      case 'closed': return 'outline'
      case 'rejected': return 'destructive'
      default: return 'outline'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active': return 'Activa'
      case 'pending_review': return 'En revisión'
      case 'draft': return 'Borrador'
      case 'completed': return 'Finalizada'
      case 'closed': return 'Cerrada'
      case 'rejected': return 'Rechazada'
      default: return status
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <CheckCircle className="h-4 w-4" />
      case 'pending_review': return <Clock className="h-4 w-4" />
      case 'draft': return <Edit className="h-4 w-4" />
      case 'completed': return <Trophy className="h-4 w-4" />
      case 'closed': return <XCircle className="h-4 w-4" />
      case 'rejected': return <AlertCircle className="h-4 w-4" />
      default: return null
    }
  }

  // Escala de urgencia en tokens de marca: emergencia (rojo) → atención
  // (terracota) → neutro → tenue. El texto de la etiqueta ya nombra el nivel,
  // así que el color refuerza pero no es el único indicador.
  const getUrgencyColor = (level: string) => {
    switch (level) {
      case 'critical': return 'bg-destructive text-white'
      case 'high': return 'bg-accent text-accent-foreground'
      case 'medium': return 'bg-secondary text-secondary-foreground'
      case 'low': return 'bg-muted text-muted-foreground'
      default: return 'bg-muted text-muted-foreground'
    }
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <main>
        <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
          {/* Header */}
          <div className="bg-gradient-to-br from-primary/10 to-accent/10 border rounded-xl p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold">Mis campañas</h1>
                <p className="text-muted-foreground">
                  Gestiona y monitorea tus campañas de recaudación
                </p>
              </div>

              <Button asChild size="lg">
                <Link href="/creator/campaigns/create">
                  <PlusCircle className="mr-2 h-5 w-5" />
                  Nueva campaña
                </Link>
              </Button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent>
                <div className="pt-6 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total campañas</p>
                    <p className="text-2xl font-bold">{stats.total}</p>
                  </div>
                  <Heart className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <div className="pt-6 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Activas</p>
                    <p className="text-2xl font-bold text-primary">{stats.active}</p>
                  </div>
                  <CheckCircle className="h-8 w-8 text-primary" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <div className="pt-6 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">En revisión</p>
                    <p className="text-2xl font-bold text-accent">{stats.pending}</p>
                  </div>
                  <Clock className="h-8 w-8 text-accent" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <div className="pt-6 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total recaudado</p>
                    <p className="text-2xl font-bold font-mono text-primary">{formatUsd(stats.totalRaised)}</p>
                  </div>
                  <DollarSign className="h-8 w-8 text-primary" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Campaigns List */}
          {!hasWithdrawalAccounts && (
            <Alert className="border-accent/40 bg-accent/10">
              <AlertCircle className="h-4 w-4 text-accent" />
              <AlertDescription className="text-foreground">
                Aún no tienes cuentas de retiro configuradas. Agrega una en tu perfil para poder enviar solicitudes de retiro.
                {' '}
                <Link href="/profile" className="underline font-medium">Configurar cuentas</Link>
                {' '}o{' '}
                <Link href="/contact" className="underline font-medium">contactar soporte</Link>.
              </AlertDescription>
            </Alert>
          )}

          {campaigns && campaigns.length > 0 ? (
            <div className="space-y-4">
              {campaigns.map((campaign: Campaign) => {
                const progressPercentage = campaign.goal_amount_usd > 0
                  ? (campaign.current_amount_usd / campaign.goal_amount_usd) * 100
                  : 0
                const campaignBalances = balancesByCampaign.get(campaign.id) || { ...EMPTY_BALANCES, campaign_id: campaign.id }
                // Barra visual de retiros: equivalente USD aproximado (Bs convertidos
                // a la tasa de hoy + USD reales). Nunca se suman Bs con USD directo.
                const withdrawnUsdEquivalent = Number(campaignBalances.withdrawn_usd || 0) +
                  (Number(campaignBalances.current_rate) > 0
                    ? Number(campaignBalances.withdrawn_bs || 0) / Number(campaignBalances.current_rate)
                    : 0)
                const withdrawnProgressPercentage = campaign.goal_amount_usd > 0
                  ? (withdrawnUsdEquivalent / campaign.goal_amount_usd) * 100
                  : 0

                return (
                  <Card key={campaign.id} className="overflow-hidden hover:shadow-lg transition-shadow bg-card">
                    <CardContent className="p-0">
                      <div className="flex flex-col md:flex-row md:gap-6">
                        {/* Image */}
                        <div className="relative w-full h-48 md:w-48 md:h-48 bg-muted flex-shrink-0">
                          {campaign.main_image_url ? (
                            <img
                              src={campaign.main_image_url}
                              alt={campaign.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-muted">
                              <Camera className="h-12 w-12 text-muted-foreground" />
                            </div>
                          )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 px-4 py-4 md:py-6 md:pr-6 md:pl-0">
                          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between mb-4">
                            <div className="flex-1">
                              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-2">
                                <h3 className="font-bold text-xl line-clamp-2 flex-1">
                                  {campaign.title}
                                </h3>
                                <div className={`px-2 py-1 rounded-full text-xs ${getUrgencyColor(campaign.urgency_level)}`}>
                                  {campaign.urgency_level === 'critical' && 'Crítico'}
                                  {campaign.urgency_level === 'high' && 'Alto'}
                                  {campaign.urgency_level === 'medium' && 'Medio'}
                                  {campaign.urgency_level === 'low' && 'Bajo'}
                                </div>
                              </div>

                              <div className="flex flex-wrap items-center gap-2 sm:gap-4 mb-3">
                                <Badge variant={getStatusVariant(campaign.status)} className="flex items-center gap-1">
                                  {getStatusIcon(campaign.status)}
                                  {getStatusText(campaign.status)}
                                </Badge>

                                {campaign.categories && (
                                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                    {campaign.categories.icon_emoji && <span>{campaign.categories.icon_emoji}</span>}
                                    <span>{campaign.categories.name}</span>
                                  </div>
                                )}

                                {campaign.location && (
                                  <div className="text-sm text-muted-foreground">
                                    📍 {campaign.location}
                                  </div>
                                )}
                              </div>

                              <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                                {campaign.story}
                              </p>
                            </div>

                            <div className="flex w-full md:w-auto gap-2 md:ml-4">
                              <Button size="sm" variant="outline" className="flex-1 md:flex-none" asChild>
                                <Link href={`/creator/campaigns/${campaign.id}/edit`}>
                                  <Edit className="h-4 w-4 mr-1" />
                                  Editar
                                </Link>
                              </Button>
                              {campaign.campaign_type === 'crisis' && (
                                <Button size="sm" variant="outline" className="flex-1 md:flex-none text-orange-600 hover:text-orange-700" asChild>
                                  <Link href={`/creator/campaigns/${campaign.id}/crisis`}>
                                    <ShieldAlert className="h-4 w-4 mr-1" />
                                    Modo crisis
                                  </Link>
                                </Button>
                              )}
                              {campaign.status === 'active' && (
                                <Button size="sm" variant="outline" className="flex-1 md:flex-none" asChild>
                                  <Link href={`/campaigns/${campaign.id}`} target="_blank">
                                    <ExternalLink className="h-4 w-4 mr-1" />
                                    Ver
                                  </Link>
                                </Button>
                              )}
                              {campaign.status === 'rejected' && (
                                <Button size="sm" variant="outline" className="flex-1 md:flex-none" asChild>
                                  <Link href={`/creator/campaigns/${campaign.id}/edit`}>
                                    <Eye className="h-4 w-4 mr-1" />
                                    Ver estado
                                  </Link>
                                </Button>
                              )}
                            </div>
                          </div>

                          {campaign.status === 'rejected' && (
                            <Alert className="mb-4 border-destructive/30 bg-destructive/10">
                              <AlertCircle className="h-4 w-4 text-destructive" />
                              <AlertDescription className="text-destructive">
                                Esta campaña fue rechazada.
                                {campaign.review_notes
                                  ? ` Motivo: ${campaign.review_notes}`
                                  : ' El equipo de revisión no dejó un motivo detallado en el registro.'}
                                {' '}Para solicitar su reactivación, envía un correo al equipo de soporte con el ID de la campaña y los ajustes realizados desde la sección de contacto.
                              </AlertDescription>
                            </Alert>
                          )}

                          {/* Progress and Stats */}
                          <div className="space-y-4">
                            <div>
                              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-sm mb-2">
                                <span className="font-medium">
                                  <span className="font-mono">{formatUsd(campaign.current_amount_usd)}</span> acumulados
                                </span>
                                <span className="text-muted-foreground">
                                  {campaign.is_open_ended ? 'Sin meta fija' : <>Meta: <span className="font-mono">{formatUsd(campaign.goal_amount_usd)}</span></>}
                                </span>
                              </div>
                              <div className="space-y-1">
                                {!campaign.is_open_ended && (
                                <div className="h-2 rounded-full bg-muted overflow-hidden">
                                  <div
                                    className="h-full bg-primary transition-all"
                                    style={{ width: `${Math.min(progressPercentage, 100)}%` }}
                                  />
                                </div>
                                )}
                                <div className="h-2 rounded-full bg-muted overflow-hidden">
                                  <div
                                    className="h-full bg-accent transition-all"
                                    style={{ width: `${Math.min(withdrawnProgressPercentage, 100)}%` }}
                                  />
                                </div>
                              </div>
                              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-muted-foreground mt-1.5">
                                <div className="flex items-center gap-3">
                                  <span className="flex items-center gap-1.5">
                                    <span className="h-2 w-2 rounded-full bg-primary" aria-hidden="true" />
                                    Recaudado
                                  </span>
                                  <span className="flex items-center gap-1.5">
                                    <span className="h-2 w-2 rounded-full bg-accent" aria-hidden="true" />
                                    Retirado
                                  </span>
                                </div>
                                {!campaign.is_open_ended && <span>{progressPercentage.toFixed(1)}% completado</span>}
                              </div>
                            </div>

                            {/* Saldos por moneda + retiros. Las campañas crisis
                                no usan saldo ni retiros (reciben pago directo). */}
                            {crisisEnabled && campaign.campaign_type === 'crisis' ? (
                              <Alert className="border-orange-200 bg-orange-50/50 dark:bg-orange-950/20 dark:border-orange-800">
                                <ShieldAlert className="h-4 w-4 text-orange-600" />
                                <AlertDescription className="text-sm">
                                  Campaña en modo crisis: las donaciones llegan directo a tus cuentas, así que
                                  no hay saldo en la plataforma ni retiros. Confirma los pagos en{' '}
                                  <Link href={`/creator/campaigns/${campaign.id}/crisis`} className="underline font-medium">Modo crisis</Link>.
                                </AlertDescription>
                              </Alert>
                            ) : (
                              <CampaignBalancePanel
                                campaignId={campaign.id}
                                campaignTitle={campaign.title}
                                balances={campaignBalances}
                                accounts={creatorWithdrawalAccounts}
                                minimums={withdrawalMinimums}
                              />
                            )}

                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-sm text-muted-foreground">
                              <span>
                                Creada el {new Date(campaign.created_at).toLocaleDateString('es-VE')}
                              </span>
                              <span>
                                Actualizada el {new Date(campaign.updated_at).toLocaleDateString('es-VE')}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="max-w-md mx-auto">
                <Camera className="h-16 w-16 text-muted-foreground mx-auto mb-6" />
                <h3 className="text-lg font-medium mb-2">Aún no tienes campañas</h3>
                <p className="text-muted-foreground mb-6">
                  Comienza tu primera campaña de recaudación y comparte tu causa con el mundo.
                </p>
                <Button asChild size="lg">
                  <Link href="/creator/campaigns/create">
                    <PlusCircle className="mr-2 h-5 w-5" />
                    Crear primera campaña
                  </Link>
                </Button>
              </div>
            </div>
          )}

          {/* Education tip for new creators */}
          {campaigns && campaigns.length === 0 && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <div className="space-y-2">
                <div className="font-medium">Consejos para comenzar</div>
                <AlertDescription>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    <li>Sé transparente y honesto en tu historia</li>
                    <li>Incluye imágenes y documentos que respalden tu causa</li>
                    <li>Establece una meta realista y específica</li>
                    <li>Comparte tu campaña en redes sociales</li>
                  </ul>
                </AlertDescription>
              </div>
            </Alert>
          )}
        </div>
      </main>
    </div>
  )
}
