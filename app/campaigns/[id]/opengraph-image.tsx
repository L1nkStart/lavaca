import { ImageResponse } from 'next/og'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Imagen Open Graph por campaña (1200×630): foto de la campaña, título,
 * barra de progreso y sello de verificación. Es la tarjeta que aparece al
 * pegar el enlace en WhatsApp, Telegram, Instagram o X. Se regenera cada
 * 10 minutos para que el progreso no quede viejo.
 */
export const runtime = 'nodejs'
export const revalidate = 600
export const alt = 'Campaña en LaVaca'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const TEAL = '#0f5c58'
const TERRACOTA = '#c2703f'

/**
 * Satori (el motor de ImageResponse) solo decodifica JPEG y PNG, y falla
 * si la imagen remota no carga. Se descarga aquí, se valida el tipo y se
 * embebe como data URI; si algo falla, la tarjeta sale sin foto.
 */
async function loadImageDataUri(url: string | null): Promise<string | null> {
    if (!url) return null
    try {
        const res = await fetch(url, { signal: AbortSignal.timeout(4000), cache: 'no-store' })
        if (!res.ok) return null
        const type = (res.headers.get('content-type') || '').split(';')[0].trim()
        if (type !== 'image/jpeg' && type !== 'image/jpg' && type !== 'image/png') return null
        const buf = Buffer.from(await res.arrayBuffer())
        if (buf.length > 6 * 1024 * 1024) return null
        return `data:${type};base64,${buf.toString('base64')}`
    } catch {
        return null
    }
}

const usd = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`

export default async function OpenGraphImage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params

    let campaign: {
        title: string
        main_image_url: string | null
        current_amount_usd: number
        goal_amount_usd: number
        is_open_ended: boolean
        location: string | null
        verified: boolean
    } | null = null

    try {
        const admin = createAdminClient()
        const { data } = await admin
            .from('campaigns')
            .select('title, main_image_url, current_amount_usd, goal_amount_usd, is_open_ended, status, location, users!campaigns_creator_id_fkey ( kyc_status )')
            .eq('id', id)
            .maybeSingle()
        if (data && data.status === 'active') {
            const creator = Array.isArray(data.users) ? data.users[0] : data.users
            campaign = {
                title: data.title,
                main_image_url: data.main_image_url,
                current_amount_usd: Number(data.current_amount_usd || 0),
                goal_amount_usd: Number(data.goal_amount_usd || 0),
                is_open_ended: Boolean(data.is_open_ended),
                location: data.location,
                verified: (creator as any)?.kyc_status === 'verified',
            }
        }
    } catch {
        campaign = null
    }

    const image = campaign ? await loadImageDataUri(campaign.main_image_url) : null
    const title = campaign
        ? campaign.title.length > 95 ? `${campaign.title.slice(0, 92).trimEnd()}…` : campaign.title
        : 'Crowdfunding verificado para Venezuela'
    const raised = campaign?.current_amount_usd || 0
    const goal = campaign?.goal_amount_usd || 0
    const openEnded = !campaign || campaign.is_open_ended || goal <= 0
    const percent = openEnded ? 0 : Math.min(100, Math.round((raised / goal) * 100))

    return new ImageResponse(
        (
            <div
                style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    position: 'relative',
                    backgroundColor: TEAL,
                    fontFamily: 'sans-serif',
                    color: '#ffffff',
                }}
            >
                {image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={image}
                        alt=""
                        width={1200}
                        height={630}
                        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                )}
                {/* Velo para que el texto sea legible sobre cualquier foto */}
                <div
                    style={{
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        background: image
                            ? 'linear-gradient(180deg, rgba(10,30,30,0.15) 0%, rgba(10,30,30,0.55) 45%, rgba(10,30,30,0.92) 100%)'
                            : 'linear-gradient(135deg, #0f5c58 0%, #163f3d 100%)',
                    }}
                />

                {/* Marca */}
                <div
                    style={{
                        position: 'absolute',
                        top: 40,
                        left: 56,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 14,
                    }}
                >
                    <div
                        style={{
                            width: 44,
                            height: 44,
                            borderRadius: 22,
                            backgroundColor: '#ffffff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: TEAL,
                            fontSize: 26,
                            fontWeight: 700,
                        }}
                    >
                        L
                    </div>
                    <div style={{ fontSize: 34, fontWeight: 700, letterSpacing: -0.5 }}>LaVaca</div>
                    {campaign?.verified && (
                        <div
                            style={{
                                marginLeft: 12,
                                display: 'flex',
                                alignItems: 'center',
                                backgroundColor: 'rgba(255,255,255,0.18)',
                                border: '2px solid rgba(255,255,255,0.7)',
                                borderRadius: 999,
                                padding: '6px 16px',
                                fontSize: 22,
                            }}
                        >
                            ✓ Creador verificado
                        </div>
                    )}
                </div>

                {/* Título + progreso */}
                <div
                    style={{
                        position: 'absolute',
                        left: 56,
                        right: 56,
                        bottom: 48,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 22,
                    }}
                >
                    <div
                        style={{
                            fontSize: title.length > 60 ? 48 : 58,
                            fontWeight: 700,
                            lineHeight: 1.12,
                            letterSpacing: -1,
                            textShadow: '0 2px 12px rgba(0,0,0,0.35)',
                        }}
                    >
                        {title}
                    </div>

                    {campaign && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                                <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
                                    <span style={{ fontSize: 52, fontWeight: 700 }}>{usd(raised)}</span>
                                    <span style={{ fontSize: 26, opacity: 0.9 }}>
                                        {openEnded ? 'recaudados · sin meta fija' : `de ${usd(goal)}`}
                                    </span>
                                </div>
                                {!openEnded && (
                                    <span style={{ fontSize: 30, fontWeight: 700, color: '#ffd9c2' }}>{percent}%</span>
                                )}
                            </div>
                            {!openEnded && (
                                <div
                                    style={{
                                        display: 'flex',
                                        width: '100%',
                                        height: 18,
                                        borderRadius: 9,
                                        backgroundColor: 'rgba(255,255,255,0.28)',
                                        overflow: 'hidden',
                                    }}
                                >
                                    <div
                                        style={{
                                            width: `${Math.max(percent, 2)}%`,
                                            height: '100%',
                                            borderRadius: 9,
                                            backgroundColor: TERRACOTA,
                                        }}
                                    />
                                </div>
                            )}
                            <div style={{ display: 'flex', fontSize: 24, opacity: 0.9 }}>
                                Dona por PagoMóvil, Zelle, tarjeta o cripto · lavaca.com.ve
                                {campaign.location ? ` · ${campaign.location}` : ''}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        ),
        { ...size }
    )
}
