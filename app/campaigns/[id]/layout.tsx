import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { getCanonicalBaseUrl } from '@/lib/url'

/**
 * Metadatos por campaña (Open Graph / Twitter). La página en sí es un
 * componente de cliente, así que las etiquetas viven en este layout de
 * servidor. Es lo que hace que un enlace pegado en WhatsApp, Telegram o
 * Instagram muestre la foto, el título y el progreso en vez de un cuadro
 * gris: la vista previa es la mitad de la decisión de abrir el enlace.
 */
export async function generateMetadata({
    params,
}: {
    params: Promise<{ id: string }>
}): Promise<Metadata> {
    const { id } = await params
    const base = getCanonicalBaseUrl()
    const fallback: Metadata = {
        title: 'Campaña | LaVaca',
        description: 'Crowdfunding verificado para Venezuela. Dona por PagoMóvil, Zelle, tarjeta o cripto.',
    }

    try {
        const supabase = await createClient()
        const { data } = await supabase
            .from('campaigns')
            .select('title, story, description, main_image_url, current_amount_usd, goal_amount_usd, is_open_ended, status, location')
            .eq('id', id)
            .maybeSingle()

        if (!data || data.status !== 'active') return fallback

        const raised = Number(data.current_amount_usd || 0)
        const goal = Number(data.goal_amount_usd || 0)
        const usd = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`
        const progress = data.is_open_ended || goal <= 0
            ? `Ya lleva ${usd(raised)} recaudados`
            : `${Math.min(100, Math.round((raised / goal) * 100))}% de ${usd(goal)} recaudado`

        const story = String(data.story || data.description || '').replace(/\s+/g, ' ').trim()
        const excerpt = story.length > 140 ? `${story.slice(0, 137).trimEnd()}…` : story
        const description = [progress, excerpt].filter(Boolean).join(' · ')
        const title = `${data.title} | LaVaca`
        const url = `${base}/campaigns/${id}`

        // La imagen la genera opengraph-image.tsx (foto + título + progreso);
        // Next la inyecta sola en og:image y twitter:image.
        return {
            title,
            description,
            alternates: { canonical: url },
            openGraph: {
                type: 'website',
                siteName: 'LaVaca',
                locale: 'es_VE',
                url,
                title: data.title,
                description,
            },
            twitter: {
                card: 'summary_large_image',
                title: data.title,
                description,
            },
        }
    } catch {
        return fallback
    }
}

export default function CampaignLayout({ children }: { children: React.ReactNode }) {
    return children
}
