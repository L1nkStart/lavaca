-- ============================================
-- 35 - NOTIFICACIONES ADMIN POR TELEGRAM
-- ============================================
-- Avisa al grupo de Telegram (bot @Lavacaadm_bot) cada vez que:
--   1) Se registra un usuario nuevo
--   2) Llega una solicitud de KYC
--   3) Se crea/pasa a revision una campana (Campanas pendientes)
--
-- Implementado 100% en la BD con pg_net (HTTP async). No requiere servidor
-- intermedio: los triggers llaman directo a la API de Telegram.
--
-- SEGURIDAD: el token del bot NO se versiona aqui. Se guarda en la tabla
-- privada public.telegram_config, insertado por separado (fuera del repo):
--
--   INSERT INTO public.telegram_config (id, bot_token, chat_id, enabled)
--   VALUES (1, '<BOT_TOKEN>', '<CHAT_ID>', true)
--   ON CONFLICT (id) DO UPDATE SET bot_token = EXCLUDED.bot_token,
--     chat_id = EXCLUDED.chat_id, enabled = true, updated_at = now();
--
-- Para pausar los avisos: UPDATE public.telegram_config SET enabled = false;

CREATE EXTENSION IF NOT EXISTS pg_net;

-- Config privada del bot. RLS sin politicas: solo service_role / funciones
-- SECURITY DEFINER pueden leerla.
CREATE TABLE IF NOT EXISTS public.telegram_config (
  id integer PRIMARY KEY DEFAULT 1,
  bot_token text NOT NULL,
  chat_id text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT telegram_config_singleton CHECK (id = 1)
);
ALTER TABLE public.telegram_config ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.telegram_config FROM anon, authenticated;

-- Envia un mensaje al grupo (async, no bloquea la transaccion del trigger).
CREATE OR REPLACE FUNCTION public.send_telegram_message(p_text text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, net
AS $$
DECLARE
  v_token text;
  v_chat text;
  v_enabled boolean;
BEGIN
  SELECT bot_token, chat_id, enabled INTO v_token, v_chat, v_enabled
  FROM public.telegram_config WHERE id = 1;

  IF v_token IS NULL OR v_chat IS NULL OR COALESCE(v_enabled, false) = false THEN
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := 'https://api.telegram.org/bot' || v_token || '/sendMessage',
    body := jsonb_build_object(
      'chat_id', v_chat,
      'text', p_text,
      'disable_web_page_preview', true
    ),
    headers := jsonb_build_object('Content-Type', 'application/json')
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.send_telegram_message(text) FROM PUBLIC, anon, authenticated;

-- 1) Nuevo registro de usuario
CREATE OR REPLACE FUNCTION public.tg_notify_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, net
AS $$
BEGIN
  PERFORM public.send_telegram_message(
    '🆕 Nuevo registro' || E'\n' ||
    'Nombre: ' || COALESCE(NEW.full_name, '—') || E'\n' ||
    'Correo: ' || COALESCE(NEW.email, '—')
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tg_new_user ON public.users;
CREATE TRIGGER trg_tg_new_user
AFTER INSERT ON public.users
FOR EACH ROW EXECUTE FUNCTION public.tg_notify_new_user();

-- 2) Nueva solicitud de KYC
CREATE OR REPLACE FUNCTION public.tg_notify_new_kyc()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, net
AS $$
DECLARE
  v_name text;
BEGIN
  SELECT COALESCE(full_name, email) INTO v_name FROM public.users WHERE id = NEW.user_id;
  PERFORM public.send_telegram_message(
    '🪪 Nueva solicitud de KYC' || E'\n' ||
    'Usuario: ' || COALESCE(v_name, NEW.user_id::text) || E'\n' ||
    'Revisar: https://lavaca.com.ve/admin/verifications'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tg_new_kyc ON public.verification_requests;
CREATE TRIGGER trg_tg_new_kyc
AFTER INSERT ON public.verification_requests
FOR EACH ROW EXECUTE FUNCTION public.tg_notify_new_kyc();

-- 3) Nueva campana pendiente de revision
CREATE OR REPLACE FUNCTION public.tg_notify_campaign_pending()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, net
AS $$
BEGIN
  IF NEW.status = 'pending_review'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'pending_review') THEN
    PERFORM public.send_telegram_message(
      '📢 Nueva campaña pendiente' || E'\n' ||
      'Título: ' || COALESCE(NEW.title, '—') || E'\n' ||
      'Revisar: https://lavaca.com.ve/admin/campaigns'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tg_campaign_pending ON public.campaigns;
CREATE TRIGGER trg_tg_campaign_pending
AFTER INSERT OR UPDATE OF status ON public.campaigns
FOR EACH ROW EXECUTE FUNCTION public.tg_notify_campaign_pending();
