-- ============================================
-- EXCHANGE RATES TABLE - LaVaca
-- ============================================
-- Tabla para histórico de tasas de cambio USD/BS

CREATE TABLE IF NOT EXISTS exchange_rates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rate NUMERIC(10, 4) NOT NULL,
    raw_rate NUMERIC(10, 4) NOT NULL, -- Tasa sin margen (de Binance)
    margin_percentage NUMERIC(5, 2) NOT NULL DEFAULT 4.3, -- Margen aplicado
    source TEXT NOT NULL DEFAULT 'binance_p2p', -- Fuente de la tasa
    is_active BOOLEAN DEFAULT TRUE, -- Solo una activa a la vez
    metadata JSONB, -- Info adicional de la consulta
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL -- Cada tasa expira después de 3 horas
);

-- Índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_exchange_rates_created_at ON exchange_rates(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_exchange_rates_active ON exchange_rates(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_exchange_rates_expires ON exchange_rates(expires_at);

-- Solo puede haber una tasa activa a la vez
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_rate ON exchange_rates(is_active) WHERE is_active = TRUE;

-- ============================================
-- FUNCIONES HELPER
-- ============================================

-- Función para obtener la tasa activa actual
CREATE OR REPLACE FUNCTION get_active_exchange_rate()
RETURNS NUMERIC AS $$
DECLARE
    current_rate NUMERIC;
BEGIN
    SELECT rate INTO current_rate
    FROM exchange_rates
    WHERE is_active = TRUE
    AND expires_at > NOW()
    LIMIT 1;
    
    RETURN current_rate;
END;
$$ LANGUAGE plpgsql;

-- Función para crear nueva tasa y desactivar anteriores
CREATE OR REPLACE FUNCTION create_new_exchange_rate(
    p_raw_rate NUMERIC,
    p_margin NUMERIC DEFAULT 4.3,
    p_source TEXT DEFAULT 'binance_p2p',
    p_metadata JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    new_id UUID;
    calculated_rate NUMERIC;
BEGIN
    -- Calcular tasa con margen
    calculated_rate := p_raw_rate * (1 + (p_margin / 100));
    
    -- Desactivar tasas anteriores
    UPDATE exchange_rates
    SET is_active = FALSE
    WHERE is_active = TRUE;
    
    -- Crear nueva tasa (expira en 3 horas)
    INSERT INTO exchange_rates (
        rate,
        raw_rate,
        margin_percentage,
        source,
        is_active,
        metadata,
        expires_at
    ) VALUES (
        calculated_rate,
        p_raw_rate,
        p_margin,
        p_source,
        TRUE,
        p_metadata,
        NOW() + INTERVAL '3 hours'
    )
    RETURNING id INTO new_id;
    
    RETURN new_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- TABLA PARA TASAS CONGELADAS (TTL)
-- ============================================

CREATE TABLE IF NOT EXISTS frozen_exchange_rates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id TEXT NOT NULL, -- ID de sesión del usuario
    rate NUMERIC(10, 4) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL, -- Expira en 10 minutos
    used BOOLEAN DEFAULT FALSE,
    donation_id UUID REFERENCES donations(id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_frozen_rates_session ON frozen_exchange_rates(session_id);
CREATE INDEX IF NOT EXISTS idx_frozen_rates_expires ON frozen_exchange_rates(expires_at);
CREATE INDEX IF NOT EXISTS idx_frozen_rates_used ON frozen_exchange_rates(used);

-- Función para congelar tasa para una sesión
CREATE OR REPLACE FUNCTION freeze_rate_for_session(
    p_session_id TEXT,
    p_duration_minutes INTEGER DEFAULT 10
)
RETURNS TABLE(rate NUMERIC, expires_at TIMESTAMPTZ) AS $$
DECLARE
    current_rate NUMERIC;
    expiry_time TIMESTAMPTZ;
BEGIN
    -- Obtener tasa activa
    SELECT get_active_exchange_rate() INTO current_rate;
    
    IF current_rate IS NULL THEN
        RAISE EXCEPTION 'No active exchange rate available';
    END IF;
    
    -- Calcular expiración
    expiry_time := NOW() + (p_duration_minutes || ' minutes')::INTERVAL;
    
    -- Verificar si ya tiene una tasa congelada válida
    IF EXISTS (
        SELECT 1 FROM frozen_exchange_rates
        WHERE session_id = p_session_id
        AND expires_at > NOW()
        AND NOT used
    ) THEN
        -- Devolver la existente
        RETURN QUERY
        SELECT fr.rate, fr.expires_at
        FROM frozen_exchange_rates fr
        WHERE fr.session_id = p_session_id
        AND fr.expires_at > NOW()
        AND NOT fr.used
        LIMIT 1;
    ELSE
        -- Crear nueva tasa congelada
        INSERT INTO frozen_exchange_rates (
            session_id,
            rate,
            expires_at
        ) VALUES (
            p_session_id,
            current_rate,
            expiry_time
        );
        
        RETURN QUERY SELECT current_rate, expiry_time;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- TRIGGER: Limpiar tasas expiradas
-- ============================================

CREATE OR REPLACE FUNCTION cleanup_expired_frozen_rates()
RETURNS void AS $$
BEGIN
    DELETE FROM frozen_exchange_rates
    WHERE expires_at < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- RLS POLICIES
-- ============================================

ALTER TABLE exchange_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE frozen_exchange_rates ENABLE ROW LEVEL SECURITY;

-- Todos pueden ver tasas de cambio
CREATE POLICY "Anyone can view exchange rates"
ON exchange_rates FOR SELECT
USING (true);

-- Permitir actualizaciones del sistema (necesario para la función)
CREATE POLICY "Allow system updates"
ON exchange_rates FOR UPDATE
USING (true);

-- Permitir inserts desde funciones (bypass RLS en funciones)
-- La seguridad la manejan las funciones mismas
CREATE POLICY "Allow function inserts"
ON exchange_rates FOR INSERT
WITH CHECK (true);

-- Frozen rates - usuarios pueden ver y crear
CREATE POLICY "Users can view frozen rates"
ON frozen_exchange_rates FOR SELECT
USING (true);

CREATE POLICY "Allow frozen rate creation"
ON frozen_exchange_rates FOR INSERT
WITH CHECK (true);

-- ============================================
-- SEED INICIAL
-- ============================================

-- Insertar tasa inicial si no existe
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM exchange_rates LIMIT 1) THEN
        PERFORM create_new_exchange_rate(
            41.25, -- Tasa base
            4.3,   -- Margen 4.3%
            'manual_seed',
            '{"note": "Initial rate"}'::JSONB
        );
        RAISE NOTICE '✅ Tasa inicial creada: 41.25 BS/USD + 4.3%% margen';
    END IF;
END $$;

-- ============================================
-- LOG
-- ============================================

DO $$
BEGIN
    RAISE NOTICE '============================================';
    RAISE NOTICE 'EXCHANGE RATES SYSTEM CREATED';
    RAISE NOTICE '============================================';
    RAISE NOTICE '✅ Tabla: exchange_rates';
    RAISE NOTICE '✅ Tabla: frozen_exchange_rates';
    RAISE NOTICE '✅ Función: get_active_exchange_rate()';
    RAISE NOTICE '✅ Función: create_new_exchange_rate()';
    RAISE NOTICE '✅ Función: freeze_rate_for_session()';
    RAISE NOTICE '✅ TTL: 10 minutos por sesión';
    RAISE NOTICE '✅ Actualización: Cada 3 horas';
    RAISE NOTICE '✅ Margen: 4.3%% por defecto';
    RAISE NOTICE '============================================';
END $$;
