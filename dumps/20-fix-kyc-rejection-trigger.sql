-- ============================================
-- Fix KYC rejection trigger campaign status
-- ============================================
-- Root cause:
-- handle_verification_rejection() attempted to set campaigns.status = 'suspended',
-- but campaign_status enum does not include that value.

CREATE OR REPLACE FUNCTION handle_verification_rejection()
RETURNS TRIGGER AS $$
DECLARE
    user_total_funds NUMERIC;
BEGIN
    IF NEW.status = 'rejected' AND OLD.status != 'rejected' THEN
        user_total_funds := get_user_total_funds(NEW.user_id);

        UPDATE campaigns
        SET status = 'rejected'
        WHERE creator_id = NEW.user_id
        AND status = 'active';

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

        RAISE NOTICE 'Usuario % rechazado por KYC y campañas activas marcadas como rejected', NEW.user_id;
    END IF;

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
