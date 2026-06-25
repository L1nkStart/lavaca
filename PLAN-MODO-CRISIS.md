# Plan de trabajo — Modo Crisis

**Estado**: en implementación
**Contexto**: ayuda a afectados por el terremoto de Venezuela del 25/06/2026.
**Objetivo**: un método EXTRA (no reemplaza al actual) donde el donante paga
**directo a la cuenta del creador** y el creador confirma esos pagos en una
pantalla simple para subir la barra de la campaña.

## Decisiones confirmadas

1. **Dinero**: donaciones directas **sin comisión ni retiros**; solo suben la barra. El método de plataforma (con comisión + retiros) sigue funcionando en paralelo.
2. **Quién marca crisis**: el creador elige al crear (default **Normal**); el admin puede cambiar el tipo en cualquier momento. La opción solo aparece si el modo crisis global está habilitado.
3. **Datos de pago**: **cuentas propias de cada campaña** (mini-pantalla del creador), aisladas de las cuentas de retiro.
4. **Anti-fraude**: el **donante registra** su pago (monto, moneda, referencia, captura); el creador **solo confirma o rechaza**. El admin puede auditar.
5. **Toggle global**: **interruptor maestro** en admin. OFF → crisis oculto en todo y las marcadas se comportan como normales. ON → disponible en toda la plataforma.
6. **Control**: mismo flujo que hoy — **KYC + aprobación de admin** antes de publicar/recibir.
7. **Vista donante**: en una campaña crisis ve **ambos métodos** (checkout de plataforma + pago directo). Los dos suman a la misma barra.
8. **Registro**: monto + moneda (Bs/USD) + referencia + captura; al confirmar el creador, acredita como una donación normal.

## Defaults asumidos

- Las donaciones directas viven en la tabla **`donations`** con flag `is_direct = true` (reusa el trigger que sube la barra, lista de donantes, notificaciones e historial). Se **excluyen del saldo retirable** (RPC `get_campaign_balances`) para que no generen comisión/retiro.
- Pantalla del creador: **`/creator/campaigns/[id]/crisis`** (cuentas para recibir + pagos por confirmar).
- Tipos de cuenta para recibir: **PagoMóvil, Zelle, Transferencia bancaria, Binance/Cripto**.

---

## Modelo de datos (migración `33-crisis-mode.sql`)

```sql
-- Toggle global (interruptor maestro)
ALTER TABLE admin_config ADD COLUMN crisis_mode_enabled boolean NOT NULL DEFAULT false;

-- Tipo de campaña
ALTER TABLE campaigns ADD COLUMN campaign_type text NOT NULL DEFAULT 'normal'
  CHECK (campaign_type IN ('normal','crisis'));

-- Cuentas de la campaña para recibir directo
CREATE TABLE campaign_crisis_accounts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  account_type text NOT NULL CHECK (account_type IN ('pagomovil','zelle','transfer','crypto')),
  account_holder_name text NOT NULL,
  -- campos según el tipo (se muestran al donante)
  phone_number text, ci_number text, bank_name text, bank_code text,
  email text, account_number text, crypto_wallet_address text, crypto_network text,
  instructions text,
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Donaciones directas (reusa donations)
ALTER TABLE donations ADD COLUMN is_direct boolean NOT NULL DEFAULT false;
ALTER TABLE donations ADD COLUMN crisis_account_id uuid REFERENCES campaign_crisis_accounts(id);
ALTER TABLE donations ADD COLUMN confirmed_by uuid REFERENCES users(id);
ALTER TABLE donations ADD COLUMN confirmed_at timestamptz;
```

- **RPC `get_campaign_balances`**: se actualiza para **excluir `is_direct = true`** de los saldos retirables (esas donaciones ya las recibió el creador). La barra pública (`current_amount_usd`) sí las suma vía el trigger existente.
- **RLS**:
  - `campaign_crisis_accounts`: lectura pública (el donante las ve en la campaña), gestión del creador dueño + admin.
  - Donaciones directas: insert por el donante (política `anyone_can_create_donations` ya existente); la **confirmación** la hace un endpoint server-side con service-role tras verificar que es el creador.

---

## Flujo

### Donante (campaña crisis)
1. Abre la campaña → ve el botón normal de "Donar" **y** una sección "Pagar directo al creador".
2. Elige una cuenta del creador (PagoMóvil/Zelle/…), paga por fuera, y **registra** el pago: monto, moneda, referencia, captura.
3. Queda como donación `pending` (`is_direct = true`) — el donante ve "en revisión, el organizador confirmará tu aporte".

### Creador (`/creator/campaigns/[id]/crisis`)
1. **Mis cuentas para recibir**: agrega/edita/desactiva sus métodos (mini-form por tipo).
2. **Pagos por confirmar**: lista de donaciones directas `pending` con monto, referencia, captura y datos del donante. Botones **Confirmar** (→ `completed`, sube la barra) y **Rechazar** (→ `failed`).

### Admin
- **Ajustes**: interruptor maestro "Habilitar campañas crisis".
- **Campañas**: cambiar el tipo Normal ⇄ Crisis de cualquier campaña.
- Puede auditar las donaciones directas (ya aparecen en su panel de pagos/donaciones).

---

## Fases

| Fase | Contenido |
|------|-----------|
| **F1 — DB** | Migración 33 + ajuste del RPC de saldos |
| **F2 — Admin** | Toggle global en ajustes + cambiar tipo por campaña + API |
| **F3 — Creación** | Selector Normal/Crisis (solo si el toggle global está ON) |
| **F4 — Creador** | Pantalla `/creator/campaigns/[id]/crisis` (cuentas + confirmar pagos) + endpoints |
| **F5 — Público** | Sección de pago directo (cuentas + registrar pago) en campañas crisis |

Cada fase termina con commit; al final build + push.

## Lo que NO cambia
- Método de donación de plataforma (checkout, comisión, retiros, multimoneda).
- Aprobación de campañas, KYC, moderación de imágenes, cambios de meta.
- La barra pública sigue alimentándose por el mismo trigger.
