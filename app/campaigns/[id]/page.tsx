"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CampaignGallery } from "@/components/campaign-gallery";
import { CampaignUpdates } from "@/components/campaign-updates";
import { CampaignDonorsList } from "@/components/campaign-donors-list";
import { CampaignShare } from "@/components/campaign-share";
import { CampaignComments } from "@/components/campaign-comments";
import { CampaignReactions } from "@/components/campaign-reactions";
import { CampaignFollow } from "@/components/campaign-follow";
import { CampaignReport } from "@/components/campaign-report";
import { CheckCircle2, MapPin, User, FileText, ArrowLeft, Heart, Loader2, Clock, ShieldCheck, Download } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { DonationStatusBanner } from '@/components/donation-status-banner';

interface Campaign {
  id: string;
  creator_id: string;
  title: string;
  slug: string;
  story: string;
  goal_amount_usd: number;
  current_amount_usd: number;
  main_image_url: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  location: string | null;
  urgency_level: string;
  categories: {
    name: string;
    icon_emoji: string | null;
  } | null;
  users: {
    full_name: string;
    kyc_status: string;
  };
  guarantors?: Array<{
    id: string;
    full_name: string;
    organization_name: string | null;
    profession_field: string | null;
    accepted_at: string;
  }>;
  campaign_details?: {
    gallery_images: string[] | null;
    support_documents: string[] | null;
    support_documents_urls?: string[] | null;
  } | null;
}

interface Donation {
  id: string;
  amount_usd: number;
  donor_name: string | null;
  is_anonymous: boolean;
  created_at: string;
  status: string;
}

interface Update {
  id: string;
  title: string;
  content: string;
  created_at: string;
  image_url: string | null;
}

export default function CampaignPage() {
  const UPDATES_PAGE_SIZE = 5;

  const params = useParams();
  const [activeTab, setActiveTab] = useState("story");
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [donations, setDonations] = useState<Donation[]>([]);
  const [updates, setUpdates] = useState<Update[]>([]);
  const [updatesCount, setUpdatesCount] = useState(0);
  const [updatesPage, setUpdatesPage] = useState(1);
  const [updatesLoading, setUpdatesLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  useEffect(() => {
    if (params.id) {
      fetchCampaignData(params.id as string);
    }
  }, [params.id]);

  const fetchCampaignData = async (campaignId: string) => {
    try {
      setLoading(true);

      const { data: authData } = await supabase.auth.getUser();
      const currentUser = authData?.user || null;

      let currentUserRole: string | null = null;
      if (currentUser) {
        const { data: profileData } = await supabase
          .from('users')
          .select('role')
          .eq('id', currentUser.id)
          .maybeSingle();

        currentUserRole = profileData?.role || null;
      }

      // Fetch campaign data
      const { data: campaignData, error: campaignError } = await supabase
        .from('campaigns')
        .select(`
          *,
          categories (
            name,
            icon_emoji
          ),
          users!campaigns_creator_id_fkey (
            full_name,
            kyc_status
          )
        `)
        .eq('id', campaignId)
        .maybeSingle();

      if (campaignError) {
        throw campaignError;
      }

      if (!campaignData) {
        setCampaign(null);
        setError('Campaña no encontrada o sin permisos para verla.');
        return;
      }

      const isAdmin = currentUserRole === 'admin';
      const isOwner = !!currentUser && campaignData.creator_id === currentUser.id;
      const isPubliclyVisible = campaignData.status === 'active';

      if (!isPubliclyVisible && !isAdmin && !isOwner) {
        setCampaign(null);
        setError('No tienes permisos para ver esta campaña.');
        return;
      }

      const { data: campaignDetailsData } = await supabase
        .from('campaign_details')
        .select('gallery_images, support_documents, support_documents_urls')
        .eq('campaign_id', campaignId)
        .maybeSingle()

      // Fetch guarantors aceptados con KYC verificado para el sello público
      const { data: guarantorRows } = await supabase
        .from('campaign_guarantors')
        .select(`
          accepted_at,
          guarantors:guarantors!campaign_guarantors_guarantor_id_fkey (
            id,
            organization_name,
            profession_field,
            kyc_status,
            users:users!guarantors_user_id_fkey (
              full_name
            )
          )
        `)
        .eq('campaign_id', campaignId)
        .eq('status', 'accepted')

      const guarantors = (guarantorRows || [])
        .map((row: any) => {
          const g = row.guarantors
          if (!g || g.kyc_status !== 'verified') return null
          return {
            id: g.id,
            full_name: g.users?.full_name || 'Garante',
            organization_name: g.organization_name || null,
            profession_field: g.profession_field || null,
            accepted_at: row.accepted_at,
          }
        })
        .filter(Boolean) as Campaign['guarantors']

      const normalizedCampaignData = {
        ...campaignData,
        campaign_details: campaignDetailsData || null,
        guarantors: guarantors || [],
      }

      setCampaign(normalizedCampaignData as Campaign);

      // Fetch donations
      const { data: donationsData, error: donationsError } = await supabase
        .from('donations')
        .select('*')
        .eq('campaign_id', campaignId)
        .eq('payment_status', 'completed')
        .order('created_at', { ascending: false })
        .limit(20);

      if (donationsError) {
        console.error('Error fetching donations:', donationsError);
      }

      console.log('Donations fetched:', donationsData?.length || 0);
      setDonations(donationsData || []);

      await fetchUpdates(campaignId, 1);

    } catch (err) {
      console.error('Error fetching campaign:', err);
      setError('Error al cargar la campaña');
    } finally {
      setLoading(false);
    }
  };

  const fetchUpdates = async (campaignId: string, page = 1) => {
    try {
      setUpdatesLoading(true);

      const from = (page - 1) * UPDATES_PAGE_SIZE;
      const to = from + UPDATES_PAGE_SIZE - 1;

      const { data, error: updatesError, count } = await supabase
        .from('campaign_updates')
        .select('*', { count: 'exact' })
        .eq('campaign_id', campaignId)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (updatesError) throw updatesError;

      setUpdates(data || []);
      setUpdatesCount(count || 0);
      setUpdatesPage(page);
    } catch (err) {
      console.error('Error fetching updates:', err);
    } finally {
      setUpdatesLoading(false);
    }
  };

  if (loading) {
    return (
      <main className="flex flex-col min-h-screen bg-background">
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </main>
    );
  }

  if (error || !campaign) {
    return (
      <main className="flex flex-col min-h-screen bg-background">
        <div className="flex-1 flex items-center justify-center">
          <Alert variant="destructive" className="max-w-md">
            <AlertDescription>
              {error || 'Campaña no encontrada'}
            </AlertDescription>
          </Alert>
        </div>
      </main>
    );
  }

  const progressPercent = campaign.goal_amount_usd > 0
    ? (campaign.current_amount_usd / campaign.goal_amount_usd) * 100
    : 0;

  // Calculate days since creation (could be enhanced with end date)
  const daysActive = Math.floor(
    (new Date().getTime() - new Date(campaign.created_at).getTime()) / (1000 * 60 * 60 * 24)
  );

  const campaignDetails = campaign.campaign_details

  const galleryImages = [
    ...(campaign.main_image_url ? [campaign.main_image_url] : []),
    ...(campaignDetails?.gallery_images || [])
  ];

  const supportDocumentUrls = campaignDetails?.support_documents || campaignDetails?.support_documents_urls || []

  const supportDocuments = supportDocumentUrls.map((url, index) => ({
    id: index.toString(),
    name: `Documento ${index + 1}`,
    url: url,
    size: '- MB' // Size not stored in current schema
  }));

  const donationsList = donations.map(donation => ({
    id: donation.id,
    amount: donation.amount_usd,
    donorName: donation.is_anonymous ? 'Donante anónimo' : (donation.donor_name || 'Donante'),
    isAnonymous: donation.is_anonymous,
    date: new Date(donation.created_at)
  }));

  const updatesList = updates.map(update => ({
    id: update.id,
    title: update.title,
    content: update.content,
    date: new Date(update.created_at),
    image: update.image_url || undefined
  }));

  const getUrgencyBadge = (level: string) => {
    switch (level) {
      case 'critical':
        return <Badge className="bg-destructive text-white">Urgencia crítica</Badge>;
      case 'high':
        return <Badge className="bg-accent text-accent-foreground">Urgencia alta</Badge>;
      case 'medium':
        return (
          <Badge variant="outline" className="border-accent/40 bg-accent/10 text-accent">
            Urgencia media
          </Badge>
        );
      case 'low':
        return <Badge variant="secondary">Urgencia baja</Badge>;
      default:
        return null;
    }
  };

  const totalUpdatePages = Math.max(1, Math.ceil(updatesCount / UPDATES_PAGE_SIZE));
  const canDonate = campaign.status === 'active';
  const donorCount = donations.length;
  const remaining = Math.max(0, campaign.goal_amount_usd - campaign.current_amount_usd);
  const usd = (n: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(n || 0);
  const isVerified = campaign.users.kyc_status === 'verified';
  const hasGuarantors = !!campaign.guarantors && campaign.guarantors.length > 0;
  const donateHref = `/campaigns/${campaign.id}/donate`;

  return (
    <main className="flex min-h-screen flex-col bg-background pb-24 lg:pb-0">
      <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:py-8">
        <Link
          href="/campaigns"
          className="inline-flex items-center gap-2 text-sm font-medium text-foreground/60 transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Volver a campañas
        </Link>

        {/* Banner que aparece cuando el donante vuelve del checkout
            (success / pending / cancelled / failed). Lee el ?donation= query
            param. Si no hay param, no renderiza nada. */}
        <div className="mt-4">
          <DonationStatusBanner />
        </div>

        <div className="mt-6 grid gap-8 lg:grid-cols-3">
          {/* Main Content */}
          <div className="space-y-8 lg:col-span-2">
            {/* Gallery */}
            <CampaignGallery
              mainImage={campaign.main_image_url || '/placeholder.jpg'}
              galleryImages={galleryImages}
              title={campaign.title}
            />

            {/* Hero: badges, title, meta */}
            <div className="lv-rise space-y-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">
                  {campaign.categories?.name || 'Sin categoría'}
                </Badge>
                {getUrgencyBadge(campaign.urgency_level)}
                {isVerified && (
                  <Badge className="bg-primary">
                    <CheckCircle2 className="mr-1 size-3" />
                    Verificado
                  </Badge>
                )}
                {hasGuarantors && (
                  <Badge className="bg-accent text-accent-foreground">
                    <ShieldCheck className="mr-1 size-3" />
                    Avalado
                    {campaign.guarantors!.length > 1
                      ? ` por ${campaign.guarantors!.length} garantes`
                      : ''}
                  </Badge>
                )}
              </div>

              <h1 className="text-balance text-3xl font-black tracking-tight md:text-4xl">
                {campaign.title}
              </h1>

              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-foreground/70">
                <span className="inline-flex items-center gap-1.5">
                  <User className="size-4 text-foreground/50" />
                  <span className="font-medium text-foreground">
                    {campaign.users.full_name}
                  </span>
                  {isVerified && (
                    <CheckCircle2 className="size-4 text-primary" aria-label="Creador verificado" />
                  )}
                </span>
                {campaign.location && (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="size-4 text-foreground/50" />
                    {campaign.location}
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="size-4 text-foreground/50" />
                  {Math.max(0, daysActive)} días activos
                </span>
              </div>

              {/* Secondary actions */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <CampaignReactions campaignId={campaign.id} initialCount={0} />
                <CampaignFollow campaignId={campaign.id} />
                <CampaignReport campaignId={campaign.id} />
              </div>
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="story">Historia</TabsTrigger>
                <TabsTrigger value="updates">
                  Actualizaciones {updatesCount > 0 && `(${updatesCount})`}
                </TabsTrigger>
                <TabsTrigger value="documents">Documentos</TabsTrigger>
                <TabsTrigger value="comments">Comentarios</TabsTrigger>
              </TabsList>

              <TabsContent value="story" className="mt-6">
                <Card>
                  <CardContent className="pt-6 prose prose-sm dark:prose-invert max-w-none">
                    <p className="whitespace-pre-wrap text-base leading-relaxed">
                      {campaign.story}
                    </p>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="updates" className="mt-6">
                {updatesLoading ? (
                  <div className="py-8 flex justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <>
                    <CampaignUpdates updates={updatesList} />
                    {updatesCount > UPDATES_PAGE_SIZE && (
                      <div className="mt-4 flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">
                          Página {updatesPage} de {totalUpdatePages}
                        </p>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={updatesPage === 1 || updatesLoading}
                            onClick={() => fetchUpdates(campaign.id, Math.max(1, updatesPage - 1))}
                          >
                            Anterior
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={updatesPage === totalUpdatePages || updatesLoading}
                            onClick={() => fetchUpdates(campaign.id, Math.min(totalUpdatePages, updatesPage + 1))}
                          >
                            Siguiente
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </TabsContent>

              <TabsContent value="documents" className="mt-6">
                <Card>
                  <CardContent className="pt-6">
                    {supportDocuments.length === 0 ? (
                      <p className="text-center text-muted-foreground">
                        No hay documentos disponibles
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {supportDocuments.map((doc) => (
                          <a
                            key={doc.id}
                            href={doc.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-between rounded-lg border border-border p-4 transition-colors hover:bg-muted"
                          >
                            <div className="flex items-center gap-3">
                              <FileText className="size-5 text-primary" />
                              <div>
                                <p className="font-medium">{doc.name}</p>
                                <p className="text-xs text-foreground/60">
                                  {doc.size}
                                </p>
                              </div>
                            </div>
                            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-primary">
                              <Download className="size-4" />
                              Descargar
                            </span>
                          </a>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="comments" className="mt-6">
                <CampaignComments
                  campaignId={campaign.id}
                  campaignSlug={campaign.slug}
                />
              </TabsContent>
            </Tabs>
          </div>

          {/* Sidebar */}
          <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
            {/* Donation module — the conversion moment */}
            <Card>
              <CardContent className="space-y-5 pt-6">
                <div>
                  <p className="font-mono text-3xl font-bold tracking-tight text-primary">
                    {usd(campaign.current_amount_usd)}
                  </p>
                  <p className="mt-1 text-sm text-foreground/70">
                    recaudado de{' '}
                    <span className="font-medium text-foreground">
                      {usd(campaign.goal_amount_usd)}
                    </span>
                  </p>
                </div>

                <Progress value={Math.min(progressPercent, 100)} className="h-2.5" />

                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold">
                    {Math.round(progressPercent)}% alcanzado
                  </span>
                  <span className="text-foreground/70">
                    {donorCount} {donorCount === 1 ? 'donante' : 'donantes'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 border-t border-border pt-4">
                  <div>
                    <p className="text-xs text-foreground/60">Falta recaudar</p>
                    <p className="font-mono text-lg font-bold text-accent">
                      {usd(remaining)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-foreground/60">Días activos</p>
                    <p className="font-mono text-lg font-bold">
                      {Math.max(0, daysActive)}
                    </p>
                  </div>
                </div>

                {canDonate ? (
                  <Button size="lg" className="h-12 w-full text-base" asChild>
                    <Link href={donateHref}>
                      <Heart className="size-5" />
                      Donar ahora
                    </Link>
                  </Button>
                ) : (
                  <div className="space-y-3">
                    <Button
                      size="lg"
                      variant="outline"
                      disabled
                      className="h-12 w-full text-base"
                    >
                      <Heart className="size-5" />
                      Donaciones deshabilitadas
                    </Button>
                    <Alert className="bg-muted/40">
                      <AlertDescription className="text-xs">
                        Esta campaña está en estado <strong>{campaign.status}</strong> y
                        no puede recibir donaciones hasta estar activa.
                      </AlertDescription>
                    </Alert>
                  </div>
                )}

                <div className="flex justify-center">
                  <CampaignShare
                    campaignId={campaign.id}
                    campaignTitle={campaign.title}
                    campaignUrl={`https://lavaca.app/campaigns/${campaign.id}`}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Guarantor trust card — reinforce at the decision point */}
            {hasGuarantors && (
              <Card className="border-accent/30 bg-accent/5">
                <CardContent className="space-y-3 pt-6">
                  <div className="flex items-center gap-2 text-accent">
                    <ShieldCheck className="size-5" />
                    <p className="font-semibold">Campaña avalada</p>
                  </div>
                  <div className="space-y-2">
                    {campaign.guarantors!.slice(0, 2).map((g) => (
                      <div key={g.id} className="text-sm">
                        <p className="font-medium text-foreground">
                          {g.organization_name || g.full_name}
                        </p>
                        {g.profession_field && (
                          <p className="text-foreground/60">{g.profession_field}</p>
                        )}
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-foreground/60">
                    Un garante con identidad verificada respalda la veracidad de esta
                    campaña.
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Donors List */}
            <CampaignDonorsList donations={donationsList} />

            {/* Commission disclosure */}
            <Card className="border-primary/20 bg-primary/5">
              <CardHeader>
                <CardTitle className="text-base">Cómo se usa tu donación</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-foreground/75">
                <p>
                  LaVaca cobra entre 3% y 6% de comisión para que un equipo humano
                  verifique cada campaña manualmente, dar soporte 24/7 y mantener la
                  plataforma activa, de modo que tu ayuda llegue a quien la necesita.
                </p>
                <p>
                  Los procesadores de pago (tarjetas, Zelle, cripto) pueden aplicar sus
                  propias tarifas según el método que elijas.
                </p>
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>

      {/* Mobile sticky donate bar — keep the CTA reachable on small screens */}
      {canDonate && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 px-4 py-3 backdrop-blur lg:hidden">
          <div className="mx-auto flex max-w-7xl items-center gap-4">
            <div className="min-w-0">
              <p className="font-mono text-lg font-bold leading-none text-primary">
                {usd(campaign.current_amount_usd)}
              </p>
              <p className="mt-1 truncate text-xs text-foreground/70">
                {Math.round(progressPercent)}% de {usd(campaign.goal_amount_usd)}
              </p>
            </div>
            <Button className="ml-auto h-11 shrink-0 px-6" asChild>
              <Link href={donateHref}>
                <Heart className="size-5" />
                Donar ahora
              </Link>
            </Button>
          </div>
        </div>
      )}
    </main>
  );
}
