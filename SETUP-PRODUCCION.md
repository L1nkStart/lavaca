# LaVaca — Guía de Configuración para Producción

Este documento describe **todo** lo que falta configurar para dejar la
plataforma operativa en producción. Está ordenado por prioridad. Marca cada
paso con `[x]` a medida que lo completes.

> **TL;DR**: aplica las 26 migraciones, crea cuentas en Supabase + cada
> pasarela, completa el `.env`, configura los webhooks, promueve tu usuario
> a admin y activa cada método de pago desde `/admin/payment-methods`.

---

## Índice

1. [Pre-requisitos](#1-pre-requisitos)
2. [Supabase (base de datos + storage + auth)](#2-supabase)
3. [Variables de entorno](#3-variables-de-entorno)
4. [Stripe (tarjeta internacional)](#4-stripe-tarjeta)
5. [Binance Pay (cripto)](#5-binance-pay-cripto)
6. [ChinChin (Venezuela C2P)](#6-chinchin-venezuela-c2p)
7. [PayPal](#7-paypal)
8. [Métodos manuales (Zelle, PagoMóvil, transferencia)](#8-métodos-manuales)
9. [Email transaccional (opcional)](#9-email-transaccional-opcional)
10. [KYC de Garante (opcional)](#10-kyc-de-garante-opcional)
11. [Deploy a Vercel](#11-deploy-a-vercel)
12. [Activación: pasar de test a producción](#12-activación-pasar-de-test-a-producción)
13. [Verificación final (smoke test)](#13-verificación-final-smoke-test)
14. [Tareas recurrentes (cron)](#14-tareas-recurrentes-cron)
15. [Mantenimiento y monitoreo](#15-mantenimiento-y-monitoreo)

---

## 1. Pre-requisitos

- [ ] **Cuenta de GitHub** con el repo `lavaca` privado.
- [ ] **Node 20+** instalado localmente (`node -v`).
- [ ] **npm** o **pnpm** (el repo trae ambos lockfiles).
- [ ] **Dominio** registrado (ej: `lavaca.app`) con DNS gestionable.
- [ ] **Cuenta bancaria/persona jurídica venezolana** para recibir los pagos
      locales (Bs, PagoMóvil, transferencias).
- [ ] **Email corporativo** del proyecto para recibir notificaciones
      operativas (ej: `admin@lavaca.app`).

---

## 2. Supabase

### 2.1 Crear proyecto

- [ ] Ir a https://supabase.com → New Project.
- [ ] Región: **East US (North Virginia)** o la más cercana a Venezuela con
      buena latencia (Vercel también está en US-East por defecto).
- [ ] Plan: **Pro** ($25/mes) — necesario para backups diarios y mayor cuota
      de Storage. El Free funciona para QA.
- [ ] Guardar contraseña de la base de datos en un gestor seguro.

### 2.2 Aplicar las migraciones

Desde el **SQL Editor** de Supabase (o `psql`), ejecuta los archivos en
`dumps/` en orden estricto. NO se puede saltar pasos.

- [ ] `01-create-tables.sql`
- [ ] `02-helpers-and-views.sql`
- [ ] `03-fix-rls-policies.sql`
- [ ] `04-auto-create-profiles.sql`
- [ ] `05-create-storage-buckets.sql`
- [ ] `06-update-campaigns-schema.sql`
- [ ] `07-phase1-critical-features.sql`
- [ ] `08-seed-test-data.sql` *(opcional — sólo para QA, NO correr en
      producción real)*
- [ ] `09-fix-rls-policies.sql`
- [ ] `10-payment-transactions-table.sql`
- [ ] `11-notification-triggers.sql`
- [ ] `12-fix-notifications-rls.sql`
- [ ] `13-exchange-rates-table.sql`
- [ ] `14-fix-donations-display.sql`
- [ ] `15-fix-donations-rls.sql`
- [ ] `16-kyc-verification-system.sql`
- [ ] `17-compliance-underwriting.sql`
- [ ] `18-campaigns-documents-policy.sql`
- [ ] `19-campaign-details-update-policy.sql`
- [ ] `20-fix-kyc-rejection-trigger.sql`
- [ ] `21-payment-methods-config.sql`
- [ ] `22-expand-categories-catalog.sql`
- [ ] `23-admin-and-owner-read-non-active-campaigns.sql`
- [ ] `24-payment-methods-chinchin-paypal.sql`
- [ ] `25-guarantor-invitations.sql`
- [ ] `26-payment-captures.sql`

### 2.3 Verificar buckets de Storage

Desde **Storage** en Supabase, confirma que existan estos 4 buckets:

- [ ] `campaigns` (público) — imágenes de campaña.
- [ ] `campaign-support` (privado) — documentos de respaldo.
- [ ] `kyc-documents` (privado) — documentos KYC.
- [ ] `payment-captures` (privado) — comprobantes de pago manual.

Las policies se crean automáticamente en `05` y `26`. Si alguna falta, revisa
el SQL Editor para ver errores.

### 2.4 Configurar Auth

Desde **Authentication → Providers**:

- [ ] **Email**: activo. Confirmar que `Email confirmation` esté **on**.
- [ ] **Google OAuth** (opcional pero recomendado):
  - Crear OAuth client en https://console.cloud.google.com/apis/credentials
  - Authorized redirect URI: `https://<tu-proyecto>.supabase.co/auth/v1/callback`
  - Pegar `Client ID` y `Client Secret` en Supabase.

Desde **Authentication → URL Configuration**:

- [ ] Site URL: `https://lavaca.app` (o tu dominio final).
- [ ] Redirect URLs: agregar `https://lavaca.app/auth/callback` y, durante
      desarrollo, `http://localhost:3000/auth/callback`.

Desde **Authentication → Email Templates**:

- [ ] Personalizar plantillas "Confirm signup", "Magic Link", "Reset password"
      con el branding de LaVaca y el dominio final.

### 2.5 Promover tu usuario a admin

Después de registrarte por primera vez en la app, ejecuta en el SQL Editor:

```sql
update public.users
   set role = 'admin'
 where email = 'tu@correo.com';
```

- [ ] Confirmar que `/admin/dashboard` carga sin errores.

### 2.6 Crear las cuentas bancarias destino

Desde `/admin/payment-methods`:

- [ ] Pestaña **transfer**: agregar cada cuenta bancaria donde recibirás
      transferencias en Bs (banco, titular, número de cuenta, cédula/RIF).
- [ ] Pestaña **pagomovil**: agregar banco/teléfono/cédula de PagoMóvil.
- [ ] Pestaña **zelle**: agregar email y nombre del titular Zelle.

---

## 3. Variables de entorno

Copia [`.env.example`](./.env.example) a `.env.local` (desarrollo) y
configura las mismas variables en **Vercel → Project → Settings →
Environment Variables** (producción).

### 3.1 Obligatorias

| Variable | Dónde se obtiene |
|----------|------------------|
| `NEXT_PUBLIC_URL` | Tu dominio final: `https://lavaca.app` |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API → `anon` `public` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → `service_role` `secret` |
| `NEXT_PUBLIC_PAYMENT_MODE` | `test` en dev, `production` cuando estés listo |

> ⚠️ La `service_role` key **NO debe** aparecer en código cliente. Vercel
> sabe que las variables sin `NEXT_PUBLIC_` solo se exponen al server.

### 3.2 Por proveedor (ver secciones específicas más abajo)

| Proveedor | Variables |
|-----------|-----------|
| Stripe | `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLIC_KEY`, `STRIPE_WEBHOOK_SECRET` |
| Binance Pay | `BINANCE_API_KEY`, `BINANCE_API_SECRET`, `BINANCE_PAY_CERT_SN`, `BINANCE_PAY_BASE_URL` |
| ChinChin | `CHINCHIN_API_KEY`, `CHINCHIN_API_SECRET`, `CHINCHIN_MERCHANT_ID`, `CHINCHIN_BASE_URL`, `CHINCHIN_WEBHOOK_SECRET` |
| PayPal | `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_BASE_URL`, `PAYPAL_WEBHOOK_ID` |
| Zelle | `ZELLE_EMAIL`, `ZELLE_PHONE` |
| PagoMóvil | `PAGOMOVIL_BANK_CODE`, `PAGOMOVIL_PHONE`, `PAGOMOVIL_CEDULA` |

---

## 4. Stripe (tarjeta)

### 4.1 Cuenta

- [ ] Crear cuenta en https://dashboard.stripe.com/register.
- [ ] Completar **Activate Payments**: razón social, número de identificación
      fiscal, cuenta bancaria receptora. Para LATAM, Stripe acepta empresas
      en **México, Brasil, Chile, Colombia, Perú**. Si LaVaca opera desde
      Venezuela, considera incorporar la empresa en una jurisdicción
      compatible (Delaware, México o Panamá son las opciones típicas).
- [ ] Activar **payouts** a tu cuenta bancaria.

### 4.2 API Keys

- [ ] Dashboard → Developers → API keys.
  - `Publishable key` → `NEXT_PUBLIC_STRIPE_PUBLIC_KEY`
  - `Secret key` → `STRIPE_SECRET_KEY`
- [ ] Empezar con las claves de **test** (`pk_test_…` / `sk_test_…`) y migrar
      a **live** (`pk_live_…` / `sk_live_…`) cuando completes activación.

### 4.3 Webhook

- [ ] Dashboard → Developers → Webhooks → **Add endpoint**.
- [ ] Endpoint URL: `https://lavaca.app/api/payments/stripe/webhook`
- [ ] Eventos a suscribir:
  - `checkout.session.completed`
  - `checkout.session.async_payment_failed`
  - `payment_intent.payment_failed`
- [ ] Copiar **Signing secret** (`whsec_…`) → `STRIPE_WEBHOOK_SECRET`.

### 4.4 Activación en la app

- [ ] Desde `/admin/payment-methods`, asegurarse de que la fila `card` esté
      **activa**.

---

## 5. Binance Pay (cripto)

### 5.1 Cuenta de merchant

- [ ] Crear cuenta en https://merchant.binance.com (requiere KYB
      empresarial). La aprobación puede tomar 2–4 semanas.
- [ ] Una vez aprobado: Merchant Portal → **Developer** → **API Management**.

### 5.2 Credenciales

- [ ] Crear un **API Key**.
  - `API Key` → `BINANCE_API_KEY`
  - `Secret Key` → `BINANCE_API_SECRET`
  - `Certificate SN` (mostrado al crear el key) → `BINANCE_PAY_CERT_SN`
- [ ] `BINANCE_PAY_BASE_URL` = `https://bpay.binanceapi.com` (default).

### 5.3 Webhook

- [ ] Merchant Portal → Developer → Webhook.
- [ ] URL: `https://lavaca.app/api/payments/binance/webhook`
- [ ] El webhook se autentica con HMAC SHA-512 usando `BINANCE_API_SECRET`
      (ya manejado en `/lib/payments/providers/binance-provider.ts`).

### 5.4 Activación

- [ ] `/admin/payment-methods` → activar fila `crypto`.

---

## 6. ChinChin (Venezuela C2P)

> **Estado actual: STUB**. La estructura del provider (firma HMAC SHA-256,
> request/response, webhook con verificación) está completa, pero los
> **endpoints exactos** (`/v1/payments`, `/v1/payments/{id}`) y el
> **algoritmo de firma** deben confirmarse con la documentación oficial
> de ChinChin cuando recibas tus credenciales.

### 6.1 Cuenta de comercio

- [ ] Contactar a ChinChin para abrir cuenta de comercio (B2B). Pedir:
  - API Key + API Secret
  - Merchant ID
  - Documentación técnica (endpoints, formato de firma, eventos del webhook)
  - URL base de sandbox y producción

### 6.2 Credenciales

| Variable | Valor |
|----------|-------|
| `CHINCHIN_API_KEY` | el API key del comercio |
| `CHINCHIN_API_SECRET` | el secret del comercio |
| `CHINCHIN_MERCHANT_ID` | tu identificador como comercio |
| `CHINCHIN_BASE_URL` | URL provista (puede ser sandbox o prod) |
| `CHINCHIN_WEBHOOK_SECRET` | secret para validar firma del webhook |

### 6.3 Ajustar el provider con la documentación real

Una vez tengas la documentación oficial, revisar:

- [ ] `lib/payments/providers/chinchin-provider.ts`
  - Path de creación de orden (`/v1/payments`)
  - Path de consulta (`/v1/payments/{id}`)
  - Esquema del payload de orden (campos esperados)
  - Algoritmo de firma exacto (puede ser SHA-256 o SHA-512, sobre
    `timestamp\nnonce\nbody\n` o variante)
  - Headers requeridos (`X-Chinchin-*`)
- [ ] `app/api/payments/chinchin/webhook/route.ts`
  - Eventos relevantes (`PAID`, `FAILED`, etc.)
  - Headers del webhook (verificar nombres exactos)

### 6.4 Webhook

- [ ] Registrar en el portal de ChinChin la URL:
      `https://lavaca.app/api/payments/chinchin/webhook`

### 6.5 Migración de DB

Ya está hecha en `dumps/24-payment-methods-chinchin-paypal.sql`. Confirma
que la fila exista:

```sql
select code, name, is_active from public.payment_method_configs where code = 'chinchin';
```

### 6.6 Activación

- [ ] `/admin/payment-methods` → activar fila `chinchin`.

---

## 7. PayPal

### 7.1 Cuenta de developer

- [ ] Crear cuenta en https://developer.paypal.com.
- [ ] Crear **REST API app**: Dashboard → My Apps & Credentials → Create App.
- [ ] Elegir tipo "Merchant".

### 7.2 Credenciales

| Variable | Valor |
|----------|-------|
| `PAYPAL_CLIENT_ID` | Client ID del app |
| `PAYPAL_CLIENT_SECRET` | Secret del app |
| `PAYPAL_BASE_URL` | `https://api-m.sandbox.paypal.com` (test) o `https://api-m.paypal.com` (prod) |

### 7.3 Webhook

- [ ] Dashboard → Webhooks → Add Webhook
- [ ] URL: `https://lavaca.app/api/payments/paypal/webhook`
- [ ] Eventos:
  - `CHECKOUT.ORDER.APPROVED`
  - `CHECKOUT.ORDER.COMPLETED`
  - `PAYMENT.CAPTURE.COMPLETED`
  - `PAYMENT.CAPTURE.DENIED`
  - `PAYMENT.CAPTURE.REFUNDED`
  - `CHECKOUT.ORDER.VOIDED`
- [ ] Copiar el **Webhook ID** → `PAYPAL_WEBHOOK_ID`.

### 7.4 Activar verificación de firma del webhook

En `app/api/payments/paypal/webhook/route.ts` hay un bloque marcado como
`TODO` para validar la firma con el endpoint
`/v1/notifications/verify-webhook-signature`. Implementarlo cuando tengas el
`PAYPAL_WEBHOOK_ID`:

- [ ] Descomentar el bloque de validación.
- [ ] Probar con el "Webhook Simulator" del dashboard de PayPal.

### 7.5 Activación

- [ ] `/admin/payment-methods` → activar fila `paypal`.

---

## 8. Métodos manuales

Estos NO requieren API externa. Funcionan así: el donante reporta su pago
(referencia + comprobante opcional), el admin lo aprueba desde
`/admin/payments`.

### 8.1 Zelle

- [ ] `.env`:
  ```
  ZELLE_EMAIL=donations@lavaca.app
  ZELLE_PHONE=+58XXXXXXXXX
  ```
- [ ] `/admin/payment-methods` → editar fila `zelle` con email/teléfono
      visibles al donante.
- [ ] Activar.

### 8.2 PagoMóvil

- [ ] `.env`:
  ```
  PAGOMOVIL_BANK_CODE=0102
  PAGOMOVIL_PHONE=04XXXXXXXXX
  PAGOMOVIL_CEDULA=V-XXXXXXXX
  ```
- [ ] `/admin/payment-methods` → editar fila `pagomovil` con datos visibles
      (incluyendo QR opcional como URL de imagen en `settings.qrImageUrl`).
- [ ] Activar.

### 8.3 Transferencia bancaria

- [ ] `/admin/payment-methods` → editar fila `transfer`.
- [ ] Agregar cuentas bancarias en la pestaña de "Cuentas". Cada cuenta:
      banco, titular, número, tipo (corriente/ahorro), cédula/RIF, moneda
      (Bs/USD), instrucciones.
- [ ] Activar.

---

## 9. Email transaccional (opcional)

Las **notificaciones in-app** (campanita en navbar) ya funcionan vía Supabase
Realtime. El **envío por email** NO está conectado.

Opción recomendada: **Resend** (https://resend.com).

### 9.1 Crear cuenta Resend

- [ ] Sign up en https://resend.com (free tier: 3,000 emails/mes).
- [ ] Verificar tu dominio (`lavaca.app`) agregando los registros DNS
      (SPF, DKIM, DMARC) que Resend pide.
- [ ] Crear un **API key**.
- [ ] Agregar `RESEND_API_KEY` a `.env`.

### 9.2 Instalar el SDK

```bash
npm install resend
```

### 9.3 Crear el helper de email

Crear `lib/email.ts`:

```ts
import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

export async function sendEmail({
  to, subject, html,
}: { to: string; subject: string; html: string }) {
  if (!resend) {
    console.warn("[email] RESEND_API_KEY no configurada, skip");
    return;
  }
  await resend.emails.send({
    from: "LaVaca <no-reply@lavaca.app>",
    to,
    subject,
    html,
  });
}
```

### 9.4 Engancharlo en los puntos clave

- [ ] **Donación completada**: en `app/api/payments/stripe/webhook/route.ts`,
      `binance/webhook/route.ts`, `chinchin/webhook/route.ts`,
      `paypal/webhook/route.ts` y en la aprobación manual
      (`app/admin/payments/page.tsx`) → enviar recibo al donante.
- [ ] **KYC aprobado/rechazado**: en
      `app/api/admin/verifications/[id]/decision/route.ts`.
- [ ] **Retiro procesado**: en `app/api/admin/withdrawals/[id]/route.ts`.
- [ ] **Invitación de garante**: en
      `app/api/guarantor/invitations/route.ts` (POST).

---

## 10. KYC de Garante (opcional)

El esquema del garante existe (`guarantors` con `organization_name`,
`rif_number`, `profession_field`, `credential_document_url`, `kyc_status`).
Hoy reutiliza el formulario KYC genérico (`components/kyc-form-improved.tsx`).

Si quieres un formulario específico para garantes (ONG/médico/abogado con
documentos distintos):

- [ ] Crear `components/guarantor-kyc-form.tsx` (clonar el actual pero con
      campos: nombre de organización, RIF, área profesional, URL del
      credencial).
- [ ] Endpoint `POST /api/guarantor/kyc` que actualice la fila en
      `guarantors`.
- [ ] Pestaña adicional en `/profile` cuando `users.role = 'guarantor'`.
- [ ] Cola en `/admin/verifications` para revisar específicamente
      garantes (filtro por `verification_type = 'guarantor'`).

El badge "Avalado por X" en la campaña pública SÓLO aparece cuando
`guarantors.kyc_status = 'verified'`. Hoy esto se hace desde Supabase
manualmente o por el admin. Sin UI específica, la app es funcional pero
operacionalmente más manual.

---

## 11. Deploy a Vercel

### 11.1 Conectar repo

- [ ] Crear cuenta en https://vercel.com con tu GitHub.
- [ ] Import Project → seleccionar el repo `lavaca`.
- [ ] Framework: **Next.js** (detectado automáticamente).
- [ ] Branch de producción: `main`.

### 11.2 Variables de entorno

- [ ] Settings → Environment Variables → pegar todas las del `.env.example`.
- [ ] Marcar el environment correcto: `Production`, `Preview` y `Development`
      según corresponda. Las claves de Stripe/Binance/etc. de **test** van en
      Preview/Development; las **live** sólo en Production.

### 11.3 Dominio

- [ ] Settings → Domains → agregar `lavaca.app` y `www.lavaca.app`.
- [ ] Configurar DNS en tu registrador:
  - `A` o `ALIAS` apuntando a la IP/CNAME que Vercel indique.
- [ ] Esperar emisión de cert SSL (automática, ~2 min).
- [ ] Actualizar `NEXT_PUBLIC_URL` a `https://lavaca.app` y redeploy.

### 11.4 Configurar URL en Supabase

Repetir lo de la sección 2.4 con la URL real:

- [ ] Supabase → Auth → URL Configuration → Site URL = `https://lavaca.app`.

### 11.5 Actualizar webhooks de cada pasarela

Cambiar la URL de los webhooks de localhost al dominio final:

- [ ] Stripe: `https://lavaca.app/api/payments/stripe/webhook`
- [ ] Binance: `https://lavaca.app/api/payments/binance/webhook`
- [ ] PayPal: `https://lavaca.app/api/payments/paypal/webhook`
- [ ] ChinChin: `https://lavaca.app/api/payments/chinchin/webhook`

---

## 12. Activación: pasar de test a producción

Una vez todo lo anterior esté listo:

- [ ] En Vercel, cambiar `NEXT_PUBLIC_PAYMENT_MODE` de `test` a `production`.
- [ ] Reemplazar claves de pasarelas de **test** por **live**:
  - `STRIPE_SECRET_KEY` (sk_live_…)
  - `NEXT_PUBLIC_STRIPE_PUBLIC_KEY` (pk_live_…)
  - `STRIPE_WEBHOOK_SECRET` (whsec_… del endpoint en modo live)
  - `BINANCE_*` (las de prod)
  - `PAYPAL_BASE_URL=https://api-m.paypal.com`
  - `PAYPAL_CLIENT_ID/SECRET` (los de live)
  - `CHINCHIN_BASE_URL` (la de prod)
- [ ] **Redeploy** (Vercel lo hace automático al cambiar env vars).
- [ ] Verificar logs en Vercel → Functions para confirmar arranque sin
      errores.

---

## 13. Verificación final (smoke test)

Probar el flujo completo end-to-end en producción con **donaciones de bajo
monto reales** ($1 cada una):

### 13.1 Como visitante

- [ ] Abrir `https://lavaca.app` → ver campañas destacadas y stats reales.
- [ ] Ir a una campaña → ver detalle, gallería, descripción.
- [ ] Click "Donar Ahora" → checkout.

### 13.2 Cada método de pago

- [ ] **Tarjeta (Stripe)**: pagar $1, verificar que llegue al dashboard de
      Stripe y que el monto se acredite a la campaña.
- [ ] **Binance Pay**: pagar $1 en USDT, verificar que llegue al merchant
      portal de Binance.
- [ ] **PayPal**: pagar $1, verificar en PayPal y en la app.
- [ ] **ChinChin**: pagar Bs equivalentes, verificar.
- [ ] **Zelle manual**: reportar pago con referencia + comprobante (subir
      una imagen). Verificar que aparezca en `/admin/payments` con el
      comprobante visible. Aprobar y verificar acreditación.
- [ ] **PagoMóvil manual**: igual que Zelle.
- [ ] **Transferencia manual**: igual.

### 13.3 Como creador

- [ ] Registrar usuario → completar perfil → enviar KYC.
- [ ] Como admin: aprobar el KYC desde `/admin/verifications`.
- [ ] Como creador: crear una campaña → enviar a revisión.
- [ ] Como admin: aprobar la campaña desde `/admin/campaigns`.
- [ ] Verificar que la campaña aparezca en el feed público.
- [ ] Como creador: solicitar retiro desde `/creator/dashboard`.
- [ ] Como admin: marcar como procesado desde `/admin/withdrawals` después
      de realizar la transferencia bancaria real.

### 13.4 Garante

- [ ] Como creador: desde `/creator/campaigns/[id]/edit` → invitar garante
      con un email de prueba.
- [ ] Como invitado: registrarse con ese email → ir a
      `/guarantor/dashboard` → aceptar invitación.
- [ ] Como admin: verificar el KYC del garante.
- [ ] Verificar que el badge "Avalado por X" aparece en la campaña pública.

### 13.5 Responsive

- [ ] Probar la app en **móvil real** (iPhone + Android, no sólo DevTools):
  - Landing
  - Catálogo de campañas
  - Detalle de campaña
  - Flujo de donación completo
  - Panel admin (sidebar como drawer)
  - Panel creador
  - Perfil

---

## 14. Tareas recurrentes (cron)

### 14.1 Actualizar la tasa BCV automáticamente

La API `POST /api/exchange-rate/update` consulta Binance P2P y actualiza la
tasa. Recomendado correrla cada hora.

Opciones:

- **Vercel Cron** (más simple, incluido en Pro plan):

  Crear `vercel.json` en la raíz:
  ```json
  {
    "crons": [{
      "path": "/api/exchange-rate/update",
      "schedule": "0 * * * *"
    }]
  }
  ```

  - [ ] Agregar el archivo y deployar.

- **Supabase pg_cron**: programar la llamada como HTTP request desde el
  edge function. Más complejo, sólo si necesitas evitar Vercel Cron.

### 14.2 Backup de la base de datos

- [ ] Supabase Pro hace backups diarios automáticos (retención 7 días).
- [ ] Para backup manual: `pg_dump` periódico a un bucket S3 propio.

### 14.3 Limpieza de invitaciones expiradas

Las invitaciones de garante expiran a los 30 días. Marcar como `expired`
las que pasaron de fecha:

```sql
update public.guarantor_invitations
   set status = 'expired'
 where status = 'pending'
   and expires_at < now();
```

- [ ] Programar este SQL semanalmente (pg_cron o Vercel Cron con un endpoint
      `/api/admin/cleanup`).

---

## 15. Mantenimiento y monitoreo

### 15.1 Logs y errores

- [ ] **Vercel**: Functions → ver errores de runtime en tiempo real.
- [ ] **Supabase**: Logs → revisar errores de SQL y Auth.
- [ ] **Sentry** (opcional): agregar para tracking estructurado de errores.

### 15.2 Métricas operativas

Revisar diariamente:

- [ ] `/admin/dashboard` → verificaciones pendientes, pagos manuales
      pendientes, retiros pendientes (badges del sidebar).
- [ ] Total recaudado vs comisión.
- [ ] Conversión: visitantes vs donaciones.

### 15.3 Soporte

- [ ] Definir email de soporte (`soporte@lavaca.app`) y publicarlo en footer.
- [ ] Establecer SLA interno para responder pagos manuales (≤ 24h
      recomendado, idealmente ≤ 4h en horario laboral).

### 15.4 Compliance / Legal

- [ ] Revisar las páginas `/terms`, `/privacy`, `/refund-policy`,
      `/acceptable-use-policy`, `/garantia` y actualizar con tu razón social,
      dirección y datos de contacto reales.
- [ ] Si operas en Venezuela: revisar requerimientos de SUDEBAN para
      plataformas de crowdfunding.

---

## Anexo A: Checklist resumido de cuentas a abrir

| Servicio | Para qué | Tiempo de aprobación |
|----------|----------|----------------------|
| Supabase Pro | DB + Auth + Storage | Inmediato |
| Vercel Pro | Hosting + Cron | Inmediato |
| Dominio (registrador) | URL final | Inmediato |
| Stripe | Tarjetas | 2–7 días (KYB) |
| Binance Pay Merchant | Cripto | 2–4 semanas (KYB) |
| PayPal Business | PayPal | 1–3 días |
| ChinChin Merchant | Pagos VE | Variable (contactar) |
| Resend | Email | Inmediato (1–24h para verificar dominio) |
| Google Cloud Console | OAuth (opcional) | Inmediato |

## Anexo B: Estimación de costos mensuales mínimos

| Servicio | Plan recomendado | USD/mes |
|----------|------------------|---------|
| Supabase | Pro | $25 |
| Vercel | Pro | $20 |
| Resend | Free → Pro | $0 → $20 |
| Dominio (anual) | — | ~$1 |
| **Total mínimo** | | **~$45–65/mes** |

Las pasarelas (Stripe, Binance, PayPal, ChinChin) no cobran fee mensual
fijo; cobran porcentaje + fee por transacción que ya está cubierto por la
comisión de plataforma configurable en `/admin/settings`.

---

## Anexo C: Si algo se rompe en producción

1. **Pagos no llegan**: revisar logs del webhook correspondiente en Vercel.
   Verificar que el `*_WEBHOOK_SECRET` coincida con el del dashboard del
   proveedor.
2. **Tasa BCV congelada**: ir a `/admin/settings` → "Refrescar desde
   Binance P2P" manualmente. Verificar que el cron esté activo.
3. **Notificaciones no llegan**: la realtime de Supabase puede fallar si
   excedes el quota. Revisar Supabase → Database → Replication.
4. **Storage no acepta uploads**: revisar policies del bucket
   correspondiente y que el `SUPABASE_SERVICE_ROLE_KEY` esté seteado.
5. **Rollback de migración**: cada migración SQL en `dumps/` es idempotente
   (usa `IF NOT EXISTS`). Para revertir un cambio puntual, escribir un
   migration SQL nuevo `27-rollback-XX.sql` que deshaga lo específico.

---

**Última actualización**: 2026-05-23
