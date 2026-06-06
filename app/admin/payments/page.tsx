"use client"

import { useState, useEffect } from "react"
import { AdminSidebar } from "@/components/admin-sidebar"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { CheckCircle2, X, Loader2, AlertCircle, ExternalLink } from 'lucide-react'
import { createClient } from "@/lib/supabase/client"
import Link from "next/link"

interface Payment {
  id: string
  campaign_id: string
  donor_id: string
  donor_name: string | null
  email: string
  is_anonymous: boolean
  amount_usd: number
  payment_method: string
  reference_number: string | null
  payment_status: string
  capture_url: string | null
  created_at: string
  campaigns: {
    title: string
    slug: string
  }
  users: {
    full_name: string
    email: string
  } | null
}

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([])
  const [methodFilter, setMethodFilter] = useState<'all' | 'zelle' | 'pagomovil' | 'transfer'>('all')
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [notes, setNotes] = useState("")
  const [processing, setProcessing] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    fetchPayments()
  }, [])

  const fetchPayments = async () => {
    try {
      setLoading(true)
      const { data, error: fetchError } = await supabase
        .from('donations')
        .select(`
          *,
          campaigns (
            title,
            slug
          ),
          users:donor_id (
            full_name,
            email
          )
        `)
        .eq('payment_status', 'pending')
        .order('created_at', { ascending: false })

      if (fetchError) throw fetchError

      setPayments(data || [])
    } catch (err: any) {
      console.error('Error fetching payments:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (id: string) => {
    if (!confirm('¿Estás seguro de aprobar este pago?')) return

    try {
      setProcessing(true)
      const { error: updateError } = await supabase
        .from('donations')
        .update({
          payment_status: 'completed',
        })
        .eq('id', id)

      if (updateError) throw updateError

      alert('✅ Pago aprobado y acreditado exitosamente')
      fetchPayments()
    } catch (err: any) {
      console.error('Error approving payment:', err)
      alert('Error al aprobar: ' + err.message)
    } finally {
      setProcessing(false)
    }
  }

  const handleReject = async (id: string) => {
    if (!notes.trim()) {
      alert('Por favor ingresa una razón para el rechazo')
      return
    }

    if (!confirm('¿Estás seguro de rechazar este pago?')) return

    try {
      setProcessing(true)
      const { error: updateError } = await supabase
        .from('donations')
        .update({
          payment_status: 'rejected',
          admin_notes: notes
        })
        .eq('id', id)

      if (updateError) throw updateError

      alert('❌ Pago rechazado')
      setNotes('')
      setSelectedId(null)
      fetchPayments()
    } catch (err: any) {
      console.error('Error rejecting payment:', err)
      alert('Error al rechazar: ' + err.message)
    } finally {
      setProcessing(false)
    }
  }

  const getTimeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime()
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)
    const minutes = Math.floor(diff / 60000)

    if (days > 0) return `Hace ${days} día${days > 1 ? 's' : ''}`
    if (hours > 0) return `Hace ${hours} hora${hours > 1 ? 's' : ''}`
    if (minutes > 0) return `Hace ${minutes} min`
    return 'Hace poco'
  }

  const getDonorDisplayName = (payment: Payment) => {
    if (payment.is_anonymous) return 'Donante anónimo'
    return payment.users?.full_name || payment.donor_name || 'Donante'
  }

  const getDonorContactEmail = (payment: Payment) => {
    return payment.email || payment.users?.email || null
  }

  const filteredPayments = payments.filter((payment) => {
    if (methodFilter === 'all') return true
    return payment.payment_method === methodFilter
  })

  const visiblePayments = [...filteredPayments].sort((a, b) => {
    const aTime = new Date(a.created_at).getTime()
    const bTime = new Date(b.created_at).getTime()
    return sortOrder === 'newest' ? bTime - aTime : aTime - bTime
  })

  if (loading) {
    return (
      <div className="flex min-h-screen bg-background">
        <AdminSidebar />
        <main className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </main>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-screen bg-background">
        <AdminSidebar />
        <main className="flex-1 p-8">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>Error al cargar pagos: {error}</AlertDescription>
          </Alert>
        </main>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-background">
      <AdminSidebar />

      <main className="flex-1 overflow-auto">
        {/* Header */}
        <div className="border-b border-border bg-card sticky top-0 z-40">
          <div className="px-4 sm:px-8 py-4 sm:py-6">
            <h1 className="text-3xl font-bold">Pagos Manuales</h1>
            <p className="text-muted-foreground mt-1">
              {filteredPayments.length} pago{filteredPayments.length !== 1 ? 's' : ''} pendiente{filteredPayments.length !== 1 ? 's' : ''} de verificación
            </p>
          </div>
        </div>

        <div className="p-4 sm:p-8 space-y-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant={methodFilter === 'all' ? 'default' : 'outline'}
                  onClick={() => setMethodFilter('all')}
                >
                  Todos ({payments.length})
                </Button>
                <Button
                  size="sm"
                  variant={methodFilter === 'zelle' ? 'default' : 'outline'}
                  onClick={() => setMethodFilter('zelle')}
                >
                  Zelle ({payments.filter((payment) => payment.payment_method === 'zelle').length})
                </Button>
                <Button
                  size="sm"
                  variant={methodFilter === 'pagomovil' ? 'default' : 'outline'}
                  onClick={() => setMethodFilter('pagomovil')}
                >
                  Pago Móvil ({payments.filter((payment) => payment.payment_method === 'pagomovil').length})
                </Button>
                <Button
                  size="sm"
                  variant={methodFilter === 'transfer' ? 'default' : 'outline'}
                  onClick={() => setMethodFilter('transfer')}
                >
                  Transferencia ({payments.filter((payment) => payment.payment_method === 'transfer').length})
                </Button>
              </div>

              <div className="flex flex-wrap gap-2 mt-3">
                <Button
                  size="sm"
                  variant={sortOrder === 'newest' ? 'default' : 'outline'}
                  onClick={() => setSortOrder('newest')}
                >
                  Más recientes
                </Button>
                <Button
                  size="sm"
                  variant={sortOrder === 'oldest' ? 'default' : 'outline'}
                  onClick={() => setSortOrder('oldest')}
                >
                  Más antiguos
                </Button>
              </div>
            </CardContent>
          </Card>

          {filteredPayments.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <CheckCircle2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No hay pagos pendientes para este filtro</p>
              </CardContent>
            </Card>
          ) : (
            visiblePayments.map((payment) => (
              <Card key={payment.id}>
                <CardContent className="pt-6 space-y-4">
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-bold text-lg mb-1">
                        {payment.campaigns?.title || 'Campaña desconocida'}
                      </h3>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline">{payment.payment_method}</Badge>
                        <span className="text-xs text-muted-foreground">
                          Enviado por {getDonorDisplayName(payment)}
                        </span>
                        {getDonorContactEmail(payment) && (
                          <>
                            <span className="text-xs text-muted-foreground">•</span>
                            <span className="text-xs text-muted-foreground">
                              {getDonorContactEmail(payment)}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-primary">
                        ${payment.amount_usd.toFixed(2)}
                      </p>
                      <p className="text-xs text-muted-foreground">USD</p>
                    </div>
                  </div>

                  {/* Payment Details */}
                  <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                    {payment.reference_number && (
                      <div>
                        <p className="text-xs text-muted-foreground">Referencia</p>
                        <p className="font-mono text-sm break-all">
                          {payment.reference_number}
                        </p>
                      </div>
                    )}

                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground">Nombre de contacto</p>
                        <p className="font-medium">{payment.donor_name || payment.users?.full_name || 'No disponible'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Email de contacto</p>
                        <p className="font-medium break-all">{getDonorContactEmail(payment) || 'No disponible'}</p>
                      </div>
                    </div>

                    {!payment.reference_number && payment.payment_method === 'zelle' && (
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          Esta donación por Zelle no tiene referencia registrada. Verifica manualmente antes de aprobar.
                        </AlertDescription>
                      </Alert>
                    )}

                    {payment.capture_url && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Comprobante</p>
                        <a
                          href={payment.capture_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 text-xs text-primary hover:underline"
                        >
                          <ExternalLink className="w-3 h-3" />
                          Ver comprobante adjunto
                        </a>
                        {/\.(jpe?g|png|webp)(\?|$)/i.test(payment.capture_url) && (
                          <a
                            href={payment.capture_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block mt-2"
                          >
                            <img
                              src={payment.capture_url}
                              alt="Comprobante de pago"
                              className="max-h-48 sm:max-h-64 rounded border border-border object-contain bg-muted/30"
                            />
                          </a>
                        )}
                      </div>
                    )}

                    <div className="grid md:grid-cols-3 gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground">Método</p>
                        <p className="font-medium">{payment.payment_method}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Reportado</p>
                        <p className="font-medium">{getTimeAgo(payment.created_at)}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(payment.created_at).toLocaleDateString('es-ES', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">ID</p>
                        <p className="font-mono text-xs">{payment.id.slice(0, 8)}...</p>
                      </div>
                    </div>

                    {/* Link to campaign */}
                    {payment.campaigns?.slug && (
                      <div className="pt-2 border-t">
                        <Link
                          href={`/campaigns/${payment.campaigns.slug}`}
                          target="_blank"
                          className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                        >
                          Ver campaña
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                      </div>
                    )}
                  </div>

                  {/* Notes/Rejection Reason */}
                  {selectedId === payment.id && (
                    <>
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          Al rechazar, el pago no será acreditado y se notificará al donante.
                        </AlertDescription>
                      </Alert>
                      <Textarea
                        placeholder="Razón del rechazo (será visible para el donante)..."
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        rows={3}
                      />
                    </>
                  )}

                  {/* Actions */}
                  <div className="flex gap-3 border-t border-border pt-4">
                    {selectedId !== payment.id ? (
                      <>
                        <Button
                          size="sm"
                          className="flex-1 bg-primary"
                          onClick={() => handleApprove(payment.id)}
                          disabled={processing}
                        >
                          {processing ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <CheckCircle2 className="w-4 h-4 mr-2" />
                          )}
                          Aprobar pago
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          onClick={() => setSelectedId(payment.id)}
                          disabled={processing}
                        >
                          <X className="w-4 h-4 mr-2" />
                          Rechazar
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          onClick={() => {
                            setSelectedId(null)
                            setNotes('')
                          }}
                          disabled={processing}
                        >
                          Cancelar
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="flex-1"
                          onClick={() => handleReject(payment.id)}
                          disabled={processing}
                        >
                          {processing ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <X className="w-4 h-4 mr-2" />
                          )}
                          Confirmar rechazo
                        </Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </main>
    </div>
  )
}
