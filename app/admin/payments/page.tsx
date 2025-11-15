"use client";

import { useState } from "react";
import { AdminSidebar } from "@/components/admin-sidebar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, X } from 'lucide-react';

const MANUAL_PAYMENTS = [
  {
    id: "1",
    campaign: "Cirugía urgente - Niño con malformación cardíaca",
    amount: 500,
    method: "Zelle",
    reference: "TXN123456789",
    donor: "Ana García",
    submittedAt: new Date("2025-11-14T10:30:00"),
    status: "pending",
  },
  {
    id: "2",
    campaign: "Educación superior para jóvenes",
    amount: 1200,
    method: "Transferencia Bs.",
    reference: "REF987654321",
    donor: "Carlos López",
    submittedAt: new Date("2025-11-14T08:15:00"),
    status: "pending",
  },
  {
    id: "3",
    campaign: "Microempresa",
    amount: 350,
    method: "Crypto (USDT)",
    reference: "0x742d35Cc6634C0532925a3b844Bc9e7595f50",
    donor: "Anónimo",
    submittedAt: new Date("2025-11-13T15:45:00"),
    status: "pending",
  },
];

export default function AdminPaymentsPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");

  const handleApprove = (id: string) => {
    alert("Pago aprobado y acreditado");
  };

  const handleReject = (id: string) => {
    alert("Pago rechazado");
    setSelectedId(null);
    setNotes("");
  };

  return (
    <div className="flex min-h-screen bg-background">
      <AdminSidebar />

      <main className="flex-1 overflow-auto">
        {/* Header */}
        <div className="border-b border-border bg-card sticky top-0 z-40">
          <div className="px-8 py-6">
            <h1 className="text-3xl font-bold">Pagos Manuales</h1>
            <p className="text-muted-foreground mt-1">
              Verifica y aprueba pagos manuales (Zelle, transferencia, cripto)
            </p>
          </div>
        </div>

        <div className="p-8 space-y-4">
          {MANUAL_PAYMENTS.map((payment) => (
            <Card key={payment.id}>
              <CardContent className="pt-6 space-y-4">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-bold text-lg mb-1">{payment.campaign}</h3>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{payment.method}</Badge>
                      <span className="text-xs text-muted-foreground">
                        Enviado por {payment.donor}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-primary">
                      ${payment.amount.toFixed(2)}
                    </p>
                    <p className="text-xs text-muted-foreground">USD</p>
                  </div>
                </div>

                {/* Payment Details */}
                <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Referencia</p>
                    <p className="font-mono text-sm break-all">
                      {payment.reference}
                    </p>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Método</p>
                      <p className="font-medium">{payment.method}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Reportado</p>
                      <p className="font-medium">
                        {payment.submittedAt.toLocaleDateString("es-VE", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Notes/Rejection Reason */}
                {selectedId === payment.id && (
                  <Textarea
                    placeholder="Notas o razón de rechazo..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                  />
                )}

                {/* Actions */}
                <div className="flex gap-3 border-t border-border pt-4">
                  {selectedId !== payment.id ? (
                    <>
                      <Button
                        size="sm"
                        className="flex-1 bg-primary"
                        onClick={() => handleApprove(payment.id)}
                      >
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        Aprobar pago
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => setSelectedId(payment.id)}
                      >
                        <X className="w-4 h-4 mr-2" />
                        Rechazar
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => {
                          setSelectedId(null);
                          setNotes("");
                        }}
                      >
                        Cancelar
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="flex-1"
                        onClick={() => handleReject(payment.id)}
                      >
                        Confirmar rechazo
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
