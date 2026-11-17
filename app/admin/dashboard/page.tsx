"use client"

import { useState, useEffect } from "react"
import { AdminSidebar } from "@/components/admin-sidebar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { AlertCircle, TrendingUp, Users, FileText, CreditCard, Loader2 } from 'lucide-react'
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"

interface DashboardStats {
  totalUsers: number
  totalCampaigns: number
  activeCampaigns: number
  totalDonations: number
  totalDonationAmount: number
  pendingVerifications: number
  pendingPayments: number
  platformFees: number
}

interface ChartData {
  date: string
  donations: number
  campaigns: number
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [chartData, setChartData] = useState<ChartData[]>([])
  const [recentVerifications, setRecentVerifications] = useState<any[]>([])
  const [recentPayments, setRecentPayments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const supabase = createClient()

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      setLoading(true)

      // Fetch all data in parallel
      const [
        usersResult,
        campaignsResult,
        donationsResult,
        verificationsResult,
        paymentsResult,
        chartDataResult
      ] = await Promise.all([
        // Total users
        supabase.from('users').select('id', { count: 'exact', head: true }),

        // Campaigns
        supabase.from('campaigns').select('id, status, current_amount_usd', { count: 'exact' }),

        // Donations (la columna correcta es payment_status, no status)
        supabase.from('donations').select('id, amount_usd, payment_status', { count: 'exact' }),

        // Pending verifications
        supabase.from('verification_requests')
          .select('*')
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(3),

        // Pending payments (donations waiting for approval). Los pagos
        // directos de modo crisis (is_direct) los confirma el organizador,
        // no el personal de LaVaca, así que no cuentan como pendientes aquí.
        supabase.from('donations')
          .select(`
            *,
            campaigns (
              title,
              slug
            )
          `, { count: 'exact' })
          .eq('payment_status', 'pending')
          .eq('is_direct', false)
          .order('created_at', { ascending: false })
          .limit(3),

        // Chart data - last 15 days
        supabase.from('donations')
          .select('created_at, amount_usd, payment_status')
          .gte('created_at', new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString())
          .eq('payment_status', 'completed')
      ])

      // Calculate stats
      const totalUsers = usersResult.count || 0
      const totalCampaigns = campaignsResult.count || 0
      const activeCampaigns = campaignsResult.data?.filter(c => c.status === 'active').length || 0
      const totalDonations = donationsResult.count || 0

      // Sum from campaigns.current_amount_usd instead of donations
      const totalDonationAmount = campaignsResult.data
        ?.reduce((sum, c) => sum + (c.current_amount_usd || 0), 0) || 0

      const platformFees = totalDonationAmount * 0.02 // 2% platform fee

      const pendingVerifications = verificationsResult.data?.length || 0
      const pendingPayments = paymentsResult.count ?? paymentsResult.data?.length ?? 0

      setStats({
        totalUsers,
        totalCampaigns,
        activeCampaigns,
        totalDonations,
        totalDonationAmount,
        pendingVerifications,
        pendingPayments,
        platformFees
      })

      setRecentVerifications(verificationsResult.data || [])
      setRecentPayments(paymentsResult.data || [])

      // Process chart data
      if (chartDataResult.data) {
        const groupedByDate = chartDataResult.data.reduce((acc: any, donation: any) => {
          const date = new Date(donation.created_at).toLocaleDateString('es-ES', {
            month: 'short',
            day: 'numeric'
          })

          if (!acc[date]) {
            acc[date] = { date, donations: 0, amount: 0 }
          }

          acc[date].donations += 1
          acc[date].amount += donation.amount_usd || 0

          return acc
        }, {})

        const chartArray = Object.values(groupedByDate).slice(-10) as ChartData[]
        setChartData(chartArray)
      }

    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  const getTimeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime()
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (days > 0) return `Hace ${days}d`
    if (hours > 0) return `Hace ${hours}h`
    return 'Hace poco'
  }

  if (loading) {
    return (
      <div className="flex flex-col md:flex-row min-h-screen bg-background">
        <AdminSidebar />
        <main className="flex-1 min-w-0 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </main>
      </div>
    )
  }

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-background">
      <AdminSidebar />

      <main className="flex-1 min-w-0 overflow-auto">
        {/* Header */}
        <div className="border-b border-border bg-card">
          <div className="px-4 sm:px-8 py-4 sm:py-6">
            <h1 className="text-2xl sm:text-3xl font-bold">Panel de Administración</h1>
            <p className="text-sm sm:text-base text-muted-foreground mt-1">
              Bienvenido. Aquí puedes gestionar la plataforma.
            </p>
          </div>
        </div>

        <div className="p-4 sm:p-8 space-y-6 sm:space-y-8">
          {/* Alert */}
          {stats && stats.pendingVerifications > 0 && (
            <Card className="border-yellow-200 bg-yellow-50 dark:bg-yellow-950 dark:border-yellow-800">
              <CardContent className="pt-6 flex items-start gap-3 sm:gap-4">
                <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-yellow-900 dark:text-yellow-100">
                    {stats.pendingVerifications} verificaciones pendientes
                  </h3>
                  <p className="text-sm text-yellow-800 dark:text-yellow-200 mt-1">
                    Hay creadores esperando verificación. Revisa la cola de verificaciones.
                  </p>
                  <Button size="sm" className="mt-3" asChild>
                    <Link href="/admin/verifications">Ir a verificaciones</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            <Card>
              <CardHeader className="pb-3 px-4 sm:px-6">
                <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground flex items-center gap-2 leading-tight">
                  <Users className="w-4 h-4 shrink-0" />
                  Usuarios totales
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 sm:px-6">
                <p className="text-xl sm:text-2xl font-bold break-words">{stats?.totalUsers.toLocaleString() || 0}</p>
                <p className="text-xs text-muted-foreground mt-1">Registrados</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3 px-4 sm:px-6">
                <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground flex items-center gap-2 leading-tight">
                  <FileText className="w-4 h-4 shrink-0" />
                  Campañas activas
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 sm:px-6">
                <p className="text-xl sm:text-2xl font-bold break-words">{stats?.activeCampaigns || 0}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  De {stats?.totalCampaigns || 0} totales
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3 px-4 sm:px-6">
                <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground flex items-center gap-2 leading-tight">
                  <CreditCard className="w-4 h-4 shrink-0" />
                  Donaciones
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 sm:px-6">
                <p className="text-xl sm:text-2xl font-bold break-words">
                  ${stats?.totalDonationAmount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) || 0}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats?.totalDonations || 0} donaciones
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3 px-4 sm:px-6">
                <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground flex items-center gap-2 leading-tight">
                  <TrendingUp className="w-4 h-4 shrink-0" />
                  Comisión plataforma
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 sm:px-6">
                <p className="text-xl sm:text-2xl font-bold break-words">
                  ${stats?.platformFees.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) || 0}
                </p>
                <p className="text-xs text-muted-foreground mt-1">2% de las donaciones</p>
              </CardContent>
            </Card>
          </div>

          {/* Chart */}
          {chartData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Actividad últimos días</CardTitle>
              </CardHeader>
              <CardContent className="px-2 sm:px-6">
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis width={36} allowDecimals={false} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="donations"
                      stroke="#1a7f64"
                      name="Donaciones"
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Queues */}
          <div className="grid md:grid-cols-2 gap-4">
            {/* Verification Queue */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <CardTitle>Cola de Verificaciones</CardTitle>
                  <Badge className="bg-accent">{stats?.pendingVerifications || 0}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {recentVerifications.length > 0 ? (
                  <>
                    {recentVerifications.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between gap-3 py-2 border-b border-border last:border-0"
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{item.full_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.verification_type === 'individual' ? 'Persona Natural' : 'Empresa'}
                          </p>
                        </div>
                        <p className="text-xs text-muted-foreground shrink-0">{getTimeAgo(item.created_at)}</p>
                      </div>
                    ))}
                    <Button variant="outline" className="w-full mt-4" asChild>
                      <Link href="/admin/verifications">Ver todas</Link>
                    </Button>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No hay verificaciones pendientes
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Manual Payments Queue */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <CardTitle>Pagos Pendientes</CardTitle>
                  <Badge className="bg-accent">{stats?.pendingPayments || 0}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {recentPayments.length > 0 ? (
                  <>
                    {recentPayments.map((item: any, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between gap-3 py-2 border-b border-border last:border-0"
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-sm line-clamp-1">
                            {item.campaigns?.title || 'Campaña'}
                          </p>
                          <p className="text-xs text-muted-foreground">{getTimeAgo(item.created_at)}</p>
                        </div>
                        <p className="font-bold text-primary text-sm shrink-0 whitespace-nowrap">
                          {item.currency === 'BS' && item.amount_bs != null
                            ? `Bs ${new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(item.amount_bs))}`
                            : `$${item.amount_usd.toFixed(2)}`}
                        </p>
                      </div>
                    ))}
                    <Button variant="outline" className="w-full mt-4" asChild>
                      <Link href="/admin/payments">Ver todas</Link>
                    </Button>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No hay pagos pendientes
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
