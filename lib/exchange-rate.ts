import { createAdminClient } from "@/lib/supabase/admin";

const STATIC_FALLBACK_RATE = 43.02;
// La tasa oficial BCV se usa tal cual, sin margen.
const DEFAULT_MARGIN_PERCENTAGE = 0;

/**
 * Obtiene la tasa oficial BCV (Bs/USD). Intenta dos APIs públicas que
 * publican el valor oficial del Banco Central de Venezuela:
 *   1. ve.dolarapi.com  -> { promedio: 582.69, ... }
 *   2. pydolarve.org    -> { monitors: { bcv: { price: 582.69 } } } (v2)
 * Devuelve null si ambas fallan (el caller decide el fallback).
 */
export async function fetchBcvRate(): Promise<number | null> {
    // Fuente 1: dolarapi (oficial BCV)
    try {
        const response = await fetch("https://ve.dolarapi.com/v1/dolares/oficial", {
            cache: "no-store",
            signal: AbortSignal.timeout(8000),
        });
        if (response.ok) {
            const data = await response.json();
            const rate = Number(data?.promedio ?? data?.precio);
            if (Number.isFinite(rate) && rate > 0) {
                return Number(rate.toFixed(4));
            }
        }
    } catch (error) {
        console.error("[exchange-rate] dolarapi BCV fetch failed:", error);
    }

    // Fuente 2: pydolarve (oficial BCV)
    try {
        const response = await fetch("https://pydolarve.org/api/v2/dollar?monitor=bcv", {
            cache: "no-store",
            signal: AbortSignal.timeout(8000),
        });
        if (response.ok) {
            const data = await response.json();
            const rate = Number(data?.price ?? data?.monitors?.bcv?.price);
            if (Number.isFinite(rate) && rate > 0) {
                return Number(rate.toFixed(4));
            }
        }
    } catch (error) {
        console.error("[exchange-rate] pydolarve BCV fetch failed:", error);
    }

    return null;
}

/**
 * Llama a Binance P2P (USDT/VES) y devuelve la tasa cruda promedio de las
 * primeras 10 ofertas de compra. Devuelve null si Binance falla.
 */
export async function fetchBinanceP2PRate(): Promise<number | null> {
    try {
        const response = await fetch(
            "https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search",
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    fiat: "VES",
                    page: 1,
                    rows: 10,
                    tradeType: "BUY",
                    asset: "USDT",
                    countries: [],
                    proMerchantAds: false,
                    shieldMerchantAds: false,
                    filterType: "all",
                    periods: [],
                    additionalKycVerifyFilter: 0,
                    publisherType: null,
                    payTypes: [],
                    classifies: ["mass", "profession", "fiat_trade"],
                }),
                // Sin caché: queremos siempre el dato fresco.
                cache: "no-store",
            },
        );

        if (!response.ok) {
            throw new Error(`Binance API HTTP ${response.status}`);
        }

        const data = await response.json();
        const offers = data?.data;
        if (!Array.isArray(offers) || offers.length === 0) return null;

        const rates = offers
            .map((offer: any) => parseFloat(offer?.adv?.price))
            .filter((price: number) => Number.isFinite(price) && price > 0);

        if (rates.length === 0) return null;

        const average = rates.reduce((a: number, b: number) => a + b, 0) / rates.length;
        return Number(average.toFixed(4));
    } catch (error) {
        console.error("[exchange-rate] Binance P2P fetch failed:", error);
        return null;
    }
}

/**
 * Refresca la tasa: usa la tasa OFICIAL BCV (sin margen). Solo si las dos
 * fuentes BCV fallan, cae a Binance P2P como último recurso (marcado en
 * `source` para poder auditarlo). Guarda con `create_new_exchange_rate`.
 */
export async function refreshExchangeRate(
    margin: number = DEFAULT_MARGIN_PERCENTAGE,
): Promise<{ rawRate: number; finalRate: number; rateId: string } | null> {
    let rawRate = await fetchBcvRate();
    let source = "bcv";

    if (!rawRate) {
        console.warn("[exchange-rate] BCV sources failed, falling back to Binance P2P");
        rawRate = await fetchBinanceP2PRate();
        source = "binance_p2p_fallback";
    }

    if (!rawRate) return null;

    const finalRate = Number((rawRate * (1 + margin / 100)).toFixed(4));

    try {
        const supabase = createAdminClient();
        const { data, error } = await supabase.rpc("create_new_exchange_rate", {
            p_raw_rate: rawRate,
            p_margin: margin,
            p_source: source,
            p_metadata: {
                timestamp: new Date().toISOString(),
                api_source: source,
                margin_applied: margin,
            },
        });

        if (error) {
            console.error("[exchange-rate] create_new_exchange_rate RPC failed:", error);
            return null;
        }

        return { rawRate, finalRate, rateId: data as string };
    } catch (error) {
        console.error("[exchange-rate] refresh failed:", error);
        return null;
    }
}

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
