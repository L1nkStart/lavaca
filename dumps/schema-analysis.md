# Análisis del Schema - LaVaca (GoFundMe Venezolano)

## ✅ Funcionalidades IMPLEMENTADAS

### 1. **Gestión de Usuarios** ✓
- Usuarios con roles (donor, creator, guarantor, admin)
- Sistema KYC completo con estados y documentos
- Perfiles con biografía, avatar, ubicación

### 2. **Campañas** ✓
- Estados de campaña (draft, pending, active, completed, rejected, cancelled)
- Metas en USD con seguimiento de progreso
- Categorías y subcategorías
- Imágenes principal y galería
- Documentos de soporte
- Ubicación geográfica
- Duración configurable
- Nivel de urgencia
- Sistema de slug para URLs amigables

### 3. **Donaciones** ✓
- Múltiples métodos de pago:
  - Stripe (tarjetas internacionales)
  - PayPal
  - PagoMóvil (venezolano)
  - Zelle
  - Transferencia bancaria (Bs)
  - Criptomonedas
- Donaciones anónimas
- Estados de pago (pending, completed, failed, refunded)
- Conversión USD/Bs con tasa BCV

### 4. **Sistema de Garantes** ✓
- Perfil de garantes con credenciales
- Verificación KYC para garantes
- Asociación de garantes a campañas
- Estados de aprobación

### 5. **Retiros** ✓
- Cuentas de retiro múltiples
- Verificación de cuentas
- Solicitudes de retiro con estados
- Conversión de moneda en retiros

### 6. **Administración** ✓
- Configuración de plataforma
- Comisión configurable
- Tasa de cambio BCV
- Logs de auditoría

### 7. **Actualizaciones de Campaña** ✓
- Creadores pueden publicar actualizaciones
- Imágenes en actualizaciones

---

## ❌ Funcionalidades FALTANTES (Comparado con GoFundMe)

### 1. **Comentarios en Campañas** ⚠️ CRÍTICO
GoFundMe permite que los donantes y visitantes dejen comentarios y palabras de apoyo.

```sql
CREATE TABLE public.campaign_comments (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    user_id uuid REFERENCES users(id) ON DELETE SET NULL,
    parent_comment_id uuid REFERENCES campaign_comments(id) ON DELETE CASCADE,
    content text NOT NULL,
    is_from_creator boolean DEFAULT false,
    is_anonymous boolean DEFAULT false,
    donor_name text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    deleted_at timestamptz,
    CONSTRAINT fk_campaign FOREIGN KEY (campaign_id) REFERENCES campaigns(id),
    CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT fk_parent FOREIGN KEY (parent_comment_id) REFERENCES campaign_comments(id)
);

CREATE INDEX idx_campaign_comments_campaign ON campaign_comments(campaign_id);
CREATE INDEX idx_campaign_comments_parent ON campaign_comments(parent_comment_id);
```

### 2. **Reacciones/Hearts** ⚠️ IMPORTANTE
GoFundMe permite dar "hearts" a las campañas para mostrar apoyo sin donar.

```sql
CREATE TABLE public.campaign_reactions (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    user_id uuid REFERENCES users(id) ON DELETE CASCADE,
    ip_address inet,
    created_at timestamptz DEFAULT now(),
    CONSTRAINT unique_user_reaction UNIQUE(campaign_id, user_id),
    CONSTRAINT fk_campaign FOREIGN KEY (campaign_id) REFERENCES campaigns(id),
    CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_reactions_campaign ON campaign_reactions(campaign_id);
```

### 3. **Seguimiento de Campañas** ⚠️ IMPORTANTE
Los usuarios pueden seguir campañas para recibir notificaciones.

```sql
CREATE TABLE public.campaign_followers (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    notify_updates boolean DEFAULT true,
    notify_milestones boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    CONSTRAINT unique_follower UNIQUE(campaign_id, user_id),
    CONSTRAINT fk_campaign FOREIGN KEY (campaign_id) REFERENCES campaigns(id),
    CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_followers_campaign ON campaign_followers(campaign_id);
CREATE INDEX idx_followers_user ON campaign_followers(user_id);
```

### 4. **Sistema de Notificaciones** ⚠️ CRÍTICO
Los usuarios necesitan recibir notificaciones sobre actividad en sus campañas.

```sql
CREATE TYPE notification_type AS ENUM (
    'donation_received',
    'campaign_approved',
    'campaign_rejected',
    'campaign_update',
    'withdrawal_approved',
    'withdrawal_rejected',
    'comment_received',
    'milestone_reached',
    'campaign_ending_soon',
    'new_follower'
);

CREATE TABLE public.notifications (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type notification_type NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    link text,
    read boolean DEFAULT false,
    data jsonb,
    created_at timestamptz DEFAULT now(),
    CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_unread ON notifications(user_id, read) WHERE read = false;
```

### 5. **Compartir en Redes Sociales (Tracking)** ⚠️ IMPORTANTE
Rastrear cuántas veces se comparte una campaña.

```sql
CREATE TABLE public.campaign_shares (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    user_id uuid REFERENCES users(id) ON DELETE SET NULL,
    platform text NOT NULL, -- 'facebook', 'twitter', 'whatsapp', 'telegram', 'email', 'link'
    ip_address inet,
    created_at timestamptz DEFAULT now(),
    CONSTRAINT fk_campaign FOREIGN KEY (campaign_id) REFERENCES campaigns(id),
    CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_shares_campaign ON campaign_shares(campaign_id);
```

### 6. **Reportes/Denuncias** ⚠️ IMPORTANTE
Permite a usuarios reportar campañas sospechosas o inapropiadas.

```sql
CREATE TYPE report_status AS ENUM ('pending', 'reviewing', 'resolved', 'dismissed');
CREATE TYPE report_category AS ENUM (
    'fraud',
    'inappropriate_content',
    'spam',
    'misleading_information',
    'copyright',
    'other'
);

CREATE TABLE public.campaign_reports (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    reporter_id uuid REFERENCES users(id) ON DELETE SET NULL,
    category report_category NOT NULL,
    description text NOT NULL,
    status report_status DEFAULT 'pending',
    admin_notes text,
    reviewed_by uuid REFERENCES users(id),
    created_at timestamptz DEFAULT now(),
    reviewed_at timestamptz,
    CONSTRAINT fk_campaign FOREIGN KEY (campaign_id) REFERENCES campaigns(id),
    CONSTRAINT fk_reporter FOREIGN KEY (reporter_id) REFERENCES users(id),
    CONSTRAINT fk_reviewer FOREIGN KEY (reviewed_by) REFERENCES users(id)
);

CREATE INDEX idx_reports_campaign ON campaign_reports(campaign_id);
CREATE INDEX idx_reports_status ON campaign_reports(status);
```

### 7. **Hitos/Milestones** 📊 MEJORA
Celebrar cuando se alcanza el 25%, 50%, 75%, 100% de la meta.

```sql
CREATE TABLE public.campaign_milestones (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    percentage integer NOT NULL, -- 25, 50, 75, 100
    amount_usd numeric NOT NULL,
    reached_at timestamptz,
    celebration_sent boolean DEFAULT false,
    created_at timestamptz DEFAULT now(),
    CONSTRAINT unique_campaign_milestone UNIQUE(campaign_id, percentage),
    CONSTRAINT fk_campaign FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
);

CREATE INDEX idx_milestones_campaign ON campaign_milestones(campaign_id);
```

### 8. **Equipo de Campaña** 📊 MEJORA
Múltiples personas pueden administrar una campaña.

```sql
CREATE TYPE team_role AS ENUM ('owner', 'admin', 'editor', 'viewer');

CREATE TABLE public.campaign_team_members (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role team_role DEFAULT 'editor',
    invited_by uuid REFERENCES users(id),
    accepted_at timestamptz,
    created_at timestamptz DEFAULT now(),
    CONSTRAINT unique_team_member UNIQUE(campaign_id, user_id),
    CONSTRAINT fk_campaign FOREIGN KEY (campaign_id) REFERENCES campaigns(id),
    CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT fk_inviter FOREIGN KEY (invited_by) REFERENCES users(id)
);

CREATE INDEX idx_team_campaign ON campaign_team_members(campaign_id);
CREATE INDEX idx_team_user ON campaign_team_members(user_id);
```

### 9. **Testimonios** 📊 MEJORA
Testimonios de beneficiarios o personas impactadas.

```sql
CREATE TABLE public.campaign_testimonials (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    author_name text NOT NULL,
    author_role text, -- 'beneficiary', 'volunteer', 'supporter', etc.
    content text NOT NULL,
    avatar_url text,
    verified boolean DEFAULT false,
    display_order integer DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    CONSTRAINT fk_campaign FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
);

CREATE INDEX idx_testimonials_campaign ON campaign_testimonials(campaign_id);
```

### 10. **Tags/Etiquetas** 📊 MEJORA
Para mejor búsqueda y descubrimiento de campañas.

```sql
CREATE TABLE public.tags (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    name text NOT NULL UNIQUE,
    slug text NOT NULL UNIQUE,
    usage_count integer DEFAULT 0,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE public.campaign_tags (
    campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    tag_id uuid NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    created_at timestamptz DEFAULT now(),
    PRIMARY KEY (campaign_id, tag_id),
    CONSTRAINT fk_campaign FOREIGN KEY (campaign_id) REFERENCES campaigns(id),
    CONSTRAINT fk_tag FOREIGN KEY (tag_id) REFERENCES tags(id)
);

CREATE INDEX idx_campaign_tags_campaign ON campaign_tags(campaign_id);
CREATE INDEX idx_campaign_tags_tag ON campaign_tags(tag_id);
```

### 11. **Búsqueda Guardada** 📊 MEJORA
Usuarios pueden guardar búsquedas y recibir notificaciones.

```sql
CREATE TABLE public.saved_searches (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name text NOT NULL,
    query_params jsonb NOT NULL,
    notify_new_results boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_saved_searches_user ON saved_searches(user_id);
```

### 12. **Historial de Vistas** 📊 ANALYTICS
Para analytics y recomendaciones.

```sql
CREATE TABLE public.campaign_views (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    user_id uuid REFERENCES users(id) ON DELETE SET NULL,
    ip_address inet,
    user_agent text,
    referrer text,
    viewed_at timestamptz DEFAULT now(),
    CONSTRAINT fk_campaign FOREIGN KEY (campaign_id) REFERENCES campaigns(id),
    CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_views_campaign ON campaign_views(campaign_id);
CREATE INDEX idx_views_date ON campaign_views(viewed_at);
```

### 13. **FAQ de Campañas** 📊 MEJORA
Preguntas frecuentes específicas de cada campaña.

```sql
CREATE TABLE public.campaign_faqs (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    question text NOT NULL,
    answer text NOT NULL,
    display_order integer DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    CONSTRAINT fk_campaign FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
);

CREATE INDEX idx_faqs_campaign ON campaign_faqs(campaign_id);
```

### 14. **Donaciones Recurrentes** 💰 IMPORTANTE
Permitir donaciones mensuales automáticas.

```sql
CREATE TYPE subscription_status AS ENUM ('active', 'paused', 'cancelled', 'failed');

CREATE TABLE public.donation_subscriptions (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    donor_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount_usd numeric NOT NULL,
    frequency text DEFAULT 'monthly', -- 'monthly', 'quarterly', 'yearly'
    status subscription_status DEFAULT 'active',
    stripe_subscription_id text,
    next_payment_date date,
    started_at timestamptz DEFAULT now(),
    cancelled_at timestamptz,
    CONSTRAINT fk_campaign FOREIGN KEY (campaign_id) REFERENCES campaigns(id),
    CONSTRAINT fk_donor FOREIGN KEY (donor_id) REFERENCES users(id)
);

CREATE INDEX idx_subscriptions_campaign ON donation_subscriptions(campaign_id);
CREATE INDEX idx_subscriptions_donor ON donation_subscriptions(donor_id);
CREATE INDEX idx_subscriptions_status ON donation_subscriptions(status);
```

---

## 🔧 MEJORAS RECOMENDADAS al Schema Actual

### 1. Agregar campos faltantes a `campaigns`:
```sql
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS view_count integer DEFAULT 0;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS share_count integer DEFAULT 0;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS comment_count integer DEFAULT 0;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS donor_count integer DEFAULT 0;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS last_donation_at timestamptz;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS is_verified boolean DEFAULT false;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS video_url text;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS beneficiary_name text;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS beneficiary_relationship text;
```

### 2. Agregar campos a `donations`:
```sql
ALTER TABLE donations ADD COLUMN IF NOT EXISTS message text;
ALTER TABLE donations ADD COLUMN IF NOT EXISTS tip_amount_usd numeric DEFAULT 0;
ALTER TABLE donations ADD COLUMN IF NOT EXISTS is_recurring boolean DEFAULT false;
ALTER TABLE donations ADD COLUMN IF NOT EXISTS subscription_id uuid REFERENCES donation_subscriptions(id);
```

### 3. Agregar campos a `users`:
```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified boolean DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_verified boolean DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_preferences jsonb DEFAULT '{"email": true, "push": true, "sms": false}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_banned boolean DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS ban_reason text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at timestamptz;
```

---

## 📊 PRIORIDADES DE IMPLEMENTACIÓN

### **FASE 1 - CRÍTICO** (Implementar YA)
1. ✅ Comentarios en campañas
2. ✅ Sistema de notificaciones
3. ✅ Reacciones/Hearts
4. ✅ Reportes/Denuncias

### **FASE 2 - IMPORTANTE** (Próximas 2 semanas)
5. ✅ Seguimiento de campañas
6. ✅ Compartir en redes (tracking)
7. ✅ Donaciones recurrentes
8. ✅ Hitos/Milestones

### **FASE 3 - MEJORAS** (Siguiente mes)
9. ✅ Equipo de campaña
10. ✅ Testimonios
11. ✅ Tags/Etiquetas
12. ✅ FAQ de campañas

### **FASE 4 - ANALYTICS** (Futuro)
13. ✅ Historial de vistas
14. ✅ Búsquedas guardadas

---

## 🎯 CONCLUSIÓN

Tu schema actual es **SÓLIDO** y cubre las funcionalidades CORE de un GoFundMe:
- ✅ Gestión de usuarios con KYC
- ✅ Campañas completas con estados
- ✅ Donaciones con múltiples métodos de pago (adaptado a Venezuela)
- ✅ Sistema de garantes (ÚNICO de tu plataforma)
- ✅ Retiros y cuentas
- ✅ Admin y auditoría

**Funcionalidades críticas faltantes:**
- ❌ Comentarios (URGENTE)
- ❌ Notificaciones (URGENTE)
- ❌ Reacciones/Hearts (IMPORTANTE)
- ❌ Reportes (IMPORTANTE)

**Recomendación:** Implementa la FASE 1 completa antes de lanzar a producción. Las demás fases pueden agregarse progresivamente según feedback de usuarios.
