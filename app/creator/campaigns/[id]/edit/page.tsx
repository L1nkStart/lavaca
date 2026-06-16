import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { EditCampaignForm } from '@/components/edit-campaign-form'
import { InviteGuarantorDialog } from '@/components/invite-guarantor-dialog'
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
      current_amount_usd,
      original_goal_amount_usd,
      status,
      main_image_url,
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

    // Donaciones completadas: si las hay, los documentos de soporte se vuelven
    // inmutables (solo se pueden agregar, no borrar) — evidencia anti-fraude.
    const { count: completedDonations } = await supabase
        .from('donations')
        .select('id', { count: 'exact', head: true })
        .eq('campaign_id', id)
        .eq('payment_status', 'completed')

    // Cambios de imagen en revisión (cola de moderación).
    const { data: pendingMediaChanges } = await supabase
        .from('campaign_media_changes')
        .select('id, change_type, proposed_url, previous_url, status, created_at')
        .eq('campaign_id', id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })

    const campaignWithDetails = {
        ...campaign,
        campaign_details: campaignDetails || null,
        has_completed_donations: (completedDonations || 0) > 0,
        pending_media_changes: pendingMediaChanges || [],
    }

    const { data: categories } = await supabase
        .from('categories')
        .select('id, name, icon_emoji')
        .order('name')

    return (
        <div className="min-h-screen bg-background p-4">
            <div className="max-w-4xl mx-auto space-y-6">
                <div className="space-y-2">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center shrink-0">
                                <FilePenLine className="h-5 w-5 text-primary-foreground" />
                            </div>
                            <div className="min-w-0">
                                <h1 className="text-xl sm:text-2xl font-bold">Editar campaña</h1>
                                <p className="text-sm text-muted-foreground">Gestiona tu historia, documentos y actualizaciones.</p>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            <InviteGuarantorDialog campaignId={id} />
                            <Button variant="outline" asChild>
                                <Link href="/creator/campaigns">Finalizar</Link>
                            </Button>
                        </div>
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
