"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CreatorSidebar } from "@/components/creator-sidebar";
import { TrendingUp, Users, DollarSign, AlertCircle, Eye, PlusCircle, Clock, FileText } from 'lucide-react';
import Link from "next/link";

// Mock data
const DASHBOARD_STATS = {
  totalRaised: 45300,
  totalCampaigns: 3,
  activeCampaigns: 1,
  totalDonors: 1240,
  profileVerified: true,
  verificationStatus: "verified",
};

const RECENT_CAMPAIGNS = [
  {
    id: "1",
    title: "Cirugía urgente - Niño con malformación cardíaca",
    status: "active",
    raised: 12500,
    goal: 15000,
    donors: 487,
    days_left: 45,
    views: 2340,
  },
  {
    id: "2",
    title: "Campaña finalizada - Educación",
    status: "closed",
    raised: 32800,
    goal: 30000,
    donors: 753,
    views: 5200,
  },
];

const RECENT_DONATIONS = [
  {
    id: "1",
    amount: 500,
    donor: "Ana García",
    campaign: "Cirugía urgente...",
    date: new Date("2025-11-12"),
    method: "Tarjeta",
  },
  {
    id: "2",
    amount: 1000,
    donor: "Anónimo",
    campaign: "Cirugía urgente...",
    date: new Date("2025-11-11"),
    method: "PayPal",
  },
  {
    id: "3",
    amount: 250,
    donor: "Carlos López",
    campaign: "Cirugía urgente...",
    date: new Date("2025-11-10"),
    method: "PagoMóvil",
  },
];

export default function CreatorDashboard() {
  return (
    <div className="flex min-h-screen bg-background">
      <CreatorSidebar />

      <main className="flex-1 overflow-auto">
        {/* Header */}
        <div className="border-b border-border bg-card sticky top-0 z-40">
          <div className="px-8 py-6">
            <h1 className="text-3xl font-bold">Panel de Control</h1>
            <p className="text-muted-foreground mt-1">
              Bienvenido de nuevo. Aquí puedes ver tus campañas y estadísticas.
            </p>
          </div>
        </div>

        <div className="p-8 space-y-8">
          {/* Status Cards */}
          {!DASHBOARD_STATS.profileVerified && (
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
                    <Link href="/creator/profile">Completar ahora</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Stats Grid */}
          <div className="grid md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  Total Recaudado
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">${DASHBOARD_STATS.totalRaised.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground mt-1">En todas las campañas</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Mis Campañas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{DASHBOARD_STATS.totalCampaigns}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {DASHBOARD_STATS.activeCampaigns} activa
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Donantes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{DASHBOARD_STATS.totalDonors}</p>
                <p className="text-xs text-muted-foreground mt-1">Personas que donaron</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  Verificación
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Badge className="bg-primary">
                  {DASHBOARD_STATS.verificationStatus === "verified"
                    ? "Verificado"
                    : "Pendiente"}
                </Badge>
                <p className="text-xs text-muted-foreground mt-2">Tu perfil</p>
              </CardContent>
            </Card>
          </div>

          {/* Campaigns Section */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Mis Campañas</h2>
              <Button size="sm" className="bg-primary" asChild>
                <Link href="/creator/campaigns/create">
                  <PlusCircle className="w-4 h-4 mr-2" />
                  Nueva campaña
                </Link>
              </Button>
            </div>

            <div className="grid gap-4">
              {RECENT_CAMPAIGNS.map((campaign) => (
                <Card key={campaign.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h3 className="font-semibold line-clamp-2">
                          {campaign.title}
                        </h3>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge
                            variant={campaign.status === "active" ? "default" : "secondary"}
                          >
                            {campaign.status === "active"
                              ? "En recaudación"
                              : "Finalizada"}
                          </Badge>
                          {campaign.status === "active" && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {campaign.days_left} días
                            </span>
                          )}
                        </div>
                      </div>
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/creator/campaigns/${campaign.id}`}>
                          Editar
                        </Link>
                      </Button>
                    </div>

                    <div className="space-y-3">
                      {/* Progress */}
                      <div>
                        <div className="flex justify-between text-sm mb-2">
                          <span className="font-semibold text-primary">
                            ${campaign.raised.toFixed(2)}
                          </span>
                          <span className="text-muted-foreground">
                            de ${campaign.goal.toFixed(2)}
                          </span>
                        </div>
                        <Progress
                          value={(campaign.raised / campaign.goal) * 100}
                          className="h-2"
                        />
                      </div>

                      {/* Stats */}
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground text-xs">Donantes</p>
                          <p className="font-semibold">{campaign.donors}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-xs">Vistas</p>
                          <p className="font-semibold flex items-center gap-1">
                            <Eye className="w-4 h-4" />
                            {campaign.views}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-xs">Progreso</p>
                          <p className="font-semibold">
                            {Math.round((campaign.raised / campaign.goal) * 100)}%
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
              <CardContent className="pt-6">
                <div className="space-y-4">
                  {RECENT_DONATIONS.map((donation) => (
                    <div
                      key={donation.id}
                      className="flex items-center justify-between py-3 border-b border-border last:border-0"
                    >
                      <div className="flex-1">
                        <p className="font-medium text-sm">{donation.donor}</p>
                        <p className="text-xs text-muted-foreground">
                          {donation.campaign}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-primary">
                          ${donation.amount.toFixed(2)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {donation.date.toLocaleDateString("es-VE", {
                            month: "short",
                            day: "numeric",
                          })}{" "}
                          • {donation.method}
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
