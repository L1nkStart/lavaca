/**
 * Campaña propia de LaVaca. La plataforma no cobra comisión en modo crisis y
 * se sostiene con donaciones voluntarias a esta campaña, así que:
 *   - va fija de primera en el inicio y en el listado,
 *   - después de cualquier donación se invita (sin insistir) a apoyarla.
 *
 * El id se puede sobreescribir con NEXT_PUBLIC_LAVACA_CAMPAIGN_ID.
 */
export const LAVACA_SUPPORT_CAMPAIGN_ID =
    (process.env.NEXT_PUBLIC_LAVACA_CAMPAIGN_ID || '').trim() || '0f483058-a627-4ae0-ac91-8f431ffb4013'

export const isLavacaCampaign = (campaignId: string | null | undefined) =>
    !!campaignId && campaignId === LAVACA_SUPPORT_CAMPAIGN_ID

export const lavacaCampaignHref = `/campaigns/${LAVACA_SUPPORT_CAMPAIGN_ID}`
export const lavacaDonateHref = `/campaigns/${LAVACA_SUPPORT_CAMPAIGN_ID}/donate`

/* ------------------------------------------------------------------ */
/* Referidos: ?ref=<código> en los enlaces compartidos                 */
/* ------------------------------------------------------------------ */

const REF_STORAGE_PREFIX = 'lavaca:ref:'
const REF_TTL_MS = 7 * 24 * 60 * 60 * 1000
const REF_CODE_REGEX = /^[a-z0-9_-]{2,32}$/i

/** Código corto y no sensible para identificar quién compartió. */
export function buildRefCode(userId: string | null | undefined): string {
    if (!userId) return 'anon'
    return userId.replace(/-/g, '').slice(0, 8).toLowerCase()
}

export function appendRef(url: string, code: string): string {
    try {
        const u = new URL(url)
        u.searchParams.set('ref', code)
        return u.toString()
    } catch {
        return url
    }
}

export const sanitizeRefCode = (raw: string | null | undefined): string | null => {
    const v = (raw || '').trim()
    return REF_CODE_REGEX.test(v) ? v.toLowerCase() : null
}

/** Guarda el ref con el que llegó el visitante a esta campaña (7 días). Solo navegador. */
export function storeRef(campaignId: string, code: string) {
    try {
        localStorage.setItem(`${REF_STORAGE_PREFIX}${campaignId}`, JSON.stringify({ code, at: Date.now() }))
    } catch {
        // storage no disponible: el ref simplemente no se mide
    }
}

/** Lee el ref guardado para esta campaña si sigue vigente. Solo navegador. */
export function readStoredRef(campaignId: string): string | null {
    try {
        const raw = localStorage.getItem(`${REF_STORAGE_PREFIX}${campaignId}`)
        if (!raw) return null
        const parsed = JSON.parse(raw) as { code?: string; at?: number }
        if (!parsed?.code || !parsed.at || Date.now() - parsed.at > REF_TTL_MS) return null
        return sanitizeRefCode(parsed.code)
    } catch {
        return null
    }
}
