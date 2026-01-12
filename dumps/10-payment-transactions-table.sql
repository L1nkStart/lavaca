-- ============================================
-- PAYMENT TRANSACTIONS TABLE
-- ============================================
-- Tabla para tracking de transacciones de pago

CREATE TABLE IF NOT EXISTS payment_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    donation_id UUID NOT NULL REFERENCES donations(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    status TEXT NOT NULL,
    amount_usd NUMERIC NOT NULL,
    amount_bs NUMERIC,
    external_id TEXT,
    provider_data JSONB,
    error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_payment_transactions_donation_id ON payment_transactions(donation_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON payment_transactions(status);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_provider ON payment_transactions(provider);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_external_id ON payment_transactions(external_id);

-- RLS Policies
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;

-- Admins pueden ver todo
CREATE POLICY "Admins can view all payment transactions"
ON payment_transactions
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM users
        WHERE users.id = auth.uid()
        AND users.role = 'admin'
    )
);

-- Usuarios pueden ver sus propias transacciones
CREATE POLICY "Users can view own payment transactions"
ON payment_transactions
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM donations
        WHERE donations.id = payment_transactions.donation_id
        AND donations.donor_id = auth.uid()
    )
);

-- Función para actualizar monto de campaña (atómica)
CREATE OR REPLACE FUNCTION increment_campaign_amount(
    campaign_id UUID,
    amount_to_add NUMERIC
)
RETURNS VOID AS $$
BEGIN
    UPDATE campaigns 
    SET current_amount_usd = current_amount_usd + amount_to_add,
        updated_at = NOW()
    WHERE id = campaign_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_payment_transaction_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER payment_transactions_updated_at
BEFORE UPDATE ON payment_transactions
FOR EACH ROW
EXECUTE FUNCTION update_payment_transaction_updated_at();

-- Log
DO $$
BEGIN
    RAISE NOTICE 'Payment transactions table created successfully';
END $$;
