import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CreatorSidebar } from '@/components/creator-sidebar'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  PlusCircle,
  Eye,
  Heart,
  DollarSign,
  Clock,
  Edit,
  ExternalLink,
  AlertCircle,
  CheckCircle,
  XCircle,
  Camera
} from 'lucide-react'
import Link from 'next/link'

interface Campaign {
  id: string
  title: string
  slug: string
  story: string
  goal_amount_usd: number
  current_amount_usd: number
  status: 'draft' | 'pending_review' | 'active' | 'paused' | 'closed'
  urgency_level: 'low' | 'medium' | 'high' | 'critical'
  main_image_url: string | null
  location: string | null
  created_at: string
  updated_at: string
  categories: {
    name: string
    icon: string | null
  } | null
}

export default async function CreatorCampaignsPage() {
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

  // Get user's campaigns with category info
  const { data: campaigns, error: campaignsError } = await supabase
    .from('campaigns')
    .select(`
            *,
            categories (
                name,
                icon
            )
        `)
    .eq('creator_id', user.id)
    .order('created_at', { ascending: false })

  if (campaignsError) {
    console.error('Campaigns error:', campaignsError)
  }

  // Get campaign statistics
  const stats = {
    total: campaigns?.length || 0,
    active: campaigns?.filter(c => c.status === 'active').length || 0,
    pending: campaigns?.filter(c => c.status === 'pending_review').length || 0,
    totalRaised: campaigns?.reduce((sum, c) => sum + c.current_amount_usd, 0) || 0
  }

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'active': return 'default'
      case 'pending_review': return 'secondary'
      case 'draft': return 'outline'
      case 'closed': return 'outline'
      case 'paused': return 'destructive'
      default: return 'outline'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active': return 'Activa'
      case 'pending_review': return 'En Revisión'
      case 'draft': return 'Borrador'
      case 'closed': return 'Finalizada'
      case 'paused': return 'Pausada'
      default: return status
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <CheckCircle className="h-4 w-4" />
      case 'pending_review': return <Clock className="h-4 w-4" />
      case 'draft': return <Edit className="h-4 w-4" />
      case 'closed': return <XCircle className="h-4 w-4" />
      case 'paused': return <AlertCircle className="h-4 w-4" />
      default: return null
    }
  }

  const getUrgencyColor = (level: string) => {
    switch (level) {
      case 'critical': return 'text-red-600 bg-red-100'
      case 'high': return 'text-orange-600 bg-orange-100'
      case 'medium': return 'text-yellow-600 bg-yellow-100'
      case 'low': return 'text-blue-600 bg-blue-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  return (
    <div className="flex min-h-screen bg-background">
      <CreatorSidebar />

      <main className="flex-1 p-6 overflow-auto">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Mis Campañas</h1>
              <p className="text-muted-foreground">
                Gestiona y monitorea tus campañas de recaudación
              </p>
            </div>

            <Button asChild size="lg">
              <Link href="/creator/campaigns/create">
                <PlusCircle className="mr-2 h-5 w-5" />
                Nueva Campaña
              </Link>
            </Button>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Campañas</CardTitle>
                <Heart className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.total}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Activas</CardTitle>
                <CheckCircle className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{stats.active}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">En Revisión</CardTitle>
                <Clock className="h-4 w-4 text-yellow-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Recaudado</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${stats.totalRaised.toFixed(2)}</div>
              </CardContent>
            </Card>
          </div>

          {/* Campaigns List */}
          {campaigns && campaigns.length > 0 ? (
            <div className="space-y-4">
              {campaigns.map((campaign: Campaign) => {
                const progressPercentage = campaign.goal_amount_usd > 0
                  ? (campaign.current_amount_usd / campaign.goal_amount_usd) * 100
                  : 0

                return (
                  <Card key={campaign.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                    <CardContent className="p-0">
                      <div className="flex gap-6">
                        {/* Image */}
                        <div className="relative w-48 h-48 bg-muted flex-shrink-0">
                          {campaign.main_image_url ? (
                            <img
                              src={campaign.main_image_url}
                              alt={campaign.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-muted">
                              <Camera className="h-12 w-12 text-muted-foreground" />
                            </div>
                          )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 py-6 pr-6">
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <h3 className="font-bold text-xl line-clamp-2 flex-1">
                                  {campaign.title}
                                </h3>
                                <div className={`px-2 py-1 rounded-full text-xs ${getUrgencyColor(campaign.urgency_level)}`}>
                                  {campaign.urgency_level === 'critical' && 'Crítico'}
                                  {campaign.urgency_level === 'high' && 'Alto'}
                                  {campaign.urgency_level === 'medium' && 'Medio'}
                                  {campaign.urgency_level === 'low' && 'Bajo'}
                                </div>
                              </div>

                              <div className="flex items-center gap-4 mb-3">
                                <Badge variant={getStatusVariant(campaign.status)} className="flex items-center gap-1">
                                  {getStatusIcon(campaign.status)}
                                  {getStatusText(campaign.status)}
                                </Badge>

                                {campaign.categories && (
                                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                    {campaign.categories.icon && <span>{campaign.categories.icon}</span>}
                                    <span>{campaign.categories.name}</span>
                                  </div>
                                )}

                                {campaign.location && (
                                  <div className="text-sm text-muted-foreground">
                                    📍 {campaign.location}
                                  </div>
                                )}
                              </div>

                              <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                                {campaign.story}
                              </p>
                            </div>

                            <div className="flex gap-2 ml-4">
                              <Button size="sm" variant="outline" asChild>
                                <Link href={`/creator/campaigns/${campaign.id}/edit`}>
                                  <Edit className="h-4 w-4 mr-1" />
                                  Editar
                                </Link>
                              </Button>
                              {campaign.status === 'active' && (
                                <Button size="sm" variant="outline" asChild>
                                  <Link href={`/campaigns/${campaign.slug}`} target="_blank">
                                    <ExternalLink className="h-4 w-4 mr-1" />
                                    Ver
                                  </Link>
                                </Button>
                              )}
                            </div>
                          </div>

                          {/* Progress and Stats */}
                          <div className="space-y-4">
                            <div>
                              <div className="flex justify-between text-sm mb-2">
                                <span className="font-medium">
                                  ${campaign.current_amount_usd.toFixed(2)} recaudados
                                </span>
                                <span className="text-muted-foreground">
                                  Meta: ${campaign.goal_amount_usd.toFixed(2)}
                                </span>
                              </div>
                              <Progress value={Math.min(progressPercentage, 100)} className="h-2" />
                              <div className="text-right text-xs text-muted-foreground mt-1">
                                {progressPercentage.toFixed(1)}% completado
                              </div>
                            </div>

                            <div className="flex items-center justify-between text-sm text-muted-foreground">
                              <span>
                                Creada el {new Date(campaign.created_at).toLocaleDateString('es-VE')}
                              </span>
                              <span>
                                Actualizada el {new Date(campaign.updated_at).toLocaleDateString('es-VE')}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="max-w-md mx-auto">
                <Camera className="h-16 w-16 text-muted-foreground mx-auto mb-6" />
                <h3 className="text-lg font-medium mb-2">Aún no tienes campañas</h3>
                <p className="text-muted-foreground mb-6">
                  Comienza tu primera campaña de recaudación y comparte tu causa con el mundo.
                </p>
                <Button asChild size="lg">
                  <Link href="/creator/campaigns/create">
                    <PlusCircle className="mr-2 h-5 w-5" />
                    Crear Primera Campaña
                  </Link>
                </Button>
              </div>
            </div>
          )}

          {/* Education tip for new creators */}
          {campaigns && campaigns.length === 0 && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <div className="space-y-2">
                <div className="font-medium">Consejos para comenzar</div>
                <AlertDescription>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    <li>Sé transparente y honesto en tu historia</li>
                    <li>Incluye imágenes y documentos que respalden tu causa</li>
                    <li>Establece una meta realista y específica</li>
                    <li>Comparte tu campaña en redes sociales</li>
                  </ul>
                </AlertDescription>
              </div>
            </Alert>
          )}
        </div>
      </main>
    </div>
  )
}
