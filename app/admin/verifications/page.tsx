"use client";

import { useState } from "react";
import { AdminSidebar } from "@/components/admin-sidebar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle2, X, FileText } from 'lucide-react';

const VERIFICATIONS = [
  {
    id: "1",
    name: "Juan Pérez",
    type: "creator",
    email: "juan@example.com",
    phone: "+58 264 1234567",
    documentType: "Cédula",
    documentNumber: "V12345678",
    documentImage: "/placeholder.svg",
    submittedAt: new Date("2025-11-14T10:30:00"),
    status: "pending",
  },
  {
    id: "2",
    name: "ONG Ayuda Venezuela",
    type: "guarantor",
    email: "info@ayudavzla.org",
    rif: "J-50000000-0",
    credentialType: "RIF",
    credentialImage: "/placeholder.svg",
    submittedAt: new Date("2025-11-14T08:15:00"),
    status: "pending",
  },
];

export default function AdminVerificationsPage() {
  const [rejectionReason, setRejectionReason] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleApprove = (id: string) => {
    alert("Verificación aprobada");
  };

  const handleReject = (id: string) => {
    if (!rejectionReason) {
      alert("Por favor ingresa una razón");
      return;
    }
    alert(`Verificación rechazada: ${rejectionReason}`);
    setRejectionReason("");
    setSelectedId(null);
  };

  return (
    <div className="flex min-h-screen bg-background">
      <AdminSidebar />

      <main className="flex-1 overflow-auto">
        {/* Header */}
        <div className="border-b border-border bg-card sticky top-0 z-40">
          <div className="px-8 py-6">
            <h1 className="text-3xl font-bold">Verificaciones KYC</h1>
            <p className="text-muted-foreground mt-1">
              {VERIFICATIONS.length} verificaciones pendientes
            </p>
          </div>
        </div>

        <div className="p-8 space-y-4">
          {VERIFICATIONS.map((verification) => (
            <Card key={verification.id}>
              <CardContent className="pt-6">
                <Tabs defaultValue="details" className="space-y-4">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="font-bold text-lg">{verification.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {verification.type === "creator" ? "Creador" : "Garantista"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">
                        {new Date().getTime() - verification.submittedAt.getTime() > 3600000
                          ? `Hace ${Math.floor((new Date().getTime() - verification.submittedAt.getTime()) / 3600000)}h`
                          : "Hace poco"}
                      </Badge>
                    </div>
                  </div>

                  {/* Tabs */}
                  <TabsList>
                    <TabsTrigger value="details">Detalles</TabsTrigger>
                    <TabsTrigger value="documents">Documentos</TabsTrigger>
                  </TabsList>

                  {/* Details Tab */}
                  <TabsContent value="details" className="space-y-4">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground">Email</p>
                        <p className="font-medium">{verification.email}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Teléfono</p>
                        <p className="font-medium">
                          {verification.phone || verification.rif}
                        </p>
                      </div>

                      {verification.type === "creator" && (
                        <>
                          <div>
                            <p className="text-xs text-muted-foreground">
                              Tipo de documento
                            </p>
                            <p className="font-medium">
                              {verification.documentType}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">
                              Número
                            </p>
                            <p className="font-medium">
                              {verification.documentNumber}
                            </p>
                          </div>
                        </>
                      )}

                      {verification.type === "guarantor" && (
                        <>
                          <div>
                            <p className="text-xs text-muted-foreground">
                              Tipo de credencial
                            </p>
                            <p className="font-medium">
                              {verification.credentialType}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">
                              RIF/Identificación
                            </p>
                            <p className="font-medium">{verification.rif}</p>
                          </div>
                        </>
                      )}
                    </div>
                  </TabsContent>

                  {/* Documents Tab */}
                  <TabsContent value="documents" className="space-y-4">
                    <div className="border border-border rounded-lg p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <FileText className="w-5 h-5 text-primary" />
                        <div>
                          <p className="font-medium">
                            {verification.type === "creator"
                              ? verification.documentType
                              : verification.credentialType}
                          </p>
                        </div>
                      </div>
                      <div className="bg-muted rounded-lg overflow-hidden aspect-video flex items-center justify-center">
                        <img
                          src={verification.documentImage || "/placeholder.svg"}
                          alt="Document"
                          className="max-w-full max-h-full"
                        />
                      </div>
                    </div>
                  </TabsContent>

                  {/* Actions */}
                  <div className="border-t border-border pt-4 space-y-3">
                    {selectedId !== verification.id ? (
                      <div className="flex gap-3">
                        <Button
                          size="sm"
                          className="flex-1 bg-primary"
                          onClick={() => handleApprove(verification.id)}
                        >
                          <CheckCircle2 className="w-4 h-4 mr-2" />
                          Aprobar
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="flex-1"
                          onClick={() => setSelectedId(verification.id)}
                        >
                          <X className="w-4 h-4 mr-2" />
                          Rechazar
                        </Button>
                      </div>
                    ) : (
                      <>
                        <Textarea
                          placeholder="Explica por qué rechazas esta verificación..."
                          value={rejectionReason}
                          onChange={(e) => setRejectionReason(e.target.value)}
                          rows={3}
                        />
                        <div className="flex gap-3">
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1"
                            onClick={() => {
                              setSelectedId(null);
                              setRejectionReason("");
                            }}
                          >
                            Cancelar
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="flex-1"
                            onClick={() =>
                              handleReject(verification.id)
                            }
                          >
                            Confirmar rechazo
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                </Tabs>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
