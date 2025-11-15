'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import {
    Loader2,
    Upload,
    Image as ImageIcon,
    FileText,
    X,
    Check,
    DollarSign,
    Users,
    Target,
    AlertCircle
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Profile {
    id: string
    full_name: string
    email: string
    role: string
    kyc_status: string
}

interface Category {
    id: string
    name: string
    description: string | null
    icon: string | null
}

interface CreateCampaignFormProps {
    profile: Profile
    categories: Category[]
}

export function CreateCampaignForm({ profile, categories }: CreateCampaignFormProps) {
    const [currentStep, setCurrentStep] = useState(1)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)
    const [uploading, setUploading] = useState(false)

    const [formData, setFormData] = useState({
        title: '',
        category_id: '',
        goal_amount_usd: '',
        story: '',
        location: '',
        urgency_level: 'medium',
        main_image: null as File | null,
        gallery_images: [] as File[],
        support_documents: [] as File[]
    })

    const mainImageRef = useRef<HTMLInputElement>(null)
    const galleryRef = useRef<HTMLInputElement>(null)
    const documentsRef = useRef<HTMLInputElement>(null)

    const router = useRouter()
    const supabase = createClient()

    const steps = [
        { number: 1, title: 'Información Básica', description: 'Título, categoría y meta' },
        { number: 2, title: 'Historia', description: 'Descripción detallada' },
        { number: 3, title: 'Multimedia', description: 'Fotos y documentos' },
        { number: 4, title: 'Revisión', description: 'Confirmar datos' }
    ]

    const updateFormData = (field: string, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }))
    }

    const generateSlug = (title: string) => {
        return title
            .toLowerCase()
            .replace(/[áàäâ]/g, 'a')
            .replace(/[éèëê]/g, 'e')
            .replace(/[íìïî]/g, 'i')
            .replace(/[óòöô]/g, 'o')
            .replace(/[úùüû]/g, 'u')
            .replace(/ñ/g, 'n')
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-+|-+$/g, '')
            .substring(0, 60)
    }

    const validateStep = (step: number) => {
        switch (step) {
            case 1:
                if (!formData.title.trim()) {
                    setError('El título es requerido')
                    return false
                }
                if (!formData.category_id) {
                    setError('Debes seleccionar una categoría')
                    return false
                }
                if (!formData.goal_amount_usd || parseFloat(formData.goal_amount_usd) < 10) {
                    setError('La meta debe ser de al menos $10 USD')
                    return false
                }
                break
            case 2:
                if (!formData.story.trim() || formData.story.length < 50) {
                    setError('La historia debe tener al menos 50 caracteres')
                    return false
                }
                break
            case 3:
                if (!formData.main_image) {
                    setError('Debes subir una imagen principal')
                    return false
                }
                break
        }
        setError(null)
        return true
    }

    const handleFileUpload = async (file: File, bucket: string, folder: string): Promise<string> => {
        const fileExt = file.name.split('.').pop()
        const fileName = `${folder}/${profile.id}_${Date.now()}.${fileExt}`

        const { data, error } = await supabase.storage
            .from(bucket)
            .upload(fileName, file, {
                cacheControl: '3600',
                upsert: false
            })

        if (error) {
            throw new Error(`Error uploading file: ${error.message}`)
        }

        const { data: { publicUrl } } = supabase.storage
            .from(bucket)
            .getPublicUrl(fileName)

        return publicUrl
    }

    const handleImageSelect = (type: 'main' | 'gallery', e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || [])

        files.forEach(file => {
            if (!file.type.startsWith('image/')) {
                setError('Solo se permiten archivos de imagen')
                return
            }
            if (file.size > 5 * 1024 * 1024) {
                setError('Las imágenes deben ser menores a 5MB')
                return
            }
        })

        if (type === 'main' && files.length > 0) {
            updateFormData('main_image', files[0])
        } else if (type === 'gallery') {
            updateFormData('gallery_images', [...formData.gallery_images, ...files])
        }

        setError(null)
    }

    const handleDocumentSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || [])

        files.forEach(file => {
            if (file.size > 10 * 1024 * 1024) {
                setError('Los documentos deben ser menores a 10MB')
                return
            }
        })

        updateFormData('support_documents', [...formData.support_documents, ...files])
        setError(null)
    }

    const removeFile = (type: 'gallery' | 'documents', index: number) => {
        if (type === 'gallery') {
            const newFiles = formData.gallery_images.filter((_, i) => i !== index)
            updateFormData('gallery_images', newFiles)
        } else {
            const newFiles = formData.support_documents.filter((_, i) => i !== index)
            updateFormData('support_documents', newFiles)
        }
    }

    const nextStep = () => {
        if (validateStep(currentStep)) {
            setCurrentStep(prev => Math.min(prev + 1, 4))
        }
    }

    const prevStep = () => {
        setCurrentStep(prev => Math.max(prev - 1, 1))
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!validateStep(3)) return

        setLoading(true)
        setError(null)
        setUploading(true)

        try {
            // Upload main image
            const mainImageUrl = formData.main_image
                ? await handleFileUpload(formData.main_image, 'campaigns', 'main-images')
                : null

            // Upload gallery images
            const galleryUrls = await Promise.all(
                formData.gallery_images.map(file =>
                    handleFileUpload(file, 'campaigns', 'gallery')
                )
            )

            // Upload support documents
            const documentUrls = await Promise.all(
                formData.support_documents.map(file =>
                    handleFileUpload(file, 'campaign-support', 'documents')
                )
            )

            setUploading(false)

            // Create campaign
            const slug = generateSlug(formData.title)
            const { data: campaign, error: campaignError } = await supabase
                .from('campaigns')
                .insert({
                    creator_id: profile.id,
                    title: formData.title,
                    slug: slug,
                    story: formData.story,
                    goal_amount_usd: parseFloat(formData.goal_amount_usd),
                    current_amount_usd: 0,
                    category_id: formData.category_id,
                    location: formData.location || null,
                    urgency_level: formData.urgency_level,
                    main_image_url: mainImageUrl,
                    status: 'pending_review'
                })
                .select()
                .single()

            if (campaignError) {
                setError(campaignError.message)
                return
            }

            // Create campaign details
            const { error: detailsError } = await supabase
                .from('campaign_details')
                .insert({
                    campaign_id: campaign.id,
                    gallery_images: galleryUrls,
                    support_documents: documentUrls
                })

            if (detailsError) {
                setError(detailsError.message)
                return
            }

            setSuccess('¡Campaña creada exitosamente! Está siendo revisada por nuestro equipo.')

            // Redirect after success
            setTimeout(() => {
                router.push('/creator/campaigns')
            }, 2000)

        } catch (err) {
            console.error('Campaign creation error:', err)
            setError(err instanceof Error ? err.message : 'Ocurrió un error inesperado')
        } finally {
            setLoading(false)
            setUploading(false)
        }
    }

    const selectedCategory = categories.find(c => c.id === formData.category_id)

    return (
        <div className="space-y-8">
            {/* Progress Steps */}
            <div className="flex items-center justify-between">
                {steps.map((step, index) => (
                    <div key={step.number} className="flex items-center">
                        <div className={`
              flex items-center justify-center w-8 h-8 rounded-full border-2 text-sm font-medium
              ${currentStep >= step.number
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'bg-background text-muted-foreground border-muted'
                            }
            `}>
                            {currentStep > step.number ? <Check className="h-4 w-4" /> : step.number}
                        </div>
                        {index < steps.length - 1 && (
                            <div className={`w-16 h-0.5 mx-2 ${currentStep > step.number ? 'bg-primary' : 'bg-muted'
                                }`} />
                        )}
                    </div>
                ))}
            </div>

            <div className="text-center">
                <h3 className="text-lg font-medium">{steps[currentStep - 1].title}</h3>
                <p className="text-sm text-muted-foreground">{steps[currentStep - 1].description}</p>
            </div>

            {error && (
                <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            {success && (
                <Alert className="bg-green-50 text-green-800 border-green-200">
                    <AlertDescription>{success}</AlertDescription>
                </Alert>
            )}

            <form onSubmit={handleSubmit}>
                {/* Step 1: Basic Information */}
                {currentStep === 1 && (
                    <div className="space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="title">Título de la Campaña *</Label>
                            <Input
                                id="title"
                                value={formData.title}
                                onChange={(e) => updateFormData('title', e.target.value)}
                                placeholder="Ej: Ayuda para cirugía de emergencia"
                                maxLength={100}
                                disabled={loading}
                            />
                            <p className="text-xs text-muted-foreground">
                                {formData.title.length}/100 caracteres
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="category">Categoría *</Label>
                            <Select
                                value={formData.category_id}
                                onValueChange={(value) => updateFormData('category_id', value)}
                                disabled={loading}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecciona una categoría" />
                                </SelectTrigger>
                                <SelectContent>
                                    {categories.map((category) => (
                                        <SelectItem key={category.id} value={category.id}>
                                            <div className="flex items-center gap-2">
                                                {category.icon && <span>{category.icon}</span>}
                                                <span>{category.name}</span>
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {selectedCategory?.description && (
                                <p className="text-xs text-muted-foreground">
                                    {selectedCategory.description}
                                </p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="goal_amount_usd" className="flex items-center gap-2">
                                <DollarSign className="h-4 w-4" />
                                Meta de Recaudación (USD) *
                            </Label>
                            <Input
                                id="goal_amount_usd"
                                type="number"
                                min="10"
                                step="0.01"
                                value={formData.goal_amount_usd}
                                onChange={(e) => updateFormData('goal_amount_usd', e.target.value)}
                                placeholder="1500.00"
                                disabled={loading}
                            />
                            <p className="text-xs text-muted-foreground">
                                Monto mínimo: $10 USD. Sé realista con tu meta.
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="location">Ubicación (Opcional)</Label>
                            <Input
                                id="location"
                                value={formData.location}
                                onChange={(e) => updateFormData('location', e.target.value)}
                                placeholder="Ciudad, Estado"
                                disabled={loading}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="urgency">Nivel de Urgencia</Label>
                            <Select
                                value={formData.urgency_level}
                                onValueChange={(value) => updateFormData('urgency_level', value)}
                                disabled={loading}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="low">
                                        <div className="space-y-1">
                                            <div className="font-medium">Baja</div>
                                            <div className="text-sm text-muted-foreground">No hay prisa específica</div>
                                        </div>
                                    </SelectItem>
                                    <SelectItem value="medium">
                                        <div className="space-y-1">
                                            <div className="font-medium">Media</div>
                                            <div className="text-sm text-muted-foreground">Importante pero no crítica</div>
                                        </div>
                                    </SelectItem>
                                    <SelectItem value="high">
                                        <div className="space-y-1">
                                            <div className="font-medium">Alta</div>
                                            <div className="text-sm text-muted-foreground">Situación urgente</div>
                                        </div>
                                    </SelectItem>
                                    <SelectItem value="critical">
                                        <div className="space-y-1">
                                            <div className="font-medium">Crítica</div>
                                            <div className="text-sm text-muted-foreground">Emergencia inmediata</div>
                                        </div>
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                )}

                {/* Step 2: Story */}
                {currentStep === 2 && (
                    <div className="space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="story">Historia de tu Campaña *</Label>
                            <Textarea
                                id="story"
                                value={formData.story}
                                onChange={(e) => updateFormData('story', e.target.value)}
                                placeholder="Cuenta tu historia de manera personal y auténtica. Explica por qué necesitas ayuda, cómo usarás los fondos y por qué es importante para ti..."
                                rows={12}
                                disabled={loading}
                                className="resize-none"
                            />
                            <div className="flex justify-between items-center text-xs text-muted-foreground">
                                <span>{formData.story.length}/2000 caracteres</span>
                                <span>Mínimo 50 caracteres</span>
                            </div>
                        </div>

                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">Consejos para una buena historia</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="flex gap-3">
                                    <Users className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
                                    <div>
                                        <p className="font-medium text-sm">Sé personal</p>
                                        <p className="text-xs text-muted-foreground">Comparte tu historia personal. La gente se conecta con experiencias reales.</p>
                                    </div>
                                </div>
                                <div className="flex gap-3">
                                    <Target className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                                    <div>
                                        <p className="font-medium text-sm">Sé específico</p>
                                        <p className="text-xs text-muted-foreground">Explica exactamente para qué necesitas el dinero y cómo lo usarás.</p>
                                    </div>
                                </div>
                                <div className="flex gap-3">
                                    <Check className="h-5 w-5 text-purple-500 mt-0.5 flex-shrink-0" />
                                    <div>
                                        <p className="font-medium text-sm">Sé honesto</p>
                                        <p className="text-xs text-muted-foreground">La transparencia genera confianza. Comparte tanto los desafíos como las esperanzas.</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}

                {/* Step 3: Media */}
                {currentStep === 3 && (
                    <div className="space-y-6">
                        {/* Main Image */}
                        <div className="space-y-3">
                            <Label>Imagen Principal *</Label>
                            <div
                                className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center cursor-pointer hover:border-muted-foreground/50 transition-colors"
                                onClick={() => mainImageRef.current?.click()}
                            >
                                {formData.main_image ? (
                                    <div className="space-y-2">
                                        <ImageIcon className="h-8 w-8 mx-auto text-green-600" />
                                        <p className="text-sm font-medium text-green-700">{formData.main_image.name}</p>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                updateFormData('main_image', null)
                                                if (mainImageRef.current) mainImageRef.current.value = ''
                                            }}
                                        >
                                            Cambiar imagen
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                                        <p className="text-sm">Haz clic para subir la imagen principal</p>
                                        <p className="text-xs text-muted-foreground">JPG, PNG hasta 5MB</p>
                                    </div>
                                )}
                            </div>
                            <input
                                ref={mainImageRef}
                                type="file"
                                accept="image/*"
                                onChange={(e) => handleImageSelect('main', e)}
                                className="hidden"
                                disabled={loading}
                            />
                        </div>

                        {/* Gallery Images */}
                        <div className="space-y-3">
                            <Label>Galería de Imágenes (Opcional)</Label>
                            <div
                                className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-4 text-center cursor-pointer hover:border-muted-foreground/50 transition-colors"
                                onClick={() => galleryRef.current?.click()}
                            >
                                <Upload className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
                                <p className="text-sm">Agregar más imágenes</p>
                            </div>
                            <input
                                ref={galleryRef}
                                type="file"
                                accept="image/*"
                                multiple
                                onChange={(e) => handleImageSelect('gallery', e)}
                                className="hidden"
                                disabled={loading}
                            />

                            {formData.gallery_images.length > 0 && (
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                    {formData.gallery_images.map((file, index) => (
                                        <div key={index} className="relative bg-muted rounded-lg p-3">
                                            <div className="flex items-center gap-2">
                                                <ImageIcon className="h-4 w-4 text-muted-foreground" />
                                                <span className="text-xs truncate flex-1">{file.name}</span>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-6 w-6 p-0"
                                                    onClick={() => removeFile('gallery', index)}
                                                >
                                                    <X className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Support Documents */}
                        <div className="space-y-3">
                            <Label>Documentos de Soporte (Opcional)</Label>
                            <p className="text-xs text-muted-foreground">
                                Sube documentos que respalden tu campaña (informes médicos, presupuestos, etc.)
                            </p>
                            <div
                                className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-4 text-center cursor-pointer hover:border-muted-foreground/50 transition-colors"
                                onClick={() => documentsRef.current?.click()}
                            >
                                <FileText className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
                                <p className="text-sm">Agregar documentos</p>
                                <p className="text-xs text-muted-foreground">PDF, DOC, JPG hasta 10MB cada uno</p>
                            </div>
                            <input
                                ref={documentsRef}
                                type="file"
                                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                                multiple
                                onChange={handleDocumentSelect}
                                className="hidden"
                                disabled={loading}
                            />

                            {formData.support_documents.length > 0 && (
                                <div className="space-y-2">
                                    {formData.support_documents.map((file, index) => (
                                        <div key={index} className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                                            <FileText className="h-4 w-4 text-muted-foreground" />
                                            <span className="text-sm flex-1 truncate">{file.name}</span>
                                            <span className="text-xs text-muted-foreground">
                                                {(file.size / 1024 / 1024).toFixed(1)} MB
                                            </span>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                className="h-6 w-6 p-0"
                                                onClick={() => removeFile('documents', index)}
                                            >
                                                <X className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Step 4: Review */}
                {currentStep === 4 && (
                    <div className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Resumen de tu Campaña</CardTitle>
                                <CardDescription>
                                    Revisa todos los detalles antes de enviar tu campaña para aprobación
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid md:grid-cols-2 gap-4">
                                    <div>
                                        <Label className="text-xs text-muted-foreground">TÍTULO</Label>
                                        <p className="font-medium">{formData.title}</p>
                                    </div>
                                    <div>
                                        <Label className="text-xs text-muted-foreground">CATEGORÍA</Label>
                                        <p className="font-medium">{selectedCategory?.name}</p>
                                    </div>
                                    <div>
                                        <Label className="text-xs text-muted-foreground">META</Label>
                                        <p className="font-medium">${formData.goal_amount_usd} USD</p>
                                    </div>
                                    <div>
                                        <Label className="text-xs text-muted-foreground">UBICACIÓN</Label>
                                        <p className="font-medium">{formData.location || 'No especificada'}</p>
                                    </div>
                                </div>

                                <Separator />

                                <div>
                                    <Label className="text-xs text-muted-foreground">HISTORIA</Label>
                                    <p className="text-sm mt-1 line-clamp-3">{formData.story}</p>
                                </div>

                                <Separator />

                                <div className="flex gap-4">
                                    <div>
                                        <Label className="text-xs text-muted-foreground">IMAGEN PRINCIPAL</Label>
                                        <p className="text-sm">{formData.main_image ? '✓ Subida' : '✗ Faltante'}</p>
                                    </div>
                                    <div>
                                        <Label className="text-xs text-muted-foreground">GALERÍA</Label>
                                        <p className="text-sm">{formData.gallery_images.length} imágenes</p>
                                    </div>
                                    <div>
                                        <Label className="text-xs text-muted-foreground">DOCUMENTOS</Label>
                                        <p className="text-sm">{formData.support_documents.length} archivos</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Alert className="bg-blue-50 border-blue-200">
                            <AlertCircle className="h-4 w-4 text-blue-600" />
                            <AlertDescription className="text-blue-800">
                                Tu campaña será revisada por nuestro equipo antes de ser publicada.
                                Este proceso usualmente toma 24-48 horas.
                            </AlertDescription>
                        </Alert>

                        {uploading && (
                            <Card>
                                <CardContent className="pt-6">
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between text-sm">
                                            <span>Subiendo archivos...</span>
                                            <span>Por favor espera</span>
                                        </div>
                                        <Progress value={66} className="w-full" />
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                    </div>
                )}

                {/* Navigation Buttons */}
                <div className="flex justify-between pt-6 border-t">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={prevStep}
                        disabled={currentStep === 1 || loading || uploading}
                    >
                        Anterior
                    </Button>

                    {currentStep < 4 ? (
                        <Button
                            type="button"
                            onClick={nextStep}
                            disabled={loading || uploading}
                        >
                            Siguiente
                        </Button>
                    ) : (
                        <Button
                            type="submit"
                            disabled={loading || uploading}
                            className="min-w-[140px]"
                        >
                            {loading || uploading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    {uploading ? 'Subiendo...' : 'Creando...'}
                                </>
                            ) : (
                                'Crear Campaña'
                            )}
                        </Button>
                    )}
                </div>
            </form>
        </div>
    )
}
