-- ============================================
-- FIX NOTIFICATIONS RLS - LaVaca
-- ============================================
-- Permitir que los triggers inserten notificaciones

-- ============================================
-- 1. Agregar política para permitir inserts desde triggers
-- ============================================

-- Eliminar políticas existentes que puedan conflictuar
DROP POLICY IF EXISTS "Allow trigger inserts" ON notifications;
DROP POLICY IF EXISTS "System can create notifications" ON notifications;

-- Crear política que permite inserts desde el sistema (triggers)
CREATE POLICY "System can create notifications"
ON notifications
FOR INSERT
WITH CHECK (true);

-- ============================================
-- 2. Verificar triggers existentes
-- ============================================

DO $$
DECLARE
    trigger_count INT;
BEGIN
    SELECT COUNT(*) INTO trigger_count
    FROM pg_trigger
    WHERE tgname IN (
        'trigger_notify_donation',
        'trigger_notify_donation_completed',
        'trigger_notify_comment'
    );
    
    RAISE NOTICE '============================================';
    RAISE NOTICE 'VERIFICACIÓN DE TRIGGERS';
    RAISE NOTICE '============================================';
    RAISE NOTICE 'Triggers encontrados: %', trigger_count;
    
    IF trigger_count < 3 THEN
        RAISE WARNING '⚠️ Faltan triggers! Ejecuta 11-notification-triggers.sql';
    ELSE
        RAISE NOTICE '✅ Todos los triggers están instalados';
    END IF;
    RAISE NOTICE '============================================';
END $$;

-- ============================================
-- 3. Verificar políticas RLS
-- ============================================

SELECT 
    schemaname,
    tablename,
    policyname,
    cmd,
    permissive
FROM pg_policies
WHERE tablename = 'notifications'
ORDER BY policyname;

-- ============================================
-- 4. Test de inserción manual (DEBUG)
-- ============================================

-- Descomenta esto para probar inserción manual:
/*
INSERT INTO notifications (
    user_id,
    type,
    title,
    message,
    read
) VALUES (
    (SELECT creator_id FROM campaigns LIMIT 1),
    'test',
    '🧪 Test Notification',
    'Esta es una notificación de prueba',
    FALSE
);
*/

-- ============================================
-- LOG FINAL
-- ============================================

DO $$
BEGIN
    RAISE NOTICE '============================================';
    RAISE NOTICE 'POLÍTICAS RLS ACTUALIZADAS';
    RAISE NOTICE '============================================';
    RAISE NOTICE '✅ Sistema puede insertar notificaciones';
    RAISE NOTICE '✅ Triggers pueden crear notificaciones';
    RAISE NOTICE '';
    RAISE NOTICE '📝 PARA PROBAR:';
    RAISE NOTICE '1. Haz una donación en cualquier campaña';
    RAISE NOTICE '2. Verifica la consola del servidor';
    RAISE NOTICE '3. Verifica la tabla notifications en Supabase';
    RAISE NOTICE '============================================';
END $$;
