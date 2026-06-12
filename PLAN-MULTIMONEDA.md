# Plan de trabajo — Separación de saldos Bs / USD

**Estado**: borrador para revisión
**Fecha**: junio 2026
**Decisiones ya tomadas**:
- Saldos **por campaña** (igual que hoy).
- Comisión de plataforma se descuenta **al retirar**; el botón "Cubrir comisiones" del donante cubre **solo el fee de la pasarela**.
- Fees de pasarela **configurables por el admin** por método de pago.
- Se permite **1 solicitud de retiro pendiente por moneda por campaña** (1 en Bs + 1 en USD a la vez).

---

## 1. Resumen ejecutivo

Hoy todo el dinero se contabiliza en USD indexado. El problema: si un donante
aporta Bs 7.300 (≈ $20 a la tasa del día) y el creador retira esos bolívares
3 meses después, la inflación se comió parte del valor, pero la plataforma
le muestra "$20 disponibles" como si nada hubiera pasado.

La solución: **dos saldos paralelos por campaña**.

| Concepto | Comportamiento |
|----------|----------------|
| **Resumen público de la campaña** | Sin cambios. Sigue indexado en USD a la tasa del día de cada transacción. Una donación de Bs 7.300 con tasa 365 suma $20 a la barra de progreso, para siempre. |
| **Saldo en Bolívares** | Nominal. Bolívares que entran, bolívares que salen. Sin indexación. |
| **Saldo en Dólares** | USD que entran (Zelle, tarjeta, cripto, PayPal), USD que salen. |
| **Pérdida cambiaria** | Estadística informativa en el saldo Bs: cuánto valor se perdió por la devaluación entre el día de la donación y hoy (o el día del retiro, si ya se retiró). |

El flujo del donante y la verificación de pagos **no cambian**, salvo dos
mejoras: ver el monto neto que recibirá la campaña y la opción de cubrir
la comisión de la pasarela.

---

## 2. Clasificación de moneda por método

### Donaciones

| Método | Moneda | Fee típico inicial (configurable) |
|--------|--------|------------------------------------|
| Tarjeta (Stripe) | USD | 2.9% + $0.30 |
| PayPal | USD | 5.4% + $0.30 |
| Binance Pay (crypto) | USD | 0% |
| Zelle | USD | 0% |
| PagoMóvil | **BS** | 0.3% |
| Transferencia bancaria | **BS** | 0% |
| ChinChin | **BS** | por confirmar al integrar |

### Retiros (por tipo de cuenta)

| Tipo de cuenta de retiro | Moneda del retiro | Fee típico inicial |
|--------------------------|-------------------|---------------------|
| Cuenta bancaria Bs (`bank_bs`) | **BS** | 0 |
| PagoMóvil (`pagomovil`) | **BS** | 0.3% |
| Zelle (`zelle`) | USD | 0 |
| PayPal (`paypal`) | USD | ~3% (recepción) |
| Cripto / Binance (`crypto`) | USD | ~$1 fijo (red) |

> El admin podrá ajustar todos estos valores sin tocar código.

---

## 3. Modelo de datos (migración `30-multi-currency-balances.sql`)

### 3.1 `donations` — columnas nuevas

```sql
ALTER TABLE donations ADD COLUMN currency text CHECK (currency IN ('USD','BS'));
ALTER TABLE donations ADD COLUMN gateway_fee_usd numeric DEFAULT 0;   -- fee estimado de pasarela
ALTER TABLE donations ADD COLUMN fee_covered_by_donor boolean DEFAULT false;
ALTER TABLE donations ADD COLUMN net_amount_usd numeric;             -- lo que acredita al saldo USD
ALTER TABLE donations ADD COLUMN net_amount_bs numeric;              -- lo que acredita al saldo Bs
```

- **Backfill**: `currency` se deriva de `payment_method`
  (`pagomovil|transfer|chinchin → BS`, resto → USD). Para donaciones
  históricas, `net = amount` y `gateway_fee = 0` (no se recalcula nada
  retroactivo).
- Lógica del neto:
  - Donante cubre fees → paga `amount + fee`, la campaña acredita `amount` completo.
  - Donante no cubre → paga `amount`, la campaña acredita `amount - fee`.
- La barra de progreso pública (`campaigns.current_amount_usd`) sigue
  sumando el `amount_usd` bruto (el gesto social del donante es "doné $20").
  El saldo retirable usa el neto.

### 3.2 `withdrawal_requests` — columnas nuevas

```sql
ALTER TABLE withdrawal_requests ADD COLUMN currency text CHECK (currency IN ('USD','BS'));
ALTER TABLE withdrawal_requests ADD COLUMN platform_fee numeric;      -- comisión LaVaca (en la moneda del retiro)
ALTER TABLE withdrawal_requests ADD COLUMN gateway_fee numeric;       -- fee bancario / Binance / Zelle
ALTER TABLE withdrawal_requests ADD COLUMN net_amount numeric;        -- lo que recibe el creador
ALTER TABLE withdrawal_requests ADD COLUMN indexed_usd_value numeric; -- (solo BS) valor indexado de esos Bs
ALTER TABLE withdrawal_requests ADD COLUMN fx_loss_usd numeric;       -- (solo BS) pérdida congelada al procesar
```

- **Backfill**: `currency` se deriva del `account_type` de la cuenta asociada.
- `exchange_rate_used` (ya existe) se llena al **procesar** el retiro Bs:
  ahí se congela la pérdida cambiaria de ese retiro.

### 3.3 Fees configurables

En `payment_method_configs.settings` (jsonb ya existente) se agregan llaves:

```json
{ "donation_fee_percent": 2.9, "donation_fee_fixed_usd": 0.30 }
```

Nueva tabla para fees de retiro:

```sql
CREATE TABLE withdrawal_fee_configs (
  account_type text PRIMARY KEY,        -- bank_bs | pagomovil | zelle | paypal | crypto
  currency text NOT NULL,               -- BS | USD
  fee_percent numeric NOT NULL DEFAULT 0,
  fee_fixed numeric NOT NULL DEFAULT 0, -- en la moneda del retiro
  is_active boolean NOT NULL DEFAULT true,
  updated_at timestamptz DEFAULT now()
);
```

En `admin_config`:

```sql
ALTER TABLE admin_config ADD COLUMN min_withdrawal_usd numeric DEFAULT 10;
ALTER TABLE admin_config ADD COLUMN min_withdrawal_bs numeric DEFAULT 500;
```

### 3.4 RPC de saldos: `get_campaign_balances(campaign_id)`

Una función SQL que devuelve en una sola llamada:

| Campo | Cálculo |
|-------|---------|
| `saldo_bs` | Σ `net_amount_bs` de donaciones BS completadas − Σ `amount_bs` de retiros BS (pending + processing + processed) |
| `saldo_usd` | Σ `net_amount_usd` de donaciones USD completadas − Σ `amount_usd` de retiros USD (pending + processing + processed) |
| `bs_indexed_usd` | Valor indexado del saldo Bs restante (costo promedio, ver 3.5) |
| `fx_loss_unrealized` | `bs_indexed_usd` − (`saldo_bs` / tasa de hoy) |
| `fx_loss_realized` | Σ `fx_loss_usd` de retiros BS procesados (congelada) |
| `pending_bs` / `pending_usd` | Montos en solicitudes pendientes (para mostrar "reservado") |

> Las solicitudes **pendientes** también descuentan disponibilidad
> (decisión confirmada: "Donado − Ya retirado o con solicitudes de retiro").

### 3.5 Contabilidad de la pérdida cambiaria

Método: **costo promedio ponderado** (simple de explicar y auditar).

- `tasa_promedio_entrada` = Σ `amount_bs` / Σ `amount_usd` de las donaciones BS de la campaña.
- **No realizada** (saldo que aún tienes):
  `pérdida = (saldo_bs / tasa_promedio_entrada) − (saldo_bs / tasa_hoy)`
- **Realizada** (congelada en cada retiro, al procesarlo el admin):
  `fx_loss_usd = (monto_bs / tasa_promedio_entrada_en_ese_momento) − (monto_bs / tasa_del_retiro)`
  Se guarda en la fila del retiro y nunca se recalcula.
- **Total mostrado al creador** = realizada + no realizada.

---

## 4. Cambios por pantalla

### 4.1 Checkout del donante (`donation-checkout-improved.tsx`)

- Bloque nuevo debajo del monto: **"La campaña recibirá: $X.XX"** con
  desglose del fee del método seleccionado.
- Checkbox **"Cubrir comisiones (+$Y.YY)"**: suma el fee al total que paga
  el donante para que la campaña reciba el 100%.
- Si el método tiene fee 0 (Zelle, transferencia), el bloque muestra
  "Sin comisiones de procesamiento — la campaña recibe el monto completo"
  y no hay checkbox.
- El servidor (`/api/donations`) recalcula el fee con la config de la BD
  (nunca confía en el valor del cliente) y guarda `gateway_fee_usd`,
  `fee_covered_by_donor`, `net_amount_usd`, `net_amount_bs`, `currency`.

### 4.2 Dashboard del creador (`/creator/dashboard`)

Por cada campaña, reemplazar el "Saldo disponible" único por:

```
┌─────────────────────────────┬─────────────────────────────┐
│  Saldo en Bolívares          │  Saldo en Dólares           │
│  Bs 12.450,00                │  $340.00                    │
│  ─────────────────────────   │  ───────────────────────    │
│  Reservado en retiros:       │  Reservado en retiros:      │
│  Bs 2.000,00                 │  $50.00                     │
│  Pérdida cambiaria: -$4.12   │                             │
│  (realizada -$1.80 +         │  [Retirar dólares]          │
│   no realizada -$2.32) ⓘ     │                             │
│  [Retirar bolívares]         │                             │
└─────────────────────────────┴─────────────────────────────┘
```

- Tooltip ⓘ explica qué es el diferencial cambiario en lenguaje simple.
- Vista consolidada arriba: total Bs + total USD de todas las campañas
  (informativa, el retiro sigue siendo por campaña).

### 4.3 Diálogo de retiro (`request-withdrawal-dialog.tsx`) — rediseño

Flujo en 3 pasos dentro del mismo diálogo:

1. **Moneda**: el creador elige Bs o USD (se filtra según qué saldo tenga
   disponible). Al elegir, solo se muestran cuentas de retiro compatibles
   (cuenta Bs/PagoMóvil para Bs; Zelle/PayPal/cripto para USD).
2. **Monto**: input en la moneda elegida con validación contra el
   disponible de esa moneda y el mínimo de retiro.
3. **Resumen antes de confirmar** (la mejora clave):

```
Monto solicitado:            Bs 5.000,00
Comisión LaVaca (8%):        − Bs 400,00
Fee bancario (0%):           − Bs 0,00
─────────────────────────────────────────
Recibirás:                   Bs 4.600,00

Cuenta destino: Banco de Venezuela ····1234
Tiempo estimado: 1-2 días hábiles
```

- El cálculo del neto lo hace un endpoint nuevo
  (`GET /api/withdrawals/quote?campaignId=&accountId=&amount=`)
  para que el desglose siempre venga del servidor.

### 4.4 Historial de retiros del creador

- Lista con estado visual tipo timeline:
  `Solicitado → En revisión → Procesado` (o `Rechazado` con motivo).
- Cada retiro Bs procesado muestra la tasa usada y su pérdida cambiaria
  congelada.

### 4.5 Admin — retiros (`/admin/withdrawals`)

- **Tabs por moneda**: `Bolívares (N)` | `Dólares (M)` | `Todos`.
- Cada tarjeta muestra el desglose completo (bruto, comisión plataforma,
  fee, neto a transferir) — el admin sabe exactamente cuánto transferir.
- Al procesar un retiro **Bs**: el campo de tasa se auto-llena con la tasa
  activa del día (editable). Al confirmar, el sistema congela
  `exchange_rate_used`, `indexed_usd_value` y `fx_loss_usd`.
- Badge de moneda en el sidebar de admin (contador por tab).

### 4.6 Admin — configuración de fees (`/admin/payment-methods`)

- En cada método de donación: campos `% fee` + `fee fijo (USD)`.
- Sección nueva "Fees de retiro": tabla editable por tipo de cuenta.
- En `/admin/settings`: mínimos de retiro por moneda.

---

## 5. APIs nuevas / modificadas

| Endpoint | Cambio |
|----------|--------|
| `POST /api/donations` | Calcula fee server-side, guarda currency + netos + fee_covered_by_donor |
| `GET /api/campaigns/[id]/balances` | NUEVO — expone `get_campaign_balances` al dashboard |
| `GET /api/withdrawals/quote` | NUEVO — desglose neto antes de confirmar |
| `POST /api/withdrawals/request` | Acepta `currency`, valida contra el saldo de esa moneda, valida 1 pendiente por moneda, guarda desglose |
| `PATCH /api/admin/withdrawals/[id]` | Al procesar Bs: congela tasa + fx_loss. Devuelve desglose |
| `GET/PATCH /api/admin/payment-methods/[code]` | Lee/escribe los fees de donación |
| `GET/PATCH /api/admin/withdrawal-fees` | NUEVO — CRUD de `withdrawal_fee_configs` |

---

## 6. Extras que dan un plus (propuestos, opcional activar)

| # | Extra | Esfuerzo | Valor |
|---|-------|----------|-------|
| P1 | **Alerta anti-inflación**: si el saldo Bs de una campaña supera un umbral (ej. equivalente a $50) o lleva más de 7 días sin retirar, mostrar aviso "Te recomendamos retirar tus bolívares para protegerte de la devaluación" + notificación in-app | Bajo | Alto — es EL diferenciador para el contexto venezolano |
| P2 | **Página pública de comisiones** (`/fees`): tabla transparente de todos los fees por método. Refuerza la marca de transparencia | Bajo | Alto |
| P3 | **Constancia de retiro** descargable (página imprimible con desglose, tasa y referencia) | Medio | Medio |
| P4 | **Exportar CSV** de donaciones y retiros por campaña (contabilidad del creador) | Bajo | Medio |
| P5 | **Gráfica de evolución de la tasa** en el dashboard del creador (con su pérdida acumulada en el tiempo) | Medio | Medio |
| P6 | **Barrido de textos**: neutralizar voseo rioplatense que quedó en algunas páginas ("podés", "escribinos", "buscás") a español neutro/venezolano ("puedes", "escríbenos", "buscas") | Bajo | Alto — coherencia de marca |

Recomendación: incluir P1, P2 y P6 en este mismo trabajo; P3-P5 para una
fase posterior.

---

## 7. Fases de implementación

| Fase | Contenido | Archivos principales |
|------|-----------|----------------------|
| **F1 — Base de datos** | Migración 30: columnas, backfill, tabla de fees de retiro, RPC `get_campaign_balances`, mínimos en admin_config | `dumps/30-*.sql` (aplicada vía MCP) |
| **F2 — Donaciones con fees** | Cálculo server-side, "La campaña recibirá $X", checkbox "Cubrir comisiones" | `api/donations/route.ts`, `donation-checkout-improved.tsx` |
| **F3 — Saldos del creador** | Dashboard con doble saldo + pérdida cambiaria + tooltip, endpoint de balances | `creator/dashboard/page.tsx`, `api/campaigns/[id]/balances` |
| **F4 — Retiro mejorado** | Diálogo 3 pasos con quote, validación por moneda, historial con timeline | `request-withdrawal-dialog.tsx`, `api/withdrawals/*` |
| **F5 — Admin** | Tabs por moneda, congelado de tasa/fx_loss al procesar, config de fees | `admin/withdrawals/page.tsx`, `admin/payment-methods/page.tsx`, `api/admin/*` |
| **F6 — Extras** | P1 alerta anti-inflación, P2 página /fees, P6 barrido de textos | varios |

Orden de ejecución: F1 → F2 → F3 → F4 → F5 → F6.
Cada fase termina con commit + push a `main` (deploy continuo en Coolify).

---

## 8. Riesgos y decisiones técnicas a validar

1. **Donaciones históricas**: se backfillean con `net = amount` y fee 0.
   La pérdida cambiaria solo se calcula con datos desde el deploy de F1
   (no hay tasa histórica confiable por donación previa salvo `amount_bs`
   ya guardado, que sí permite el cálculo — lo aprovechamos).
2. **Tasa promedio por campaña**: usamos costo promedio ponderado, no FIFO.
   Más simple de explicar al creador y auditable con una sola fórmula.
3. **Comisión de plataforma en Bs**: el % se aplica sobre el monto Bs
   directamente (no se convierte a USD y de vuelta), evitando dobles
   redondeos.
4. **El trigger actual** (`update_campaign_amount_on_donation`) no se toca:
   la barra pública sigue igual. Los saldos nuevos se calculan por RPC,
   no por trigger, para evitar estados duplicados que se desincronicen.
5. **Solicitudes pendientes reservan fondos**: si el admin rechaza una
   solicitud, esos fondos vuelven a estar disponibles automáticamente
   (la RPC excluye los rechazados).

---

## 9. Lo que NO cambia

- Flujo del donante para reportar pagos manuales (con comprobante).
- Aprobación de pagos manuales en `/admin/payments`.
- Barra de progreso pública de la campaña (indexada como hoy).
- Triggers de notificaciones y acreditación.
- KYC, garantes, todo lo demás.
