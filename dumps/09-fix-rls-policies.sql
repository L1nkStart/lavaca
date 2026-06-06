-- ============================================
-- FIX RLS POLICIES - Permitir lectura pública
-- ============================================

-- IMPORTANTE: Este script arregla las políticas RLS para permitir
-- que usuarios no autenticados puedan ver campañas públicas

-- ============================================
-- 1. CAMPAIGNS - Permitir lectura pública
-- ============================================

-- Eliminar políticas restrictivas existentes
DROP POLICY IF EXISTS "Campaigns are viewable by everyone" ON campaigns;
DROP POLICY IF EXISTS "Public campaigns are viewable by everyone" ON campaigns;
DROP POLICY IF EXISTS "Anyone can view active campaigns" ON campaigns;

-- Crear política que permite a TODOS ver campañas activas
CREATE POLICY "Anyone can view active campaigns"
ON campaigns
FOR SELECT
USING (status = 'active');

-- Política para que creadores vean sus propias campañas en cualquier estado
CREATE POLICY "Creators can view own campaigns"
ON campaigns
FOR SELECT
USING (auth.uid() = creator_id);

-- ============================================
-- 2. CATEGORIES - Lectura pública
-- ============================================

DROP POLICY IF EXISTS "Categories are viewable by everyone" ON categories;

CREATE POLICY "Categories are viewable by everyone"
ON categories
FOR SELECT
USING (true);

-- ============================================
-- 3. USERS - Lectura pública de perfiles
-- ============================================

DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON users;

CREATE POLICY "Public profiles are viewable by everyone"
ON users
FOR SELECT
USING (true);

-- ============================================
-- 4. CAMPAIGN_DETAILS - Lectura pública
-- ============================================

DROP POLICY IF EXISTS "Campaign details are viewable by everyone" ON campaign_details;

CREATE POLICY "Campaign details are viewable by everyone"
ON campaign_details
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM campaigns
        WHERE campaigns.id = campaign_details.campaign_id
        AND campaigns.status = 'active'
    )
);

-- ============================================
-- 5. DONATIONS - Lectura pública (solo completadas)
-- ============================================

DROP POLICY IF EXISTS "Completed donations are viewable by everyone" ON donations;

CREATE POLICY "Completed donations are viewable by everyone"
ON donations
FOR SELECT
USING (payment_status = 'completed');

-- ============================================
-- 6. CAMPAIGN_UPDATES - Lectura pública
-- ============================================

DROP POLICY IF EXISTS "Campaign updates are viewable by everyone" ON campaign_updates;

CREATE POLICY "Campaign updates are viewable by everyone"
ON campaign_updates
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM campaigns
        WHERE campaigns.id = campaign_updates.campaign_id
        AND campaigns.status = 'active'
    )
);

-- ============================================
-- 7. GARANTORS - Lectura pública
-- ============================================

DROP POLICY IF EXISTS "Guarantors are viewable by everyone" ON guarantors;

CREATE POLICY "Guarantors are viewable by everyone"
ON guarantors
FOR SELECT
USING (kyc_status = 'verified');

-- ============================================
-- VERIFICAR POLÍTICAS
-- ============================================

-- Ver todas las políticas de campaigns
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'campaigns';

-- ============================================
-- FIN DEL SCRIPT
-- ============================================

DO $$
BEGIN
    RAISE NOTICE '============================================';
    RAISE NOTICE 'POLÍTICAS RLS ACTUALIZADAS';
    RAISE NOTICE '============================================';
    RAISE NOTICE 'Las campañas activas ahora son visibles públicamente';
    RAISE NOTICE 'Los usuarios no autenticados pueden navegar la app';
    RAISE NOTICE '============================================';
END $$;
