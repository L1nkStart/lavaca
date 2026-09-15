import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CrisisManager } from '@/components/crisis-manager'
import { ArrowLeft, HandHeart, AlertCircle, ExternalLink } from 'lucide-react'

export default async function CampaignCrisisPage({
    params,
}: {
    params: Promise<{ id: string }>
}) {
    const { id } = await params
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) redirect('/auth/login')

    const [{ data: campaign }, { data: profile }] = await Promise.all([
        supabase
            .from('campaigns')
            .select('id, creator_id, title, campaign_type, status, slug')
            .eq('id', id)
            .eq('creator_id', user.id)
            .maybeSingle(),
        supabase.from('users').select('full_name').eq('id', user.id).maybeSingle(),
    ])

    if (!campaign) redirect('/creator/campaigns')

    return (
        <div className="min-h-screen bg-muted/30 p-4">
            <div className="max-w-3xl mx-auto space-y-6">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center shrink-0">
                            <HandHeart className="h-5 w-5 text-white" />
                        </div>
                        <div className="min-w-0">
                            <h1 className="text-xl sm:text-2xl font-bold">Pagos directos</h1>
                            <p className="text-sm text-muted-foreground line-clamp-1">{campaign.title}</p>
                        </div>
                    </div>
                    <div className="flex shrink-0 gap-2">
                        {campaign.status === 'active' && (
                            <Button variant="outline" size="sm" className="hidden sm:inline-flex" asChild>
                                <Link href={`/campaigns/${campaign.id}`} target="_blank">
                                    <ExternalLink className="h-4 w-4 mr-2" />
                                    Ver campaña
                                </Link>
                            </Button>
                        )}
                        <Button variant="outline" size="sm" asChild>
                            <Link href="/creator/campaigns">
                                <ArrowLeft className="h-4 w-4 mr-2" />
                                Volver
                            </Link>
                        </Button>
                    </div>
                </div>

                {campaign.campaign_type !== 'crisis' ? (
                    <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                            Esta campaña no está en modo crisis. El pago directo se activa cuando un administrador
                            marca la campaña como "Crisis". Mientras tanto, sigues recibiendo donaciones por el método normal.
                        </AlertDescription>
                    </Alert>
                ) : campaign.status !== 'active' ? (
                    <Alert className="border-primary/30 bg-primary/5">
                        <AlertCircle className="h-4 w-4 text-primary" />
                        <AlertDescription className="text-foreground">
                            Tu campaña aún está en revisión. Deja tus cuentas listas desde ya: en cuanto se active, los
                            donantes las verán y podrás confirmar sus pagos aquí.
                        </AlertDescription>
                    </Alert>
                ) : null}

                <CrisisManager
                    campaignId={campaign.id}
                    isCrisis={campaign.campaign_type === 'crisis'}
                    defaultHolderName={profile?.full_name || ''}
                />
            </div>
        </div>
    )
}
