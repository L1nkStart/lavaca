# LaVaca

Plataforma de crowdfunding para Venezuela. Inspirada en GoFundMe, pero diseñada
para el ecosistema local: meta y progreso en USD, conversión automática a
bolívares, KYC obligatorio para creadores, sistema de garantes para validar la
veracidad de cada campaña y soporte para múltiples métodos de pago
(internacional, local, cripto y manuales).

Documento de requerimientos: ver [`funcionalidades.md`](./funcionalidades.md).

---

## Stack

- **Next.js 15** (App Router) + **React 19**
- **Supabase** (Postgres + Auth + Storage)
- **TailwindCSS 4** + **Radix UI** + **shadcn/ui**
- **Stripe SDK** (tarjetas internacionales)
- **Binance Pay** (cripto)
- **PayPal** y **ChinChin** stubeados, listos para activar
- **Sonner** (toasts), **react-hook-form**, **zod**

---

## Setup local

### 1. Requisitos

- Node 20+
- npm o pnpm (el repo trae lockfiles de ambos)
- Una cuenta de Supabase

### 2. Instalar dependencias

```bash
npm install
# o
pnpm install
```

### 3. Variables de entorno

Copia [`.env.example`](./.env.example) a `.env.local` y completa al menos:

- `NEXT_PUBLIC_URL` (ej: `http://localhost:3000`)
- `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (para rutas admin y webhooks)
- `NEXT_PUBLIC_PAYMENT_MODE=test` (en desarrollo)

### 4. Base de datos

Los scripts SQL están en [`dumps/`](./dumps/). Aplícalos en orden desde el
SQL Editor de Supabase. El orden es importante: el 01 crea tablas, el resto
agrega features y arregla policies.

```text
01-create-tables.sql                  # tablas base
02-helpers-and-views.sql              # funciones y vistas
03-fix-rls-policies.sql               # RLS
04-auto-create-profiles.sql           # trigger para crear `public.users` al firmar
05-create-storage-buckets.sql         # buckets de Storage (KYC, capturas, imágenes)
06-update-campaigns-schema.sql        # columnas extra de campaigns
07-phase1-critical-features.sql       # garantes, updates, etc.
08-seed-test-data.sql                 # data de prueba (opcional)
09-fix-rls-policies.sql               # ajustes RLS
10-payment-transactions-table.sql     # log de transacciones de pago
11-notification-triggers.sql          # triggers de notificaciones
12-fix-notifications-rls.sql
13-exchange-rates-table.sql           # tasa BCV + freeze por sesión
14-fix-donations-display.sql
15-fix-donations-rls.sql
16-kyc-verification-system.sql        # verification_requests
17-compliance-underwriting.sql        # fund_freezes, user_suspensions, audit_logs
18-campaigns-documents-policy.sql
19-campaign-details-update-policy.sql
20-fix-kyc-rejection-trigger.sql
21-payment-methods-config.sql         # payment_method_configs + bank_accounts
22-expand-categories-catalog.sql      # categorías base
23-admin-and-owner-read-non-active-campaigns.sql
24-payment-methods-chinchin-paypal.sql # métodos PayPal + ChinChin (stub)
25-guarantor-invitations.sql          # flujo de garante: invitar / aceptar / rechazar
26-payment-captures.sql               # comprobantes de pago manual (bucket + columna)
```

Si ya tienes la DB y sólo quieres ver el esquema actual, abre
[`dumps/schema.sql`](./dumps/schema.sql).

### 5. Buckets de Storage

El script `05-create-storage-buckets.sql` crea los buckets, pero asegúrate de
que en el dashboard de Supabase existan estos con las policies aplicadas:

- `kyc-documents` (privado, creado por `05-create-storage-buckets.sql`)
- `payment-captures` (privado, creado por `26-payment-captures.sql`) — comprobantes de pagos manuales
- `campaigns` (público, creado por `05-create-storage-buckets.sql`) — imágenes de campaña
- `campaign-support` (privado, creado por `05-create-storage-buckets.sql`) — documentos de respaldo

### 6. Crear el primer admin

Por defecto cualquier usuario nuevo nace con `role = 'donor'`. Para promover
tu usuario a admin, desde el SQL Editor:

```sql
update public.users set role = 'admin' where email = 'tu@correo.com';
```

### 7. Arrancar

```bash
npm run dev
```

App en `http://localhost:3000`.

---

## Modo test vs producción de pagos

La variable `NEXT_PUBLIC_PAYMENT_MODE` controla cómo se comportan las pasarelas:

- **`test`** (default en `.env.example`): el `MockProvider` simula cualquier
  proveedor y auto-confirma los pagos al instante. Útil para QA del flujo
  completo sin tocar APIs externas. La tasa BCV sigue siendo la real (se
  consulta la tabla `exchange_rates` o la del `admin_config`).
- **`production`**: cada pasarela usa su SDK real. Si las credenciales no
  están seteadas, la pasarela no aparece como método disponible (no crashea).

### Pagos manuales

Zelle, Pago Móvil y transferencias bancarias usan flujo manual: el donante
reporta su pago con la referencia, queda como `pending`, y un admin lo aprueba
o rechaza desde **/admin/payments**. Eso lo controla la tabla
`payment_method_configs` (codes `zelle`, `pagomovil`, `transfer`).

---

## Integraciones de pago

| Proveedor | Estado | Cómo activarlo |
|-----------|--------|----------------|
| **Stripe** (tarjeta) | ✅ Implementado | Setear `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLIC_KEY`, `STRIPE_WEBHOOK_SECRET`. Configurar webhook a `/api/payments/stripe/webhook`. |
| **Binance Pay** (cripto) | ✅ Implementado | Setear `BINANCE_API_KEY`, `BINANCE_API_SECRET`, `BINANCE_PAY_CERT_SN`. Webhook a `/api/payments/binance/webhook`. |
| **PayPal** | 🟡 Stub completo | Setear `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_BASE_URL`, `PAYPAL_WEBHOOK_ID`. Webhook a `/api/payments/paypal/webhook`. Activar el método desde `/admin/payment-methods`. |
| **ChinChin** (Venezuela C2P) | 🟡 Stub completo | Setear `CHINCHIN_API_KEY`, `CHINCHIN_API_SECRET`, `CHINCHIN_MERCHANT_ID`, `CHINCHIN_WEBHOOK_SECRET`. Webhook a `/api/payments/chinchin/webhook`. **Ajustar endpoints y algoritmo de firma** en `lib/payments/providers/chinchin-provider.ts` según la documentación oficial cuando esté disponible. |
| **Zelle** | ✅ Manual | Configurar email/teléfono receptor desde `/admin/payment-methods`. Donante reporta referencia → admin aprueba. |
| **Pago Móvil** | ✅ Manual | Configurar banco/teléfono/cédula desde `/admin/payment-methods`. Donante reporta referencia → admin aprueba. |
| **Transferencia bancaria** | ✅ Manual | Configurar cuentas bancarias destino desde `/admin/payment-methods`. |

> Los stubs (PayPal, ChinChin) ya tienen creado: tipo en `PaymentProvider`,
> provider class con `createPayment` / `getPaymentStatus` / `handleWebhook` /
> `refund`, ruta de webhook con verificación de firma y entradas en
> `payment_method_configs` (desactivadas). Sólo falta agregar credenciales y
> activar la fila desde el admin.

---

## Rutas relevantes

### Público

- `/` — landing con destacadas y stats reales.
- `/campaigns` — catálogo con filtros y búsqueda.
- `/campaigns/[id]` — detalle de campaña + donación + comentarios.
- `/garantia`, `/terms`, `/privacy`, `/refund-policy`, `/acceptable-use-policy`,
  `/how-it-works` — páginas legales/informativas.

### Auth

- `/auth/login`, `/auth/register`, `/auth/verify`, `/auth/callback`,
  `/auth/signout`.

### Donante

- `/profile` — perfil, historial de donaciones, KYC, cuentas de retiro.

### Creador (requiere KYC verificado para publicar)

- `/creator/dashboard`
- `/creator/campaigns`
- `/creator/campaigns/create`
- `/creator/campaigns/[id]/edit` — incluye el botón "Invitar garante".

### Garante (Veedor)

- `/guarantor/dashboard` — invitaciones pendientes (aceptar / rechazar) e historial.
  El rol se asigna automáticamente al aceptar la primera invitación.

### Admin (`role = 'admin'`)

- `/admin/dashboard`
- `/admin/campaigns` — cola de revisión.
- `/admin/verifications` — cola KYC.
- `/admin/payments` — aprobar pagos manuales.
- `/admin/withdrawals` — procesar retiros.
- `/admin/payment-methods` — activar/configurar pasarelas y cuentas bancarias.
- `/admin/settings` — comisión de plataforma, tasa BCV, categorías.

### API

- `POST /api/donations` — crea donación + lanza pasarela.
- `GET  /api/exchange-rate` — devuelve la tasa congelada por sesión (10 min).
- `POST /api/exchange-rate/update` — refresca la tasa desde Binance P2P.
- `GET|PATCH /api/admin/settings` — comisión + tasa de respaldo.
- `GET|POST|PATCH|DELETE /api/admin/categories` — CRUD de categorías.
- `POST /api/payments/stripe/webhook`
- `POST /api/payments/binance/webhook`
- `POST /api/payments/paypal/webhook`
- `POST /api/payments/chinchin/webhook`
- `POST /api/withdrawals/request`
- `GET|POST /api/guarantor/invitations` — listar / crear invitaciones.
- `PATCH|DELETE /api/guarantor/invitations/[id]` — aceptar/rechazar/cancelar.
- `POST /api/donations/capture-upload` — sube comprobante de pago manual (FormData).
- Resto bajo `app/api/admin/*` (campañas, verificaciones, retiros, pagos).

---

## Deploy

Recomendado: **Vercel + Supabase Cloud**.

1. Conectar el repo a Vercel.
2. Configurar todas las variables de `.env.example` en el proyecto de Vercel.
3. Aplicar las migraciones SQL en Supabase Cloud (ver paso 4 del setup).
4. Configurar webhooks de cada pasarela apuntando al dominio final
   (`https://tu-dominio.com/api/payments/{provider}/webhook`).
5. Cambiar `NEXT_PUBLIC_PAYMENT_MODE=production`.

---

## Scripts

| Comando | Qué hace |
|---------|----------|
| `npm run dev` | Servidor de desarrollo. |
| `npm run build` | Build de producción. |
| `npm run start` | Sirve el build. |
| `npm run lint` | ESLint. |

---

## Estructura del sistema de pagos

```
lib/payments/
├── base-provider.ts        # clase abstracta común
├── config.ts               # initializePayments() + isTestMode()
├── payment-factory.ts      # crea instancias por enum
├── payment-manager.ts      # orquesta processPayment / refund / status
├── types.ts                # enums, interfaces, errores
├── stripe-loader.ts        # carga condicional del SDK de Stripe en cliente
└── providers/
    ├── mock-provider.ts    # usado en test mode y para métodos manuales
    ├── stripe-provider.ts
    ├── binance-provider.ts
    ├── paypal-provider.ts  # stub completo
    └── chinchin-provider.ts # stub completo
```

Para agregar un nuevo proveedor:

1. Crear `lib/payments/providers/X-provider.ts` extendiendo `BasePaymentProvider`.
2. Añadir el `enum PaymentProvider.X` en `types.ts`.
3. Registrarlo en el `switch` de `PaymentFactory.createProvider`.
4. Añadir su bloque de configuración en `config.ts` (`initializePayments`).
5. Crear `app/api/payments/X/webhook/route.ts`.
6. Sembrar la fila en `payment_method_configs` y ampliar el CHECK constraint si
   hace falta (ver `dumps/24-payment-methods-chinchin-paypal.sql` como ejemplo).
