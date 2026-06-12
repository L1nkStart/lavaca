-- ============================================
-- 31 - FEE DE PASARELA EN BOLIVARES
-- ============================================
-- Para donaciones BS, el fee se calcula nativo en Bs (lib/fees.ts). Esta
-- columna lo persiste para que el admin pueda ver exactamente cuanto pago
-- el donante cuando cubrio la comision:
--   total pagado = amount_bs + (fee_covered_by_donor ? gateway_fee_bs : 0)
--   la campana recibe = net_amount_bs

ALTER TABLE public.donations
  ADD COLUMN IF NOT EXISTS gateway_fee_bs numeric NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.donations.gateway_fee_bs IS 'Fee de pasarela en Bs (solo donaciones BS). Si fee_covered_by_donor, el donante pago amount_bs + gateway_fee_bs.';

-- Backfill:
--   * No cubierto: el fee ya esta implicito en la diferencia bruto - neto.
--   * Cubierto: se reconstruye con el % vigente del metodo.
UPDATE public.donations d
SET gateway_fee_bs = CASE
  WHEN d.fee_covered_by_donor = false AND d.net_amount_bs IS NOT NULL
    THEN GREATEST(ROUND(d.amount_bs - d.net_amount_bs, 2), 0)
  WHEN d.fee_covered_by_donor = true
    THEN ROUND(d.amount_bs * COALESCE(
      (SELECT (p.settings->>'donation_fee_percent')::numeric
       FROM public.payment_method_configs p
       WHERE p.code = d.payment_method::text), 0) / 100, 2)
  ELSE 0
END
WHERE d.currency = 'BS'
  AND d.amount_bs IS NOT NULL
  AND d.gateway_fee_bs = 0;
