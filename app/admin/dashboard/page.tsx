"use client";

import { AdminSidebar } from "@/components/admin-sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { AlertCircle, TrendingUp, Users, FileText, CreditCard, CheckCircle2 } from 'lucide-react';
import Link from "next/link";

const CHART_DATA = [
  { date: "Nov 1", donations: 45, campaigns: 2 },
  { date: "Nov 5", donations: 72, campaigns: 3 },
  { date: "Nov 10", donations: 98, campaigns: 5 },
  { date: "Nov 15", donations: 145, campaigns: 8 },
];

export default function AdminDashboard() {
  return (
    <div className="flex min-h-screen bg-background">
      <AdminSidebar />

      <main className="flex-1 overflow-auto">
        {/* Header */}
        <div className="border-b border-border bg-card sticky top-0 z-40">
          <div className="px-8 py-6">
            <h1 className="text-3xl font-bold">Panel de Administración</h1>
            <p className="text-muted-foreground mt-1">
              Bienvenido. Aquí puedes gestionar la plataforma.
            </p>
          </div>
        </div>

        <div className="p-8 space-y-8">
          {/* Alert */}
          <Card className="border-yellow-200 bg-yellow-50 dark:bg-yellow-950 dark:border-yellow-800">
            <CardContent className="pt-6 flex items-start gap-4">
              <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-yellow-900 dark:text-yellow-100">
                  12 verificaciones pendientes
                </h3>
                <p className="text-sm text-yellow-800 dark:text-yellow-200 mt-1">
                  Hay creadores esperando verificación. Revisa la cola de verificaciones.
                </p>
                <Button size="sm" className="mt-3" asChild>
                  <Link href="/admin/verifications">Ir a verificaciones</Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Stats Grid */}
          <div className="grid md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Usuarios totales
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">2,540</p>
                <p className="text-xs text-muted-foreground mt-1">+124 esta semana</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Campañas activas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">340</p>
                <p className="text-xs text-muted-foreground mt-1">En recaudación</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <CreditCard className="w-4 h-4" />
                  Donaciones
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">$2.3M</p>
                <p className="text-xs text-muted-foreground mt-1">Recaudados totales</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  Comisión plataforma
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">$46K</p>
                <p className="text-xs text-muted-foreground mt-1">Ingresos totales</p>
              </CardContent>
            </Card>
          </div>

          {/* Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Actividad últimos 15 días</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={CHART_DATA}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="donations"
                    stroke="#1a7f64"
                    name="Donaciones"
                  />
                  <Line
                    type="monotone"
                    dataKey="campaigns"
                    stroke="#ff9900"
                    name="Campañas"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Queues */}
          <div className="grid md:grid-cols-2 gap-4">
            {/* Verification Queue */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Cola de Verificaciones</CardTitle>
                  <Badge className="bg-accent">12</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { name: "Juan Pérez", type: "Creator", date: "Hace 2h" },
                  { name: "ONG Ayuda", type: "Guarantor", date: "Hace 4h" },
                  { name: "María García", type: "Creator", date: "Hace 1d" },
                ].map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between py-2 border-b border-border last:border-0"
                  >
                    <div>
                      <p className="font-medium text-sm">{item.name}</p>
                      <p className="text-xs text-muted-foreground">{item.type}</p>
                    </div>
                    <p className="text-xs text-muted-foreground">{item.date}</p>
                  </div>
                ))}
                <Button variant="outline" className="w-full mt-4" asChild>
                  <Link href="/admin/verifications">Ver todas</Link>
                </Button>
              </CardContent>
            </Card>

            {/* Manual Payments Queue */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Pagos Pendientes</CardTitle>
                  <Badge className="bg-accent">8</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { campaign: "Cirugía urgente", amount: "$500", date: "Hace 30m" },
                  { campaign: "Educación", amount: "$1,200", date: "Hace 2h" },
                  { campaign: "Emprendimiento", amount: "$350", date: "Hace 5h" },
                ].map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between py-2 border-b border-border last:border-0"
                  >
                    <div>
                      <p className="font-medium text-sm line-clamp-1">
                        {item.campaign}
                      </p>
                      <p className="text-xs text-muted-foreground">{item.date}</p>
                    </div>
                    <p className="font-bold text-primary text-sm">{item.amount}</p>
                  </div>
                ))}
                <Button variant="outline" className="w-full mt-4" asChild>
                  <Link href="/admin/payments">Ver todas</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
