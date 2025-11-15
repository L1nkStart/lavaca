import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
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

    // Check if user is verified and can create campaigns
    if (profile.kyc_status !== 'verified') {
        redirect('/profile?verify=true&becomeCreator=true')
    }

    if (profile.role !== 'creator' && profile.role !== 'admin') {
        redirect('/profile?becomeCreator=true')
    }

    // Get categories for the form
    const { data: categories } = await supabase
        .from('categories')
        .select('*')
        .order('name')

    return (
        <div className="min-h-screen bg-background p-4">
            <div className="max-w-4xl mx-auto space-y-6">
                {/* Header */}
                <div className="space-y-2">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                            <Plus className="h-5 w-5 text-primary-foreground" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold">Crear Nueva Campaña</h1>
                            <p className="text-muted-foreground">
                                Comparte tu causa y comienza a recaudar fondos
                            </p>
                        </div>
                    </div>
                </div>

                {/* Verification Status */}
                {profile.kyc_status === 'verified' && (
                    <Alert className="bg-green-50 border-green-200">
                        <AlertCircle className="h-4 w-4 text-green-600" />
                        <AlertDescription className="text-green-800">
                            Tu identidad está verificada. Puedes crear campañas con todas las funcionalidades.
                        </AlertDescription>
                    </Alert>
                )}

                {/* Create Campaign Form */}
                <Card>
                    <CardHeader>
                        <CardTitle>Información de la Campaña</CardTitle>
                        <CardDescription>
                            Proporciona los detalles de tu campaña. Asegúrate de ser claro y honesto para generar confianza.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <CreateCampaignForm
                            profile={profile}
                            categories={categories || []}
                        />
                    </CardContent>
                </Card>

                {/* Tips for Success */}
                <Card>
                    <CardHeader>
                        <CardTitle>Consejos para una Campaña Exitosa</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <h4 className="font-medium text-green-700">✓ Títulos efectivos</h4>
                                <p className="text-sm text-muted-foreground">
                                    Usa títulos claros y específicos que describan exactamente para qué necesitas ayuda.
                                </p>
                            </div>
                            <div className="space-y-2">
                                <h4 className="font-medium text-green-700">✓ Historia compelling</h4>
                                <p className="text-sm text-muted-foreground">
                                    Cuenta tu historia de manera personal y auténtica. Explica por qué es importante.
                                </p>
                            </div>
                            <div className="space-y-2">
                                <h4 className="font-medium text-green-700">✓ Metas realistas</h4>
                                <p className="text-sm text-muted-foreground">
                                    Establece una meta alcanzable basada en tus necesidades reales.
                                </p>
                            </div>
                            <div className="space-y-2">
                                <h4 className="font-medium text-green-700">✓ Evidencia visual</h4>
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
