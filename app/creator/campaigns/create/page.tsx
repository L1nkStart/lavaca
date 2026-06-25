import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { CreateCampaignForm } from '@/components/create-campaign-form'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle, Plus } from 'lucide-react'

export default async function CreateCampaignPage() {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
        redirect('/auth/login')
    }

    // Get user profile
    const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single()

    if (profileError || !profile) {
        console.error('Profile error:', profileError)
        redirect('/auth/login')
    }

    // Users can create campaigns without KYC verification
    // But they need to be verified to publish them

    // No role restriction - any user can create campaigns
    // They will be created as drafts initially

    // Get categories for the form
    const { data: categories } = await supabase
        .from('categories')
        .select('*')
        .order('order_index', { ascending: true })
        .order('name', { ascending: true })

    // Modo crisis global: solo si está habilitado se ofrece el tipo "Crisis".
    let crisisEnabled = false
    try {
        const adminSupabase = createAdminClient()
        const { data: cfg } = await adminSupabase
            .from('admin_config')
            .select('crisis_mode_enabled')
            .limit(1)
            .maybeSingle()
        crisisEnabled = Boolean(cfg?.crisis_mode_enabled)
    } catch {
        crisisEnabled = false
    }

    return (
        <div className="min-h-screen bg-muted/30">
            <div className="bg-gradient-to-br from-primary/10 to-accent/10 border-b">
                <div className="max-w-4xl mx-auto px-4 py-8">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center shadow-sm">
                            <Plus className="h-5 w-5 text-primary-foreground" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold">Crear nueva campaña</h1>
                            <p className="text-muted-foreground">
                                Comparte tu causa y comienza a recaudar fondos
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">

                {/* Verification Status */}
                {profile.kyc_status === 'verified' && (
                    <Alert className="border-primary/30 bg-primary/5">
                        <AlertCircle className="h-4 w-4 text-primary" />
                        <AlertDescription className="text-foreground">
                            Tu identidad está verificada. Puedes crear campañas con todas las funcionalidades.
                        </AlertDescription>
                    </Alert>
                )}

                {/* Create Campaign Form */}
                <Card className="shadow-sm border-border/60">
                    <CardHeader>
                        <CardTitle>Información de la campaña</CardTitle>
                        <CardDescription>
                            Proporciona los detalles de tu campaña. Asegúrate de ser claro y honesto para generar confianza.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <CreateCampaignForm
                            profile={profile}
                            categories={categories || []}
                            crisisEnabled={crisisEnabled}
                        />
                    </CardContent>
                </Card>

                {/* Tips for Success */}
                <Card className="shadow-sm border-border/60">
                    <CardHeader>
                        <CardTitle>Consejos para una campaña exitosa</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <h4 className="font-medium text-primary">✓ Títulos efectivos</h4>
                                <p className="text-sm text-muted-foreground">
                                    Usa títulos claros y específicos que describan exactamente para qué necesitas ayuda.
                                </p>
                            </div>
                            <div className="space-y-2">
                                <h4 className="font-medium text-primary">✓ Historia que conecta</h4>
                                <p className="text-sm text-muted-foreground">
                                    Cuenta tu historia de manera personal y auténtica. Explica por qué es importante.
                                </p>
                            </div>
                            <div className="space-y-2">
                                <h4 className="font-medium text-primary">✓ Metas realistas</h4>
                                <p className="text-sm text-muted-foreground">
                                    Establece una meta alcanzable basada en tus necesidades reales.
                                </p>
                            </div>
                            <div className="space-y-2">
                                <h4 className="font-medium text-primary">✓ Evidencia visual</h4>
                                <p className="text-sm text-muted-foreground">
                                    Incluye fotos y documentos que respalden tu causa.
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
