-- ============================================
-- KYC VERIFICATION SYSTEM - LaVaca
-- ============================================
-- Sistema completo de verificación de usuarios y gestión de fondos

-- ============================================
-- TABLA: VERIFICATION REQUESTS
-- ============================================

CREATE TABLE IF NOT EXISTS verification_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Tipo de verificación
    verification_type TEXT NOT NULL CHECK (verification_type IN ('individual', 'company')),
    
    -- Información Personal/Empresa
    full_name TEXT NOT NULL,
    document_type TEXT NOT NULL CHECK (document_type IN ('cedula', 'rif', 'passport')),
    document_number TEXT NOT NULL,
    birth_date DATE,
    nationality TEXT,
    
    -- Información de Contacto
    phone TEXT NOT NULL,
    email TEXT NOT NULL,
    address TEXT NOT NULL,
    city TEXT,
    state TEXT,
    country TEXT NOT NULL DEFAULT 'Venezuela',
    postal_code TEXT,
    
    -- Información de Empresa (si aplica)
    company_name TEXT,
    company_rif TEXT,
    company_type TEXT, -- C.A., S.A., etc.
    company_registration_date DATE,
    
    -- Documentos (URLs en Storage)
    document_front_url TEXT NOT NULL,
    document_back_url TEXT,
    selfie_url TEXT NOT NULL, -- Selfie con documento
    proof_of_address_url TEXT,
    company_registration_url TEXT, -- Solo para empresas
    
    -- Estado de la verificación
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'under_review', 'approved', 'rejected', 'suspended')),
    
    -- Razón de rechazo/suspensión
    rejection_reason TEXT,
    rejection_details TEXT,
    
    -- Auditoría
    reviewed_by UUID REFERENCES auth.users(id),
    reviewed_at TIMESTAMPTZ,
    
    -- Metadata
    ip_address TEXT,
    user_agent TEXT,
    metadata JSONB DEFAULT '{}'::JSONB,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_verification_requests_user_id ON verification_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_verification_requests_status ON verification_requests(status);
CREATE INDEX IF NOT EXISTS idx_verification_requests_created_at ON verification_requests(created_at DESC);

-- ============================================
-- TABLA: FUND FREEZES
-- ============================================

CREATE TABLE IF NOT EXISTS fund_freezes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
    
    -- Información del congelamiento
    frozen_amount_usd NUMERIC(10, 2) NOT NULL,
    frozen_amount_bs NUMERIC(12, 2),
    
    -- Razón
    reason TEXT NOT NULL CHECK (reason IN ('verification_rejected', 'fraud_detected', 'user_reported', 'admin_action', 'other')),
    reason_details TEXT,
    
    -- Estado
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'released', 'refunded')),
    
    -- Auditoría
    frozen_by UUID NOT NULL REFERENCES auth.users(id),
    frozen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    released_by UUID REFERENCES auth.users(id),
    released_at TIMESTAMPTZ,
    release_notes TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_fund_freezes_user_id ON fund_freezes(user_id);
CREATE INDEX IF NOT EXISTS idx_fund_freezes_campaign_id ON fund_freezes(campaign_id);
CREATE INDEX IF NOT EXISTS idx_fund_freezes_status ON fund_freezes(status);

-- ============================================
-- TABLA: USER SUSPENSIONS
-- ============================================

CREATE TABLE IF NOT EXISTS user_suspensions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Información de la suspensión
    suspension_type TEXT NOT NULL CHECK (suspension_type IN ('temporary', 'permanent')),
    reason TEXT NOT NULL CHECK (reason IN ('verification_rejected', 'fraud', 'tos_violation', 'user_request', 'other')),
    reason_details TEXT NOT NULL,
    
    -- Fechas
    suspended_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    suspended_until TIMESTAMPTZ, -- NULL si es permanente
    lifted_at TIMESTAMPTZ,
    
    -- Estado
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    
    -- Auditoría
    suspended_by UUID NOT NULL REFERENCES auth.users(id),
    lifted_by UUID REFERENCES auth.users(id),
    lift_reason TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_user_suspensions_user_id ON user_suspensions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_suspensions_is_active ON user_suspensions(is_active) WHERE is_active = TRUE;

-- ============================================
-- FUNCIONES HELPER
-- ============================================

-- Verificar si un usuario está suspendido
CREATE OR REPLACE FUNCTION is_user_suspended(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM user_suspensions
        WHERE user_id = p_user_id
        AND is_active = TRUE
        AND (suspended_until IS NULL OR suspended_until > NOW())
    );
END;
$$ LANGUAGE plpgsql;

-- Obtener fondos totales de un usuario
CREATE OR REPLACE FUNCTION get_user_total_funds(p_user_id UUID)
RETURNS NUMERIC AS $$
DECLARE
    total NUMERIC;
BEGIN
    SELECT COALESCE(SUM(current_amount_usd), 0)
    INTO total
    FROM campaigns
    WHERE creator_id = p_user_id
    AND status = 'active';
    
    RETURN total;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- TRIGGERS
-- ============================================

-- 1. Al rechazar verificación → Suspender usuario y congelar fondos
CREATE OR REPLACE FUNCTION handle_verification_rejection()
RETURNS TRIGGER AS $$
DECLARE
    user_total_funds NUMERIC;
BEGIN
    IF NEW.status = 'rejected' AND OLD.status != 'rejected' THEN
        -- Obtener fondos totales del usuario
        user_total_funds := get_user_total_funds(NEW.user_id);
        
        -- Suspender campañas del usuario
        UPDATE campaigns
        SET status = 'suspended'
        WHERE creator_id = NEW.user_id
        AND status = 'active';
        
        -- Crear suspensión de usuario
        INSERT INTO user_suspensions (
            user_id,
            suspension_type,
            reason,
            reason_details,
            suspended_by
        ) VALUES (
            NEW.user_id,
            'permanent',
            'verification_rejected',
            COALESCE(NEW.rejection_reason, 'Verificación de identidad rechazada'),
            NEW.reviewed_by
        );
        
        -- Congelar fondos si hay alguno
        IF user_total_funds > 0 THEN
            INSERT INTO fund_freezes (
                user_id,
                frozen_amount_usd,
                reason,
                reason_details,
                frozen_by
            ) VALUES (
                NEW.user_id,
                user_total_funds,
                'verification_rejected',
                'Fondos congelados debido al rechazo de verificación',
                NEW.reviewed_by
            );
        END IF;
        
        RAISE NOTICE 'Usuario % suspendido y fondos congelados ($%)', NEW.user_id, user_total_funds;
    END IF;
    
    -- Al aprobar → Actualizar perfil del usuario
    IF NEW.status = 'approved' AND OLD.status != 'approved' THEN
        UPDATE users
        SET 
            kyc_status = 'verified',
            verified_at = NOW()
        WHERE id = NEW.user_id;
        
        RAISE NOTICE 'Usuario % verificado exitosamente', NEW.user_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_handle_verification_rejection ON verification_requests;
CREATE TRIGGER trigger_handle_verification_rejection
AFTER UPDATE ON verification_requests
FOR EACH ROW
EXECUTE FUNCTION handle_verification_rejection();

-- 2. Prevenir acciones de usuarios suspendidos
CREATE OR REPLACE FUNCTION prevent_suspended_user_actions()
RETURNS TRIGGER AS $$
BEGIN
    IF is_user_suspended(NEW.creator_id) THEN
        RAISE EXCEPTION 'Usuario suspendido no puede crear campañas';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_prevent_suspended_campaigns ON campaigns;
CREATE TRIGGER trigger_prevent_suspended_campaigns
BEFORE INSERT ON campaigns
FOR EACH ROW
EXECUTE FUNCTION prevent_suspended_user_actions();

-- ============================================
-- RLS POLICIES
-- ============================================

ALTER TABLE verification_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE fund_freezes ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_suspensions ENABLE ROW LEVEL SECURITY;

-- Verification Requests
CREATE POLICY "Users can view own verification requests"
ON verification_requests FOR SELECT
USING (auth.uid() = user_id OR auth.uid() IN (SELECT id FROM users WHERE role = 'admin'));

CREATE POLICY "Users can create own verification requests"
ON verification_requests FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Only admins can update verification requests"
ON verification_requests FOR UPDATE
USING (auth.uid() IN (SELECT id FROM users WHERE role = 'admin'));

-- Fund Freezes
CREATE POLICY "Users can view own fund freezes"
ON fund_freezes FOR SELECT
USING (auth.uid() = user_id OR auth.uid() IN (SELECT id FROM users WHERE role = 'admin'));

CREATE POLICY "Only admins can manage fund freezes"
ON fund_freezes FOR ALL
USING (auth.uid() IN (SELECT id FROM users WHERE role = 'admin'));

-- User Suspensions
CREATE POLICY "Users can view own suspensions"
ON user_suspensions FOR SELECT
USING (auth.uid() = user_id OR auth.uid() IN (SELECT id FROM users WHERE role = 'admin'));

CREATE POLICY "Only admins can manage suspensions"
ON user_suspensions FOR ALL
USING (auth.uid() IN (SELECT id FROM users WHERE role = 'admin'));

-- ============================================
-- STORAGE BUCKETS
-- ============================================

-- Crear bucket para documentos de verificación
INSERT INTO storage.buckets (id, name, public)
VALUES ('verification-documents', 'verification-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Políticas de storage
CREATE POLICY "Users can upload own verification documents"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'verification-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can view own verification documents"
ON storage.objects FOR SELECT
USING (
    bucket_id = 'verification-documents'
    AND (
        (storage.foldername(name))[1] = auth.uid()::text
        OR auth.uid() IN (SELECT id FROM users WHERE role = 'admin')
    )
);

-- ============================================
-- LOG FINAL
-- ============================================

DO $$
BEGIN
    RAISE NOTICE '============================================';
    RAISE NOTICE 'KYC VERIFICATION SYSTEM CREATED';
    RAISE NOTICE '============================================';
    RAISE NOTICE '✅ Table: verification_requests';
    RAISE NOTICE '✅ Table: fund_freezes';
    RAISE NOTICE '✅ Table: user_suspensions';
    RAISE NOTICE '✅ Functions: is_user_suspended(), get_user_total_funds()';
    RAISE NOTICE '✅ Trigger: Auto-suspend on rejection';
    RAISE NOTICE '✅ Trigger: Prevent suspended user actions';
    RAISE NOTICE '✅ RLS Policies: All configured';
    RAISE NOTICE '✅ Storage: verification-documents bucket';
    RAISE NOTICE '============================================';
    RAISE NOTICE 'FEATURES:';
    RAISE NOTICE '- Users can submit verification requests';
    RAISE NOTICE '- Users can create campaigns while pending';
    RAISE NOTICE '- Auto-suspend campaigns on rejection';
    RAISE NOTICE '- Auto-freeze funds on rejection';
    RAISE NOTICE '- Admin panel for verification management';
    RAISE NOTICE '============================================';
END $$;
