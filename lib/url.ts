import type { NextRequest } from "next/server";

/**
 * Resuelve la URL base canónica del despliegue. La orden de prioridad
 * está pensada para que la redirección al usuario nunca termine apuntando
 * a `http://localhost:3000` ni al hostname interno del contenedor.
 *
 *   1. `process.env.NEXT_PUBLIC_URL` — el valor que configurás en Coolify
 *      (ej: `https://lavaca.app`). Siempre fuente de verdad si está seteado.
 *   2. `x-forwarded-host` + `x-forwarded-proto` — los headers que un
 *      reverse proxy bien configurado (Traefik/Coolify) inyecta para que
 *      la app sepa cuál fue la URL pública original.
 *   3. El origin que arma Next.js a partir del `Host` header. Esto es lo
 *      que falla cuando el proxy no preserva el Host original.
 *
 * Devuelve siempre sin trailing slash. Usa `buildAbsoluteUrl(req, path)`
 * para concatenar paths correctamente.
 */
export function getCanonicalBaseUrl(request?: NextRequest | Request): string {
    const envUrl = (process.env.NEXT_PUBLIC_URL || "").trim();
    if (envUrl) {
        return envUrl.replace(/\/$/, "");
    }

    if (request) {
        const headers =
            "headers" in request && typeof (request as any).headers?.get === "function"
                ? ((request as any).headers as Headers)
                : null;

        if (headers) {
            const forwardedHost = headers.get("x-forwarded-host");
            const forwardedProto = headers.get("x-forwarded-proto");
            if (forwardedHost) {
                const proto = forwardedProto || "https";
                return `${proto}://${forwardedHost}`.replace(/\/$/, "");
            }
        }

        try {
            const url = new URL((request as any).url);
            return `${url.protocol}//${url.host}`;
        } catch {
            // ignore
        }
    }

    // Último recurso: nunca llegamos acá en server. Si pasa, asumimos local dev.
    return "http://localhost:3000";
}

/**
 * Concatena un path al base canónico. Acepta paths con o sin `/` inicial.
 */
export function buildAbsoluteUrl(
    request: NextRequest | Request | undefined,
    path: string,
): string {
    const base = getCanonicalBaseUrl(request);
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    return `${base}${normalizedPath}`;
}

/**
 * Helper para cliente (browser). En el browser, `window.location.origin`
 * suele ser correcto, pero si `NEXT_PUBLIC_URL` está seteado en build time
 * lo preferimos por consistencia con server-side. Devuelve sin trailing /.
 */
export function getClientBaseUrl(): string {
    const envUrl = (process.env.NEXT_PUBLIC_URL || "").trim();
    if (envUrl) return envUrl.replace(/\/$/, "");
    if (typeof window !== "undefined") {
        return window.location.origin;
    }
    return "";
}
