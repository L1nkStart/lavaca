"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, notFound } from 'next/navigation';
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
import { CheckCircle2, MapPin, User, FileText, ArrowLeft, Heart, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface Campaign {
  id: string;
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
    icon: string | null;
  } | null;
  users: {
    full_name: string;
    kyc_status: string;
  };
  guarantor?: {
    full_name: string;
  };
  campaign_details?: {
    gallery_images: string[] | null;
    support_documents: string[] | null;
  };
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
  const params = useParams();
  const [activeTab, setActiveTab] = useState("story");
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [donations, setDonations] = useState<Donation[]>([]);
  const [updates, setUpdates] = useState<Update[]>([]);
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

      // Fetch campaign data
      const { data: campaignData, error: campaignError } = await supabase
        .from('campaigns')
        .select(`
          *,
          categories (
            name,
            icon
          ),
          users!campaigns_creator_id_fkey (
            full_name,
            kyc_status
          ),
          guarantor:users!campaigns_guarantor_id_fkey (
            full_name
          ),
          campaign_details (
            gallery_images,
            support_documents
          )
        `)
        .eq('id', campaignId)
        .eq('status', 'active')
        .single();

      if (campaignError) {
        if (campaignError.code === 'PGRST116') {
          notFound();
        }
        throw campaignError;
      }

      setCampaign(campaignData);

      // Fetch donations
      const { data: donationsData } = await supabase
        .from('donations')
        .select('*')
        .eq('campaign_id', campaignId)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(20);

      setDonations(donationsData || []);

      // Fetch updates
      const { data: updatesData } = await supabase
        .from('campaign_updates')
        .select('*')
        .eq('campaign_id', campaignId)
        .order('created_at', { ascending: false });

      setUpdates(updatesData || []);

    } catch (err) {
      console.error('Error fetching campaign:', err);
      setError('Error al cargar la campaña');
    } finally {
      setLoading(false);
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

  const galleryImages = [
    ...(campaign.main_image_url ? [campaign.main_image_url] : []),
    ...(campaign.campaign_details?.gallery_images || [])
  ];

  const supportDocuments = (campaign.campaign_details?.support_documents || []).map((url, index) => ({
    id: index.toString(),
    name: `Documento ${index + 1}`,
    url: url,
    size: '- MB' // Size not stored in current schema
  }));

  const donationsList = donations.map(donation => ({
    id: donation.id,
    amount: donation.amount_usd,
    donorName: donation.is_anonymous ? 'Anónimo' : (donation.donor_name || 'Anónimo'),
    isAnonymous: donation.is_anonymous,
    date: new Date(donation.created_at)
  }));

  const updatesList = updates.map(update => ({
    id: update.id,
    title: update.title,
    content: update.content,
    date: new Date(update.created_at),
    image: update.image_url
  }));

  const getUrgencyBadge = (level: string) => {
    switch (level) {
      case 'critical':
        return <Badge variant="destructive">Crítico</Badge>;
      case 'high':
        return <Badge className="bg-orange-500">Alto</Badge>;
      case 'medium':
        return <Badge className="bg-yellow-500">Medio</Badge>;
      case 'low':
        return <Badge variant="secondary">Bajo</Badge>;
      default:
        return null;
    }
  };

  return (
    <main className="flex flex-col min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <Link
            href="/campaigns"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver a campañas
          </Link>
        </div>
      </div>

      <div className="flex-1 max-w-7xl mx-auto w-full px-4 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Gallery */}
            <CampaignGallery
              mainImage={campaign.main_image_url || '/placeholder.jpg'}
              galleryImages={galleryImages}
              title={campaign.title}
            />

            {/* Info Cards */}
            <div className="grid sm:grid-cols-2 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <User className="w-5 h-5 text-primary" />
                    <div>
                      <p className="text-xs text-muted-foreground">Creador</p>
                      <p className="font-semibold flex items-center gap-2">
                        {campaign.users.full_name}
                        {campaign.users.kyc_status === 'verified' && (
                          <CheckCircle2 className="w-4 h-4 text-primary" />
                        )}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <MapPin className="w-5 h-5 text-accent" />
                    <div>
                      <p className="text-xs text-muted-foreground">Ubicación</p>
                      <p className="font-semibold">{campaign.location || 'No especificada'}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Title and Badges */}
            <div className="space-y-4">
              <div>
                <h1 className="text-3xl md:text-4xl font-bold mb-4 text-pretty">
                  {campaign.title}
                </h1>
                <div className="flex flex-wrap gap-2">
                  <Badge>{campaign.categories?.name || 'Sin categoría'}</Badge>
                  {getUrgencyBadge(campaign.urgency_level)}
                  {campaign.users.kyc_status === 'verified' && (
                    <Badge variant="default" className="bg-primary">
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      Verificado
                    </Badge>
                  )}
                  {campaign.guarantor && (
                    <Badge className="bg-accent">
                      <Heart className="w-3 h-3 mr-1" />
                      Avalado: {campaign.guarantor.full_name}
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Progress Section */}
            <Card>
              <CardHeader>
                <CardTitle>Progreso de recaudación</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <div className="flex justify-between items-baseline mb-2">
                    <div>
                      <p className="text-sm text-muted-foreground">Recaudado</p>
                      <p className="text-3xl font-bold text-primary">
                        ${campaign.current_amount_usd.toFixed(2)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Meta</p>
                      <p className="text-xl font-semibold">
                        ${campaign.goal_amount_usd.toFixed(2)}
                      </p>
                    </div>
                  </div>
                  <Progress value={Math.min(progressPercent, 100)} className="h-2" />
                  <p className="text-sm text-muted-foreground mt-2">
                    {Math.round(progressPercent)}% del objetivo alcanzado •{" "}
                    {donations.length} donantes
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">
                      Falta recaudar
                    </p>
                    <p className="text-lg font-bold text-accent">
                      ${(campaign.goal_amount_usd - campaign.current_amount_usd).toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">
                      Días activos
                    </p>
                    <p className="text-lg font-bold">{daysActive} días</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="story">Historia</TabsTrigger>
                <TabsTrigger value="updates">
                  Actualizaciones {updates.length > 0 && `(${updates.length})`}
                </TabsTrigger>
                <TabsTrigger value="documents">Documentos</TabsTrigger>
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
                <CampaignUpdates updates={updatesList} />
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
                            className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-muted transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <FileText className="w-5 h-5 text-primary" />
                              <div>
                                <p className="font-medium">{doc.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {doc.size}
                                </p>
                              </div>
                            </div>
                            <span className="text-xs font-medium text-primary">
                              DESCARGAR
                            </span>
                          </a>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Donate Button */}
            <Button size="lg" className="w-full bg-primary hover:bg-primary/90 h-12 text-base" asChild>
              <Link href={`/campaigns/${campaign.id}/donate`}>
                <Heart className="w-5 h-5 mr-2" />
                Donar Ahora
              </Link>
            </Button>

            {/* Share Button */}
            <CampaignShare
              campaignId={campaign.id}
              campaignTitle={campaign.title}
              campaignUrl={`https://lavaca.app/campaigns/${campaign.id}`}
            />

            {/* Donors List */}
            <CampaignDonorsList donations={donationsList} />

            {/* Info Card */}
            <Card className="bg-primary/5 border-primary/20">
              <CardHeader>
                <CardTitle className="text-base">Información importante</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-3">
                <p>
                  Todos los fondos recaudados van directamente a la campaña. La
                  plataforma LaVaca no retiene comisiones en campañas verificadas.
                </p>
                <p>
                  Los retiros se procesan dentro de 24-48 horas hábiles.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </main>
  );
}
