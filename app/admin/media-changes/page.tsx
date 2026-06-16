"use client"

import { useEffect, useState } from "react"
import { AdminSidebar } from "@/components/admin-sidebar"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, AlertCircle, CheckCircle2, XCircle, ImageIcon, ExternalLink } from "lucide-react"

type MediaChange = {
    id: string
    campaign_id: string
    change_type: 'main_image' | 'gallery_add' | 'gallery_remove'
    proposed_url: string | null
    previous_url: string | null
    status: string
    created_at: string
    campaigns: { title: string; slug: string | null; main_image_url: string | null } | null
    users: { full_name: string | null; email: string | null } | null
}

const CHANGE_LABEL: Record<MediaChange['change_type'], string> = {
    main_image: 'Nueva portada',
    gallery_add: 'Nueva imagen de galería',
    gallery_remove: 'Eliminar imagen de galería',
}

export default function AdminMediaChangesPage() {
    const [changes, setChanges] = useState<MediaChange[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [processingId, setProcessingId] = useState<string | null>(null)
    const [rejectingId, setRejectingId] = useState<string | null>(null)
    const [reason, setReason] = useState("")

    useEffect(() => {
        fetchChanges()
    }, [])

    const fetchChanges = async () => {
        try {
            setLoading(true)
            setError(null)
            const response = await fetch('/api/admin/media-changes', { cache: 'no-store' })
            const result = await response.json()
            if (!response.ok) throw new Error(result?.error || 'No se pudieron cargar los cambios')
            setChanges(result.changes || [])
        } catch (err: any) {
            setError(err.message || 'No se pudieron cargar los cambios')
        } finally {
            setLoading(false)
        }
    }

    const moderate = async (id: string, action: 'approve' | 'reject', reviewNotes?: string) => {
        try {
            setProcessingId(id)
            const response = await fetch(`/api/admin/media-changes/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, reviewNotes }),
            })
            const result = await response.json()
            if (!response.ok) throw new Error(result?.error || 'No se pudo procesar')
            setRejectingId(null)
            setReason("")
            fetchChanges()
        } catch (err: any) {
            alert('Error: ' + (err?.message || 'desconocido'))
        } finally {
            setProcessingId(null)
        }
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

    return (
        <div className="flex min-h-screen bg-background">
            <AdminSidebar />
            <main className="flex-1 overflow-auto">
                <div className="border-b border-border bg-card sticky top-0 z-40">
                    <div className="px-4 sm:px-8 py-4 sm:py-6">
                        <h1 className="text-3xl font-bold">Moderar imágenes</h1>
                        <p className="text-muted-foreground mt-1">
                            {changes.length} cambio{changes.length !== 1 ? 's' : ''} de portada o galería en revisión
                        </p>
                    </div>
                </div>

                <div className="p-4 sm:p-8 space-y-4">
                    {error && (
                        <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}

                    {changes.length === 0 ? (
                        <Card>
                            <CardContent className="py-12 text-center text-muted-foreground">
                                <CheckCircle2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                No hay cambios de imagen pendientes.
                            </CardContent>
                        </Card>
                    ) : (
                        changes.map((change) => {
                            const isRemove = change.change_type === 'gallery_remove'
                            const beforeUrl = change.change_type === 'main_image'
                                ? (change.previous_url || change.campaigns?.main_image_url || null)
                                : isRemove ? change.previous_url : null
                            const afterUrl = isRemove ? null : change.proposed_url

                            return (
                                <Card key={change.id}>
                                    <CardContent className="pt-6 space-y-4">
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="space-y-1">
                                                <p className="font-semibold flex items-center gap-2">
                                                    <ImageIcon className="h-4 w-4 text-primary" />
                                                    {CHANGE_LABEL[change.change_type]}
                                                    <Badge variant={isRemove ? 'destructive' : 'secondary'}>
                                                        {isRemove ? 'Eliminación' : 'Nueva imagen'}
                                                    </Badge>
                                                </p>
                                                <p className="text-sm text-muted-foreground">
                                                    Campaña: {change.campaigns?.title || 'Campaña'}
                                                    {change.campaigns?.slug && (
                                                        <a
                                                            href={`/campaigns/${change.campaigns.slug}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="ml-2 inline-flex items-center gap-1 text-primary hover:underline"
                                                        >
                                                            ver <ExternalLink className="h-3 w-3" />
                                                        </a>
                                                    )}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    Solicitado por {change.users?.full_name || 'Usuario'} • {change.users?.email || ''} • {new Date(change.created_at).toLocaleString('es-VE')}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Comparación antes / después */}
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <p className="text-xs text-muted-foreground mb-1">
                                                    {isRemove ? 'Imagen que se quitaría' : 'Actual'}
                                                </p>
                                                {beforeUrl ? (
                                                    <img src={beforeUrl} alt="Antes" className="w-full h-40 object-cover rounded border" />
                                                ) : (
                                                    <div className="w-full h-40 rounded border bg-muted flex items-center justify-center text-xs text-muted-foreground">
                                                        Sin imagen
                                                    </div>
                                                )}
                                            </div>
                                            <div>
                                                <p className="text-xs text-muted-foreground mb-1">
                                                    {isRemove ? 'Resultado' : 'Propuesta'}
                                                </p>
                                                {afterUrl ? (
                                                    <img src={afterUrl} alt="Después" className="w-full h-40 object-cover rounded border" />
                                                ) : (
                                                    <div className="w-full h-40 rounded border bg-muted flex items-center justify-center text-xs text-muted-foreground">
                                                        {isRemove ? 'Se elimina de la galería' : 'Sin imagen'}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {rejectingId === change.id && (
                                            <Textarea
                                                placeholder="Motivo del rechazo (visible para el creador)…"
                                                value={reason}
                                                onChange={(e) => setReason(e.target.value)}
                                                rows={2}
                                            />
                                        )}

                                        <div className="flex flex-wrap gap-2 border-t pt-4">
                                            {rejectingId !== change.id ? (
                                                <>
                                                    <Button
                                                        size="sm"
                                                        onClick={() => moderate(change.id, 'approve')}
                                                        disabled={processingId === change.id}
                                                    >
                                                        {processingId === change.id ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                                                        Aprobar
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => { setRejectingId(change.id); setReason("") }}
                                                        disabled={processingId === change.id}
                                                    >
                                                        <XCircle className="h-4 w-4 mr-2" />
                                                        Rechazar
                                                    </Button>
                                                </>
                                            ) : (
                                                <>
                                                    <Button
                                                        size="sm"
                                                        variant="destructive"
                                                        onClick={() => {
                                                            if (!reason.trim()) { alert('Ingresa el motivo del rechazo'); return }
                                                            moderate(change.id, 'reject', reason.trim())
                                                        }}
                                                        disabled={processingId === change.id}
                                                    >
                                                        {processingId === change.id ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <XCircle className="h-4 w-4 mr-2" />}
                                                        Confirmar rechazo
                                                    </Button>
                                                    <Button size="sm" variant="ghost" onClick={() => { setRejectingId(null); setReason("") }} disabled={processingId === change.id}>
                                                        Cancelar
                                                    </Button>
                                                </>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            )
                        })
                    )}
                </div>
            </main>
        </div>
    )
}
