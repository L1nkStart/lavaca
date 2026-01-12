-- ============================================
-- NOTIFICATION TRIGGERS - LaVaca
-- ============================================
-- Triggers automáticos para crear notificaciones

-- ============================================
-- 1. TRIGGER: Nueva Donación
-- ============================================
CREATE OR REPLACE FUNCTION notify_campaign_owner_donation()
RETURNS TRIGGER AS $$
DECLARE
    v_creator_id UUID;
    v_campaign_title TEXT;
    v_donor_name TEXT;
BEGIN
    -- Solo notificar si el pago fue completado
    IF NEW.payment_status = 'completed' THEN
        -- Obtener el creador de la campaña
        SELECT creator_id, title 
        INTO v_creator_id, v_campaign_title
        FROM campaigns 
        WHERE id = NEW.campaign_id;

        -- Determinar nombre del donante
        IF NEW.is_anonymous THEN
            v_donor_name := 'Un donante anónimo';
        ELSE
            v_donor_name := COALESCE(NEW.donor_name, 'Un donante');
        END IF;

        -- Crear notificación
        INSERT INTO notifications (
            user_id,
            type,
            title,
            message,
            campaign_id,
            related_id,
            link,
            read
        ) VALUES (
            v_creator_id,
            'donation_received',
            '💰 Nueva donación recibida',
            v_donor_name || ' ha donado $' || NEW.amount_usd::TEXT || ' a "' || v_campaign_title || '"',
            NEW.campaign_id,
            NEW.id,
            '/campaigns/' || NEW.campaign_id::TEXT,
            FALSE
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear trigger solo si no existe
DROP TRIGGER IF EXISTS trigger_notify_donation ON donations;
CREATE TRIGGER trigger_notify_donation
AFTER INSERT ON donations
FOR EACH ROW
EXECUTE FUNCTION notify_campaign_owner_donation();

-- ============================================
-- 2. TRIGGER: Actualizar notificación cuando pago se complete
-- ============================================
CREATE OR REPLACE FUNCTION notify_donation_completed()
RETURNS TRIGGER AS $$
DECLARE
    v_creator_id UUID;
    v_campaign_title TEXT;
    v_donor_name TEXT;
BEGIN
    -- Solo si cambió de pending a completed
    IF OLD.payment_status != 'completed' AND NEW.payment_status = 'completed' THEN
        -- Obtener el creador de la campaña
        SELECT creator_id, title 
        INTO v_creator_id, v_campaign_title
        FROM campaigns 
        WHERE id = NEW.campaign_id;

        -- Determinar nombre del donante
        IF NEW.is_anonymous THEN
            v_donor_name := 'Un donante anónimo';
        ELSE
            v_donor_name := COALESCE(NEW.donor_name, 'Un donante');
        END IF;

        -- Crear notificación
        INSERT INTO notifications (
            user_id,
            type,
            title,
            message,
            campaign_id,
            related_id,
            link,
            read
        ) VALUES (
            v_creator_id,
            'donation_received',
            '💰 Donación confirmada',
            v_donor_name || ' completó su donación de $' || NEW.amount_usd::TEXT || ' a "' || v_campaign_title || '"',
            NEW.campaign_id,
            NEW.id,
            '/campaigns/' || NEW.campaign_id::TEXT,
            FALSE
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_notify_donation_completed ON donations;
CREATE TRIGGER trigger_notify_donation_completed
AFTER UPDATE ON donations
FOR EACH ROW
EXECUTE FUNCTION notify_donation_completed();

-- ============================================
-- 3. TRIGGER: Nuevo Comentario
-- ============================================
CREATE OR REPLACE FUNCTION notify_campaign_owner_comment()
RETURNS TRIGGER AS $$
DECLARE
    v_creator_id UUID;
    v_campaign_title TEXT;
    v_commenter_name TEXT;
BEGIN
    -- Obtener el creador de la campaña
    SELECT c.creator_id, c.title 
    INTO v_creator_id, v_campaign_title
    FROM campaigns c
    WHERE c.id = NEW.campaign_id;

    -- No notificar si el comentario es del propio creador
    IF NEW.user_id IS NOT NULL AND NEW.user_id = v_creator_id THEN
        RETURN NEW;
    END IF;

    -- Determinar nombre del comentarista
    IF NEW.is_anonymous THEN
        v_commenter_name := 'Alguien';
    ELSIF NEW.user_id IS NOT NULL THEN
        SELECT full_name INTO v_commenter_name 
        FROM users 
        WHERE id = NEW.user_id;
    ELSE
        v_commenter_name := 'Alguien';
    END IF;

    -- Crear notificación
    INSERT INTO notifications (
        user_id,
        type,
        title,
        message,
        campaign_id,
        related_id,
        link,
        read
    ) VALUES (
        v_creator_id,
        'campaign_comment',
        '💬 Nuevo comentario',
        v_commenter_name || ' comentó en "' || v_campaign_title || '"',
        NEW.campaign_id,
        NEW.id,
        '/campaigns/' || NEW.campaign_id::TEXT,
        FALSE
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_notify_comment ON campaign_comments;
CREATE TRIGGER trigger_notify_comment
AFTER INSERT ON campaign_comments
FOR EACH ROW
EXECUTE FUNCTION notify_campaign_owner_comment();

-- ============================================
-- 4. TRIGGER: Nueva Reacción
-- ============================================
CREATE OR REPLACE FUNCTION notify_campaign_owner_reaction()
RETURNS TRIGGER AS $$
DECLARE
    v_creator_id UUID;
    v_campaign_title TEXT;
    v_user_name TEXT;
    v_reaction_count INT;
BEGIN
    -- Obtener el creador de la campaña
    SELECT c.creator_id, c.title 
    INTO v_creator_id, v_campaign_title
    FROM campaigns c
    WHERE c.id = NEW.campaign_id;

    -- No notificar si es del propio creador
    IF NEW.user_id = v_creator_id THEN
        RETURN NEW;
    END IF;

    -- Contar reacciones totales
    SELECT COUNT(*) INTO v_reaction_count
    FROM campaign_reactions
    WHERE campaign_id = NEW.campaign_id;

    -- Solo notificar en hitos (1, 5, 10, 25, 50, 100, etc.)
    IF v_reaction_count IN (1, 5, 10, 25, 50, 100, 250, 500, 1000) THEN
        -- Obtener nombre del usuario
        SELECT full_name INTO v_user_name 
        FROM users 
        WHERE id = NEW.user_id;

        -- Crear notificación
        INSERT INTO notifications (
            user_id,
            type,
            title,
            message,
            campaign_id,
            related_id,
            link,
            read
        ) VALUES (
            v_creator_id,
            'campaign_milestone',
            '❤️ ¡Hito alcanzado!',
            '"' || v_campaign_title || '" ha recibido ' || v_reaction_count || ' reacciones',
            NEW.campaign_id,
            NEW.id,
            '/campaigns/' || NEW.campaign_id::TEXT,
            FALSE
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_notify_reaction ON campaign_reactions;
CREATE TRIGGER trigger_notify_reaction
AFTER INSERT ON campaign_reactions
FOR EACH ROW
EXECUTE FUNCTION notify_campaign_owner_reaction();

-- ============================================
-- 5. TRIGGER: Nuevo Seguidor
-- ============================================
CREATE OR REPLACE FUNCTION notify_campaign_owner_follower()
RETURNS TRIGGER AS $$
DECLARE
    v_creator_id UUID;
    v_campaign_title TEXT;
    v_follower_name TEXT;
    v_follower_count INT;
BEGIN
    -- Obtener el creador de la campaña
    SELECT c.creator_id, c.title 
    INTO v_creator_id, v_campaign_title
    FROM campaigns c
    WHERE c.id = NEW.campaign_id;

    -- No notificar si es del propio creador
    IF NEW.user_id = v_creator_id THEN
        RETURN NEW;
    END IF;

    -- Contar seguidores totales
    SELECT COUNT(*) INTO v_follower_count
    FROM campaign_followers
    WHERE campaign_id = NEW.campaign_id;

    -- Notificar solo en hitos
    IF v_follower_count IN (1, 5, 10, 25, 50, 100) THEN
        INSERT INTO notifications (
            user_id,
            type,
            title,
            message,
            campaign_id,
            related_id,
            link,
            read
        ) VALUES (
            v_creator_id,
            'campaign_milestone',
            '👥 ¡Nuevos seguidores!',
            '"' || v_campaign_title || '" ahora tiene ' || v_follower_count || ' seguidores',
            NEW.campaign_id,
            NEW.id,
            '/campaigns/' || NEW.campaign_id::TEXT,
            FALSE
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_notify_follower ON campaign_followers;
CREATE TRIGGER trigger_notify_follower
AFTER INSERT ON campaign_followers
FOR EACH ROW
EXECUTE FUNCTION notify_campaign_owner_follower();

-- ============================================
-- LOG
-- ============================================
DO $$
BEGIN
    RAISE NOTICE '============================================';
    RAISE NOTICE 'NOTIFICATION TRIGGERS CREADOS';
    RAISE NOTICE '============================================';
    RAISE NOTICE '✅ Trigger: Donaciones completadas';
    RAISE NOTICE '✅ Trigger: Comentarios nuevos';
    RAISE NOTICE '✅ Trigger: Reacciones (hitos)';
    RAISE NOTICE '✅ Trigger: Seguidores (hitos)';
    RAISE NOTICE '============================================';
END $$;
