import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { CampaignCard } from "@/components/campaign-card";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  HeartHandshake,
  LineChart,
  ShieldCheck,
  Wallet,
} from "lucide-react";

interface Campaign {
  id: string
  title: string
  story: string
  main_image_url: string | null
  goal_amount_usd: number
  current_amount_usd: number
  slug: string
  categories: {
    name: string
    icon_emoji: string | null
  }[]
  users: {
    full_name: string
    kyc_status: string
  }[]
}

const trustPillars = [
  {
    icon: ShieldCheck,
    tone: "primary" as const,
    title: "Identidad verificada, sin excepciones",
    body:
      "Cada creador pasa por verificación de identidad (KYC) antes de poder recibir un solo bolívar. Nadie recauda en el anonimato.",
  },
  {
    icon: HeartHandshake,
    tone: "accent" as const,
    title: "Garantes que ponen su nombre",
    body:
      "Personas reales avalan la veracidad de la campaña. Si ves el sello Avalado, alguien respaldó esa historia con su reputación.",
  },
  {
    icon: LineChart,
    tone: "primary" as const,
    title: "Cada donación se puede seguir",
    body:
      "Metas y progreso en dólares, conversión automática a bolívares con tasa BCV. Ves cuánto se recaudó y cuánto falta, en tiempo real.",
  },
  {
    icon: Wallet,
    tone: "primary" as const,
    title: "Paga como puedas pagar",
    body:
      "Tarjeta internacional, PayPal, PagoMóvil, Zelle, transferencia o cripto. El método no debería ser la barrera para ayudar.",
  },
];

function formatUsd(value: number) {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toLocaleString("es-VE")}`;
}

function formatCount(value: number) {
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K+`;
  return `${value}+`;
}

export default async function Home() {
  const supabase = await createClient()

  // Verificar si el usuario está logueado
  const { data: { user } } = await supabase.auth.getUser()

  // Get active campaigns for homepage
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select(`
      id,
      title,
      story,
      main_image_url,
      goal_amount_usd,
      current_amount_usd,
      slug,
      categories (
        name,
        icon_emoji
      ),
      users (
        full_name,
        kyc_status
      )
    `)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(3)

  const featuredCampaigns = campaigns || []

  // Get real stats from database
  const [campaignsResult, campaignsCountResult, donorsResult] = await Promise.all([
    supabase.from('campaigns').select('current_amount_usd'),
    supabase.from('campaigns').select('id', { count: 'exact', head: true }),
    supabase.from('donations').select('donor_id'),
  ])

  const totalRaised = campaignsResult.data?.reduce((sum, c) => sum + (c.current_amount_usd || 0), 0) || 0
  const totalCampaigns = campaignsCountResult.count || 0
  const uniqueDonors = new Set(donorsResult.data?.map(d => d.donor_id).filter(id => id)).size || 0

  const createHref = user ? "/creator/campaigns/create" : "/auth/register"

  const stats = [
    { label: "Recaudado para causas", value: formatUsd(totalRaised) },
    { label: "Personas que han donado", value: formatCount(uniqueDonors) },
    { label: "Campañas publicadas", value: formatCount(totalCampaigns) },
  ]

  return (
    <main className="flex min-h-screen flex-col">

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="mx-auto max-w-7xl px-4 py-16 md:py-24">
          <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
            {/* Copy */}
            <div className="max-w-xl">
              <p className="lv-rise inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/5 px-3 py-1 text-sm font-medium text-primary">
                <ShieldCheck className="size-4" />
                Crowdfunding verificado de Venezuela
              </p>

              <h1 className="lv-rise lv-delay-1 mt-6 text-balance text-4xl font-black leading-[1.05] tracking-tight sm:text-5xl lg:text-[clamp(2.75rem,5vw,4rem)]">
                Recaudamos juntos para causas que{" "}
                <span className="relative whitespace-nowrap text-primary">
                  de verdad existen
                  <span
                    aria-hidden
                    className="absolute -bottom-1 left-0 h-[0.16em] w-full rounded-full bg-accent"
                  />
                </span>
              </h1>

              <p className="lv-rise lv-delay-2 mt-6 text-pretty text-lg leading-relaxed text-foreground/80">
                Verificamos la identidad de cada creador y sumamos garantes que avalan
                su historia. Tu donación llega a una persona real, con progreso que
                puedes seguir hasta el final.
              </p>

              <div className="lv-rise lv-delay-3 mt-8 flex flex-col gap-3 sm:flex-row">
                <Button size="lg" className="w-full sm:w-auto" asChild>
                  <Link href="/campaigns">
                    Ver campañas
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" className="w-full sm:w-auto" asChild>
                  <Link href={createHref}>
                    {user ? "Crear campaña" : "Comenzar ahora"}
                  </Link>
                </Button>
              </div>
            </div>

            {/* Image with committed-color depth */}
            <div className="lv-image-in lv-delay-2 relative mx-auto w-full max-w-md sm:max-w-lg lg:max-w-none">
              <div
                aria-hidden
                className="absolute -right-4 -top-4 h-2/3 w-2/3 rounded-[1.75rem] bg-primary md:-right-6 md:-top-6"
              />
              <div
                aria-hidden
                className="absolute -bottom-4 -left-4 hidden size-28 rounded-3xl bg-accent sm:block md:-bottom-6 md:-left-6"
              />
              <div className="relative aspect-[4/3] overflow-hidden rounded-[1.75rem] border border-border shadow-sm">
                <Image
                  src="/diverse-people-helping-community.jpg"
                  alt="Vecinos venezolanos organizándose para apoyar una causa comunitaria"
                  fill
                  priority
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  className="object-cover"
                />
              </div>

              {/* Floating verification proof */}
              <div className="absolute -bottom-5 left-4 flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-lg sm:left-8">
                <span className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <CheckCircle2 className="size-5" />
                </span>
                <div className="text-sm leading-tight">
                  <p className="font-semibold text-card-foreground">Identidad verificada</p>
                  <p className="text-foreground/60">KYC obligatorio para crear</p>
                </div>
              </div>
            </div>
          </div>

          {/* Trust ribbon: real proof, tabular figures, no decoration */}
          <dl className="lv-rise lv-delay-4 mt-20 grid grid-cols-1 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            {stats.map((stat) => (
              <div key={stat.label} className="flex flex-col gap-1.5 px-6 py-5">
                <dt className="text-sm font-medium text-foreground/70">{stat.label}</dt>
                <dd className="font-mono text-3xl font-semibold tracking-tight text-primary">
                  {stat.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Why trust LaVaca — editorial list, not a card grid */}
      <section className="border-b border-border bg-muted/40">
        <div className="mx-auto max-w-7xl px-4 py-16 md:py-24">
          <div className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
            <div className="lg:sticky lg:top-24 lg:self-start">
              <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
                Lo que protege cada bolívar que donas
              </h2>
              <p className="mt-4 text-pretty text-lg leading-relaxed text-foreground/70">
                No te pedimos confiar a ciegas. Te mostramos exactamente por qué
                puedes hacerlo.
              </p>
              <Button variant="outline" className="mt-8" asChild>
                <Link href="/how-it-works">
                  Cómo funciona
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>

            <div>
              {trustPillars.map((pillar, index) => (
                <div
                  key={pillar.title}
                  className={cn(
                    "flex gap-5 py-7",
                    index > 0 && "border-t border-border",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-12 shrink-0 items-center justify-center rounded-xl",
                      pillar.tone === "accent"
                        ? "bg-accent/15 text-accent"
                        : "bg-primary/10 text-primary",
                    )}
                  >
                    <pillar.icon className="size-6" />
                  </span>
                  <div>
                    <h3 className="text-lg font-bold sm:text-xl">{pillar.title}</h3>
                    <p className="mt-2 text-pretty leading-relaxed text-foreground/70">
                      {pillar.body}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Featured campaigns */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-7xl px-4 py-16 md:py-24">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
                Campañas que necesitan apoyo hoy
              </h2>
              <p className="mt-3 text-lg text-foreground/70">
                Cada una verificada antes de publicarse.
              </p>
            </div>
            <Button variant="outline" className="shrink-0 self-start sm:self-auto" asChild>
              <Link href="/campaigns">
                Ver todas
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>

          {featuredCampaigns.length > 0 ? (
            <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {featuredCampaigns.map((campaign: Campaign) => (
                <CampaignCard
                  key={campaign.id}
                  id={campaign.id}
                  title={campaign.title}
                  description={campaign.story}
                  image={campaign.main_image_url || '/placeholder.svg'}
                  goalAmount={campaign.goal_amount_usd}
                  raisedAmount={campaign.current_amount_usd}
                  category={campaign.categories?.[0]?.name || 'General'}
                  creator={campaign.users?.[0]?.full_name || 'Creador anónimo'}
                  verified={campaign.users?.[0]?.kyc_status === 'verified'}
                  donorCount={0}
                />
              ))}
            </div>
          ) : (
            <div className="mt-10 flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border bg-muted/40 px-6 py-16 text-center">
              <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <BadgeCheck className="size-6" />
              </span>
              <div>
                <p className="text-lg font-semibold">Aún no hay campañas activas</p>
                <p className="mt-1 text-foreground/70">
                  Sé la primera persona en lanzar una causa verificada en LaVaca.
                </p>
              </div>
              <Button asChild>
                <Link href={createHref}>Crear la primera campaña</Link>
              </Button>
            </div>
          )}
        </div>
      </section>

      {/* Closing CTA — drenched teal */}
      <section className="relative overflow-hidden bg-primary text-primary-foreground">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, color-mix(in oklch, white 14%, transparent) 1px, transparent 0)",
            backgroundSize: "26px 26px",
          }}
        />
        <div className="relative mx-auto max-w-3xl px-4 py-20 text-center md:py-28">
          <h2 className="text-balance text-3xl font-black tracking-tight sm:text-4xl md:text-5xl">
            ¿Tu causa necesita apoyo? Empieza hoy.
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-pretty text-lg leading-relaxed text-primary-foreground/85">
            Verificamos tu identidad y tu campaña se publica de inmediato. Sin
            comisiones ocultas y sin letra chica.
          </p>
          <Button
            size="lg"
            className="mt-8 bg-background text-primary hover:bg-background/90"
            asChild
          >
            <Link href={createHref}>Crear mi campaña</Link>
          </Button>
          <p className="mt-4 text-sm text-primary-foreground/70">
            Gratis para empezar · KYC en minutos
          </p>
        </div>
      </section>

    </main>
  );
}
