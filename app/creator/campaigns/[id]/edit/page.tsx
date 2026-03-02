import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { EditCampaignForm } from '@/components/edit-campaign-form'
import { FilePenLine } from 'lucide-react'

interface EditCampaignPageProps {
    params: Promise<{
        id: string
    }>
}

export default async function EditCampaignPage({ params }: EditCampaignPageProps) {
    const { id } = await params
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
        redirect('/auth/login')
    }

    const { data: campaign, error: campaignError } = await supabase
        .from('campaigns')
        .select(`
      id,
      creator_id,
      title,
      story,
      location,
      goal_amount_usd,
      urgency_level,
            category_id
    `)
        .eq('id', id)
        .eq('creator_id', user.id)
        .maybeSingle()

    if (campaignError || !campaign) {
        redirect('/creator/campaigns')
    }

    const { data: campaignDetails } = await supabase
        .from('campaign_details')
        .select('support_documents, support_documents_urls, gallery_images')
        .eq('campaign_id', id)
        .maybeSingle()

    const campaignWithDetails = {
        ...campaign,
        campaign_details: campaignDetails || null
    }

    const { data: categories } = await supabase
        .from('categories')
        .select('id, name, icon_emoji')
        .order('name')

    return (
        <div className="min-h-screen bg-background p-4">
            <div className="max-w-4xl mx-auto space-y-6">
                <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                                <FilePenLine className="h-5 w-5 text-primary-foreground" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold">Editar campaña</h1>
                                <p className="text-muted-foreground">Gestiona tu historia, documentos y actualizaciones.</p>
                            </div>
                        </div>

                        <Button variant="outline" asChild>
                            <Link href="/creator/campaigns">Finalizar</Link>
                        </Button>
                    </div>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Gestión de campaña</CardTitle>
                        <CardDescription>
                            Solo el creador propietario de esta campaña puede ver y editar esta sección.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <EditCampaignForm
                            campaign={campaignWithDetails as any}
                            categories={categories || []}
                            currentUserId={user.id}
                        />
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
