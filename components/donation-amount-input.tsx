"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useEffect, useState } from "react";

interface DonationAmountInputProps {
  amountUSD: number;
  onAmountChange: (amount: number) => void;
  exchangeRate?: number;
}

export function DonationAmountInput({
  amountUSD,
  onAmountChange,
  exchangeRate = 41.25,
}: DonationAmountInputProps) {
  const [localAmount, setLocalAmount] = useState(amountUSD.toString());

  useEffect(() => {
    setLocalAmount(amountUSD.toString());
  }, [amountUSD]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setLocalAmount(value);
    const numValue = parseFloat(value) || 0;
    if (numValue > 0) {
      onAmountChange(numValue);
    }
  };

  const amountVEF = (amountUSD * exchangeRate).toFixed(2);
  const suggestedAmounts = [10, 25, 50, 100];

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="amount-usd">Monto a donar (USD)</Label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            $
          </span>
          <Input
            id="amount-usd"
            type="number"
            min="1"
            step="0.01"
            placeholder="0.00"
            value={localAmount}
            onChange={handleChange}
            className="pl-7"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Mínimo: $1.00 • Máximo: $50,000.00
        </p>
      </div>

      {/* Suggested Amounts */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground mb-2">
          Montos sugeridos:
        </p>
        <div className="grid grid-cols-4 gap-2">
          {suggestedAmounts.map((amount) => (
            <button
              key={amount}
              onClick={() => {
                setLocalAmount(amount.toString());
                onAmountChange(amount);
              }}
              className={`py-2 px-3 rounded-lg text-sm font-semibold transition-colors ${
                amountUSD === amount
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-foreground hover:bg-muted/80'
              }`}
            >
              ${amount}
            </button>
          ))}
        </div>
      </div>

      {/* Exchange Info Card */}
      <Card className="bg-muted/50">
        <CardContent className="pt-6 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Monto en USD:</span>
            <span className="font-semibold">${amountUSD.toFixed(2)}</span>
          </div>
          <div className="border-t border-border pt-2">
            <p className="text-xs text-muted-foreground mb-1">
              Equivalente en Bs. (Tasa BCV: {exchangeRate.toFixed(2)}):
            </p>
            <p className="text-lg font-bold text-accent">
              Bs. {amountVEF}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
