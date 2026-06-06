-- ============================================
-- FIX DONATIONS RLS POLICIES
-- ============================================
-- El problema: Las políticas RLS bloquean UPDATE de donations
-- desde el servidor (service role)

-- Ver políticas actuales
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'donations';

-- ============================================
-- SOLUCIÓN: Eliminar políticas restrictivas
-- ============================================

-- Eliminar TODAS las políticas existentes de donations
DROP POLICY IF EXISTS "Users can view their own donations" ON donations;
DROP POLICY IF EXISTS "Users can insert their own donations" ON donations;
DROP POLICY IF EXISTS "Users can update their own donations" ON donations;
DROP POLICY IF EXISTS "Creators can view campaign donations" ON donations;
DROP POLICY IF EXISTS "Anyone can view completed donations" ON donations;
DROP POLICY IF EXISTS "Service role can do anything" ON donations;

-- ============================================
-- CREAR POLÍTICAS CORRECTAS
-- ============================================

-- 1. SELECT: Cualquiera puede ver donaciones completadas
CREATE POLICY "anyone_can_view_completed_donations"
ON donations FOR SELECT
USING (
    payment_status = 'completed'
    OR auth.uid() = donor_id
    OR auth.uid() IN (
        SELECT creator_id FROM campaigns WHERE id = donations.campaign_id
    )
);

-- 2. INSERT: Cualquiera puede crear donaciones
CREATE POLICY "anyone_can_create_donations"
ON donations FOR INSERT
WITH CHECK (true);

-- 3. UPDATE: Permitir actualizaciones del sistema
-- IMPORTANTE: Esto permite que el servidor actualice sin restricciones
CREATE POLICY "system_can_update_donations"
ON donations FOR UPDATE
USING (
    -- El usuario es dueño de la donación
    auth.uid() = donor_id
    OR
    -- O es el creador de la campaña
    auth.uid() IN (
        SELECT creator_id FROM campaigns WHERE id = donations.campaign_id
    )
    OR
    -- O la donación fue creada recientemente (últimos 5 minutos)
    -- Esto permite que el sistema actualice justo después de crear
    created_at > NOW() - INTERVAL '5 minutes'
);

-- ============================================
-- VERIFICACIÓN
-- ============================================

DO $$
DECLARE
    policy_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies
    WHERE tablename = 'donations';
    
    RAISE NOTICE '============================================';
    RAISE NOTICE 'DONATIONS RLS POLICIES FIXED';
    RAISE NOTICE '============================================';
    RAISE NOTICE '✅ Policies created: %', policy_count;
    RAISE NOTICE '✅ SELECT: Anyone can view completed';
    RAISE NOTICE '✅ INSERT: Anyone can create';
    RAISE NOTICE '✅ UPDATE: System can update (5 min window)';
    RAISE NOTICE '============================================';
END $$;

-- Ver políticas finales
SELECT 
    policyname,
    cmd as operation,
    CASE 
        WHEN cmd = 'SELECT' THEN 'View donations'
        WHEN cmd = 'INSERT' THEN 'Create donations'
        WHEN cmd = 'UPDATE' THEN 'Update donations (5 min window)'
        ELSE cmd
    END as description
FROM pg_policies
WHERE tablename = 'donations';
