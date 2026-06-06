-- ============================================
-- FASE 1 - FUNCIONALIDADES CRÍTICAS
-- Mejoras esenciales para LaVaca (GoFundMe Venezolano)
-- ============================================

-- ============================================
-- 1. COMENTARIOS EN CAMPAÑAS
-- ============================================

CREATE TABLE IF NOT EXISTS public.campaign_comments (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id uuid NOT NULL,
    user_id uuid,
    parent_comment_id uuid,
    content text NOT NULL,
    is_from_creator boolean DEFAULT false,
    is_anonymous boolean DEFAULT false,
    donor_name text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    deleted_at timestamptz,
    CONSTRAINT fk_comment_campaign FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE,
    CONSTRAINT fk_comment_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL,
    CONSTRAINT fk_comment_parent FOREIGN KEY (parent_comment_id) REFERENCES public.campaign_comments(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_campaign_comments_campaign ON public.campaign_comments(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_comments_parent ON public.campaign_comments(parent_comment_id);
CREATE INDEX IF NOT EXISTS idx_campaign_comments_created ON public.campaign_comments(created_at DESC);

COMMENT ON TABLE public.campaign_comments IS 'Comentarios y mensajes de apoyo en campañas';
COMMENT ON COLUMN public.campaign_comments.is_from_creator IS 'True si el comentario es del creador de la campaña';
COMMENT ON COLUMN public.campaign_comments.is_anonymous IS 'True si el donante quiere comentar anónimamente';
COMMENT ON COLUMN public.campaign_comments.donor_name IS 'Nombre para mostrar si es anónimo o no tiene cuenta';

-- ============================================
-- 2. REACCIONES/HEARTS
-- ============================================

CREATE TABLE IF NOT EXISTS public.campaign_reactions (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id uuid NOT NULL,
    user_id uuid,
    ip_address inet,
    created_at timestamptz DEFAULT now(),
    CONSTRAINT unique_user_reaction UNIQUE(campaign_id, user_id),
    CONSTRAINT fk_reaction_campaign FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE,
    CONSTRAINT fk_reaction_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_reactions_campaign ON public.campaign_reactions(campaign_id);
CREATE INDEX IF NOT EXISTS idx_reactions_user ON public.campaign_reactions(user_id);

COMMENT ON TABLE public.campaign_reactions IS 'Hearts/reacciones de apoyo a campañas sin donar';

-- ============================================
-- 3. SEGUIMIENTO DE CAMPAÑAS
-- ============================================

CREATE TABLE IF NOT EXISTS public.campaign_followers (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id uuid NOT NULL,
    user_id uuid NOT NULL,
    notify_updates boolean DEFAULT true,
    notify_milestones boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    CONSTRAINT unique_follower UNIQUE(campaign_id, user_id),
    CONSTRAINT fk_follower_campaign FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE,
    CONSTRAINT fk_follower_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_followers_campaign ON public.campaign_followers(campaign_id);
CREATE INDEX IF NOT EXISTS idx_followers_user ON public.campaign_followers(user_id);

COMMENT ON TABLE public.campaign_followers IS 'Usuarios que siguen campañas para recibir notificaciones';

-- ============================================
-- 4. SISTEMA DE NOTIFICACIONES
-- ============================================

DO $$ BEGIN
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
        'new_follower',
        'new_reaction'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS public.notifications (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid NOT NULL,
    type notification_type NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    link text,
    read boolean DEFAULT false,
    data jsonb,
    created_at timestamptz DEFAULT now(),
    read_at timestamptz,
    CONSTRAINT fk_notification_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON public.notifications(user_id, read) WHERE read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_created ON public.notifications(created_at DESC);

COMMENT ON TABLE public.notifications IS 'Sistema de notificaciones para usuarios';
COMMENT ON COLUMN public.notifications.data IS 'Datos adicionales en formato JSON (campaign_id, donation_id, etc)';

-- ============================================
-- 5. REPORTES/DENUNCIAS
-- ============================================

DO $$ BEGIN
    CREATE TYPE report_status AS ENUM ('pending', 'reviewing', 'resolved', 'dismissed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE report_category AS ENUM (
        'fraud',
        'inappropriate_content',
        'spam',
        'misleading_information',
        'copyright',
        'other'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS public.campaign_reports (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id uuid NOT NULL,
    reporter_id uuid,
    category report_category NOT NULL,
    description text NOT NULL,
    status report_status DEFAULT 'pending',
    admin_notes text,
    reviewed_by uuid,
    created_at timestamptz DEFAULT now(),
    reviewed_at timestamptz,
    CONSTRAINT fk_report_campaign FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE,
    CONSTRAINT fk_report_reporter FOREIGN KEY (reporter_id) REFERENCES public.users(id) ON DELETE SET NULL,
    CONSTRAINT fk_report_reviewer FOREIGN KEY (reviewed_by) REFERENCES public.users(id)
);

CREATE INDEX IF NOT EXISTS idx_reports_campaign ON public.campaign_reports(campaign_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON public.campaign_reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_created ON public.campaign_reports(created_at DESC);

COMMENT ON TABLE public.campaign_reports IS 'Reportes y denuncias de campañas sospechosas';

-- ============================================
-- 6. COMPARTIR EN REDES SOCIALES (TRACKING)
-- ============================================

CREATE TABLE IF NOT EXISTS public.campaign_shares (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id uuid NOT NULL,
    user_id uuid,
    platform text NOT NULL, -- 'facebook', 'twitter', 'whatsapp', 'telegram', 'email', 'link'
    ip_address inet,
    created_at timestamptz DEFAULT now(),
    CONSTRAINT fk_share_campaign FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE,
    CONSTRAINT fk_share_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_shares_campaign ON public.campaign_shares(campaign_id);
CREATE INDEX IF NOT EXISTS idx_shares_platform ON public.campaign_shares(platform);
CREATE INDEX IF NOT EXISTS idx_shares_created ON public.campaign_shares(created_at DESC);

COMMENT ON TABLE public.campaign_shares IS 'Tracking de compartidos en redes sociales';

-- ============================================
-- 7. MEJORAS A TABLAS EXISTENTES
-- ============================================

-- Campos adicionales para campaigns
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS view_count integer DEFAULT 0;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS share_count integer DEFAULT 0;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS comment_count integer DEFAULT 0;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS reaction_count integer DEFAULT 0;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS follower_count integer DEFAULT 0;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS donor_count integer DEFAULT 0;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS last_donation_at timestamptz;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS is_verified boolean DEFAULT false;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS video_url text;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS beneficiary_name text;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS beneficiary_relationship text;

COMMENT ON COLUMN public.campaigns.view_count IS 'Número de visualizaciones de la campaña';
COMMENT ON COLUMN public.campaigns.share_count IS 'Número de veces compartida';
COMMENT ON COLUMN public.campaigns.comment_count IS 'Número de comentarios';
COMMENT ON COLUMN public.campaigns.reaction_count IS 'Número de reacciones/hearts';
COMMENT ON COLUMN public.campaigns.follower_count IS 'Número de seguidores';
COMMENT ON COLUMN public.campaigns.donor_count IS 'Número de donantes únicos';
COMMENT ON COLUMN public.campaigns.is_verified IS 'Campaña verificada por administradores';
COMMENT ON COLUMN public.campaigns.beneficiary_name IS 'Nombre del beneficiario si es diferente al creador';
COMMENT ON COLUMN public.campaigns.beneficiary_relationship IS 'Relación del creador con el beneficiario';

-- Campos adicionales para donations
ALTER TABLE public.donations ADD COLUMN IF NOT EXISTS message text;
ALTER TABLE public.donations ADD COLUMN IF NOT EXISTS tip_amount_usd numeric DEFAULT 0;

COMMENT ON COLUMN public.donations.message IS 'Mensaje opcional del donante con la donación';
COMMENT ON COLUMN public.donations.tip_amount_usd IS 'Propina adicional para la plataforma';

-- Campos adicionales para users
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email_verified boolean DEFAULT false;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS phone_verified boolean DEFAULT false;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS notification_preferences jsonb DEFAULT '{"email": true, "push": true, "sms": false}'::jsonb;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_banned boolean DEFAULT false;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS ban_reason text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_login_at timestamptz;

COMMENT ON COLUMN public.users.notification_preferences IS 'Preferencias de notificaciones del usuario';
COMMENT ON COLUMN public.users.is_banned IS 'Usuario baneado de la plataforma';

-- ============================================
-- 8. ROW LEVEL SECURITY (RLS)
-- ============================================

-- Habilitar RLS en las nuevas tablas
ALTER TABLE public.campaign_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_followers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_shares ENABLE ROW LEVEL SECURITY;

-- Políticas para campaign_comments
CREATE POLICY "Comments are viewable by everyone" 
    ON public.campaign_comments FOR SELECT 
    USING (deleted_at IS NULL);

CREATE POLICY "Users can create comments" 
    ON public.campaign_comments FOR INSERT 
    WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can update own comments" 
    ON public.campaign_comments FOR UPDATE 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own comments" 
    ON public.campaign_comments FOR DELETE 
    USING (auth.uid() = user_id);

-- Políticas para campaign_reactions
CREATE POLICY "Reactions are viewable by everyone" 
    ON public.campaign_reactions FOR SELECT 
    USING (true);

CREATE POLICY "Users can add reactions" 
    ON public.campaign_reactions FOR INSERT 
    WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can remove own reactions" 
    ON public.campaign_reactions FOR DELETE 
    USING (auth.uid() = user_id OR user_id IS NULL);

-- Políticas para campaign_followers
CREATE POLICY "Users can view own follows" 
    ON public.campaign_followers FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can follow campaigns" 
    ON public.campaign_followers FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unfollow campaigns" 
    ON public.campaign_followers FOR DELETE 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update follow preferences" 
    ON public.campaign_followers FOR UPDATE 
    USING (auth.uid() = user_id);

-- Políticas para notifications
CREATE POLICY "Users can view own notifications" 
    ON public.notifications FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications" 
    ON public.notifications FOR UPDATE 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own notifications" 
    ON public.notifications FOR DELETE 
    USING (auth.uid() = user_id);

-- Políticas para campaign_reports
CREATE POLICY "Users can view own reports" 
    ON public.campaign_reports FOR SELECT 
    USING (auth.uid() = reporter_id OR 
           EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Users can create reports" 
    ON public.campaign_reports FOR INSERT 
    WITH CHECK (auth.uid() = reporter_id OR reporter_id IS NULL);

-- Políticas para campaign_shares
CREATE POLICY "Shares are viewable by everyone" 
    ON public.campaign_shares FOR SELECT 
    USING (true);

CREATE POLICY "Anyone can track shares" 
    ON public.campaign_shares FOR INSERT 
    WITH CHECK (true);

-- ============================================
-- 9. FUNCIONES Y TRIGGERS
-- ============================================

-- Función para actualizar contador de comentarios
CREATE OR REPLACE FUNCTION update_campaign_comment_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE campaigns 
        SET comment_count = comment_count + 1 
        WHERE id = NEW.campaign_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE campaigns 
        SET comment_count = GREATEST(comment_count - 1, 0)
        WHERE id = OLD.campaign_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_comment_count
AFTER INSERT OR DELETE ON campaign_comments
FOR EACH ROW EXECUTE FUNCTION update_campaign_comment_count();

-- Función para actualizar contador de reacciones
CREATE OR REPLACE FUNCTION update_campaign_reaction_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE campaigns 
        SET reaction_count = reaction_count + 1 
        WHERE id = NEW.campaign_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE campaigns 
        SET reaction_count = GREATEST(reaction_count - 1, 0)
        WHERE id = OLD.campaign_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_reaction_count
AFTER INSERT OR DELETE ON campaign_reactions
FOR EACH ROW EXECUTE FUNCTION update_campaign_reaction_count();

-- Función para actualizar contador de seguidores
CREATE OR REPLACE FUNCTION update_campaign_follower_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE campaigns 
        SET follower_count = follower_count + 1 
        WHERE id = NEW.campaign_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE campaigns 
        SET follower_count = GREATEST(follower_count - 1, 0)
        WHERE id = OLD.campaign_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_follower_count
AFTER INSERT OR DELETE ON campaign_followers
FOR EACH ROW EXECUTE FUNCTION update_campaign_follower_count();

-- Función para actualizar contador de compartidos
CREATE OR REPLACE FUNCTION update_campaign_share_count()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE campaigns 
    SET share_count = share_count + 1 
    WHERE id = NEW.campaign_id;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_share_count
AFTER INSERT ON campaign_shares
FOR EACH ROW EXECUTE FUNCTION update_campaign_share_count();

-- Función para crear notificación cuando hay un nuevo comentario
CREATE OR REPLACE FUNCTION notify_comment()
RETURNS TRIGGER AS $$
BEGIN
    -- Notificar al creador de la campaña
    INSERT INTO notifications (user_id, type, title, message, link, data)
    SELECT 
        c.creator_id,
        'comment_received',
        'Nuevo comentario en tu campaña',
        CASE 
            WHEN NEW.is_anonymous THEN 'Alguien comentó en tu campaña'
            ELSE u.full_name || ' comentó en tu campaña'
        END,
        '/campaigns/' || c.slug,
        jsonb_build_object('campaign_id', c.id, 'comment_id', NEW.id)
    FROM campaigns c
    LEFT JOIN users u ON u.id = NEW.user_id
    WHERE c.id = NEW.campaign_id 
        AND c.creator_id != COALESCE(NEW.user_id, '00000000-0000-0000-0000-000000000000'::uuid);
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_notify_comment
AFTER INSERT ON campaign_comments
FOR EACH ROW EXECUTE FUNCTION notify_comment();

-- Función para crear notificación cuando hay una nueva reacción
CREATE OR REPLACE FUNCTION notify_reaction()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO notifications (user_id, type, title, message, link, data)
    SELECT 
        c.creator_id,
        'new_reaction',
        'Nueva reacción en tu campaña',
        u.full_name || ' reaccionó a tu campaña',
        '/campaigns/' || c.slug,
        jsonb_build_object('campaign_id', c.id, 'reaction_id', NEW.id)
    FROM campaigns c
    LEFT JOIN users u ON u.id = NEW.user_id
    WHERE c.id = NEW.campaign_id 
        AND c.creator_id != COALESCE(NEW.user_id, '00000000-0000-0000-0000-000000000000'::uuid);
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_notify_reaction
AFTER INSERT ON campaign_reactions
FOR EACH ROW EXECUTE FUNCTION notify_reaction();

-- Función para crear notificación cuando alguien sigue una campaña
CREATE OR REPLACE FUNCTION notify_follower()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO notifications (user_id, type, title, message, link, data)
    SELECT 
        c.creator_id,
        'new_follower',
        'Nuevo seguidor en tu campaña',
        u.full_name || ' está siguiendo tu campaña',
        '/campaigns/' || c.slug,
        jsonb_build_object('campaign_id', c.id, 'follower_id', NEW.user_id)
    FROM campaigns c
    LEFT JOIN users u ON u.id = NEW.user_id
    WHERE c.id = NEW.campaign_id 
        AND c.creator_id != NEW.user_id;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_notify_follower
AFTER INSERT ON campaign_followers
FOR EACH ROW EXECUTE FUNCTION notify_follower();

-- ============================================
-- 10. VISTAS ÚTILES
-- ============================================

-- Vista de campañas con estadísticas completas
CREATE OR REPLACE VIEW campaigns_with_stats AS
SELECT 
    c.*,
    COUNT(DISTINCT d.id) as total_donations,
    COUNT(DISTINCT d.donor_id) as unique_donors,
    COUNT(DISTINCT cc.id) as total_comments,
    COUNT(DISTINCT cr.id) as total_reactions,
    COUNT(DISTINCT cf.id) as total_followers,
    COUNT(DISTINCT cs.id) as total_shares
FROM campaigns c
LEFT JOIN donations d ON d.campaign_id = c.id AND d.payment_status = 'completed'
LEFT JOIN campaign_comments cc ON cc.campaign_id = c.id AND cc.deleted_at IS NULL
LEFT JOIN campaign_reactions cr ON cr.campaign_id = c.id
LEFT JOIN campaign_followers cf ON cf.campaign_id = c.id
LEFT JOIN campaign_shares cs ON cs.campaign_id = c.id
GROUP BY c.id;

COMMENT ON VIEW campaigns_with_stats IS 'Vista de campañas con todas las estadísticas agregadas';

-- ============================================
-- FIN DEL SCRIPT
-- ============================================

-- Mensaje de confirmación
DO $$
BEGIN
    RAISE NOTICE 'FASE 1 - Funcionalidades críticas instaladas correctamente';
    RAISE NOTICE 'Tablas creadas: campaign_comments, campaign_reactions, campaign_followers, notifications, campaign_reports, campaign_shares';
    RAISE NOTICE 'Funciones y triggers configurados';
    RAISE NOTICE 'RLS habilitado en todas las tablas nuevas';
END $$;
