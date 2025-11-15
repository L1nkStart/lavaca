"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const BANKS = [
  "BancoVenezolano",
  "BancoPróximo",
  "Banco del Tesoro",
  "Banco Agrícola",
  "Banesco",
  "BBVA",
  "Mercantil",
];

interface PagoMovilFormProps {
  data: {
    bank: string;
    phone: string;
    cedula: string;
  };
  onChange: (data: any) => void;
}

export function PagoMovilForm({ data, onChange }: PagoMovilFormProps) {
  return (
    <div className="space-y-4">
      <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
        <CardHeader>
          <CardTitle className="text-base">Instrucciones PagoMóvil</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          <ol className="list-decimal list-inside space-y-1 text-blue-900 dark:text-blue-100">
            <li>Selecciona tu banco</li>
            <li>Ingresa tu número de teléfono sin el 58 inicial</li>
            <li>Ingresa tu número de cédula</li>
            <li>Haz clic en "Continuar con PagoMóvil"</li>
            <li>Confirma el pago desde tu app bancaria</li>
            <li>Tu donación se procesará automáticamente</li>
          </ol>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <div>
          <Label htmlFor="bank">Banco</Label>
          <Select
            value={data.bank}
            onValueChange={(bank) =>
              onChange({ ...data, bank })
            }
          >
            <SelectTrigger id="bank">
              <SelectValue placeholder="Selecciona tu banco" />
            </SelectTrigger>
            <SelectContent>
              {BANKS.map((bank) => (
                <SelectItem key={bank} value={bank}>
                  {bank}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="phone">Número de teléfono (sin 58)</Label>
          <Input
            id="phone"
            type="tel"
            placeholder="2641234567"
            value={data.phone}
            onChange={(e) =>
              onChange({ ...data, phone: e.target.value })
            }
          />
          <p className="text-xs text-muted-foreground mt-1">
            Ejemplo: 2641234567 (sin el 58)
          </p>
        </div>

        <div>
          <Label htmlFor="cedula">Número de cédula</Label>
          <Input
            id="cedula"
            type="text"
            placeholder="V12345678"
            value={data.cedula}
            onChange={(e) =>
              onChange({ ...data, cedula: e.target.value.toUpperCase() })
            }
          />
        </div>
      </div>
    </div>
  );
}
