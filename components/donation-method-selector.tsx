"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { CreditCard, Banknote, Smartphone, Mail, TrendingUp, Coins } from 'lucide-react';

export type PaymentMethod = 'card' | 'paypal' | 'pagomovil' | 'zelle' | 'transfer' | 'crypto';

interface PaymentMethodOption {
  id: PaymentMethod;
  name: string;
  description: string;
  icon: React.ReactNode;
  badge?: string;
  processing: 'automatic' | 'manual';
}

const PAYMENT_METHODS: PaymentMethodOption[] = [
  {
    id: 'card',
    name: 'Tarjeta de Crédito',
    description: 'Visa, Mastercard, American Express',
    icon: <CreditCard className="w-5 h-5" />,
    badge: 'Automático',
    processing: 'automatic',
  },
  {
    id: 'paypal',
    name: 'PayPal',
    description: 'Transferencia instantánea',
    icon: <Banknote className="w-5 h-5" />,
    badge: 'Automático',
    processing: 'automatic',
  },
  {
    id: 'pagomovil',
    name: 'PagoMóvil',
    description: 'BancoVenezolano, BancoPróximo, etc.',
    icon: <Smartphone className="w-5 h-5" />,
    badge: 'Automático',
    processing: 'automatic',
  },
  {
    id: 'zelle',
    name: 'Zelle',
    description: 'Transferencia bancaria internacional',
    icon: <Mail className="w-5 h-5" />,
    badge: 'Manual',
    processing: 'manual',
  },
  {
    id: 'transfer',
    name: 'Transferencia Bancaria',
    description: 'En Bolívares o divisas',
    icon: <TrendingUp className="w-5 h-5" />,
    badge: 'Manual',
    processing: 'manual',
  },
  {
    id: 'crypto',
    name: 'Criptomonedas',
    description: 'USDT (BEP20, TRC20)',
    icon: <Coins className="w-5 h-5" />,
    badge: 'Manual',
    processing: 'manual',
  },
];

interface DonationMethodSelectorProps {
  value: PaymentMethod;
  onChange: (method: PaymentMethod) => void;
}

export function DonationMethodSelector({
  value,
  onChange,
}: DonationMethodSelectorProps) {
  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-foreground">Elige tu método de pago</h3>
      
      <RadioGroup value={value} onValueChange={(val) => onChange(val as PaymentMethod)}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {PAYMENT_METHODS.map((method) => (
            <div key={method.id}>
              <RadioGroupItem value={method.id} id={method.id} className="sr-only" />
              <Label
                htmlFor={method.id}
                className={`flex items-start gap-4 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                  value === method.id
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <div className="mt-1 text-primary">{method.icon}</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-foreground">
                      {method.name}
                    </span>
                    <Badge variant="secondary" className="text-xs">
                      {method.badge}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {method.description}
                  </p>
                </div>
              </Label>
            </div>
          ))}
        </div>
      </RadioGroup>

      <div className="p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
        <p className="text-sm text-blue-900 dark:text-blue-100">
          <span className="font-semibold">Métodos manuales:</span> Tu donación se procesará después de que verifiquemos el comprobante de pago.
        </p>
      </div>
    </div>
  );
}
