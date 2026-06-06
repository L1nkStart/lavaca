import { createAdminClient } from "@/lib/supabase/admin";

const STATIC_FALLBACK_RATE = 43.02;

/**
 * Returns the current Bs/USD rate to use for backend conversions
 * (donations, withdrawals, etc).
 *
 * Resolution order:
 *   1. The active rate stored in `exchange_rates` (latest non-expired).
 *   2. The most recent rate even if expired.
 *   3. `admin_config.bcv_exchange_rate`.
 *   4. A safe static fallback so payments never break.
 */
export async function getActiveExchangeRate(): Promise<number> {
    try {
        const supabase = createAdminClient();

        const { data: activeRate } = await supabase.rpc("get_active_exchange_rate");
        const activeRateNumber = Number(activeRate);
        if (Number.isFinite(activeRateNumber) && activeRateNumber > 0) {
            return activeRateNumber;
        }

        const { data: latestRate } = await supabase
            .from("exchange_rates")
            .select("rate")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

        const latestRateNumber = Number(latestRate?.rate);
        if (Number.isFinite(latestRateNumber) && latestRateNumber > 0) {
            return latestRateNumber;
        }

        const { data: config } = await supabase
            .from("admin_config")
            .select("bcv_exchange_rate")
            .limit(1)
            .maybeSingle();

        const configRateNumber = Number(config?.bcv_exchange_rate);
        if (Number.isFinite(configRateNumber) && configRateNumber > 0) {
            return configRateNumber;
        }
    } catch (error) {
        console.error("[exchange-rate] Failed to resolve rate:", error);
    }

    return STATIC_FALLBACK_RATE;
}

/**
 * Convenience helper: convert a USD amount to bolivares using the live rate.
 */
export async function convertUsdToBs(amountUsd: number): Promise<number> {
    const rate = await getActiveExchangeRate();
    return Number((amountUsd * rate).toFixed(2));
}
