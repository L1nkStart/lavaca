"use client";

import { useState } from "react";
import { AdminSidebar } from "@/components/admin-sidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function AdminSettingsPage() {
  const [exchangeRate, setExchangeRate] = useState("41.25");
  const [commission, setCommission] = useState("2.5");

  return (
    <div className="flex min-h-screen bg-background">
      <AdminSidebar />

      <main className="flex-1 overflow-auto">
        {/* Header */}
        <div className="border-b border-border bg-card sticky top-0 z-40">
          <div className="px-8 py-6">
            <h1 className="text-3xl font-bold">Configuración</h1>
            <p className="text-muted-foreground mt-1">
              Gestiona los parámetros de la plataforma
            </p>
          </div>
        </div>

        <div className="p-8 space-y-8">
          <Tabs defaultValue="exchange" className="space-y-4">
            <TabsList>
              <TabsTrigger value="exchange">Tasa de Cambio</TabsTrigger>
              <TabsTrigger value="commission">Comisión</TabsTrigger>
              <TabsTrigger value="categories">Categorías</TabsTrigger>
            </TabsList>

            {/* Exchange Rate Tab */}
            <TabsContent value="exchange">
              <Card>
                <CardHeader>
                  <CardTitle>Tasa de Cambio BCV</CardTitle>
                  <CardDescription>
                    Configura la tasa de cambio VEF/USD para conversiones
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="rate">Tasa BCV (VEF por USD)</Label>
                    <Input
                      id="rate"
                      type="number"
                      step="0.01"
                      value={exchangeRate}
                      onChange={(e) => setExchangeRate(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground mt-2">
                      Última actualización: Hoy a las 9:30 AM
                    </p>
                  </div>

                  <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg">
                    <p className="text-sm text-blue-900 dark:text-blue-100">
                      Con esta tasa, $1 USD = Bs. {(parseFloat(exchangeRate) || 0).toFixed(2)}
                    </p>
                  </div>

                  <Button className="bg-primary">Guardar cambios</Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Commission Tab */}
            <TabsContent value="commission">
              <Card>
                <CardHeader>
                  <CardTitle>Comisión de Plataforma</CardTitle>
                  <CardDescription>
                    Porcentaje de comisión en cada donación
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="commission">Porcentaje (%)</Label>
                    <Input
                      id="commission"
                      type="number"
                      step="0.1"
                      value={commission}
                      onChange={(e) => setCommission(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground mt-2">
                      Ejemplo: Si alguien dona $100, LaVaca recibe ${(100 * parseFloat(commission) / 100).toFixed(2)}
                    </p>
                  </div>

                  <div className="space-y-2 pt-4 border-t border-border">
                    <h4 className="font-semibold">Comisión actual por donación:</h4>
                    <div className="grid grid-cols-3 gap-4">
                      {[10, 50, 100].map((amount) => (
                        <div key={amount} className="bg-muted p-3 rounded">
                          <p className="text-xs text-muted-foreground">
                            Donación ${amount}
                          </p>
                          <p className="text-lg font-bold text-primary">
                            ${(amount * parseFloat(commission) / 100).toFixed(2)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Button className="bg-primary">Guardar cambios</Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Categories Tab */}
            <TabsContent value="categories">
              <Card>
                <CardHeader>
                  <CardTitle>Categorías de Campaña</CardTitle>
                  <CardDescription>
                    Administra las categorías disponibles
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    {[
                      "Salud",
                      "Educación",
                      "Emprendimiento",
                      "Comunitaria",
                      "Emergencia",
                    ].map((cat) => (
                      <div
                        key={cat}
                        className="flex items-center justify-between p-3 bg-muted rounded-lg"
                      >
                        <span className="font-medium">{cat}</span>
                        <Button size="sm" variant="ghost">
                          Editar
                        </Button>
                      </div>
                    ))}
                  </div>

                  <Button variant="outline" className="w-full">
                    Agregar categoría
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
