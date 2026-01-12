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
  amount_usd: number
  payment_method: string
  payment_reference: string | null
  payment_status: string
  created_at: string
  campaigns: {
    title: string
    slug: string
  }
  users: {
    full_name: string
    email: string
  }
}

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([])
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
          status: 'completed'
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
          status: 'failed',
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
          <div className="px-8 py-6">
            <h1 className="text-3xl font-bold">Pagos Manuales</h1>
            <p className="text-muted-foreground mt-1">
              {payments.length} pago{payments.length !== 1 ? 's' : ''} pendiente{payments.length !== 1 ? 's' : ''} de verificación
            </p>
          </div>
        </div>

        <div className="p-8 space-y-4">
          {payments.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <CheckCircle2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No hay pagos pendientes de verificación</p>
              </CardContent>
            </Card>
          ) : (
            payments.map((payment) => (
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
                          Enviado por {payment.users?.full_name || 'Anónimo'}
                        </span>
                        {payment.users?.email && (
                          <>
                            <span className="text-xs text-muted-foreground">•</span>
                            <span className="text-xs text-muted-foreground">
                              {payment.users.email}
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
                    {payment.payment_reference && (
                      <div>
                        <p className="text-xs text-muted-foreground">Referencia</p>
                        <p className="font-mono text-sm break-all">
                          {payment.payment_reference}
                        </p>
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
