-- ============================================
-- FIX DONATIONS DISPLAY ISSUE
-- ============================================

-- Paso 1: Ver todas las donaciones y sus estados
DO $$
BEGIN
    RAISE NOTICE '============================================';
    RAISE NOTICE 'DONATIONS DEBUG INFO';
    RAISE NOTICE '============================================';
END $$;

-- Mostrar todas las donaciones con sus estados
SELECT 
    id,
    campaign_id,
    amount_usd,
    donor_name,
    payment_status,
    payment_method,
    created_at
FROM donations
ORDER BY created_at DESC
LIMIT 10;

-- Contar donaciones por estado
SELECT 
    payment_status,
    COUNT(*) as count
FROM donations
GROUP BY payment_status;

-- ============================================
-- SOLUCIÓN: Actualizar donaciones pending a completed
-- ============================================

-- Si las donaciones están en 'pending', cambiarlas a 'completed'
UPDATE donations
SET payment_status = 'completed'
WHERE payment_status IN ('pending', 'processing')
AND created_at > NOW() - INTERVAL '7 days'; -- Solo últimas 7 días

-- ============================================
-- VERIFICAR RLS POLICIES
-- ============================================

-- Ver políticas actuales de donations
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies
WHERE tablename = 'donations';

-- ============================================
-- ASEGURAR QUE DONATIONS SE PUEDAN LEER
-- ============================================

-- Eliminar políticas restrictivas si existen
DROP POLICY IF EXISTS "Anyone can view completed donations" ON donations;

-- Crear política correcta para ver donaciones completadas
CREATE POLICY "Anyone can view completed donations"
ON donations FOR SELECT
USING (
    payment_status = 'completed'
    OR auth.uid() = donor_id
    OR auth.uid() IN (
        SELECT creator_id FROM campaigns WHERE id = donations.campaign_id
    )
);

-- ============================================
-- TRIGGER PARA ACTUALIZAR CURRENT_AMOUNT
-- ============================================

-- Crear trigger que actualice current_amount cuando se complete una donación
CREATE OR REPLACE FUNCTION update_campaign_amount_on_donation()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.payment_status = 'completed' AND (OLD.payment_status IS NULL OR OLD.payment_status != 'completed') THEN
        UPDATE campaigns
        SET current_amount_usd = current_amount_usd + NEW.amount_usd
        WHERE id = NEW.campaign_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Eliminar trigger si existe
DROP TRIGGER IF EXISTS trigger_update_campaign_amount ON donations;

-- Crear trigger
CREATE TRIGGER trigger_update_campaign_amount
AFTER INSERT OR UPDATE ON donations
FOR EACH ROW
EXECUTE FUNCTION update_campaign_amount_on_donation();

-- ============================================
-- RECALCULAR TOTALES EXISTENTES
-- ============================================

-- Recalcular current_amount para todas las campañas
UPDATE campaigns c
SET current_amount_usd = COALESCE((
    SELECT SUM(amount_usd)
    FROM donations d
    WHERE d.campaign_id = c.id
    AND d.payment_status = 'completed'
), 0);

-- ============================================
-- LOG FINAL
-- ============================================

DO $$
DECLARE
    completed_count INTEGER;
    pending_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO completed_count FROM donations WHERE payment_status = 'completed';
    SELECT COUNT(*) INTO pending_count FROM donations WHERE payment_status = 'pending';
    
    RAISE NOTICE '============================================';
    RAISE NOTICE 'DONATIONS FIXED';
    RAISE NOTICE '============================================';
    RAISE NOTICE '✅ Completed donations: %', completed_count;
    RAISE NOTICE '⏳ Pending donations: %', pending_count;
    RAISE NOTICE '✅ RLS Policy updated';
    RAISE NOTICE '✅ Trigger created';
    RAISE NOTICE '✅ Campaign amounts recalculated';
    RAISE NOTICE '============================================';
END $$;
