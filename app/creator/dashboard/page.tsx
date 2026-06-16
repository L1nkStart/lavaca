import { redirect } from 'next/navigation'
import Link from "next/link";
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, Users, DollarSign, AlertCircle, Eye, PlusCircle, Clock, FileText, Heart, Wallet, Banknote, TrendingDown } from 'lucide-react';
import { getBalancesForCampaigns } from '@/lib/balances';
import { formatBs, formatUsd } from '@/lib/format';
import { ExchangeRateChart } from '@/components/exchange-rate-chart';

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

  // Saldos multi-moneda consolidados (informativo; el retiro es por campaña)
  const balancesByCampaign = await getBalancesForCampaigns(supabase, campaignIds)
  let consolidatedBs = 0
  let consolidatedUsd = 0
  let consolidatedFxLoss = 0
  for (const balances of balancesByCampaign.values()) {
    consolidatedBs += Number(balances.saldo_bs || 0)
    consolidatedUsd += Number(balances.saldo_usd || 0)
    consolidatedFxLoss += Number(balances.fx_loss_total || 0)
  }

  // Historial de la tasa Bs/USD (últimos 30 días) para la gráfica
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const { data: rateHistory } = await supabase
    .from('exchange_rates')
    .select('rate, created_at')
    .gte('created_at', thirtyDaysAgo)
    .order('created_at', { ascending: true })
    .limit(500)

  // Una muestra por día (la última de cada día) para que la gráfica sea legible
  const ratePointsByDay = new Map<string, number>()
  for (const row of rateHistory || []) {
    const day = new Date(row.created_at).toLocaleDateString('es-VE', { day: '2-digit', month: 'short' })
    ratePointsByDay.set(day, Number(row.rate))
  }
  const ratePoints = Array.from(ratePointsByDay.entries()).map(([date, rate]) => ({ date, rate }))

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
          amount_bs,
          currency,
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

  const formatWithdrawalAccountType = (type: string) => {
    switch (type) {
      case 'bank_bs': return 'Cuenta Bancaria (Bs.)'
      case 'pagomovil': return 'PagoMóvil'
      case 'zelle': return 'Zelle'
      case 'paypal': return 'PayPal'
      case 'crypto': return 'Criptomoneda'
      default: return type
    }
  }

  const getWithdrawalStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary">Pendiente</Badge>
      case 'processed':
        return <Badge>Procesado</Badge>
      case 'failed':
        return <Badge variant="destructive">Fallido</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const { data: withdrawalRequests } = await supabase
    .from('withdrawal_requests')
    .select(`
      id,
      amount_usd,
      amount_bs,
      currency,
      platform_fee,
      gateway_fee,
      net_amount,
      fx_loss_usd,
      status,
      exchange_rate_used,
      reference_number,
      rejection_reason,
      created_at,
      processed_at,
      campaigns (
        title
      ),
      withdrawal_accounts (
        account_type,
        account_holder_name
      )
    `)
    .eq('creator_id', user.id)
    .order('created_at', { ascending: false })
    .limit(8)

  return (
    <div className="min-h-screen bg-muted/30">
      <main>
        <div className="bg-gradient-to-br from-primary/10 to-accent/10 border-b">
          <div className="max-w-7xl mx-auto px-4 py-8">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold">Panel de control</h1>
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
            <Card className="border-accent/40 bg-accent/10">
              <CardContent className="pt-6 flex items-start gap-4">
                <AlertCircle className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-foreground">
                    Verifica tu identidad
                  </h3>
                  <p className="text-sm text-foreground mt-1">
                    Completa tu perfil y verifica tu identidad para crear campañas.
                  </p>
                  <Button size="sm" className="mt-3" asChild>
                    <Link href="/profile">Completar ahora</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Resumen: una sola tira con divisores de 1px (plano en reposo),
              en vez de cuatro tarjetas elevadas compitiendo por atención. */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-border rounded-xl overflow-hidden border">
            <div className="bg-card p-5 flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-muted-foreground">Total recaudado</p>
                <p className="text-2xl font-bold font-mono text-primary">{formatUsd(totalRaised)}</p>
              </div>
              <DollarSign className="h-7 w-7 text-primary shrink-0" />
            </div>

            <div className="bg-card p-5 flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-muted-foreground">Mis campañas</p>
                <p className="text-2xl font-bold">{totalCampaigns}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {activeCampaigns} activa{activeCampaigns === 1 ? '' : 's'}
                </p>
              </div>
              <FileText className="h-7 w-7 text-muted-foreground shrink-0" />
            </div>

            <div className="bg-card p-5 flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-muted-foreground">Donantes</p>
                <p className="text-2xl font-bold">{totalDonors}</p>
              </div>
              <Heart className="h-7 w-7 text-muted-foreground shrink-0" />
            </div>

            <div className="bg-card p-5 flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-muted-foreground">Verificación</p>
                {profileVerified ? (
                  <Badge className="mt-1">Verificado</Badge>
                ) : (
                  <Badge variant="secondary" className="mt-1">Pendiente</Badge>
                )}
              </div>
              <TrendingUp className="h-7 w-7 text-muted-foreground shrink-0" />
            </div>
          </div>

          {/* Saldos consolidados por moneda */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Saldos disponibles</h2>
              <Button size="sm" variant="outline" asChild>
                <Link href="/creator/campaigns">Gestionar retiros</Link>
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card>
                <CardContent>
                  <div className="pt-6 flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Saldo en Bolívares</p>
                      <p className="text-2xl font-bold font-mono">{formatBs(consolidatedBs)}</p>
                      <p className="text-xs text-muted-foreground mt-1">Suma de todas tus campañas</p>
                    </div>
                    <Banknote className="h-8 w-8 text-primary" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent>
                  <div className="pt-6 flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Saldo en Dólares</p>
                      <p className="text-2xl font-bold font-mono">{formatUsd(consolidatedUsd)}</p>
                      <p className="text-xs text-muted-foreground mt-1">Zelle, tarjeta, PayPal y cripto</p>
                    </div>
                    <DollarSign className="h-8 w-8 text-primary" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent>
                  <div className="pt-6 flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Pérdida cambiaria</p>
                      <p className={`text-2xl font-bold font-mono ${consolidatedFxLoss > 0.005 ? 'text-destructive' : ''}`}>
                        {consolidatedFxLoss > 0.005 ? `−${formatUsd(consolidatedFxLoss)}` : formatUsd(0)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Valor perdido por variación de la tasa en tus bolívares
                      </p>
                    </div>
                    <TrendingDown className="h-8 w-8 text-destructive/70" />
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Evolución de la tasa (P5) */}
          {ratePoints.length >= 2 && (
            <ExchangeRateChart points={ratePoints} fxLossTotal={consolidatedFxLoss} />
          )}

          {/* Campaigns Section */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Mis campañas</h2>
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
                    {(() => {
                      // Saldos por moneda del RPC: nunca se suman Bs con USD.
                      const campaignBalances = balancesByCampaign.get(campaign.id)
                      const withdrawnBs = Number(campaignBalances?.withdrawn_bs || 0)
                      const withdrawnUsd = Number(campaignBalances?.withdrawn_usd || 0)
                      const saldoBs = Number(campaignBalances?.saldo_bs || 0)
                      const saldoUsd = Number(campaignBalances?.saldo_usd || 0)
                      const currentRate = Number(campaignBalances?.current_rate || 0)
                      // Solo para la barra visual: equivalente USD aproximado del retiro total
                      const withdrawnUsdEquivalent = withdrawnUsd + (currentRate > 0 ? withdrawnBs / currentRate : 0)
                      const totalProgress = campaign.goal_amount_usd > 0
                        ? (campaign.current_amount_usd / campaign.goal_amount_usd) * 100
                        : 0
                      const withdrawnProgress = campaign.goal_amount_usd > 0
                        ? (withdrawnUsdEquivalent / campaign.goal_amount_usd) * 100
                        : 0

                      return (
                        <>
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
                                <span className="font-semibold text-primary font-mono">
                                  {formatUsd(campaign.current_amount_usd)} <span className="font-sans font-normal text-muted-foreground">acumulados</span>
                                </span>
                                <span className="text-muted-foreground">
                                  de <span className="font-mono">{formatUsd(campaign.goal_amount_usd)}</span>
                                </span>
                              </div>
                              <div className="space-y-1">
                                <div className="h-2 rounded-full bg-muted overflow-hidden">
                                  <div
                                    className="h-full bg-primary transition-all"
                                    style={{ width: `${Math.min(totalProgress, 100)}%` }}
                                  />
                                </div>
                                <div className="h-2 rounded-full bg-muted overflow-hidden">
                                  <div
                                    className="h-full bg-accent transition-all"
                                    style={{ width: `${Math.min(withdrawnProgress, 100)}%` }}
                                  />
                                </div>
                              </div>
                              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1.5">
                                <span className="flex items-center gap-1.5">
                                  <span className="h-2 w-2 rounded-full bg-primary" aria-hidden="true" />
                                  Recaudado
                                </span>
                                <span className="flex items-center gap-1.5">
                                  <span className="h-2 w-2 rounded-full bg-accent" aria-hidden="true" />
                                  Retirado
                                </span>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2 text-xs">
                                <div className="rounded-md border bg-muted/20 px-2 py-1">
                                  <span className="text-muted-foreground">Total:</span> <span className="font-mono">{formatUsd(campaign.current_amount_usd || 0)}</span>
                                </div>
                                <div className="rounded-md border bg-accent/10 px-2 py-1">
                                  <span className="text-muted-foreground">Retirado:</span>{' '}
                                  <span className="font-mono">
                                    {withdrawnBs <= 0 && withdrawnUsd <= 0
                                      ? formatUsd(0)
                                      : [
                                        withdrawnUsd > 0 ? formatUsd(withdrawnUsd) : null,
                                        withdrawnBs > 0 ? formatBs(withdrawnBs) : null,
                                      ].filter(Boolean).join(' + ')}
                                  </span>
                                </div>
                                <div className="rounded-md border bg-primary/5 px-2 py-1">
                                  <span className="text-muted-foreground">Disponible:</span>{' '}
                                  <span className="font-mono">
                                    {saldoBs <= 0 && saldoUsd <= 0
                                      ? formatUsd(0)
                                      : [
                                        saldoUsd > 0 ? formatUsd(saldoUsd) : null,
                                        saldoBs > 0 ? formatBs(saldoBs) : null,
                                      ].filter(Boolean).join(' + ')}
                                  </span>
                                </div>
                              </div>
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
                                    ? `${Math.round(totalProgress)}%`
                                    : '0%'}
                                </p>
                              </div>
                            </div>
                          </div>
                        </>
                      )
                    })()}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Recent Donations */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Mis solicitudes de retiro</h2>
              <Button size="sm" variant="outline" asChild>
                <Link href="/contact">Soporte de retiros</Link>
              </Button>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Últimas solicitudes enviadas</CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  {(withdrawalRequests || []).length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">
                      Aún no has enviado solicitudes de retiro.
                    </p>
                  ) : (withdrawalRequests || []).map((request: any) => {
                    const isBs = request.currency === 'BS'
                    const grossLabel = isBs
                      ? formatBs(Number(request.amount_bs || 0))
                      : formatUsd(Number(request.amount_usd || 0))
                    const netLabel = request.net_amount != null
                      ? (isBs ? formatBs(Number(request.net_amount)) : formatUsd(Number(request.net_amount)))
                      : null

                    // Timeline simple: Solicitado -> En revisión -> Procesado / Rechazado
                    const timelineSteps = request.status === 'failed'
                      ? ['Solicitado', 'En revisión', 'Rechazado']
                      : ['Solicitado', 'En revisión', 'Procesado']
                    const currentStepIndex = request.status === 'pending' ? 1 : 2
                    const isFailed = request.status === 'failed'

                    return (
                      <div
                        key={request.id}
                        className="py-3 border-b border-border last:border-0 space-y-2"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <p className="font-medium text-sm flex items-center gap-2">
                              <Wallet className="w-4 h-4 text-primary" />
                              {grossLabel}
                              <Badge variant="outline" className="text-[10px]">{isBs ? 'Bs' : 'USD'}</Badge>
                            </p>
                            {netLabel && Number(request.net_amount) !== Number(isBs ? request.amount_bs : request.amount_usd) && (
                              <p className="text-xs text-muted-foreground">
                                Neto a recibir: <strong>{netLabel}</strong>
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground mt-1">
                              Campaña: {request.campaigns?.title || 'Campaña'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Destino: {formatWithdrawalAccountType(request.withdrawal_accounts?.account_type || 'cuenta')} • {request.withdrawal_accounts?.account_holder_name || 'Sin titular'}
                            </p>
                          </div>
                          <div className="text-right space-y-1">
                            {getWithdrawalStatusBadge(request.status)}
                            <p className="text-xs text-muted-foreground">
                              {new Date(request.created_at).toLocaleDateString('es-VE')}
                            </p>
                          </div>
                        </div>

                        {/* Timeline de estado */}
                        <div className="flex items-center gap-1">
                          {timelineSteps.map((stepLabel, index) => (
                            <div key={stepLabel} className="flex items-center gap-1 flex-1 last:flex-none">
                              <div className="flex items-center gap-1.5">
                                <span
                                  className={`h-2.5 w-2.5 rounded-full shrink-0 ${index <= currentStepIndex
                                    ? isFailed && index === 2
                                      ? 'bg-destructive'
                                      : 'bg-primary'
                                    : 'bg-muted-foreground/30'
                                    }`}
                                />
                                <span
                                  className={`text-[11px] ${index <= currentStepIndex
                                    ? isFailed && index === 2
                                      ? 'text-destructive font-medium'
                                      : 'text-foreground font-medium'
                                    : 'text-muted-foreground'
                                    }`}
                                >
                                  {stepLabel}
                                </span>
                              </div>
                              {index < timelineSteps.length - 1 && (
                                <span className={`h-px flex-1 ${index < currentStepIndex ? 'bg-primary/50' : 'bg-border'}`} />
                              )}
                            </div>
                          ))}
                        </div>

                        {(request.status === 'processed' || request.status === 'failed') && (
                          <div className="rounded-md border bg-muted/20 px-3 py-2 space-y-1">
                            {(Number(request.platform_fee) > 0 || Number(request.gateway_fee) > 0) && (
                              <p className="text-xs text-muted-foreground">
                                Comisión LaVaca: {isBs ? formatBs(Number(request.platform_fee || 0)) : formatUsd(Number(request.platform_fee || 0))}
                                {Number(request.gateway_fee) > 0 && (
                                  <> • Fee de pasarela: {isBs ? formatBs(Number(request.gateway_fee || 0)) : formatUsd(Number(request.gateway_fee || 0))}</>
                                )}
                              </p>
                            )}
                            {isBs && request.exchange_rate_used && (
                              <p className="text-xs text-muted-foreground">
                                Tasa usada: {Number(request.exchange_rate_used).toFixed(2)} Bs/USD
                              </p>
                            )}
                            {isBs && Number(request.fx_loss_usd) > 0 && (
                              <p className="text-xs text-destructive">
                                Pérdida cambiaria congelada: −{formatUsd(Number(request.fx_loss_usd))}
                              </p>
                            )}
                            {request.reference_number && (
                              <p className="text-xs text-muted-foreground">
                                Referencia: {request.reference_number}
                              </p>
                            )}
                            {request.processed_at && (
                              <p className="text-xs text-muted-foreground">
                                Procesado: {new Date(request.processed_at).toLocaleString('es-VE')}
                              </p>
                            )}
                            {request.status === 'processed' && (
                              <Link
                                href={`/creator/withdrawals/${request.id}/receipt`}
                                className="text-xs text-primary underline underline-offset-2 inline-block"
                              >
                                Ver constancia de retiro
                              </Link>
                            )}

                            {request.status === 'failed' && request.rejection_reason && (
                              <p className="text-xs text-destructive">
                                Motivo del rechazo: {request.rejection_reason}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Donations */}
          <div>
            <h2 className="text-xl font-bold mb-4">Donaciones recientes</h2>

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
                        {/* La donación se muestra en su moneda original (sin indexar) */}
                        {donation.currency === 'BS' && donation.amount_bs != null ? (
                          <>
                            <p className="font-semibold text-primary font-mono">
                              {formatBs(Number(donation.amount_bs))}
                            </p>
                            <p className="text-[11px] text-muted-foreground font-mono">
                              ≈ {formatUsd(Number(donation.amount_usd || 0))}
                            </p>
                          </>
                        ) : (
                          <p className="font-semibold text-primary font-mono">
                            {formatUsd(Number(donation.amount_usd || 0))}
                          </p>
                        )}
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
