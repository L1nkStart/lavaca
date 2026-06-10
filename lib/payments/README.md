# 💳 Sistema de Pagos - LaVaca

Arquitectura robusta y escalable para integrar múltiples proveedores de pago.

## 📋 Tabla de Contenidos

- [Arquitectura](#arquitectura)
- [Proveedores Soportados](#proveedores-soportados)
- [Instalación](#instalación)
- [Configuración](#configuración)
- [Uso Básico](#uso-básico)
- [Crear Nuevo Proveedor](#crear-nuevo-proveedor)
- [Webhooks](#webhooks)
- [Manejo de Errores](#manejo-de-errores)

## 🏗️ Arquitectura

### Componentes Principales

```
lib/payments/
├── types.ts              # Tipos e interfaces
├── base-provider.ts      # Clase abstracta base
├── payment-factory.ts    # Factory Pattern
├── payment-manager.ts    # Orquestador principal
├── providers/            # Implementaciones específicas
│   ├── stripe-provider.ts
│   ├── paypal-provider.ts
│   ├── binance-provider.ts
│   ├── zelle-provider.ts
│   └── pagomovil-provider.ts
└── README.md
```

### Patrón de Diseño

**Factory Pattern + Strategy Pattern:**
- Cada proveedor implementa `IPaymentProvider`
- El Factory crea instancias según configuración
- El Manager orquesta toda la lógica de negocio

## 🌐 Proveedores Soportados

### Implementados (próximamente)

| Proveedor | Tipo | Regiones | Status |
|-----------|------|----------|--------|
| **Stripe** | Tarjetas | Global | 🟡 Pendiente |
| **PayPal** | Wallet | Global | 🟡 Pendiente |
| **Binance** | Crypto | Global | 🟡 Pendiente |
| **Zelle** | Transferencia | USA/LATAM | 🟡 Pendiente |
| **Pago Móvil** | Mobile | Venezuela | 🟡 Pendiente |
| **Banesco** | Banco | Venezuela | 🟡 Pendiente |
| **Banco Mercantil** | Banco | Venezuela | 🟡 Pendiente |
| **Banco Venezuela** | Banco | Venezuela | 🟡 Pendiente |

## 📦 Instalación

### 1. Variables de Entorno

Crea/actualiza tu `.env.local`:

```bash
# Stripe
STRIPE_PUBLIC_KEY=pk_test_xxxxx
STRIPE_SECRET_KEY=sk_test_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx

# PayPal
PAYPAL_CLIENT_ID=xxxxx
PAYPAL_CLIENT_SECRET=xxxxx
PAYPAL_WEBHOOK_ID=xxxxx

# Binance
BINANCE_API_KEY=xxxxx
BINANCE_API_SECRET=xxxxx

# Zelle (Manual)
ZELLE_EMAIL=donations@lavaca.com.ve
ZELLE_PHONE=+1234567890

# PagoMóvil (Manual)
PAGOMOVIL_BANK_CODE=0134
PAGOMOVIL_PHONE=04241234567
PAGOMOVIL_CEDULA=V12345678
```

### 2. Instalar Dependencias

```bash
npm install stripe @paypal/checkout-server-sdk
```

## ⚙️ Configuración

### Inicializar en tu aplicación

```typescript
// lib/payments/config.ts
import { PaymentFactory } from './payment-factory';
import { PaymentProvider } from './types';

// Registrar configuraciones al inicio de la app
export function initializePayments() {
    PaymentFactory.registerConfigs([
        {
            provider: PaymentProvider.STRIPE,
            enabled: true,
            apiKey: process.env.STRIPE_SECRET_KEY,
            publicKey: process.env.STRIPE_PUBLIC_KEY,
            webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
            environment: 'sandbox', // o 'production'
        },
        {
            provider: PaymentProvider.PAYPAL,
            enabled: true,
            apiKey: process.env.PAYPAL_CLIENT_ID,
            apiSecret: process.env.PAYPAL_CLIENT_SECRET,
            environment: 'sandbox',
        },
        {
            provider: PaymentProvider.BINANCE,
            enabled: true,
            apiKey: process.env.BINANCE_API_KEY,
            apiSecret: process.env.BINANCE_API_SECRET,
            environment: 'production',
        },
        // ... más proveedores
    ]);
}
```

## 🚀 Uso Básico

### 1. Procesar un Pago

```typescript
import { PaymentManager } from '@/lib/payments/payment-manager';
import { PaymentProvider, PaymentType } from '@/lib/payments/types';

// En tu API route
export async function POST(request: Request) {
    const { campaignId, amount, provider } = await request.json();

    const result = await PaymentManager.processPayment({
        amount: {
            usd: amount,
            bs: amount * 41.25, // Exchange rate
        },
        provider: provider,
        paymentType: PaymentType.CARD,
        metadata: {
            campaignId,
            donationId: 'don_xxxxx',
            donorEmail: 'donor@email.com',
            isAnonymous: false,
        },
        returnUrl: `${process.env.NEXT_PUBLIC_URL}/success`,
        cancelUrl: `${process.env.NEXT_PUBLIC_URL}/cancel`,
    });

    return Response.json(result);
}
```

### 2. Verificar Estado de Pago

```typescript
const status = await PaymentManager.checkPaymentStatus(
    'txn_123456',
    PaymentProvider.STRIPE
);

console.log(status.status); // 'completed', 'pending', 'failed'
```

### 3. Procesar Webhooks

```typescript
// app/api/webhooks/stripe/route.ts
import { PaymentManager } from '@/lib/payments/payment-manager';
import { PaymentProvider } from '@/lib/payments/types';

export async function POST(request: Request) {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    // Stripe verificará la firma internamente
    const event = {
        provider: PaymentProvider.STRIPE,
        eventType: 'payment_intent.succeeded',
        transactionId: 'txn_xxxxx',
        status: PaymentStatus.COMPLETED,
        timestamp: new Date(),
        rawData: body,
    };

    const result = await PaymentManager.handleWebhook(event);

    return Response.json({ received: true });
}
```

### 4. Procesar Reembolso

```typescript
const refund = await PaymentManager.refundPayment({
    transactionId: 'txn_123456',
    amount: {
        usd: 50.00,
    },
    reason: 'Requested by donor',
});
```

## 🔨 Crear Nuevo Proveedor

### 1. Crear el archivo del proveedor

```typescript
// lib/payments/providers/stripe-provider.ts
import { BasePaymentProvider } from '../base-provider';
import { PaymentProvider, ProcessPaymentRequest, PaymentResult } from '../types';
import Stripe from 'stripe';

export class StripeProvider extends BasePaymentProvider {
    private stripe: Stripe | null = null;

    constructor() {
        super(PaymentProvider.STRIPE);
    }

    protected async onInitialize(): Promise<void> {
        this.stripe = new Stripe(this.config.apiKey!, {
            apiVersion: '2023-10-16',
        });
    }

    async createPayment(request: ProcessPaymentRequest): Promise<PaymentResult> {
        try {
            const session = await this.stripe!.checkout.sessions.create({
                payment_method_types: ['card'],
                line_items: [{
                    price_data: {
                        currency: 'usd',
                        product_data: {
                            name: `Donación a ${request.metadata.campaignId}`,
                        },
                        unit_amount: Math.round(request.amount.usd * 100),
                    },
                    quantity: 1,
                }],
                mode: 'payment',
                success_url: request.returnUrl,
                cancel_url: request.cancelUrl,
                metadata: {
                    campaignId: request.metadata.campaignId,
                    donationId: request.metadata.donationId,
                },
            });

            return this.createPendingResult(session.id, session.id);
        } catch (error: any) {
            return this.createErrorResult(error.message);
        }
    }

    async getPaymentStatus(transactionId: string): Promise<PaymentResult> {
        const session = await this.stripe!.checkout.sessions.retrieve(transactionId);
        
        return {
            success: session.payment_status === 'paid',
            transactionId,
            status: session.payment_status === 'paid' 
                ? PaymentStatus.COMPLETED 
                : PaymentStatus.PENDING,
        };
    }

    async handleWebhook(event: WebhookEvent): Promise<PaymentResult> {
        // Implementar lógica de webhook
        return this.createSuccessResult(event.transactionId);
    }

    async refund(request: RefundRequest): Promise<PaymentResult> {
        const refund = await this.stripe!.refunds.create({
            payment_intent: request.transactionId,
            amount: Math.round(request.amount.usd * 100),
        });

        return this.createSuccessResult(refund.id);
    }

    validateConfig(): boolean {
        return super.validateConfig() && !!this.config.apiKey;
    }
}
```

### 2. Registrar en el Factory

```typescript
// lib/payments/payment-factory.ts

// Importar
import { StripeProvider } from './providers/stripe-provider';

// Agregar al switch
case PaymentProvider.STRIPE:
    providerInstance = new StripeProvider();
    break;
```

## 🔔 Webhooks

### URLs de Webhooks por Proveedor

```
Stripe:   https://tudominio.com/api/webhooks/stripe
PayPal:   https://tudominio.com/api/webhooks/paypal
Binance:  https://tudominio.com/api/webhooks/binance
```

### Configurar en cada plataforma

1. **Stripe Dashboard** → Developers → Webhooks
2. **PayPal Dashboard** → Webhooks
3. **Binance** → API Management

## ⚠️ Manejo de Errores

```typescript
try {
    const result = await PaymentManager.processPayment(request);
} catch (error) {
    if (error instanceof PaymentError) {
        console.error('Payment error:', {
            code: error.code,
            provider: error.provider,
            message: error.message,
            metadata: error.metadata,
        });
    }
}
```

### Códigos de Error

- `INVALID_AMOUNT`: Monto inválido
- `INVALID_CONFIG`: Configuración incorrecta
- `PROVIDER_ERROR`: Error del proveedor externo
- `NETWORK_ERROR`: Error de red
- `WEBHOOK_VALIDATION_FAILED`: Webhook no válido
- `REFUND_FAILED`: Falló el reembolso
- `TRANSACTION_NOT_FOUND`: Transacción no encontrada

## 📊 Base de Datos

### Tabla requerida: `payment_transactions`

```sql
CREATE TABLE payment_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    donation_id UUID NOT NULL REFERENCES donations(id),
    provider TEXT NOT NULL,
    status TEXT NOT NULL,
    amount_usd NUMERIC NOT NULL,
    amount_bs NUMERIC,
    external_id TEXT,
    provider_data JSONB,
    error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);
```

### Función SQL requerida

```sql
CREATE OR REPLACE FUNCTION increment_campaign_amount(
    campaign_id UUID,
    amount_to_add NUMERIC
)
RETURNS VOID AS $$
BEGIN
    UPDATE campaigns 
    SET current_amount_usd = current_amount_usd + amount_to_add
    WHERE id = campaign_id;
END;
$$ LANGUAGE plpgsql;
```

## 🧪 Testing

```typescript
// Usar modo sandbox para pruebas
const testConfig = {
    provider: PaymentProvider.STRIPE,
    enabled: true,
    environment: 'sandbox',
    apiKey: 'sk_test_xxxxx',
};
```

## 📝 Licencia

Parte del proyecto LaVaca - Crowdfunding para Venezuela

---

**¿Preguntas?** Revisa la documentación o contacta al equipo de desarrollo.
