"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle } from 'lucide-react';

interface ManualPaymentFormProps {
  paymentType: 'zelle' | 'transfer' | 'crypto';
  data: {
    reference: string;
    proofDescription: string;
  };
  onChange: (data: any) => void;
}

export function ManualPaymentForm({
  paymentType,
  data,
  onChange,
}: ManualPaymentFormProps) {
  const getInstructions = () => {
    switch (paymentType) {
      case 'zelle':
        return {
          title: 'Instrucciones Zelle',
          details: [
            'Email de Zelle: support@lavaca.app',
            'Concepto: LaVaca Donation - Tu nombre',
            'Monto: El especificado arriba',
          ],
        };
      case 'transfer':
        return {
          title: 'Instrucciones Transferencia Bancaria',
          details: [
            'Banco: Banco del Tesoro',
            'Titular: Fundación LaVaca',
            'RIF: J-50000000-0',
            'Cuenta: 0150-0000-12345678-90',
            'Concepto: Tu nombre y cédula',
          ],
        };
      case 'crypto':
        return {
          title: 'Instrucciones Criptomonedas',
          details: [
            'Criptomoneda: USDT (BEP20 o TRC20)',
            'Dirección Wallet: 0x742d35Cc6634C0532925a3b844Bc9e7595f50',
            'Después de enviar, reporta el Hash de transacción',
          ],
        };
    }
  };

  const instructions = getInstructions();

  return (
    <div className="space-y-4">
      <Card className="bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            {instructions?.title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-yellow-900 dark:text-yellow-100">
            {instructions?.details.map((detail, idx) => (
              <li key={idx} className="font-mono text-xs">
                {detail}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <div>
          <Label htmlFor="reference">Referencia o número de transacción</Label>
          <Input
            id="reference"
            placeholder="Ej: TXN12345678 o Referencia del banco"
            value={data.reference}
            onChange={(e) =>
              onChange({ ...data, reference: e.target.value })
            }
          />
          <p className="text-xs text-muted-foreground mt-1">
            Copia el número de referencia de tu transferencia o comprobante
          </p>
        </div>

        <div>
          <Label htmlFor="proof">Detalles adicionales (opcional)</Label>
          <Textarea
            id="proof"
            placeholder="Cuéntanos los detalles de tu transferencia (nombre del banco, hora aproximada, etc.)"
            value={data.proofDescription}
            onChange={(e) =>
              onChange({ ...data, proofDescription: e.target.value })
            }
            rows={3}
          />
        </div>

        <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
          <CardContent className="pt-6">
            <p className="text-xs text-blue-900 dark:text-blue-100">
              Un administrador verificará tu pago en las próximas 24-48 horas. Recibirás una
              confirmación por correo cuando se apruebe tu donación.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
