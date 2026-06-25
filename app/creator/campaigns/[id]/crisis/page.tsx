import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CrisisManager } from '@/components/crisis-manager'
import { ArrowLeft, ShieldAlert, AlertCircle } from 'lucide-react'

export default async function CampaignCrisisPage({
    params,
}: {
    params: Promise<{ id: string }>
}) {
    const { id } = await params
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) redirect('/auth/login')

    const { data: campaign } = await supabase
        .from('campaigns')
        .select('id, creator_id, title, campaign_type, status, slug')
        .eq('id', id)
        .eq('creator_id', user.id)
        .maybeSingle()

    if (!campaign) redirect('/creator/campaigns')

    return (
        <div className="min-h-screen bg-muted/30 p-4">
            <div className="max-w-3xl mx-auto space-y-6">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center shrink-0">
                            <ShieldAlert className="h-5 w-5 text-white" />
                        </div>
                        <div className="min-w-0">
                            <h1 className="text-xl sm:text-2xl font-bold">Modo crisis</h1>
                            <p className="text-sm text-muted-foreground line-clamp-1">{campaign.title}</p>
                        </div>
                    </div>
                    <Button variant="outline" asChild>
                        <Link href="/creator/campaigns">
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Volver
                        </Link>
                    </Button>
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
                    <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                            Tu campaña aún no está activa. Podrás recibir y confirmar pagos directos una vez que sea aprobada.
                            Puedes ir cargando tus cuentas para recibir desde ya.
                        </AlertDescription>
                    </Alert>
                ) : null}

                <CrisisManager
                    campaignId={campaign.id}
                    isCrisis={campaign.campaign_type === 'crisis'}
                />
            </div>
        </div>
    )
}
