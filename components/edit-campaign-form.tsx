'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Loader2, Save, Upload, Trash2, FileText, PlusCircle, Star, Clock, ImageIcon, ShieldCheck, Info } from 'lucide-react'
import { formatUsd } from '@/lib/format'

interface Category {
    id: string
    name: string
    icon_emoji?: string | null
}

interface CampaignUpdate {
    id: string
    title: string
    content: string
    created_at: string
    image_url: string | null
}

interface PendingMediaChange {
    id: string
    change_type: 'main_image' | 'gallery_add' | 'gallery_remove'
    proposed_url: string | null
    previous_url: string | null
    status: string
    created_at: string
}

interface EditCampaignFormProps {
    campaign: {
        id: string
        creator_id: string
        title: string
        story: string
        location: string | null
        goal_amount_usd: number
        current_amount_usd?: number
        original_goal_amount_usd?: number | null
        status?: string
        main_image_url?: string | null
        urgency_level: string
        category_id: string | null
        has_completed_donations?: boolean
        pending_media_changes?: PendingMediaChange[]
        campaign_details?: {
            support_documents: string[] | null
            support_documents_urls?: string[] | null
            gallery_images?: string[] | null
        } | {
            support_documents: string[] | null
            support_documents_urls?: string[] | null
            gallery_images?: string[] | null
        }[] | null
    }
    categories: Category[]
    currentUserId: string
}

const usd = (n: number) => formatUsd(n)

export function EditCampaignForm({ campaign, categories, currentUserId }: EditCampaignFormProps) {
    const PAGE_SIZE = 5

    const raised = Number(campaign.current_amount_usd || 0)
    const isFrozen = campaign.status === 'closed' || campaign.status === 'completed'
    const hasCompletedDonations = Boolean(campaign.has_completed_donations)

    const [savingGoal, setSavingGoal] = useState(false)
    const [savingDocs, setSavingDocs] = useState(false)
    const [savingMedia, setSavingMedia] = useState(false)
    const [publishingUpdate, setPublishingUpdate] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)

    const [goalAmountUsd, setGoalAmountUsd] = useState(String(campaign.goal_amount_usd))
    const [goalReason, setGoalReason] = useState('')
    const [urgencyLevel, setUrgencyLevel] = useState(campaign.urgency_level || 'medium')
    const [categoryId] = useState(campaign.category_id || '')

    const campaignDetails = Array.isArray(campaign.campaign_details)
        ? campaign.campaign_details[0]
        : campaign.campaign_details

    const initialSupportDocuments =
        campaignDetails?.support_documents || campaignDetails?.support_documents_urls || []
    const initialGalleryImages = campaignDetails?.gallery_images || []

    const [existingDocuments, setExistingDocuments] = useState<string[]>(initialSupportDocuments)
    const [newDocumentFiles, setNewDocumentFiles] = useState<File[]>([])
    const [galleryImages] = useState<string[]>(initialGalleryImages)
    const [mainImageUrl, setMainImageUrl] = useState<string | null>(campaign.main_image_url || null)

    const [pendingChanges, setPendingChanges] = useState<PendingMediaChange[]>(campaign.pending_media_changes || [])

    const [updates, setUpdates] = useState<CampaignUpdate[]>([])
    const [updatesCount, setUpdatesCount] = useState(0)
    const [updatesPage, setUpdatesPage] = useState(1)

    const [updateTitle, setUpdateTitle] = useState('')
    const [updateContent, setUpdateContent] = useState('')

    const router = useRouter()
    const supabase = createClient()

    const totalUpdatePages = Math.max(1, Math.ceil(updatesCount / PAGE_SIZE))

    const selectedCategory = useMemo(
        () => categories.find((category) => category.id === categoryId),
        [categories, categoryId]
    )

    const goalNumber = parseFloat(goalAmountUsd)
    const goalChanged = Number.isFinite(goalNumber) && goalNumber !== Number(campaign.goal_amount_usd)
    const decreasingBelowRaised = Number.isFinite(goalNumber) && goalNumber < raised

    const pendingMainImage = pendingChanges.find((c) => c.change_type === 'main_image')
    const pendingGalleryAdds = pendingChanges.filter((c) => c.change_type === 'gallery_add')
    const pendingRemovals = pendingChanges.filter((c) => c.change_type === 'gallery_remove')
    const pendingRemovalUrls = new Set(pendingRemovals.map((c) => c.previous_url))

    const loadUpdates = async (page = 1) => {
        try {
            const from = (page - 1) * PAGE_SIZE
            const to = from + PAGE_SIZE - 1
            const { data, error: updatesError, count } = await supabase
                .from('campaign_updates')
                .select('*', { count: 'exact' })
                .eq('campaign_id', campaign.id)
                .order('created_at', { ascending: false })
                .range(from, to)
            if (updatesError) throw updatesError
            setUpdates((data as CampaignUpdate[]) || [])
            setUpdatesCount(count || 0)
        } catch (err: any) {
            setError(err.message || 'No se pudieron cargar las actualizaciones')
        }
    }

    const refreshPending = async () => {
        try {
            const response = await fetch(`/api/campaigns/${campaign.id}/media`, { cache: 'no-store' })
            const result = await response.json()
            if (response.ok) setPendingChanges(result.pending || [])
        } catch {
            // silencioso
        }
    }

    useEffect(() => {
        loadUpdates(1)
    }, [])

    // ===== META =====
    const handleSaveGoal = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)
        setSuccess(null)

        const goal = parseFloat(goalAmountUsd)
        if (Number.isNaN(goal) || goal < 10) {
            setError('La meta debe ser de al menos $10 USD')
            return
        }
        if (goal !== Number(campaign.goal_amount_usd) && goalReason.trim().length < 10) {
            setError('Para cambiar la meta debes escribir el motivo (mínimo 10 caracteres). Tus donantes lo verán.')
            return
        }

        try {
            setSavingGoal(true)

            // Urgencia: cambio simple directo (no es sensible).
            if (urgencyLevel !== campaign.urgency_level) {
                await supabase
                    .from('campaigns')
                    .update({ urgency_level: urgencyLevel, updated_at: new Date().toISOString() })
                    .eq('id', campaign.id)
                    .eq('creator_id', currentUserId)
            }

            // Meta: va por el endpoint con transparencia (historial, update,
            // comentario del sistema y notificaciones).
            if (goal !== Number(campaign.goal_amount_usd)) {
                const response = await fetch(`/api/campaigns/${campaign.id}/goal`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ newGoal: goal, reason: goalReason.trim() }),
                })
                const result = await response.json()
                if (!response.ok) throw new Error(result?.error || 'No se pudo cambiar la meta')
                setSuccess(`Meta actualizada. Notificamos a ${result.notified} persona(s) que apoyan tu campaña.`)
                setGoalReason('')
            } else {
                setSuccess('Cambios guardados.')
            }

            router.refresh()
        } catch (err: any) {
            setError(err.message || 'No se pudo guardar')
        } finally {
            setSavingGoal(false)
        }
    }

    // ===== IMÁGENES (portada + galería con moderación) =====
    const uploadImageChange = async (file: File, changeType: 'main_image' | 'gallery_add') => {
        setError(null)
        setSuccess(null)
        setSavingMedia(true)
        try {
            const formData = new FormData()
            formData.append('file', file)
            formData.append('changeType', changeType)
            const response = await fetch(`/api/campaigns/${campaign.id}/media`, {
                method: 'POST',
                body: formData,
            })
            const result = await response.json()
            if (!response.ok) throw new Error(result?.error || 'No se pudo subir la imagen')
            setSuccess('Imagen enviada a revisión. Aparecerá en la campaña cuando un moderador la apruebe.')
            await refreshPending()
        } catch (err: any) {
            setError(err.message || 'No se pudo subir la imagen')
        } finally {
            setSavingMedia(false)
        }
    }

    const setAsCover = async (galleryUrl: string) => {
        setError(null)
        setSuccess(null)
        setSavingMedia(true)
        try {
            const response = await fetch(`/api/campaigns/${campaign.id}/media`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'set_cover', galleryUrl }),
            })
            const result = await response.json()
            if (!response.ok) throw new Error(result?.error || 'No se pudo fijar la portada')
            setMainImageUrl(galleryUrl)
            setSuccess('Portada actualizada.')
            router.refresh()
        } catch (err: any) {
            setError(err.message || 'No se pudo fijar la portada')
        } finally {
            setSavingMedia(false)
        }
    }

    const requestGalleryRemoval = async (url: string) => {
        setError(null)
        setSuccess(null)
        setSavingMedia(true)
        try {
            const response = await fetch(`/api/campaigns/${campaign.id}/media`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'gallery_remove', url }),
            })
            const result = await response.json()
            if (!response.ok) throw new Error(result?.error || 'No se pudo solicitar la eliminación')
            setSuccess('Solicitud de eliminación enviada a revisión.')
            await refreshPending()
        } catch (err: any) {
            setError(err.message || 'No se pudo solicitar la eliminación')
        } finally {
            setSavingMedia(false)
        }
    }

    // ===== DOCUMENTOS =====
    const uploadFile = async (file: File, bucket: string, folder: string) => {
        const extension = file.name.split('.').pop() || 'bin'
        const fileName = `${folder}/${currentUserId}_${Date.now()}_${Math.random().toString(36).slice(2)}.${extension}`
        const { error: uploadError } = await supabase.storage.from(bucket).upload(fileName, file, { cacheControl: '3600', upsert: false })
        if (uploadError) throw uploadError
        const { data } = supabase.storage.from(bucket).getPublicUrl(fileName)
        return data.publicUrl
    }

    const upsertCampaignDetailsDocuments = async (documents: string[]) => {
        const { data: existingDetails } = await supabase
            .from('campaign_details')
            .select('id')
            .eq('campaign_id', campaign.id)
            .maybeSingle()

        if (existingDetails?.id) {
            const { error } = await supabase
                .from('campaign_details')
                .update({ support_documents: documents, updated_at: new Date().toISOString() })
                .eq('campaign_id', campaign.id)
            if (error) {
                if (!error.message?.toLowerCase().includes('support_documents')) throw error
                const { error: legacyError } = await supabase
                    .from('campaign_details')
                    .update({ support_documents_urls: documents, updated_at: new Date().toISOString() })
                    .eq('campaign_id', campaign.id)
                if (legacyError) throw legacyError
            }
            return
        }

        const { error } = await supabase
            .from('campaign_details')
            .insert({ campaign_id: campaign.id, full_story: campaign.story, gallery_images: [], support_documents: documents })
        if (error) {
            if (!error.message?.toLowerCase().includes('support_documents')) throw error
            const { error: legacyError } = await supabase
                .from('campaign_details')
                .insert({ campaign_id: campaign.id, full_story: campaign.story, gallery_images: [], support_documents_urls: documents })
            if (legacyError) throw legacyError
        }
    }

    const handleUploadDocuments = async () => {
        if (newDocumentFiles.length === 0) return
        setSavingDocs(true)
        setError(null)
        setSuccess(null)
        try {
            const uploadedUrls = await Promise.all(
                newDocumentFiles.map((file) => uploadFile(file, 'campaigns', `documents/${campaign.id}`))
            )
            const merged = [...existingDocuments, ...uploadedUrls]
            await upsertCampaignDetailsDocuments(merged)
            setExistingDocuments(merged)
            setNewDocumentFiles([])
            setSuccess('Documentos agregados correctamente')
        } catch (err: any) {
            setError(err.message || 'No se pudieron subir los documentos')
        } finally {
            setSavingDocs(false)
        }
    }

    const handleRemoveDocument = async (urlToRemove: string) => {
        // Inmutabilidad: si ya hubo donaciones, no se permite borrar evidencia.
        if (hasCompletedDonations) {
            setError('No puedes eliminar documentos de una campaña que ya recibió donaciones. Solo puedes agregar nuevos.')
            return
        }
        setSavingDocs(true)
        setError(null)
        try {
            const updated = existingDocuments.filter((url) => url !== urlToRemove)
            await upsertCampaignDetailsDocuments(updated)
            setExistingDocuments(updated)
            setSuccess('Documento eliminado')
        } catch (err: any) {
            setError(err.message || 'No se pudo eliminar el documento')
        } finally {
            setSavingDocs(false)
        }
    }

    // ===== UPDATES =====
    const handlePublishUpdate = async (e: React.FormEvent) => {
        e.preventDefault()
        setPublishingUpdate(true)
        setError(null)
        setSuccess(null)
        try {
            if (!updateTitle.trim()) throw new Error('El título de la actualización es obligatorio')
            if (!updateContent.trim()) throw new Error('El contenido de la actualización es obligatorio')
            const { error: insertError } = await supabase
                .from('campaign_updates')
                .insert({ campaign_id: campaign.id, creator_id: currentUserId, title: updateTitle.trim(), content: updateContent.trim(), image_url: null })
            if (insertError) throw insertError
            setUpdateTitle('')
            setUpdateContent('')
            setUpdatesPage(1)
            await loadUpdates(1)
            setSuccess('Actualización publicada')
        } catch (err: any) {
            setError(err.message || 'No se pudo publicar la actualización')
        } finally {
            setPublishingUpdate(false)
        }
    }

    return (
        <div className="space-y-6">
            {error && (
                <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}
            {success && (
                <Alert className="border-primary/30 bg-primary/5">
                    <AlertDescription className="text-foreground">{success}</AlertDescription>
                </Alert>
            )}

            {/* META + URGENCIA */}
            <Card>
                <CardHeader>
                    <CardTitle>Meta y urgencia</CardTitle>
                    <CardDescription>Por seguridad, el título, la historia y la categoría no se editan tras la creación.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSaveGoal} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="title">Título</Label>
                            <Input id="title" value={campaign.title} disabled />
                        </div>

                        <div className="grid md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="goal">Meta USD</Label>
                                <Input
                                    id="goal"
                                    type="number"
                                    min="10"
                                    step="0.01"
                                    value={goalAmountUsd}
                                    onChange={(e) => setGoalAmountUsd(e.target.value)}
                                    disabled={savingGoal || isFrozen}
                                    aria-invalid={decreasingBelowRaised}
                                />
                                <p className="text-xs text-muted-foreground">
                                    Recaudado hasta ahora: <strong>{usd(raised)}</strong>. No puedes bajar la meta por debajo de ese monto.
                                </p>
                            </div>

                            <div className="space-y-2">
                                <Label>Urgencia</Label>
                                <Select value={urgencyLevel} onValueChange={setUrgencyLevel} disabled={savingGoal}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="low">Baja</SelectItem>
                                        <SelectItem value="medium">Media</SelectItem>
                                        <SelectItem value="high">Alta</SelectItem>
                                        <SelectItem value="critical">Crítica</SelectItem>
                                    </SelectContent>
                                </Select>
                                {selectedCategory ? (
                                    <p className="text-xs text-muted-foreground">Categoría: {selectedCategory.name}</p>
                                ) : null}
                            </div>
                        </div>

                        {isFrozen && (
                            <Alert>
                                <Info className="h-4 w-4" />
                                <AlertDescription className="text-sm">
                                    Esta campaña está cerrada o finalizada: la meta quedó congelada. Escribe a soporte para evaluar un cambio.
                                </AlertDescription>
                            </Alert>
                        )}

                        {goalChanged && !isFrozen && (
                            <div className="space-y-2">
                                <Label htmlFor="goal-reason">Motivo del cambio de meta (obligatorio)</Label>
                                <Textarea
                                    id="goal-reason"
                                    rows={3}
                                    placeholder="Ej: El presupuesto del tratamiento subió por nuevas complicaciones médicas…"
                                    value={goalReason}
                                    onChange={(e) => setGoalReason(e.target.value)}
                                    disabled={savingGoal}
                                />
                                <p className="text-xs text-muted-foreground">
                                    {decreasingBelowRaised ? (
                                        <span className="text-destructive">La nueva meta ({usd(goalNumber)}) es menor a lo recaudado ({usd(raised)}). No está permitido.</span>
                                    ) : (
                                        'Este cambio es público: publicaremos una actualización, un comentario en el muro y notificaremos a tus donantes y seguidores.'
                                    )}
                                </p>
                            </div>
                        )}

                        <Button type="submit" disabled={savingGoal || isFrozen || decreasingBelowRaised}>
                            {savingGoal ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                            Guardar
                        </Button>
                    </form>
                </CardContent>
            </Card>

            {/* PORTADA */}
            <Card>
                <CardHeader>
                    <CardTitle>Portada de la campaña</CardTitle>
                    <CardDescription>
                        Cambiar la portada requiere aprobación de un moderador. La portada actual se mantiene hasta que se apruebe la nueva.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex flex-col sm:flex-row gap-4">
                        <div className="w-full sm:w-48 shrink-0">
                            <p className="text-xs text-muted-foreground mb-1">Portada actual</p>
                            {mainImageUrl ? (
                                <img src={mainImageUrl} alt="Portada actual" className="w-full h-32 object-cover rounded border" />
                            ) : (
                                <div className="w-full h-32 rounded border bg-muted flex items-center justify-center text-xs text-muted-foreground">
                                    <ImageIcon className="h-6 w-6 opacity-50" />
                                </div>
                            )}
                        </div>

                        <div className="flex-1 space-y-2">
                            {pendingMainImage ? (
                                <Alert>
                                    <Clock className="h-4 w-4" />
                                    <AlertDescription className="text-sm">
                                        Tienes una nueva portada <strong>en revisión</strong>. Te avisaremos cuando un moderador la apruebe o la rechace.
                                    </AlertDescription>
                                </Alert>
                            ) : (
                                <>
                                    <Label htmlFor="cover-upload">Subir nueva portada (JPG, PNG o WebP · máx 5 MB)</Label>
                                    <Input
                                        id="cover-upload"
                                        type="file"
                                        accept="image/jpeg,image/png,image/webp"
                                        disabled={savingMedia}
                                        onChange={(e) => {
                                            const file = e.target.files?.[0]
                                            if (file) uploadImageChange(file, 'main_image')
                                            e.target.value = ''
                                        }}
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        Tip: si la imagen ya está en tu galería, puedes fijarla como portada abajo sin esperar aprobación.
                                    </p>
                                </>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* GALERÍA */}
            <Card>
                <CardHeader>
                    <CardTitle>Galería de imágenes</CardTitle>
                    <CardDescription>Máximo 6 imágenes. Las nuevas pasan por revisión; fijar una existente como portada es inmediato.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            disabled={savingMedia}
                            onChange={(e) => {
                                const file = e.target.files?.[0]
                                if (file) uploadImageChange(file, 'gallery_add')
                                e.target.value = ''
                            }}
                        />
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <ShieldCheck className="h-3 w-3" />
                            Las fotos de avances (cirugía, entrega de insumos) van mejor como <strong>Actualización</strong> para crear una línea de tiempo del caso.
                        </p>
                    </div>

                    {pendingGalleryAdds.length > 0 && (
                        <div className="space-y-2">
                            <p className="text-xs font-medium text-muted-foreground">En revisión</p>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                {pendingGalleryAdds.map((c) => (
                                    <div key={c.id} className="relative rounded-md border p-2">
                                        {c.proposed_url && <img src={c.proposed_url} alt="Pendiente" className="w-full h-28 object-cover rounded opacity-60" />}
                                        <Badge variant="secondary" className="absolute top-3 left-3 text-[10px]">
                                            <Clock className="h-3 w-3 mr-1" /> En revisión
                                        </Badge>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {galleryImages.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No hay imágenes de galería aprobadas.</p>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            {galleryImages.map((imageUrl, index) => {
                                const isCover = imageUrl === mainImageUrl
                                const isPendingRemoval = pendingRemovalUrls.has(imageUrl)
                                return (
                                    <div key={imageUrl} className="rounded-md border p-2 space-y-2">
                                        <img src={imageUrl} alt={`Imagen ${index + 1}`} className="w-full h-28 object-cover rounded" />
                                        {isCover && (
                                            <Badge className="text-[10px]"><Star className="h-3 w-3 mr-1" /> Portada</Badge>
                                        )}
                                        {isPendingRemoval ? (
                                            <Badge variant="secondary" className="text-[10px]"><Clock className="h-3 w-3 mr-1" /> Eliminación en revisión</Badge>
                                        ) : (
                                            <div className="flex flex-wrap gap-1">
                                                {!isCover && (
                                                    <Button type="button" variant="outline" size="sm" className="text-xs h-7" disabled={savingMedia} onClick={() => setAsCover(imageUrl)}>
                                                        <Star className="h-3 w-3 mr-1" /> Portada
                                                    </Button>
                                                )}
                                                <Button type="button" variant="outline" size="sm" className="text-xs h-7" disabled={savingMedia} onClick={() => requestGalleryRemoval(imageUrl)}>
                                                    <Trash2 className="h-3 w-3 mr-1" /> Quitar
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* DOCUMENTOS */}
            <Card>
                <CardHeader>
                    <CardTitle>Documentos de soporte</CardTitle>
                    <CardDescription>
                        {hasCompletedDonations
                            ? 'Tu campaña ya recibió donaciones: los documentos quedan como evidencia y solo puedes agregar nuevos.'
                            : 'Sube nuevos documentos o elimina los existentes.'}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Input
                            type="file"
                            multiple
                            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp"
                            onChange={(e) => setNewDocumentFiles(Array.from(e.target.files || []))}
                            disabled={savingDocs}
                        />
                        <Button type="button" onClick={handleUploadDocuments} disabled={savingDocs || newDocumentFiles.length === 0}>
                            {savingDocs ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                            Subir documentos
                        </Button>
                    </div>

                    {existingDocuments.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No hay documentos asociados.</p>
                    ) : (
                        <div className="space-y-2">
                            {existingDocuments.map((docUrl, index) => (
                                <div key={docUrl} className="flex items-center justify-between rounded-md border p-3">
                                    <div className="flex items-center gap-2 text-sm">
                                        <FileText className="h-4 w-4 text-primary" />
                                        <a href={docUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">Documento {index + 1}</a>
                                    </div>
                                    {hasCompletedDonations ? (
                                        <Badge variant="secondary" className="text-[10px]"><ShieldCheck className="h-3 w-3 mr-1" /> Evidencia</Badge>
                                    ) : (
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button type="button" variant="outline" size="sm" disabled={savingDocs}>
                                                    <Trash2 className="h-4 w-4 mr-2" /> Eliminar
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>¿Eliminar este documento?</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        El documento {index + 1} dejará de respaldar tu campaña. Esta acción no se puede deshacer.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => handleRemoveDocument(docUrl)}>
                                                        Eliminar documento
                                                    </AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* PUBLICAR ACTUALIZACIÓN */}
            <Card>
                <CardHeader>
                    <CardTitle>Publicar actualización</CardTitle>
                    <CardDescription>Crea posts para mantener informados a tus donantes (avances, fotos de progreso, agradecimientos).</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handlePublishUpdate} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="update-title">Título</Label>
                            <Input id="update-title" value={updateTitle} onChange={(e) => setUpdateTitle(e.target.value)} disabled={publishingUpdate} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="update-content">Contenido</Label>
                            <Textarea id="update-content" rows={4} value={updateContent} onChange={(e) => setUpdateContent(e.target.value)} disabled={publishingUpdate} />
                        </div>
                        <Button type="submit" disabled={publishingUpdate}>
                            {publishingUpdate ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <PlusCircle className="h-4 w-4 mr-2" />}
                            Publicar actualización
                        </Button>
                    </form>
                </CardContent>
            </Card>

            {/* HISTORIAL DE ACTUALIZACIONES */}
            <Card>
                <CardHeader>
                    <CardTitle>Historial de actualizaciones ({updatesCount})</CardTitle>
                    <CardDescription>Últimos posts de tu campaña.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {updates.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Aún no has publicado actualizaciones.</p>
                    ) : (
                        updates.map((update) => (
                            <div key={update.id} className="rounded-md border p-3 space-y-2">
                                <div className="flex items-center justify-between gap-3">
                                    <p className="font-medium">{update.title}</p>
                                    <span className="text-xs text-muted-foreground">{new Date(update.created_at).toLocaleDateString('es-VE')}</span>
                                </div>
                                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{update.content}</p>
                            </div>
                        ))
                    )}

                    {updatesCount > PAGE_SIZE ? (
                        <div className="flex items-center justify-between border-t pt-3">
                            <p className="text-sm text-muted-foreground">Página {updatesPage} de {totalUpdatePages}</p>
                            <div className="flex gap-2">
                                <Button type="button" variant="outline" size="sm" disabled={updatesPage === 1} onClick={async () => { const n = Math.max(1, updatesPage - 1); setUpdatesPage(n); await loadUpdates(n) }}>Anterior</Button>
                                <Button type="button" variant="outline" size="sm" disabled={updatesPage === totalUpdatePages} onClick={async () => { const n = Math.min(totalUpdatePages, updatesPage + 1); setUpdatesPage(n); await loadUpdates(n) }}>Siguiente</Button>
                            </div>
                        </div>
                    ) : null}
                </CardContent>
            </Card>
        </div>
    )
}
