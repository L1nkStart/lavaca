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
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Save, Upload, Trash2, FileText, PlusCircle } from 'lucide-react'

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

interface EditCampaignFormProps {
    campaign: {
        id: string
        creator_id: string
        title: string
        story: string
        location: string | null
        goal_amount_usd: number
        urgency_level: string
        category_id: string | null
        main_image_url?: string | null
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

export function EditCampaignForm({ campaign, categories, currentUserId }: EditCampaignFormProps) {
    const PAGE_SIZE = 5

    const [loading, setLoading] = useState(false)
    const [savingDocs, setSavingDocs] = useState(false)
    const [savingGallery, setSavingGallery] = useState(false)
    const [publishingUpdate, setPublishingUpdate] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)

    const [title, setTitle] = useState(campaign.title)
    const [story, setStory] = useState(campaign.story)
    const [location, setLocation] = useState(campaign.location || '')
    const [goalAmountUsd, setGoalAmountUsd] = useState(String(campaign.goal_amount_usd))
    const [urgencyLevel, setUrgencyLevel] = useState(campaign.urgency_level || 'medium')
    const [categoryId, setCategoryId] = useState(campaign.category_id || '')

    const campaignDetails = Array.isArray(campaign.campaign_details)
        ? campaign.campaign_details[0]
        : campaign.campaign_details

    const initialSupportDocuments =
        campaignDetails?.support_documents || campaignDetails?.support_documents_urls || []
    const initialGalleryImages = campaignDetails?.gallery_images || []

    const [existingDocuments, setExistingDocuments] = useState<string[]>(initialSupportDocuments)
    const [newDocumentFiles, setNewDocumentFiles] = useState<File[]>([])
    const [existingGalleryImages, setExistingGalleryImages] = useState<string[]>(initialGalleryImages)
    const [newGalleryFiles, setNewGalleryFiles] = useState<File[]>([])

    const [updates, setUpdates] = useState<CampaignUpdate[]>([])
    const [updatesCount, setUpdatesCount] = useState(0)
    const [updatesPage, setUpdatesPage] = useState(1)

    const [updateTitle, setUpdateTitle] = useState('')
    const [updateContent, setUpdateContent] = useState('')
    const [updateImage, setUpdateImage] = useState<File | null>(null)

    const router = useRouter()
    const supabase = createClient()

    const totalUpdatePages = Math.max(1, Math.ceil(updatesCount / PAGE_SIZE))

    const selectedCategory = useMemo(
        () => categories.find((category) => category.id === categoryId),
        [categories, categoryId]
    )

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

    useEffect(() => {
        loadUpdates(1)
    }, [])

    const handleSaveCampaign = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)
        setSuccess(null)

        try {
            const goal = parseFloat(goalAmountUsd)

            if (Number.isNaN(goal) || goal < 10) throw new Error('La meta debe ser de al menos $10 USD')

            const { error: updateError } = await supabase
                .from('campaigns')
                .update({
                    goal_amount_usd: goal,
                    urgency_level: urgencyLevel,
                    updated_at: new Date().toISOString()
                })
                .eq('id', campaign.id)
                .eq('creator_id', currentUserId)

            if (updateError) throw updateError

            setSuccess('Campaña actualizada correctamente')
            router.refresh()
        } catch (err: any) {
            setError(err.message || 'No se pudo actualizar la campaña')
        } finally {
            setLoading(false)
        }
    }

    const upsertCampaignDetailsGalleryImages = async (galleryImages: string[]) => {
        const { data: existingDetails } = await supabase
            .from('campaign_details')
            .select('id')
            .eq('campaign_id', campaign.id)
            .maybeSingle()

        if (existingDetails?.id) {
            const { error } = await supabase
                .from('campaign_details')
                .update({
                    gallery_images: galleryImages,
                    updated_at: new Date().toISOString()
                })
                .eq('campaign_id', campaign.id)

            if (error) throw error
            return
        }

        const { error } = await supabase
            .from('campaign_details')
            .insert({
                campaign_id: campaign.id,
                full_story: story,
                gallery_images: galleryImages,
                support_documents: existingDocuments
            })

        if (error) {
            const shouldFallbackToLegacyColumn =
                error.message?.toLowerCase().includes('support_documents')

            if (!shouldFallbackToLegacyColumn) throw error

            const { error: legacyInsertError } = await supabase
                .from('campaign_details')
                .insert({
                    campaign_id: campaign.id,
                    full_story: story,
                    gallery_images: galleryImages,
                    support_documents_urls: existingDocuments
                })

            if (legacyInsertError) throw legacyInsertError
        }
    }

    const handleUploadGalleryImages = async () => {
        if (newGalleryFiles.length === 0) return

        setSavingGallery(true)
        setError(null)
        setSuccess(null)

        try {
            const uploadedUrls = await Promise.all(
                newGalleryFiles.map((file) => uploadFile(file, 'campaigns', 'gallery'))
            )

            const merged = [...existingGalleryImages, ...uploadedUrls]
            await upsertCampaignDetailsGalleryImages(merged)

            setExistingGalleryImages(merged)
            setNewGalleryFiles([])
            setSuccess('Imágenes de galería agregadas correctamente')
        } catch (err: any) {
            setError(err.message || 'No se pudieron subir las imágenes de galería')
        } finally {
            setSavingGallery(false)
        }
    }

    const uploadFile = async (file: File, bucket: string, folder: string) => {
        const extension = file.name.split('.').pop() || 'bin'
        const fileName = `${folder}/${currentUserId}_${Date.now()}_${Math.random().toString(36).slice(2)}.${extension}`

        const { error: uploadError } = await supabase.storage
            .from(bucket)
            .upload(fileName, file, {
                cacheControl: '3600',
                upsert: false
            })

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
                .update({
                    support_documents: documents,
                    updated_at: new Date().toISOString()
                })
                .eq('campaign_id', campaign.id)

            if (error) {
                const shouldFallbackToLegacyColumn =
                    error.message?.toLowerCase().includes('support_documents')

                if (!shouldFallbackToLegacyColumn) throw error

                const { error: legacyUpdateError } = await supabase
                    .from('campaign_details')
                    .update({
                        support_documents_urls: documents,
                        updated_at: new Date().toISOString()
                    })
                    .eq('campaign_id', campaign.id)

                if (legacyUpdateError) throw legacyUpdateError
            }
            return
        }

        const { error } = await supabase
            .from('campaign_details')
            .insert({
                campaign_id: campaign.id,
                full_story: story,
                gallery_images: [],
                support_documents: documents
            })

        if (error) {
            const shouldFallbackToLegacyColumn =
                error.message?.toLowerCase().includes('support_documents')

            if (!shouldFallbackToLegacyColumn) throw error

            const { error: legacyInsertError } = await supabase
                .from('campaign_details')
                .insert({
                    campaign_id: campaign.id,
                    full_story: story,
                    gallery_images: [],
                    support_documents_urls: documents
                })

            if (legacyInsertError) throw legacyInsertError
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

    const handlePublishUpdate = async (e: React.FormEvent) => {
        e.preventDefault()
        setPublishingUpdate(true)
        setError(null)
        setSuccess(null)

        try {
            if (!updateTitle.trim()) throw new Error('El título de la actualización es obligatorio')
            if (!updateContent.trim()) throw new Error('El contenido de la actualización es obligatorio')

            let imageUrl: string | null = null
            if (updateImage) {
                imageUrl = await uploadFile(updateImage, 'campaigns', 'gallery')
            }

            const { error: insertError } = await supabase
                .from('campaign_updates')
                .insert({
                    campaign_id: campaign.id,
                    creator_id: currentUserId,
                    title: updateTitle.trim(),
                    content: updateContent.trim(),
                    image_url: imageUrl
                })

            if (insertError) throw insertError

            setUpdateTitle('')
            setUpdateContent('')
            setUpdateImage(null)
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
                <Alert>
                    <AlertDescription>{success}</AlertDescription>
                </Alert>
            )}

            <Card>
                <CardHeader>
                    <CardTitle>Editar campaña</CardTitle>
                    <CardDescription>Por seguridad solo puedes editar meta y urgencia.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSaveCampaign} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="title">Título</Label>
                            <Input id="title" value={title} disabled />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="story">Historia</Label>
                            <Textarea
                                id="story"
                                rows={8}
                                value={story}
                                disabled
                            />
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
                                    disabled={loading}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="location">Ubicación</Label>
                                <Input
                                    id="location"
                                    value={location}
                                    disabled
                                />
                            </div>
                        </div>

                        <div className="grid md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Categoría</Label>
                                <Select value={categoryId} disabled>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecciona una categoría" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {categories.map((category) => (
                                            <SelectItem key={category.id} value={category.id}>
                                                <span className="inline-flex items-center gap-2">
                                                    {category.icon_emoji ? <span>{category.icon_emoji}</span> : null}
                                                    <span>{category.name}</span>
                                                </span>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {selectedCategory ? (
                                    <p className="text-xs text-muted-foreground">Categoría actual: {selectedCategory.name}</p>
                                ) : null}
                            </div>

                            <div className="space-y-2">
                                <Label>Urgencia</Label>
                                <Select value={urgencyLevel} onValueChange={setUrgencyLevel} disabled={loading}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="low">Baja</SelectItem>
                                        <SelectItem value="medium">Media</SelectItem>
                                        <SelectItem value="high">Alta</SelectItem>
                                        <SelectItem value="critical">Crítica</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <Button type="submit" disabled={loading}>
                            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                            Guardar meta y urgencia
                        </Button>
                    </form>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Galería de imágenes</CardTitle>
                    <CardDescription>Puedes añadir nuevas imágenes. Las existentes no se pueden eliminar desde aquí.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Input
                            type="file"
                            multiple
                            accept="image/*"
                            onChange={(e) => setNewGalleryFiles(Array.from(e.target.files || []))}
                            disabled={savingGallery}
                        />
                        <Button type="button" onClick={handleUploadGalleryImages} disabled={savingGallery || newGalleryFiles.length === 0}>
                            {savingGallery ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                            Añadir imágenes a la galería
                        </Button>
                    </div>

                    {existingGalleryImages.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No hay imágenes de galería asociadas.</p>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            {existingGalleryImages.map((imageUrl, index) => (
                                <a
                                    key={imageUrl}
                                    href={imageUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block rounded-md border border-border p-2 hover:bg-muted"
                                >
                                    <img
                                        src={imageUrl}
                                        alt={`Imagen de galería ${index + 1}`}
                                        className="w-full h-28 object-cover rounded"
                                    />
                                </a>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Documentos de soporte</CardTitle>
                    <CardDescription>Sube nuevos documentos o elimina los existentes de tu campaña.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Input
                            type="file"
                            multiple
                            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
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
                                <div key={docUrl} className="flex items-center justify-between rounded-md border border-border p-3">
                                    <div className="flex items-center gap-2 text-sm">
                                        <FileText className="h-4 w-4 text-primary" />
                                        <a href={docUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">
                                            Documento {index + 1}
                                        </a>
                                    </div>
                                    <Button type="button" variant="outline" size="sm" onClick={() => handleRemoveDocument(docUrl)} disabled={savingDocs}>
                                        <Trash2 className="h-4 w-4 mr-2" />
                                        Eliminar
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Publicar actualización</CardTitle>
                    <CardDescription>Crea posts para mantener informados a tus donantes.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handlePublishUpdate} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="update-title">Título</Label>
                            <Input
                                id="update-title"
                                value={updateTitle}
                                onChange={(e) => setUpdateTitle(e.target.value)}
                                disabled={publishingUpdate}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="update-content">Contenido</Label>
                            <Textarea
                                id="update-content"
                                rows={4}
                                value={updateContent}
                                onChange={(e) => setUpdateContent(e.target.value)}
                                disabled={publishingUpdate}
                            />
                        </div>

                        {/* <div className="space-y-2">
                            <Label htmlFor="update-image">Imagen (opcional)</Label>
                            <Input
                                id="update-image"
                                type="file"
                                accept="image/*"
                                onChange={(e) => setUpdateImage(e.target.files?.[0] || null)}
                                disabled={publishingUpdate}
                            />
                        </div> */}

                        <Button type="submit" disabled={publishingUpdate}>
                            {publishingUpdate ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <PlusCircle className="h-4 w-4 mr-2" />}
                            Publicar actualización
                        </Button>
                    </form>
                </CardContent>
            </Card>

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
                            <div key={update.id} className="rounded-md border border-border p-3 space-y-2">
                                <div className="flex items-center justify-between gap-3">
                                    <p className="font-medium">{update.title}</p>
                                    <span className="text-xs text-muted-foreground">
                                        {new Date(update.created_at).toLocaleDateString('es-VE')}
                                    </span>
                                </div>
                                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{update.content}</p>
                                {update.image_url ? (
                                    <a href={update.image_url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">
                                        Ver imagen
                                    </a>
                                ) : null}
                            </div>
                        ))
                    )}

                    {updatesCount > PAGE_SIZE ? (
                        <div className="flex items-center justify-between border-t border-border pt-3">
                            <p className="text-sm text-muted-foreground">
                                Página {updatesPage} de {totalUpdatePages}
                            </p>
                            <div className="flex gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    disabled={updatesPage === 1}
                                    onClick={async () => {
                                        const next = Math.max(1, updatesPage - 1)
                                        setUpdatesPage(next)
                                        await loadUpdates(next)
                                    }}
                                >
                                    Anterior
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    disabled={updatesPage === totalUpdatePages}
                                    onClick={async () => {
                                        const next = Math.min(totalUpdatePages, updatesPage + 1)
                                        setUpdatesPage(next)
                                        await loadUpdates(next)
                                    }}
                                >
                                    Siguiente
                                </Button>
                            </div>
                        </div>
                    ) : null}
                </CardContent>
            </Card>
        </div>
    )
}
