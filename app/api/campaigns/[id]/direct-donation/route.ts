import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActiveExchangeRate } from '@/lib/exchange-rate'
import { sanitizeRefCode } from '@/lib/lavaca-campaign'
import {
    DIRECT_PAYMENT_MAX_USD,
    directDonationMoneyLabel,
    isTrustedCaptureUrl,
    normalizeReference,
} from '@/lib/direct-payments'

/**
 * POST /api/campaigns/[id]/direct-donation
 * El donante REGISTRA un pago que hizo directo a la cuenta del creador
 * (modo crisis). Queda pendiente hasta que el creador lo confirme. No genera
 * saldo retirable ni comisión: solo sube la barra cuando se confirma.
 *
 * Al registrarse se notifica al organizador (campana in-app) para que
 * confirme. El personal de LaVaca NO confirma estos pagos: los ve en
 * /admin/direct-payments solo para auditar y mediar.
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const supabase = await createClient()
        const { id } = await params
        const body = await request.json().catch(() => null)

        const amount = Number(body?.amount)
        const currency = body?.currency === 'BS' ? 'BS' : 'USD'
        const accountId = String(body?.accountId || '')
        const reference = typeof body?.reference === 'string' ? body.reference.trim().replace(/\s+/g, ' ') : ''
        // Solo comprobantes subidos a nuestro storage (no enlaces arbitrarios).
        const captureUrl = typeof body?.captureUrl === 'string' && isTrustedCaptureUrl(body.captureUrl) ? body.captureUrl : null
        const isAnonymous = body?.isAnonymous === true
        const rawEmail = typeof body?.donorEmail === 'string' ? body.donorEmail.trim().toLowerCase() : ''
        const rawName = typeof body?.donorName === 'string' ? body.donorName.trim().replace(/\s+/g, ' ').slice(0, 120) : ''
        // ?ref= del enlace por el que llegó el donante (solo medición).
        const referralCode = sanitizeRefCode(typeof body?.referralCode === 'string' ? body.referralCode : null)

        if (!Number.isFinite(amount) || amount <= 0) {
            return NextResponse.json({ error: 'Ingresa un monto válido' }, { status: 400 })
        }
        if (!accountId) {
            return NextResponse.json({ error: 'Selecciona la cuenta a la que pagaste' }, { status: 400 })
        }
        if (!reference) {
            return NextResponse.json({ error: 'La referencia del pago es obligatoria' }, { status: 400 })
        }
        if (reference.length > 100 || !normalizeReference(reference)) {
            return NextResponse.json({ error: 'Revisa la referencia: copia solo el número que aparece en tu comprobante' }, { status: 400 })
        }

        const { data: { user } } = await supabase.auth.getUser()
        const finalEmail = user?.email?.trim().toLowerCase() || rawEmail
        if (!finalEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(finalEmail)) {
            return NextResponse.json({ error: 'El correo del donante es obligatorio y debe ser válido' }, { status: 400 })
        }

        const adminSupabase = createAdminClient()

        // Modo crisis global + campaña crisis + activa + cuenta válida.
        const [{ data: cfg }, { data: campaign }, { data: account }] = await Promise.all([
            adminSupabase.from('admin_config').select('crisis_mode_enabled').limit(1).maybeSingle(),
            adminSupabase.from('campaigns').select('id, status, campaign_type, creator_id, title').eq('id', id).maybeSingle(),
            adminSupabase.from('campaign_crisis_accounts').select('id, account_type, campaign_id, is_active').eq('id', accountId).maybeSingle(),
        ])

        if (!cfg?.crisis_mode_enabled) {
            return NextResponse.json({ error: 'El modo crisis no está habilitado' }, { status: 403 })
        }
        if (!campaign || campaign.campaign_type !== 'crisis') {
            return NextResponse.json({ error: 'Esta campaña no acepta pagos directos' }, { status: 400 })
        }
        if (campaign.status !== 'active') {
            return NextResponse.json({ error: 'La campaña no está activa' }, { status: 400 })
        }
        if (!account || account.campaign_id !== id || !account.is_active) {
            return NextResponse.json({ error: 'La cuenta seleccionada no es válida' }, { status: 400 })
        }

        const rate = await getActiveExchangeRate()
        if (!Number.isFinite(rate) || rate <= 0) {
            return NextResponse.json({ error: 'No pudimos obtener la tasa de cambio. Intenta de nuevo en unos minutos.' }, { status: 503 })
        }
        let amountUsd: number
        let amountBs: number
        if (currency === 'BS') {
            amountBs = Math.round(amount * 100) / 100
            amountUsd = Number((amountBs / rate).toFixed(2))
        } else {
            amountUsd = Math.round(amount * 100) / 100
            amountBs = Number((amountUsd * rate).toFixed(2))
        }
        if (amountUsd < 0.01) {
            return NextResponse.json({ error: 'El monto es demasiado pequeño' }, { status: 400 })
        }
        if (amountUsd > DIRECT_PAYMENT_MAX_USD) {
            return NextResponse.json({ error: 'Revisa el monto: parece demasiado alto para un solo pago' }, { status: 400 })
        }

        // Anti-duplicado: la misma referencia ya registrada en esta campaña (y
        // no rechazada) es casi siempre un doble envío. La comparación ignora
        // espacios, guiones y ceros a la izquierda.
        const normalizedRef = normalizeReference(reference)
        const { data: sameCampaignRefs } = await adminSupabase
            .from('donations')
            .select('id, reference_number, payment_status')
            .eq('campaign_id', id)
            .eq('is_direct', true)
            .neq('payment_status', 'failed')
            .limit(1000)
        const duplicate = (sameCampaignRefs || []).find((d) => normalizeReference(d.reference_number) === normalizedRef)
        if (duplicate) {
            return NextResponse.json(
                {
                    error: duplicate.payment_status === 'completed'
                        ? 'Este pago ya fue registrado y el organizador ya lo confirmó. ¡Gracias!'
                        : 'Este pago ya fue registrado y está esperando la confirmación del organizador.',
                    duplicate: true,
                },
                { status: 409 }
            )
        }

        const { data: donation, error } = await adminSupabase
            .from('donations')
            .insert({
                campaign_id: id,
                donor_id: user?.id || null,
                email: finalEmail,
                amount_usd: amountUsd,
                amount_bs: amountBs,
                payment_method: account.account_type, // pagomovil|zelle|transfer|crypto
                payment_status: 'pending',
                is_anonymous: isAnonymous,
                donor_name: rawName || null,
                reference_number: reference,
                capture_url: captureUrl,
                currency,
                net_amount_usd: amountUsd,
                net_amount_bs: currency === 'BS' ? amountBs : null,
                gateway_fee_usd: 0,
                fee_covered_by_donor: false,
                is_direct: true,
                crisis_account_id: accountId,
                referral_code: referralCode,
                admin_notes: 'Pago directo (modo crisis) — pendiente de confirmación del organizador',
            })
            .select('id')
            .single()

        if (error) throw error

        // Notificar al organizador que tiene un pago directo POR CONFIRMAR
        // (en modo crisis el creador es quien aprueba). Best-effort: supabase-js
        // no lanza excepción, devuelve { error }, así que hay que revisarlo.
        try {
            const amountLabel = directDonationMoneyLabel({ currency, amount_bs: amountBs, amount_usd: amountUsd })
            const donorLabel = isAnonymous ? 'Alguien' : (rawName || 'Un donante')
            const { error: notifyError } = await adminSupabase.from('notifications').insert({
                user_id: campaign.creator_id,
                type: 'donation_received',
                title: 'Tienes un pago por confirmar',
                message: `${donorLabel} registró un pago de ${amountLabel} (ref. ${reference}) en "${campaign.title}". Revisa tu cuenta y confírmalo para que sume a tu campaña.`,
                link: `/creator/campaigns/${id}/crisis`,
                campaign_id: id,
                related_id: donation.id,
            })
            if (notifyError) {
                console.warn('[direct-donation] no se pudo crear la notificación:', notifyError.message)
            }
        } catch (notifyError) {
            console.warn('[direct-donation] no se pudo crear la notificación:', notifyError)
        }

        return NextResponse.json({ ok: true, donationId: donation.id })
    } catch (error: any) {
        console.error('[direct-donation] error:', error)
        return NextResponse.json({ error: error?.message || 'No se pudo registrar el pago' }, { status: 500 })
    }
}
