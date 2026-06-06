"use client"

import { useState, useEffect } from "react"
import { AdminSidebar } from "@/components/admin-sidebar"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { CheckCircle2, X, FileText, Loader2, AlertCircle, Image as ImageIcon } from 'lucide-react'
import { createClient } from "@/lib/supabase/client"

interface VerificationRequest {
  id: string
  user_id: string
  verification_type: 'individual' | 'company'
  full_name: string
  document_type: string
  document_number: string
  phone: string
  email: string
  address: string
  city: string | null
  state: string | null
  company_name: string | null
  company_rif: string | null
  company_type: string | null
  document_front_url: string
  document_back_url: string | null
  selfie_url: string
  proof_of_address_url: string | null
  company_registration_url: string | null
  status: string
  rejection_reason: string | null
  created_at: string
}

export default function AdminVerificationsPage() {
  const [verifications, setVerifications] = useState<VerificationRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [actionMessageType, setActionMessageType] = useState<'success' | 'error'>('success')
  const [rejectionReason, setRejectionReason] = useState("")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)

  const supabase = createClient()

  const extractPathFromStorageUrl = (url: string, bucket: string) => {
    const marker = `/object/public/${bucket}/`
    const markerAuthenticated = `/object/authenticated/${bucket}/`
    const markerSigned = `/object/sign/${bucket}/`

    const candidateMarker = [marker, markerAuthenticated, markerSigned].find((value) =>
      url.includes(value)
    )

    if (!candidateMarker) return null

    const rawPath = url.split(candidateMarker)[1]?.split('?')[0]
    if (!rawPath) return null
    return decodeURIComponent(rawPath)
  }

  const getSignedDocumentUrl = async (value: string | null) => {
    if (!value) return null

    const normalizedValue = value.replace('/verification-documents/', '/kyc-documents/')

    const pathCandidates = [
      extractPathFromStorageUrl(normalizedValue, 'kyc-documents'),
      extractPathFromStorageUrl(normalizedValue, 'verification-documents'),
      normalizedValue.startsWith('http') ? null : normalizedValue,
    ].filter(Boolean) as string[]

    for (const path of pathCandidates) {
      const tryBuckets = ['kyc-documents', 'verification-documents']

      for (const bucket of tryBuckets) {
        const { data, error } = await supabase.storage
          .from(bucket)
          .createSignedUrl(path, 60 * 60)

        if (!error && data?.signedUrl) {
          return data.signedUrl
        }
      }
    }

    return normalizedValue
  }

  const resolveVerificationDocumentUrls = async (verification: VerificationRequest): Promise<VerificationRequest> => {
    const [
      documentFrontUrl,
      documentBackUrl,
      selfieUrl,
      proofOfAddressUrl,
      companyRegistrationUrl,
    ] = await Promise.all([
      getSignedDocumentUrl(verification.document_front_url),
      getSignedDocumentUrl(verification.document_back_url),
      getSignedDocumentUrl(verification.selfie_url),
      getSignedDocumentUrl(verification.proof_of_address_url),
      getSignedDocumentUrl(verification.company_registration_url),
    ])

    return {
      ...verification,
      document_front_url: documentFrontUrl || verification.document_front_url,
      document_back_url: documentBackUrl,
      selfie_url: selfieUrl || verification.selfie_url,
      proof_of_address_url: proofOfAddressUrl,
      company_registration_url: companyRegistrationUrl,
    }
  }

  useEffect(() => {
    fetchVerifications()
  }, [])

  const fetchVerifications = async () => {
    try {
      setLoading(true)
      const { data, error: fetchError } = await supabase
        .from('verification_requests')
        .select('*')
        .order('created_at', { ascending: false })

      if (fetchError) throw fetchError

      const resolvedVerifications = await Promise.all(
        (data || []).map((verification) => resolveVerificationDocumentUrls(verification as VerificationRequest))
      )

      setVerifications(resolvedVerifications)
    } catch (err: any) {
      console.error('Error fetching verifications:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (id: string) => {
    try {
      setProcessing(true)
      setActionMessage(null)
      const response = await fetch(`/api/admin/verifications/${id}/decision`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ decision: 'approved' }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result?.error || result?.details || 'No se pudo aprobar la verificación')
      }

      setActionMessageType('success')
      setActionMessage('Verificación aprobada exitosamente.')
      fetchVerifications()
    } catch (err: any) {
      console.error('Error approving:', err)
      setActionMessageType('error')
      setActionMessage('Error al aprobar: ' + err.message)
    } finally {
      setProcessing(false)
    }
  }

  const handleReject = async (id: string) => {
    if (!rejectionReason.trim()) {
      setActionMessageType('error')
      setActionMessage('Debes ingresar una razón para el rechazo.')
      return
    }

    try {
      setProcessing(true)
      setActionMessage(null)
      const response = await fetch(`/api/admin/verifications/${id}/decision`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          decision: 'rejected',
          rejectionReason,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result?.error || result?.details || 'No se pudo rechazar la verificación')
      }

      setActionMessageType('success')
      setActionMessage('Verificación rechazada. El motivo fue guardado y el usuario podrá enviar una nueva solicitud.')
      setRejectionReason('')
      setSelectedId(null)
      fetchVerifications()
    } catch (err: any) {
      console.error('Error rejecting:', err)
      setActionMessageType('error')
      setActionMessage('Error al rechazar: ' + err.message)
    } finally {
      setProcessing(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { color: string; text: string }> = {
      pending: { color: 'bg-yellow-500', text: 'Pendiente' },
      under_review: { color: 'bg-blue-500', text: 'En revisión' },
      approved: { color: 'bg-green-500', text: 'Aprobado' },
      rejected: { color: 'bg-red-500', text: 'Rechazado' },
    }
    const variant = variants[status] || variants.pending
    return <Badge className={variant.color}>{variant.text}</Badge>
  }

  const getTimeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime()
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (days > 0) return `Hace ${days} día${days > 1 ? 's' : ''}`
    if (hours > 0) return `Hace ${hours} hora${hours > 1 ? 's' : ''}`
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
            <AlertDescription>Error al cargar verificaciones: {error}</AlertDescription>
          </Alert>
        </main>
      </div>
    )
  }

  const pendingCount = verifications.filter(v => v.status === 'pending').length

  return (
    <div className="flex min-h-screen bg-background">
      <AdminSidebar />

      <main className="flex-1 overflow-auto">
        {/* Header */}
        <div className="border-b border-border bg-card sticky top-0 z-40">
          <div className="px-4 sm:px-8 py-4 sm:py-6">
            <h1 className="text-3xl font-bold">Verificaciones KYC</h1>
            <p className="text-muted-foreground mt-1">
              {pendingCount} verificación{pendingCount !== 1 ? 'es' : ''} pendiente{pendingCount !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        <div className="p-4 sm:p-8 space-y-4">
          {actionMessage && (
            <Alert variant={actionMessageType === 'error' ? 'destructive' : 'default'}>
              {actionMessageType === 'error' ? (
                <AlertCircle className="h-4 w-4" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              <AlertDescription>{actionMessage}</AlertDescription>
            </Alert>
          )}

          {verifications.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No hay verificaciones para revisar</p>
              </CardContent>
            </Card>
          ) : (
            verifications.map((verification) => (
              <Card key={verification.id}>
                <CardContent className="pt-6">
                  {(() => {
                    const documentFrontUrl = verification.document_front_url
                    const documentBackUrl = verification.document_back_url
                    const selfieUrl = verification.selfie_url
                    const proofOfAddressUrl = verification.proof_of_address_url
                    const companyRegistrationUrl = verification.company_registration_url

                    return (
                      <Tabs defaultValue="details" className="space-y-4">
                        {/* Header */}
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <h3 className="font-bold text-lg">{verification.full_name}</h3>
                            <p className="text-sm text-muted-foreground">
                              {verification.verification_type === 'individual' ? '👤 Persona Natural' : '🏢 Empresa'}
                            </p>
                            {verification.company_name && (
                              <p className="text-sm font-medium mt-1">{verification.company_name}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {getStatusBadge(verification.status)}
                            <Badge variant="secondary">
                              {getTimeAgo(verification.created_at)}
                            </Badge>
                          </div>
                        </div>

                        {/* Tabs */}
                        <TabsList>
                          <TabsTrigger value="details">Detalles</TabsTrigger>
                          <TabsTrigger value="documents">Documentos</TabsTrigger>
                        </TabsList>

                        {/* Details Tab */}
                        <TabsContent value="details" className="space-y-4">
                          <div className="grid md:grid-cols-2 gap-4">
                            <div>
                              <p className="text-xs text-muted-foreground">Email</p>
                              <p className="font-medium">{verification.email}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Teléfono</p>
                              <p className="font-medium">{verification.phone}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Tipo de documento</p>
                              <p className="font-medium capitalize">{verification.document_type}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Número</p>
                              <p className="font-medium">{verification.document_number}</p>
                            </div>
                            <div className="md:col-span-2">
                              <p className="text-xs text-muted-foreground">Dirección</p>
                              <p className="font-medium">{verification.address}</p>
                              {verification.city && verification.state && (
                                <p className="text-sm text-muted-foreground">
                                  {verification.city}, {verification.state}
                                </p>
                              )}
                            </div>
                            {verification.company_rif && (
                              <>
                                <div>
                                  <p className="text-xs text-muted-foreground">RIF</p>
                                  <p className="font-medium">{verification.company_rif}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground">Tipo de empresa</p>
                                  <p className="font-medium">{verification.company_type}</p>
                                </div>
                              </>
                            )}
                          </div>
                        </TabsContent>

                        {/* Documents Tab */}
                        <TabsContent value="documents" className="space-y-4">
                          <div className="grid md:grid-cols-2 gap-4">
                            {/* Document Front */}
                            <div className="border border-border rounded-lg p-4">
                              <div className="flex items-center gap-2 mb-3">
                                <ImageIcon className="w-4 h-4 text-primary" />
                                <p className="font-medium text-sm">Documento (Frente)</p>
                              </div>
                              <a
                                href={documentFrontUrl || '#'}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block bg-muted rounded-lg overflow-hidden aspect-video hover:opacity-80 transition-opacity"
                              >
                                <img
                                  src={documentFrontUrl || ''}
                                  alt="Documento frente"
                                  className="w-full h-full object-contain"
                                />
                              </a>
                            </div>

                            {/* Document Back */}
                            {documentBackUrl && (
                              <div className="border border-border rounded-lg p-4">
                                <div className="flex items-center gap-2 mb-3">
                                  <ImageIcon className="w-4 h-4 text-primary" />
                                  <p className="font-medium text-sm">Documento (Reverso)</p>
                                </div>
                                <a
                                  href={documentBackUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="block bg-muted rounded-lg overflow-hidden aspect-video hover:opacity-80 transition-opacity"
                                >
                                  <img
                                    src={documentBackUrl}
                                    alt="Documento reverso"
                                    className="w-full h-full object-contain"
                                  />
                                </a>
                              </div>
                            )}

                            {/* Selfie */}
                            <div className="border border-border rounded-lg p-4">
                              <div className="flex items-center gap-2 mb-3">
                                <ImageIcon className="w-4 h-4 text-primary" />
                                <p className="font-medium text-sm">Selfie con Documento</p>
                              </div>
                              <a
                                href={selfieUrl || '#'}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block bg-muted rounded-lg overflow-hidden aspect-video hover:opacity-80 transition-opacity"
                              >
                                <img
                                  src={selfieUrl || ''}
                                  alt="Selfie"
                                  className="w-full h-full object-contain"
                                />
                              </a>
                            </div>

                            {/* Proof of Address */}
                            {proofOfAddressUrl && (
                              <div className="border border-border rounded-lg p-4">
                                <div className="flex items-center gap-2 mb-3">
                                  <FileText className="w-4 h-4 text-primary" />
                                  <p className="font-medium text-sm">Comprobante de Domicilio</p>
                                </div>
                                <a
                                  href={proofOfAddressUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="block bg-muted rounded-lg overflow-hidden aspect-video hover:opacity-80 transition-opacity"
                                >
                                  <img
                                    src={proofOfAddressUrl}
                                    alt="Comprobante"
                                    className="w-full h-full object-contain"
                                  />
                                </a>
                              </div>
                            )}

                            {/* Company Registration */}
                            {companyRegistrationUrl && (
                              <div className="border border-border rounded-lg p-4 md:col-span-2">
                                <div className="flex items-center gap-2 mb-3">
                                  <FileText className="w-4 h-4 text-primary" />
                                  <p className="font-medium text-sm">Registro Mercantil</p>
                                </div>
                                <a
                                  href={companyRegistrationUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="block bg-muted rounded-lg overflow-hidden aspect-video max-w-md hover:opacity-80 transition-opacity"
                                >
                                  <img
                                    src={companyRegistrationUrl}
                                    alt="Registro"
                                    className="w-full h-full object-contain"
                                  />
                                </a>
                              </div>
                            )}
                          </div>
                        </TabsContent>

                        {/* Actions */}
                        {verification.status === 'pending' && (
                          <div className="border-t border-border pt-4 space-y-3">
                            {selectedId !== verification.id ? (
                              <div className="flex gap-3">
                                <Button
                                  size="sm"
                                  className="flex-1 bg-primary"
                                  onClick={() => handleApprove(verification.id)}
                                  disabled={processing}
                                >
                                  {processing ? (
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                  ) : (
                                    <CheckCircle2 className="w-4 h-4 mr-2" />
                                  )}
                                  Aprobar
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  className="flex-1"
                                  onClick={() => setSelectedId(verification.id)}
                                  disabled={processing}
                                >
                                  <X className="w-4 h-4 mr-2" />
                                  Rechazar
                                </Button>
                              </div>
                            ) : (
                              <>
                                <Alert variant="destructive">
                                  <AlertCircle className="h-4 w-4" />
                                  <AlertDescription>
                                    Esta acción marcará la verificación como rechazada y guardará el motivo para que el usuario pueda corregir y reenviar su solicitud.
                                  </AlertDescription>
                                </Alert>
                                <Textarea
                                  placeholder="Explica por qué rechazas esta verificación..."
                                  value={rejectionReason}
                                  onChange={(e) => setRejectionReason(e.target.value)}
                                  rows={3}
                                />
                                <div className="flex gap-3">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="flex-1"
                                    onClick={() => {
                                      setSelectedId(null)
                                      setRejectionReason('')
                                    }}
                                    disabled={processing}
                                  >
                                    Cancelar
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    className="flex-1"
                                    onClick={() => handleReject(verification.id)}
                                    disabled={processing}
                                  >
                                    {processing ? (
                                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    ) : (
                                      <X className="w-4 h-4 mr-2" />
                                    )}
                                    Confirmar rechazo
                                  </Button>
                                </div>
                              </>
                            )}
                          </div>
                        )}

                        {verification.status === 'approved' && (
                          <Alert className="border-green-200 bg-green-50">
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                            <AlertDescription className="text-green-800">
                              Verificación aprobada exitosamente
                            </AlertDescription>
                          </Alert>
                        )}

                        {verification.status === 'rejected' && (
                          <Alert variant="destructive">
                            <X className="h-4 w-4" />
                            <AlertDescription>
                              <strong>Rechazado:</strong> {verification.rejection_reason || 'Sin razón especificada'}
                            </AlertDescription>
                          </Alert>
                        )}
                      </Tabs>
                    )
                  })()}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </main>
    </div>
  )
}
