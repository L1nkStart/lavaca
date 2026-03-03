import { redirect } from 'next/navigation'
import Link from "next/link";
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, Users, DollarSign, AlertCircle, Eye, PlusCircle, Clock, FileText, Heart } from 'lucide-react';

type CampaignRow = {
  id: string
  title: string
  status: string
  current_amount_usd: number
  goal_amount_usd: number
  donor_count: number | null
  view_count: number | null
  created_at: string
  updated_at: string
}

type DonationAggregateRow = {
  id: string
  campaign_id: string
  donor_id: string | null
  email: string | null
  is_anonymous: boolean
}

type ViewAggregateRow = {
  campaign_id: string
}

export default async function CreatorDashboard() {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect('/auth/login')
  }

  const { data: profile } = await supabase
    .from('users')
    .select('kyc_status')
    .eq('id', user.id)
    .maybeSingle()

  const { data: allCampaignsRaw } = await supabase
    .from('campaigns')
    .select('id, title, status, current_amount_usd, goal_amount_usd, donor_count, view_count, created_at, updated_at')
    .eq('creator_id', user.id)
    .order('created_at', { ascending: false })

  const allCampaigns = (allCampaignsRaw || []) as CampaignRow[]
  const recentCampaigns = allCampaigns.slice(0, 5)

  const campaignIds = allCampaigns.map(campaign => campaign.id)

  const { data: donationAggregateRows } = campaignIds.length > 0
    ? await supabase
      .from('donations')
      .select('id, campaign_id, donor_id, email, is_anonymous')
      .in('campaign_id', campaignIds)
      .eq('payment_status', 'completed')
    : { data: [] as DonationAggregateRow[] }

  const donorCountByCampaign = new Map<string, number>()
  const donorIdentitiesByCampaign = new Map<string, Set<string>>()

  for (const donation of (donationAggregateRows || []) as DonationAggregateRow[]) {
    const campaignId = donation.campaign_id

    if (donation.is_anonymous) {
      donorCountByCampaign.set(campaignId, (donorCountByCampaign.get(campaignId) || 0) + 1)
      continue
    }

    const identity = donation.donor_id || donation.email || donation.id

    if (!donorIdentitiesByCampaign.has(campaignId)) {
      donorIdentitiesByCampaign.set(campaignId, new Set<string>())
    }

    donorIdentitiesByCampaign.get(campaignId)!.add(identity)
  }

  for (const [campaignId, identities] of donorIdentitiesByCampaign.entries()) {
    donorCountByCampaign.set(campaignId, (donorCountByCampaign.get(campaignId) || 0) + identities.size)
  }

  const { data: viewRows, error: viewRowsError } = campaignIds.length > 0
    ? await supabase
      .from('campaign_views')
      .select('campaign_id')
      .in('campaign_id', campaignIds)
    : { data: [] as ViewAggregateRow[], error: null }

  const viewCountByCampaign = new Map<string, number>()

  if (!viewRowsError) {
    for (const row of (viewRows || []) as ViewAggregateRow[]) {
      viewCountByCampaign.set(row.campaign_id, (viewCountByCampaign.get(row.campaign_id) || 0) + 1)
    }
  }

  const totalRaised = allCampaigns.reduce((sum, campaign) => sum + (campaign.current_amount_usd || 0), 0)
  const totalCampaigns = allCampaigns.length
  const activeCampaigns = allCampaigns.filter(campaign => campaign.status === 'active').length
  const totalDonors = allCampaigns.reduce((sum, campaign) => {
    const donorsFromDonations = donorCountByCampaign.get(campaign.id)
    return sum + (donorsFromDonations ?? campaign.donor_count ?? 0)
  }, 0)

  const { data: recentDonations } = campaignIds.length > 0
    ? await supabase
      .from('donations')
      .select(`
          id,
          amount_usd,
          donor_name,
          is_anonymous,
          payment_method,
          created_at,
          campaigns (
            title
          )
        `)
      .in('campaign_id', campaignIds)
      .eq('payment_status', 'completed')
      .order('created_at', { ascending: false })
      .limit(8)
    : { data: [] as any[] }

  const verificationStatus = profile?.kyc_status || 'pending'
  const profileVerified = verificationStatus === 'verified'
  const canCreateCampaign = profileVerified

  const getCampaignDonorCount = (campaign: CampaignRow) => {
    return donorCountByCampaign.get(campaign.id) ?? campaign.donor_count ?? 0
  }

  const getCampaignViewCount = (campaign: CampaignRow) => {
    if (!viewRowsError) {
      return viewCountByCampaign.get(campaign.id) ?? 0
    }

    return campaign.view_count ?? 0
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge>En recaudación</Badge>
      case 'pending_review':
        return <Badge variant="secondary">En revisión</Badge>
      case 'completed':
      case 'closed':
        return <Badge variant="secondary">Finalizada</Badge>
      case 'rejected':
        return <Badge variant="destructive">Rechazada</Badge>
      default:
        return <Badge variant="outline">Borrador</Badge>
    }
  }

  const formatPaymentMethod = (paymentMethod: string) => {
    switch (paymentMethod) {
      case 'card': return 'Tarjeta'
      case 'paypal': return 'PayPal'
      case 'pagomovil': return 'PagoMóvil'
      case 'zelle': return 'Zelle'
      case 'transfer': return 'Transferencia'
      case 'crypto': return 'Cripto'
      default: return paymentMethod
    }
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <main>
        <div className="bg-gradient-to-br from-primary/10 to-accent/10 border-b">
          <div className="max-w-7xl mx-auto px-4 py-8">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold">Panel de Control</h1>
                <p className="text-muted-foreground mt-1">
                  Revisa tus métricas, campañas y donaciones recientes.
                </p>
              </div>
              {canCreateCampaign ? (
                <Button asChild>
                  <Link href="/creator/campaigns/create">
                    <PlusCircle className="w-4 h-4 mr-2" />
                    Nueva campaña
                  </Link>
                </Button>
              ) : (
                <Button
                  disabled
                  variant="outline"
                  className="text-muted-foreground border-muted-foreground/30"
                >
                  <PlusCircle className="w-4 h-4 mr-2" />
                  Nueva campaña
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
          {/* Status Cards */}
          {!profileVerified && (
            <Card className="border-yellow-200 bg-yellow-50 dark:bg-yellow-950 dark:border-yellow-800">
              <CardContent className="pt-6 flex items-start gap-4">
                <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-yellow-900 dark:text-yellow-100">
                    Verifica tu identidad
                  </h3>
                  <p className="text-sm text-yellow-800 dark:text-yellow-200 mt-1">
                    Completa tu perfil y verifica tu identidad para crear campañas.
                  </p>
                  <Button size="sm" className="mt-3" asChild>
                    <Link href="/profile">Completar ahora</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent>
                <div className="pt-6 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total recaudado</p>
                    <p className="text-2xl font-bold">${totalRaised.toFixed(2)}</p>
                  </div>
                  <DollarSign className="h-8 w-8 text-primary" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <div className="pt-6 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Mis campañas</p>
                    <p className="text-2xl font-bold">{totalCampaigns}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {activeCampaigns} activa{activeCampaigns === 1 ? '' : 's'}
                    </p>
                  </div>
                  <FileText className="h-8 w-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <div className="pt-6 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Donantes</p>
                    <p className="text-2xl font-bold">{totalDonors}</p>
                  </div>
                  <Heart className="h-8 w-8 text-green-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <div className="pt-6 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Verificación</p>
                    <Badge className="bg-primary mt-1">
                      {verificationStatus === "verified"
                        ? "Verificado"
                        : "Pendiente"}
                    </Badge>
                  </div>
                  <TrendingUp className="h-8 w-8 text-purple-500" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Campaigns Section */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Mis Campañas</h2>
              <Button size="sm" variant="outline" asChild>
                <Link href="/creator/campaigns/create">
                  <PlusCircle className="w-4 h-4 mr-2" />
                  Nueva campaña
                </Link>
              </Button>
            </div>

            <div className="grid gap-4">
              {recentCampaigns.length === 0 ? (
                <Card>
                  <CardContent className="py-10 text-center text-muted-foreground">
                    Aún no tienes campañas creadas.
                  </CardContent>
                </Card>
              ) : recentCampaigns.map((campaign) => (
                <Card key={campaign.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h3 className="font-semibold line-clamp-2">
                          {campaign.title}
                        </h3>
                        <div className="flex items-center gap-2 mt-2">
                          {getStatusBadge(campaign.status)}
                          {campaign.status === "active" && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              Activa
                            </span>
                          )}
                        </div>
                      </div>
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/creator/campaigns/${campaign.id}/edit`}>
                          Editar
                        </Link>
                      </Button>
                    </div>

                    <div className="space-y-3">
                      {/* Progress */}
                      <div>
                        <div className="flex justify-between text-sm mb-2">
                          <span className="font-semibold text-primary">
                            ${campaign.current_amount_usd.toFixed(2)}
                          </span>
                          <span className="text-muted-foreground">
                            de ${campaign.goal_amount_usd.toFixed(2)}
                          </span>
                        </div>
                        <Progress
                          value={campaign.goal_amount_usd > 0 ? (campaign.current_amount_usd / campaign.goal_amount_usd) * 100 : 0}
                          className="h-2"
                        />
                      </div>

                      {/* Stats */}
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground text-xs">Donantes</p>
                          <p className="font-semibold">{getCampaignDonorCount(campaign)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-xs">Vistas</p>
                          <p className="font-semibold flex items-center gap-1">
                            <Eye className="w-4 h-4" />
                            {getCampaignViewCount(campaign)}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-xs">Progreso</p>
                          <p className="font-semibold">
                            {campaign.goal_amount_usd > 0
                              ? `${Math.round((campaign.current_amount_usd / campaign.goal_amount_usd) * 100)}%`
                              : '0%'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Recent Donations */}
          <div>
            <h2 className="text-xl font-bold mb-4">Donaciones Recientes</h2>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Últimos aportes recibidos</CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  {(recentDonations || []).length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">
                      Aún no tienes donaciones completadas.
                    </p>
                  ) : (recentDonations || []).map((donation: any) => (
                    <div
                      key={donation.id}
                      className="flex items-center justify-between py-3 border-b border-border last:border-0"
                    >
                      <div className="flex-1">
                        <p className="font-medium text-sm">{donation.is_anonymous ? 'Donante anónimo' : (donation.donor_name || 'Donante')}</p>
                        <p className="text-xs text-muted-foreground">
                          {donation.campaigns?.title || 'Campaña'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-primary">
                          ${Number(donation.amount_usd || 0).toFixed(2)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(donation.created_at).toLocaleDateString("es-VE", {
                            month: "short",
                            day: "numeric",
                          })}{" "}
                          • {formatPaymentMethod(donation.payment_method)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
