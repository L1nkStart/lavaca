import { NextRequest, NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
    CAPTURE_BUCKET,
    DIRECT_PAYMENT_STALE_HOURS,
    captureObjectPath,
    normalizeReference,
} from '@/lib/direct-payments'

/**
 * GET /api/admin/direct-payments
 *
 * Auditoría de pagos directos (modo crisis). El organizador es quien confirma
 * estos pagos; LaVaca solo los audita y media. Tres vistas:
 *
 *   ?view=campaigns                (default) resumen por campaña
 *   ?campaignId=<uuid>             detalle de una campaña: organizador, cuentas,
 *                                  pagos y bitácora de mediación
 *   ?view=list&status=…&stale=1    lista plana (300 más recientes)
 */

async function assertAdmin() {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return { ok: false as const, status: 401, error: 'No autorizado' }
    const { data: actor } = await supabase.from('users').select('role').eq('id', user.id).single()
    if (actor?.role !== 'admin') return { ok: false as const, status: 403, error: 'Permisos insuficientes' }
    return { ok: true as const, userId: user.id }
}

const STALE_MS = DIRECT_PAYMENT_STALE_HOURS * 60 * 60 * 1000
const round2 = (v: number) => Math.round(v * 100) / 100

type MinimalDirect = {
    id: string
    campaign_id: string
    amount_usd: number
    amount_bs: number | null
    currency: string | null
    payment_status: string
    reference_number: string | null
    created_at: string
    confirmed_at: string | null
}

/** Trae TODAS las donaciones directas (columnas mínimas), paginando de 1000 en 1000. */
async function fetchAllDirectMinimal(db: SupabaseClient): Promise<MinimalDirect[]> {
    const PAGE = 1000
    const rows: MinimalDirect[] = []
    for (let page = 0; page < 100; page++) {
        const { data, error } = await db
            .from('donations')
            .select('id, campaign_id, amount_usd, amount_bs, currency, payment_status, reference_number, created_at, confirmed_at')
            .eq('is_direct', true)
            .order('created_at', { ascending: false })
            .range(page * PAGE, page * PAGE + PAGE - 1)
        if (error) throw error
        rows.push(...((data || []) as MinimalDirect[]))
        if (!data || data.length < PAGE) break
    }
    return rows
}

/**
 * Referencias repetidas entre pagos NO rechazados (en cualquier campaña):
 * mismo comprobante usado dos veces o doble registro. Devuelve el set de ids
 * de donación marcados.
 */
function duplicateIds(rows: MinimalDirect[]): Set<string> {
    const byRef = new Map<string, string[]>()
    for (const r of rows) {
        if (r.payment_status === 'failed') continue
        const key = normalizeReference(r.reference_number)
        if (!key) continue
        const list = byRef.get(key) || []
        list.push(r.id)
        byRef.set(key, list)
    }
    const dup = new Set<string>()
    for (const ids of byRef.values()) if (ids.length > 1) ids.forEach((id) => dup.add(id))
    return dup
}

const isStale = (r: { payment_status: string; created_at: string }) =>
    r.payment_status === 'pending' && Date.now() - new Date(r.created_at).getTime() > STALE_MS

/** Las URLs firmadas de comprobantes vencen al año: las re-firmamos para auditar. */
async function refreshCaptureUrls<T extends { capture_url: string | null }>(db: SupabaseClient, rows: T[]): Promise<T[]> {
    const paths = Array.from(new Set(rows.map((r) => captureObjectPath(r.capture_url)).filter(Boolean) as string[]))
    if (paths.length === 0) return rows
    try {
        const { data } = await db.storage.from(CAPTURE_BUCKET).createSignedUrls(paths, 60 * 60 * 6)
        const fresh = new Map<string, string>()
        for (const item of data || []) {
            if (item?.path && item?.signedUrl && !item.error) fresh.set(item.path, item.signedUrl)
        }
        return rows.map((r) => {
            const path = captureObjectPath(r.capture_url)
            return path && fresh.has(path) ? { ...r, capture_url: fresh.get(path)! } : r
        })
    } catch (err) {
        console.warn('[admin/direct-payments] no se pudieron re-firmar comprobantes:', err)
        return rows
    }
}

const DONATION_COLUMNS = `
    id, campaign_id, donor_id, amount_usd, amount_bs, currency, payment_method, payment_status,
    reference_number, capture_url, donor_name, email, is_anonymous, created_at, completed_at,
    confirmed_at, confirmed_by, crisis_account_id, admin_notes, referral_code,
    donor:donor_id ( full_name, email, phone ),
    confirmer:confirmed_by ( full_name, email )
`

const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null)

export async function GET(request: NextRequest) {
    try {
        const adminCheck = await assertAdmin()
        if (!adminCheck.ok) return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status })

        const db = createAdminClient()
        const { searchParams } = new URL(request.url)
        const campaignId = searchParams.get('campaignId')
        const view = searchParams.get('view') || 'campaigns'

        // ---------------- Detalle de una campaña ----------------
        if (campaignId) {
            const [{ data: campaign, error: campaignError }, { data: accounts }, { data: donations, error: donationsError }, allMinimal] =
                await Promise.all([
                    db
                        .from('campaigns')
                        .select('id, title, slug, status, campaign_type, current_amount_usd, goal_amount_usd, is_open_ended, created_at, creator_id')
                        .eq('id', campaignId)
                        .maybeSingle(),
                    db
                        .from('campaign_crisis_accounts')
                        .select('*')
                        .eq('campaign_id', campaignId)
                        .order('display_order', { ascending: true }),
                    db
                        .from('donations')
                        .select(DONATION_COLUMNS)
                        .eq('campaign_id', campaignId)
                        .eq('is_direct', true)
                        .order('created_at', { ascending: false })
                        .limit(1000),
                    fetchAllDirectMinimal(db),
                ])

            if (campaignError) throw campaignError
            if (!campaign) return NextResponse.json({ error: 'Campaña no encontrada' }, { status: 404 })
            if (donationsError) throw donationsError

            const { data: creator } = await db
                .from('users')
                .select('id, full_name, email, phone, kyc_status')
                .eq('id', campaign.creator_id)
                .maybeSingle()

            const dups = duplicateIds(allMinimal)
            // Campañas donde aparece cada referencia repetida (para el aviso).
            const refCampaigns = new Map<string, Set<string>>()
            for (const r of allMinimal) {
                if (r.payment_status === 'failed') continue
                const key = normalizeReference(r.reference_number)
                if (!key) continue
                const set = refCampaigns.get(key) || new Set<string>()
                set.add(r.campaign_id)
                refCampaigns.set(key, set)
            }

            // Bitácora de mediación. En bloques: un `.in()` con cientos de
            // UUIDs arma una URL demasiado larga para PostgREST.
            const ids = (donations || []).map((d: any) => d.id as string)
            const audit: any[] = []
            for (let i = 0; i < ids.length; i += 150) {
                const { data: logs, error: logsError } = await db
                    .from('audit_logs')
                    .select('id, action, target_id, reason, changes, created_at, admin:admin_id ( full_name )')
                    .eq('target_table', 'donations')
                    .in('target_id', ids.slice(i, i + 150))
                    .order('created_at', { ascending: false })
                    .limit(1000)
                if (logsError) console.warn('[admin/direct-payments] bitácora:', logsError.message)
                audit.push(...(logs || []).map((l: any) => ({ ...l, admin: one(l.admin) })))
            }

            const accountById = new Map((accounts || []).map((a: any) => [a.id, a]))
            const enriched = await refreshCaptureUrls(
                db,
                (donations || []).map((d: any) => {
                    const key = normalizeReference(d.reference_number)
                    return {
                        ...d,
                        donor: one(d.donor),
                        confirmer: one(d.confirmer),
                        account: d.crisis_account_id ? accountById.get(d.crisis_account_id) || null : null,
                        duplicate_reference: dups.has(d.id),
                        duplicate_in_other_campaign: key ? (refCampaigns.get(key)?.size || 0) > 1 : false,
                        stale: isStale(d),
                    }
                })
            )

            return NextResponse.json({
                campaign,
                creator: creator || null,
                accounts: accounts || [],
                donations: enriched,
                audit,
                staleHours: DIRECT_PAYMENT_STALE_HOURS,
            })
        }

        // ---------------- Lista plana ----------------
        if (view === 'list') {
            const status = searchParams.get('status') || 'all'
            const staleOnly = searchParams.get('stale') === '1'

            let query = db
                .from('donations')
                .select(`${DONATION_COLUMNS}, campaigns ( title, slug, creator_id )`)
                .eq('is_direct', true)
                .order('created_at', { ascending: !!staleOnly })
                .limit(300)
            if (staleOnly) {
                query = query.eq('payment_status', 'pending').lt('created_at', new Date(Date.now() - STALE_MS).toISOString())
            } else if (status !== 'all') {
                query = query.eq('payment_status', status)
            }

            const [{ data, error }, allMinimal] = await Promise.all([query, fetchAllDirectMinimal(db)])
            if (error) throw error
            const dups = duplicateIds(allMinimal)

            const enriched = await refreshCaptureUrls(
                db,
                (data || []).map((d: any) => ({
                    ...d,
                    donor: one(d.donor),
                    confirmer: one(d.confirmer),
                    campaigns: one(d.campaigns),
                    duplicate_reference: dups.has(d.id),
                    stale: isStale(d),
                }))
            )
            return NextResponse.json({ donations: enriched, staleHours: DIRECT_PAYMENT_STALE_HOURS })
        }

        // ---------------- Resumen por campaña (default) ----------------
        const allMinimal = await fetchAllDirectMinimal(db)
        const dups = duplicateIds(allMinimal)

        type Summary = {
            campaign_id: string
            pending: number
            completed: number
            failed: number
            stale: number
            duplicates: number
            confirmed_usd: number
            pending_usd: number
            rejected_usd: number
            oldest_pending_at: string | null
            last_activity_at: string | null
        }
        const byCampaign = new Map<string, Summary>()
        for (const r of allMinimal) {
            const s = byCampaign.get(r.campaign_id) || {
                campaign_id: r.campaign_id,
                pending: 0,
                completed: 0,
                failed: 0,
                stale: 0,
                duplicates: 0,
                confirmed_usd: 0,
                pending_usd: 0,
                rejected_usd: 0,
                oldest_pending_at: null,
                last_activity_at: null,
            }
            const amount = Number(r.amount_usd) || 0
            if (r.payment_status === 'completed') {
                s.completed++
                s.confirmed_usd += amount
            } else if (r.payment_status === 'pending') {
                s.pending++
                s.pending_usd += amount
                if (isStale(r)) s.stale++
                if (!s.oldest_pending_at || r.created_at < s.oldest_pending_at) s.oldest_pending_at = r.created_at
            } else {
                s.failed++
                s.rejected_usd += amount
            }
            if (dups.has(r.id)) s.duplicates++
            const activity = r.confirmed_at && r.confirmed_at > r.created_at ? r.confirmed_at : r.created_at
            if (!s.last_activity_at || activity > s.last_activity_at) s.last_activity_at = activity
            byCampaign.set(r.campaign_id, s)
        }

        // Campañas crisis sin ningún pago también se listan (para auditar que
        // tengan cuentas cargadas), además de las que tienen pagos directos.
        const { data: crisisCampaigns } = await db
            .from('campaigns')
            .select('id')
            .eq('campaign_type', 'crisis')
            .limit(2000)
        const campaignIds = Array.from(
            new Set([...byCampaign.keys(), ...((crisisCampaigns || []).map((c: any) => c.id) as string[])])
        )

        const campaignRows: any[] = []
        const accountCounts = new Map<string, number>()
        for (let i = 0; i < campaignIds.length; i += 200) {
            const chunk = campaignIds.slice(i, i + 200)
            const [{ data: cs, error: csError }, { data: accs }] = await Promise.all([
                db
                    .from('campaigns')
                    .select('id, title, slug, status, campaign_type, current_amount_usd, created_at, creator:creator_id ( full_name, email, phone )')
                    .in('id', chunk),
                db.from('campaign_crisis_accounts').select('campaign_id').in('campaign_id', chunk).eq('is_active', true),
            ])
            if (csError) throw csError
            campaignRows.push(...(cs || []))
            for (const a of accs || []) accountCounts.set((a as any).campaign_id, (accountCounts.get((a as any).campaign_id) || 0) + 1)
        }

        const empty = (id: string): Summary => ({
            campaign_id: id,
            pending: 0,
            completed: 0,
            failed: 0,
            stale: 0,
            duplicates: 0,
            confirmed_usd: 0,
            pending_usd: 0,
            rejected_usd: 0,
            oldest_pending_at: null,
            last_activity_at: null,
        })

        const campaigns = campaignRows
            .map((c: any) => {
                const s = byCampaign.get(c.id) || empty(c.id)
                return {
                    ...s,
                    confirmed_usd: round2(s.confirmed_usd),
                    pending_usd: round2(s.pending_usd),
                    rejected_usd: round2(s.rejected_usd),
                    title: c.title,
                    slug: c.slug,
                    status: c.status,
                    campaign_type: c.campaign_type,
                    current_amount_usd: Number(c.current_amount_usd) || 0,
                    created_at: c.created_at as string,
                    creator: one(c.creator),
                    active_accounts: accountCounts.get(c.id) || 0,
                }
            })
            // Lo que requiere atención primero: pendientes viejos, duplicados,
            // pendientes, y luego por actividad reciente.
            .sort((a, b) =>
                b.stale - a.stale ||
                b.duplicates - a.duplicates ||
                b.pending - a.pending ||
                String(b.last_activity_at || b.created_at || '').localeCompare(String(a.last_activity_at || a.created_at || ''))
            )

        const totals = campaigns.reduce(
            (acc, c) => {
                acc.campaigns++
                acc.pending += c.pending
                acc.stale += c.stale
                acc.completed += c.completed
                acc.failed += c.failed
                acc.duplicates += c.duplicates
                acc.confirmed_usd = round2(acc.confirmed_usd + c.confirmed_usd)
                acc.pending_usd = round2(acc.pending_usd + c.pending_usd)
                if (c.campaign_type === 'crisis' && c.status === 'active' && c.active_accounts === 0) acc.without_accounts++
                return acc
            },
            { campaigns: 0, pending: 0, stale: 0, completed: 0, failed: 0, duplicates: 0, confirmed_usd: 0, pending_usd: 0, without_accounts: 0 }
        )

        return NextResponse.json({ campaigns, totals, staleHours: DIRECT_PAYMENT_STALE_HOURS })
    } catch (error: any) {
        console.error('[admin/direct-payments] error:', error)
        return NextResponse.json({ error: 'Error interno', details: error?.message }, { status: 500 })
    }
}
