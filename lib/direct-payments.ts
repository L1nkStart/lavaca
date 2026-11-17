// Utilidades compartidas del flujo de pagos directos (modo crisis): el donante
// paga directo a la cuenta del organizador y el organizador confirma. LaVaca
// no confirma estos pagos; solo los audita y media en caso de conflicto.

import { formatBs, formatUsd } from '@/lib/format'
import { normalizeVePhone } from '@/lib/venezuela'

/** Bucket privado donde viven los comprobantes de pago. */
export const CAPTURE_BUCKET = 'payment-captures'

/** Horas sin respuesta del organizador a partir de las que LaVaca hace seguimiento. */
export const DIRECT_PAYMENT_STALE_HOURS = 72

/** Tope de cordura para un pago directo registrado (equivalente en USD). */
export const DIRECT_PAYMENT_MAX_USD = 100_000

type MoneyLike = {
    currency?: string | null
    amount_bs?: number | string | null
    amount_usd?: number | string | null
}

/** Monto en la moneda en que se pagó: `Bs 1.234,50` o `$12.00`. */
export const directDonationMoneyLabel = (d: MoneyLike) =>
    d.currency === 'BS' && d.amount_bs != null ? formatBs(Number(d.amount_bs)) : formatUsd(Number(d.amount_usd))

/**
 * Referencia normalizada para detectar duplicados: sin espacios, guiones ni
 * ceros a la izquierda y en mayúsculas ("00-1234 56" ≡ "123456").
 */
export const normalizeReference = (ref: string | null | undefined) =>
    String(ref || '')
        .toUpperCase()
        .replace(/[\s\-_.#]/g, '')
        .replace(/^0+(?=.)/, '')

/**
 * Solo aceptamos comprobantes subidos a NUESTRO storage (vía
 * /api/donations/capture-upload). Evita que se registre un enlace arbitrario
 * (phishing) que luego abriría el organizador o el admin.
 */
export function isTrustedCaptureUrl(url: string | null | undefined): boolean {
    if (!url) return false
    const base = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '')
    if (!base) return false
    return url.startsWith(`${base}/storage/v1/object/`) && url.includes(`/${CAPTURE_BUCKET}/`)
}

/**
 * Enlace de WhatsApp para contactar a una parte (mediación). Acepta números
 * venezolanos en cualquier formato ("0412-1234567", "+58 412…") o
 * internacionales con "+". Devuelve null si no parece un teléfono.
 */
export function whatsappLink(phone: string | null | undefined, text?: string): string | null {
    if (!phone) return null
    const raw = phone.trim()
    const ve = normalizeVePhone(raw)
    let intl: string | null = null
    if (/^04\d{9}$/.test(ve)) intl = `58${ve.slice(1)}`
    else if (raw.startsWith('+')) {
        const digits = raw.replace(/\D/g, '')
        if (digits.length >= 10 && digits.length <= 15) intl = digits
    }
    if (!intl) return null
    return `https://wa.me/${intl}${text ? `?text=${encodeURIComponent(text)}` : ''}`
}

/**
 * Extrae la ruta del objeto desde una URL firmada/pública de Supabase Storage
 * para poder volver a firmarla (las firmadas vencen al año).
 */
export function captureObjectPath(url: string | null | undefined): string | null {
    if (!url) return null
    const marker = `/${CAPTURE_BUCKET}/`
    const idx = url.indexOf(marker)
    if (idx === -1) return null
    const rest = url.slice(idx + marker.length).split('?')[0]
    try {
        return decodeURIComponent(rest) || null
    } catch {
        return rest || null
    }
}
