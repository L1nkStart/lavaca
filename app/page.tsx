import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, Heart, Shield, TrendingUp } from 'lucide-react';
import { CampaignCard } from "@/components/campaign-card";
import { createClient } from "@/lib/supabase/server";
import Image from "next/image";

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

export default async function Home() {
  const supabase = await createClient()

  // Get active campaigns for homepage
  const { data: campaigns, error: campaignsError } = await supabase
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
  return (
    <main className="flex flex-col min-h-screen">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white font-bold text-sm">
              LV
            </div>
            <span className="font-bold text-lg">LaVaca</span>
          </div>
          <div className="hidden md:flex items-center gap-6">
            <Link href="/campaigns" className="text-sm hover:text-primary">
              Campañas
            </Link>
            <Link href="/how-it-works" className="text-sm hover:text-primary">
              Cómo funciona
            </Link>
            <Link href="/about" className="text-sm hover:text-primary">
              Acerca de
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/auth/login">Iniciar sesión</Link>
            </Button>
            <Button size="sm" asChild className="bg-primary">
              <Link href="/auth/sign-up">Registrarse</Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative py-20 px-4 bg-gradient-to-br from-primary/10 to-accent/10 border-b border-border">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <h1 className="text-4xl md:text-5xl font-bold leading-tight text-pretty">
                Juntos recaudamos fondos para causas verificadas
              </h1>
              <p className="text-lg text-muted-foreground text-pretty">
                LaVaca es la plataforma de crowdfunding más segura de Venezuela.
                Verificamos identidades, transparencia total, y múltiples métodos de pago.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Button size="lg" className="bg-primary hover:bg-primary/90" asChild>
                  <Link href="/campaigns">
                    Ver campaña
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link href="/create-campaign">Crear campaña</Link>
                </Button>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-4 pt-4">
                <div>
                  <div className="text-2xl font-bold text-primary">$2.3M</div>
                  <div className="text-sm text-muted-foreground">Recaudados</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-primary">12,400+</div>
                  <div className="text-sm text-muted-foreground">Donantes</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-primary">340+</div>
                  <div className="text-sm text-muted-foreground">Campañas</div>
                </div>
              </div>
            </div>

            {/* Hero Image */}
            <div className="relative h-96 rounded-lg overflow-hidden">
              <Image
                src="/diverse-people-helping-community.jpg"
                alt="Communidad LaVaca"
                fill
                className="object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Trust Section */}
      <section className="py-16 px-4">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">
            Por qué confiar en LaVaca
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="space-y-4 p-6 rounded-lg bg-card border border-border hover:border-primary transition-colors">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                <Shield className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-bold text-lg">100% Verificado</h3>
              <p className="text-muted-foreground text-sm">
                Verificación de identidad obligatoria. Todos los creadores de
                campaña son verificados.
              </p>
            </div>

            <div className="space-y-4 p-6 rounded-lg bg-card border border-border hover:border-primary transition-colors">
              <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-accent" />
              </div>
              <h3 className="font-bold text-lg">Transparencia Total</h3>
              <p className="text-muted-foreground text-sm">
                Sigue cada donación. Reportes públicos de recaudación y uso de fondos.
              </p>
            </div>

            <div className="space-y-4 p-6 rounded-lg bg-card border border-border hover:border-primary transition-colors">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                <Heart className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-bold text-lg">Múltiples Métodos</h3>
              <p className="text-muted-foreground text-sm">
                Paga con tarjeta, PayPal, PagoMóvil, Zelle, transferencia o cripto.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Campaigns */}
      <section className="py-16 px-4 bg-muted/50">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-12">
            <h2 className="text-3xl font-bold">Campañas destacadas</h2>
            <Button variant="outline" size="sm" asChild>
              <Link href="/campaigns">
                Ver todas
                <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </Button>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
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
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 px-4 bg-primary text-primary-foreground">
        <div className="max-w-7xl mx-auto text-center space-y-6">
          <h2 className="text-3xl md:text-4xl font-bold">
            ¿Tienes una causa que necesita apoyo?
          </h2>
          <p className="text-lg opacity-90 max-w-2xl mx-auto">
            Crea tu campaña en LaVaca. Es rápido, fácil y completamente transparente.
            Verificamos tu identidad y tu campaña se publica inmediatamente.
          </p>
          <Button
            size="lg"
            className="bg-primary-foreground text-primary hover:bg-primary-foreground/90"
            asChild
          >
            <Link href="/auth/sign-up">Crear mi campaña ahora</Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-card py-12 px-4">
        <div className="max-w-7xl mx-auto grid md:grid-cols-4 gap-8 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white font-bold text-sm">
                LV
              </div>
              <span className="font-bold">LaVaca</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Crowdfunding transparente para Venezuela.
            </p>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Plataforma</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  href="/campaigns"
                  className="text-muted-foreground hover:text-foreground"
                >
                  Campañas
                </Link>
              </li>
              <li>
                <Link
                  href="/how-it-works"
                  className="text-muted-foreground hover:text-foreground"
                >
                  Cómo funciona
                </Link>
              </li>
              <li>
                <Link
                  href="/faq"
                  className="text-muted-foreground hover:text-foreground"
                >
                  Preguntas frecuentes
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Empresa</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  href="/about"
                  className="text-muted-foreground hover:text-foreground"
                >
                  Acerca de
                </Link>
              </li>
              <li>
                <Link
                  href="/blog"
                  className="text-muted-foreground hover:text-foreground"
                >
                  Blog
                </Link>
              </li>
              <li>
                <Link
                  href="/contact"
                  className="text-muted-foreground hover:text-foreground"
                >
                  Contacto
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Legal</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  href="/privacy"
                  className="text-muted-foreground hover:text-foreground"
                >
                  Privacidad
                </Link>
              </li>
              <li>
                <Link
                  href="/terms"
                  className="text-muted-foreground hover:text-foreground"
                >
                  Términos
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-border pt-8 text-center text-sm text-muted-foreground">
          <p>
            {new Date().getFullYear()} LaVaca. Todos los derechos reservados.
          </p>
        </div>
      </footer>
    </main>
  );
}
