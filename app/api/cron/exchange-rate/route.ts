import { NextRequest, NextResponse } from "next/server";
import { refreshExchangeRate } from "@/lib/exchange-rate";

export const runtime = "nodejs";
// Importante: evitar caché para que el cron siempre traiga dato fresco.
export const dynamic = "force-dynamic";

/**
 * Endpoint para que un cron externo (Coolify Scheduled Task) refresque la
 * tasa de cambio. Protegido por `CRON_SECRET` para que no lo pueda invocar
 * un anónimo y consuma la API de Binance arbitrariamente.
 *
 * Uso típico desde Coolify (cada hora):
 *
 *   curl -sS -X POST \
 *     -H "Authorization: Bearer $CRON_SECRET" \
 *     https://lavaca.com.ve/api/cron/exchange-rate
 *
 * Acepta tanto POST como GET para facilitar el setup en cualquier scheduler.
 */
async function handle(request: NextRequest) {
    const expected = process.env.CRON_SECRET;
    if (!expected) {
        return NextResponse.json(
            { error: "CRON_SECRET no configurado en el servidor" },
            { status: 500 },
        );
    }

    const authHeader = request.headers.get("authorization") || "";
    const headerToken = authHeader.replace(/^Bearer\s+/i, "").trim();
    const queryToken = new URL(request.url).searchParams.get("secret");
    const provided = headerToken || queryToken || "";

    // Comparación timing-safe simple (en TS sin Buffer no nos preocupa demasiado;
    // CRON_SECRET no se asume crítico, sólo evita drive-by abuse).
    if (provided.length !== expected.length || provided !== expected) {
        return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const result = await refreshExchangeRate();
    if (!result) {
        return NextResponse.json(
            { success: false, error: "No se pudo obtener tasa de Binance" },
            { status: 502 },
        );
    }

    return NextResponse.json({
        success: true,
        rawRate: result.rawRate,
        finalRate: result.finalRate,
        rateId: result.rateId,
        timestamp: new Date().toISOString(),
    });
}

export const POST = handle;
export const GET = handle;
