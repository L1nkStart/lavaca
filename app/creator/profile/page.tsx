"use client";

import { useState } from "react";
import { CreatorSidebar } from "@/components/creator-sidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle2, AlertCircle, Upload } from 'lucide-react';

export default function CreatorProfilePage() {
  const [formData, setFormData] = useState({
    fullName: "Miguel García",
    email: "miguel@example.com",
    phone: "+58 264 1234567",
    documentType: "cedula",
    documentNumber: "V12345678",
  });

  const [withdrawalAccounts, setWithdrawalAccounts] = useState([
    {
      id: "1",
      type: "bolivares_account",
      name: "Cuenta Banesco",
      verified: true,
    },
    {
      id: "2",
      type: "paypal",
      email: "miguel@paypal.com",
      verified: false,
    },
  ]);

  return (
    <div className="flex min-h-screen bg-background">
      <CreatorSidebar />

      <main className="flex-1 overflow-auto">
        {/* Header */}
        <div className="border-b border-border bg-card sticky top-0 z-40">
          <div className="px-8 py-6">
            <h1 className="text-3xl font-bold">Perfil y Verificación</h1>
            <p className="text-muted-foreground mt-1">
              Completa tu perfil y verifica tu identidad
            </p>
          </div>
        </div>

        <div className="p-8 space-y-8">
          <Tabs defaultValue="profile" className="space-y-4">
            <TabsList>
              <TabsTrigger value="profile">Perfil</TabsTrigger>
              <TabsTrigger value="verification">Verificación</TabsTrigger>
              <TabsTrigger value="withdrawals">Retiros</TabsTrigger>
            </TabsList>

            {/* Profile Tab */}
            <TabsContent value="profile">
              <Card>
                <CardHeader>
                  <CardTitle>Información Personal</CardTitle>
                  <CardDescription>
                    Actualiza tu información de perfil
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="fullname">Nombre Completo</Label>
                      <Input
                        id="fullname"
                        value={formData.fullName}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            fullName: e.target.value,
                          })
                        }
                      />
                    </div>

                    <div>
                      <Label htmlFor="email">Correo Electrónico</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        disabled
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="phone">Teléfono</Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) =>
                        setFormData({ ...formData, phone: e.target.value })
                      }
                    />
                  </div>

                  <Button className="bg-primary">Guardar cambios</Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Verification Tab */}
            <TabsContent value="verification">
              <Card>
                <CardHeader>
                  <CardTitle>Verificación de Identidad (KYC)</CardTitle>
                  <CardDescription>
                    Verifica tu identidad para crear campañas
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Status */}
                  <div className="flex items-start gap-4 p-4 bg-primary/5 rounded-lg border border-primary/20">
                    <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-foreground">
                        Verificación completada
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Tu identidad ha sido verificada el 10 de noviembre de 2025
                      </p>
                    </div>
                  </div>

                  {/* Document Info */}
                  <div className="space-y-4">
                    <h3 className="font-semibold">Documentación</h3>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="doctype">Tipo de Documento</Label>
                        <Select value={formData.documentType}>
                          <SelectTrigger id="doctype">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="cedula">Cédula de Identidad</SelectItem>
                            <SelectItem value="rif">RIF</SelectItem>
                            <SelectItem value="passport">Pasaporte</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label htmlFor="docnumber">Número de Documento</Label>
                        <Input
                          id="docnumber"
                          value={formData.documentNumber}
                          disabled
                        />
                      </div>
                    </div>

                    <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
                      <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm font-medium text-muted-foreground">
                        Documento verificado
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Se requiere nuevamente si deseas cambiar de documento
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Withdrawals Tab */}
            <TabsContent value="withdrawals" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Cuentas de Retiro</CardTitle>
                  <CardDescription>
                    Agrega cuentas donde recibirás tus fondos
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {withdrawalAccounts.map((account) => (
                      <div
                        key={account.id}
                        className="flex items-center justify-between p-4 border border-border rounded-lg"
                      >
                        <div>
                          <p className="font-medium">
                            {account.type === "bolivares_account"
                              ? "Cuenta Banesco"
                              : "PayPal"}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {account.type === "bolivares_account"
                              ? "0150-0000-12345678-90"
                              : account.email}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {account.verified ? (
                            <Badge className="bg-primary">Verificada</Badge>
                          ) : (
                            <Badge variant="secondary">Pendiente</Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <Button variant="outline" className="w-full mt-4">
                    Agregar cuenta de retiro
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
