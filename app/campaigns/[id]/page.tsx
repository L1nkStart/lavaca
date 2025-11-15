"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CampaignGallery } from "@/components/campaign-gallery";
import { CampaignUpdates } from "@/components/campaign-updates";
import { CampaignDonorsList } from "@/components/campaign-donors-list";
import { CampaignShare } from "@/components/campaign-share";
import { CheckCircle2, MapPin, User, FileText, ArrowLeft, Heart } from 'lucide-react';

// Mock campaign data
const CAMPAIGN_DATA = {
  id: "1",
  title: "Cirugía urgente - Niño con malformación cardíaca",
  description:
    "Necesitamos $15,000 para una cirugía de corazón abierto para salvar la vida de un niño de 8 años. Este es un caso urgente que requiere atención inmediata.",
  fullStory: `
    Miguel tiene 8 años y nació con una malformación cardíaca severa que requiere una cirugía de corazón abierto.
    Sus padres son personas humildes que trabajan como vendedores ambulantes y no pueden pagar los $15,000 que cuesta
    la intervención quirúrgica en una clínica privada.
    
    La cirugía es urgente ya que la salud de Miguel se deteriora cada día. Los médicos del hospital público han recomendado
    la cirugía, pero el tiempo de espera es incierto debido a la situación actual.
    
    Con tu ayuda, podemos salvar la vida de este niño y darle una oportunidad de vivir una vida normal y saludable.
    Todos los fondos recaudados irán directamente al hospital para cubrir los gastos de la cirugía.
  `,
  category: "Salud",
  location: "Caracas, Miranda",
  creator: "Fundación Salud Infantil",
  creatorVerified: true,
  guarantor: "Hospital Metropolitano",
  goalAmount: 15000,
  raisedAmount: 12500,
  mainImage: "/medical-surgery-child.jpg",
  galleryImages: [
    "/medical-surgery-child.jpg",
    "/placeholder.svg?key=2",
    "/placeholder.svg?key=3",
  ],
  supportDocuments: [
    {
      id: "1",
      name: "Diagnóstico médico",
      url: "/docs/diagnosis.pdf",
      size: "2.4 MB",
    },
    {
      id: "2",
      name: "Presupuesto hospital",
      url: "/docs/budget.pdf",
      size: "1.2 MB",
    },
  ],
  updates: [
    {
      id: "1",
      title: "¡Miguel está mejorando!",
      content:
        "Miguel fue operado exitosamente hace 3 días. La cirugía salió según lo planeado y el pequeño está en recuperación. Los médicos son optimistas sobre su recuperación completa.",
      date: new Date("2025-11-10"),
      image: "/placeholder.svg?key=update1",
    },
    {
      id: "2",
      title: "Recaudación alcanzó el 80%",
      content:
        "Gracias a todos ustedes, hemos recaudado $12,000. Esto significa que podemos proceder con la cirugía en los próximos días.",
      date: new Date("2025-11-05"),
    },
  ],
  donations: [
    {
      id: "1",
      amount: 500,
      donorName: "Ana García",
      isAnonymous: false,
      date: new Date("2025-11-12"),
    },
    {
      id: "2",
      amount: 1000,
      donorName: "Anónimo",
      isAnonymous: true,
      date: new Date("2025-11-11"),
    },
    {
      id: "3",
      amount: 250,
      donorName: "Carlos López",
      isAnonymous: false,
      date: new Date("2025-11-10"),
    },
    {
      id: "4",
      amount: 2000,
      donorName: "Anónimo",
      isAnonymous: true,
      date: new Date("2025-11-09"),
    },
    {
      id: "5",
      amount: 300,
      donorName: "Marta Rodríguez",
      isAnonymous: false,
      date: new Date("2025-11-08"),
    },
  ],
};

export default function CampaignPage() {
  const params = useParams();
  const [activeTab, setActiveTab] = useState("story");

  const campaign = CAMPAIGN_DATA;
  const progressPercent = (campaign.raisedAmount / campaign.goalAmount) * 100;
  const daysLeft = 45;

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
              mainImage={campaign.mainImage}
              galleryImages={campaign.galleryImages}
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
                        {campaign.creator}
                        {campaign.creatorVerified && (
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
                      <p className="font-semibold">{campaign.location}</p>
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
                  <Badge>{campaign.category}</Badge>
                  {campaign.creatorVerified && (
                    <Badge variant="default" className="bg-primary">
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      Verificado
                    </Badge>
                  )}
                  {campaign.guarantor && (
                    <Badge className="bg-accent">
                      <Heart className="w-3 h-3 mr-1" />
                      Avalado: {campaign.guarantor}
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
                        ${campaign.raisedAmount.toFixed(2)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Meta</p>
                      <p className="text-xl font-semibold">
                        ${campaign.goalAmount.toFixed(2)}
                      </p>
                    </div>
                  </div>
                  <Progress value={Math.min(progressPercent, 100)} className="h-2" />
                  <p className="text-sm text-muted-foreground mt-2">
                    {Math.round(progressPercent)}% del objetivo alcanzado •{" "}
                    {campaign.donations.length} donantes
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">
                      Falta recaudar
                    </p>
                    <p className="text-lg font-bold text-accent">
                      ${(campaign.goalAmount - campaign.raisedAmount).toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">
                      Días restantes
                    </p>
                    <p className="text-lg font-bold">{daysLeft} días</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="story">Historia</TabsTrigger>
                <TabsTrigger value="updates">
                  Actualizaciones {campaign.updates.length > 0 && `(${campaign.updates.length})`}
                </TabsTrigger>
                <TabsTrigger value="documents">Documentos</TabsTrigger>
              </TabsList>

              <TabsContent value="story" className="mt-6">
                <Card>
                  <CardContent className="pt-6 prose prose-sm dark:prose-invert max-w-none">
                    <p className="whitespace-pre-wrap text-base leading-relaxed">
                      {campaign.fullStory}
                    </p>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="updates" className="mt-6">
                <CampaignUpdates updates={campaign.updates} />
              </TabsContent>

              <TabsContent value="documents" className="mt-6">
                <Card>
                  <CardContent className="pt-6">
                    {campaign.supportDocuments.length === 0 ? (
                      <p className="text-center text-muted-foreground">
                        No hay documentos disponibles
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {campaign.supportDocuments.map((doc) => (
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
            <CampaignDonorsList donations={campaign.donations} />

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
