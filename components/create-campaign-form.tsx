'use client'

import { useState, useRef, useEffect, Fragment } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
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
    AlertCircle,
    ChevronsUpDown,
    Wallet,
    Trash2,
    CheckCircle2,
    Circle,
    Clock,
    ShieldCheck,
    ArrowRight,
    ExternalLink,
} from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { formatUsd } from '@/lib/format'
import { cn } from '@/lib/utils'
import { ReceivingAccountForm, ReceivingAccountItem } from '@/components/receiving-account-form'
import { RECEIVING_ACCOUNT_LABEL, receivingAccountSummary, type ReceivingAccountInput } from '@/lib/venezuela'

const VENEZUELA_STATES = [
    'Amazonas',
    'Anzoátegui',
    'Apure',
    'Aragua',
    'Barinas',
    'Bolívar',
    'Carabobo',
    'Cojedes',
    'Delta Amacuro',
    'Distrito Capital',
    'Falcón',
    'Guárico',
    'Lara',
    'La Guaira',
    'Mérida',
    'Miranda',
    'Monagas',
    'Nueva Esparta',
    'Portuguesa',
    'Sucre',
    'Táchira',
    'Trujillo',
    'Yaracuy',
    'Zulia',
]

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
    description: string | "En desarrollo"
    icon: string | null
}

interface CreateCampaignFormProps {
    profile: Profile
    categories: Category[]
    crisisEnabled?: boolean
    crisisForced?: boolean
    /** Campañas normales: si el creador ya tiene cuentas de retiro en su perfil. */
    hasWithdrawalAccounts?: boolean
}

/** Resultado de la creación, para la pantalla de "¿y ahora qué?". */
interface CreatedCampaign {
    id: string
    title: string
    isCrisis: boolean
    accountsSaved: number
    accountsFailed: number
}

const TOTAL_STEPS = 5

export function CreateCampaignForm({
    profile,
    categories,
    crisisEnabled = false,
    crisisForced = false,
    hasWithdrawalAccounts = false,
}: CreateCampaignFormProps) {
    const [currentStep, setCurrentStep] = useState(1)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [created, setCreated] = useState<CreatedCampaign | null>(null)
    const [uploading, setUploading] = useState(false)
    const [uploadProgress, setUploadProgress] = useState({ done: 0, total: 0 })
    const [stateDropdownOpen, setStateDropdownOpen] = useState(false)
    const [draftRestored, setDraftRestored] = useState(false)
    // Errores por campo: el mensaje vive junto al control que falló, no en un
    // solo banner arriba (mejor recuperación y soporte para lectores de pantalla).
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

    // Borrador por usuario. El móvil lento es el caso base: una recarga o un
    // cambio de app no debe borrar una historia de 1.500 caracteres.
    const DRAFT_KEY = `lavaca:campaign-draft:${profile.id}`

    const [formData, setFormData] = useState({
        title: '',
        category_id: '',
        description: '',
        goal_amount_usd: '',
        is_open_ended: false,
        story: '',
        location: '',
        state: '',
        urgency_level: 'medium',
        campaign_type: 'normal',
        // Cuentas donde el creador recibe los pagos directos (campañas crisis).
        // Son serializables, así que sobreviven en el borrador local.
        receiving_accounts: [] as ReceivingAccountInput[],
        main_image: null as File | null,
        gallery_images: [] as File[],
        support_documents: [] as File[]
    })

    // Una campaña es "crisis" si el admin lo forzó o si el creador la eligió
    // con el modo habilitado. Define qué muestra el paso "Cómo recibir el dinero".
    const isCrisisCampaign = crisisForced || (crisisEnabled && formData.campaign_type === 'crisis')

    const mainImageRef = useRef<HTMLInputElement>(null)
    const galleryRef = useRef<HTMLInputElement>(null)
    const documentsRef = useRef<HTMLInputElement>(null)

    const supabase = createClient()

    // Restaurar borrador al montar. Solo texto y selecciones: los archivos no
    // se pueden serializar, así que se vuelven a adjuntar en el paso Multimedia.
    useEffect(() => {
        try {
            const raw = localStorage.getItem(DRAFT_KEY)
            if (!raw) return
            const saved = JSON.parse(raw)
            if (saved?.formData) {
                setFormData(prev => ({
                    ...prev,
                    ...saved.formData,
                    main_image: null,
                    gallery_images: [],
                    support_documents: [],
                }))
                if (saved.formData.title || saved.formData.story) setDraftRestored(true)
            }
            // Tope en el paso 2: los archivos se perdieron, así que el creador
            // vuelve a pasar por Multimedia antes de la revisión.
            if (saved?.currentStep) setCurrentStep(Math.min(saved.currentStep, 2))
        } catch {
            // borrador corrupto o storage no disponible: se ignora
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // Guardar borrador en cada cambio (best-effort, sin archivos).
    useEffect(() => {
        try {
            const { main_image, gallery_images, support_documents, ...serializable } = formData
            localStorage.setItem(DRAFT_KEY, JSON.stringify({ formData: serializable, currentStep }))
        } catch {
            // storage lleno o no disponible: el borrador es opcional
        }
    }, [formData, currentStep, DRAFT_KEY])

    const steps = [
        { number: 1, title: 'Información básica', description: 'Título, categoría y meta' },
        { number: 2, title: 'Historia', description: 'Descripción detallada' },
        { number: 3, title: 'Multimedia', description: 'Fotos y documentos' },
        {
            number: 4,
            title: 'Cómo recibir el dinero',
            description: isCrisisCampaign ? 'Cuentas donde te pagarán' : 'Dónde retirarás lo recaudado',
        },
        { number: 5, title: 'Revisión', description: 'Confirmar y enviar' }
    ]

    // Zona de carga accesible: es un <button> real (operable con teclado y
    // lectores de pantalla) con foco visible, no un <div onClick>.
    const dropzoneClass =
        'w-full border-2 border-dashed border-muted-foreground/25 bg-muted/20 rounded-lg p-4 text-center cursor-pointer transition-colors hover:border-muted-foreground/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed'

    const updateFormData = (field: string, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }))
        // Limpiar el error del campo en cuanto el usuario lo corrige.
        setFieldErrors(prev => {
            if (!prev[field]) return prev
            const next = { ...prev }
            delete next[field]
            return next
        })
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

    // Orden de campos por paso, para enfocar el primero que falle.
    const fieldFocusIds: Record<string, string> = {
        title: 'title',
        category_id: 'category',
        goal_amount_usd: 'goal_amount_usd',
        story: 'story',
        main_image: 'main-image-upload',
    }

    const validateStep = (step: number) => {
        const errs: Record<string, string> = {}

        if (step === 1) {
            if (!formData.title.trim()) errs.title = 'El título es requerido'
            if (!formData.category_id) errs.category_id = 'Debes seleccionar una categoría'
            // Campaña "sin monto": no se valida la meta.
            if (!formData.is_open_ended && (!formData.goal_amount_usd || parseFloat(formData.goal_amount_usd) < 10)) {
                errs.goal_amount_usd = 'La meta debe ser de al menos $10 USD'
            }
        } else if (step === 2) {
            if (!formData.story.trim() || formData.story.length < 50) {
                errs.story = 'La historia debe tener al menos 50 caracteres'
            }
        } else if (step === 3) {
            if (!formData.main_image) errs.main_image = 'Debes subir una imagen principal'
        } else if (step === 4) {
            // Sin cuenta no hay forma de que te paguen: es el paso que más se
            // saltaba la gente, por eso es obligatorio en campañas crisis.
            if (isCrisisCampaign && formData.receiving_accounts.length === 0) {
                errs.receiving_accounts = 'Agrega al menos una cuenta para poder recibir donaciones'
            }
        }

        setFieldErrors(errs)

        const firstInvalid = Object.keys(errs)[0]
        if (firstInvalid) {
            const focusId = fieldFocusIds[firstInvalid]
            if (focusId) {
                requestAnimationFrame(() => document.getElementById(focusId)?.focus())
            }
            return false
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

        // Rechazar el lote completo si algún archivo no es válido, en lugar de
        // mostrar un error y adjuntarlo igual.
        if (files.some(file => !file.type.startsWith('image/'))) {
            setError('Solo se permiten archivos de imagen')
            e.target.value = ''
            return
        }
        if (files.some(file => file.size > 5 * 1024 * 1024)) {
            setError('Las imágenes deben ser menores a 5MB')
            e.target.value = ''
            return
        }

        if (type === 'main' && files.length > 0) {
            updateFormData('main_image', files[0])
        } else if (type === 'gallery') {
            updateFormData('gallery_images', [...formData.gallery_images, ...files])
        }

        setError(null)
    }

    const handleDocumentSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || [])

        if (files.some(file => file.size > 10 * 1024 * 1024)) {
            setError('Los documentos deben ser menores a 10MB')
            e.target.value = ''
            return
        }

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
            setCurrentStep(prev => Math.min(prev + 1, TOTAL_STEPS))
            // En móvil el botón queda abajo: al cambiar de paso subimos al indicador.
            requestAnimationFrame(() => document.getElementById('campaign-steps')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
        }
    }

    const prevStep = () => {
        setCurrentStep(prev => Math.max(prev - 1, 1))
    }

    const addReceivingAccount = (account: ReceivingAccountInput) => {
        updateFormData('receiving_accounts', [...formData.receiving_accounts, account])
    }

    const removeReceivingAccount = (index: number) => {
        updateFormData('receiving_accounts', formData.receiving_accounts.filter((_, i) => i !== index))
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (currentStep !== TOTAL_STEPS) {
            setError('Completa todos los pasos y usa "Enviar a revisión" en la pantalla final.')
            return
        }

        if (!validateStep(3)) return
        if (!validateStep(4)) {
            setCurrentStep(4)
            return
        }

        setLoading(true)
        setError(null)
        setUploading(true)

        // Progreso real: un paso por cada archivo que se sube.
        const totalUploads = (formData.main_image ? 1 : 0) +
            formData.gallery_images.length +
            formData.support_documents.length
        setUploadProgress({ done: 0, total: totalUploads })
        const bumpProgress = () => setUploadProgress(prev => ({ ...prev, done: prev.done + 1 }))

        try {
            // Upload main image
            const mainImageUrl = formData.main_image
                ? await handleFileUpload(formData.main_image, 'campaigns', 'main-images').then(url => { bumpProgress(); return url })
                : null

            // Upload gallery images
            const galleryUrls = await Promise.all(
                formData.gallery_images.map(file =>
                    handleFileUpload(file, 'campaigns', 'gallery').then(url => { bumpProgress(); return url })
                )
            )

            // Create campaign
            const slug = generateSlug(formData.title)

            // All campaigns must pass manual underwriting review before publication
            const initialStatus = 'pending_review'

            const { data: campaign, error: campaignError } = await supabase
                .from('campaigns')
                .insert({
                    creator_id: profile.id,
                    title: formData.title,
                    slug: slug,
                    story: formData.story,
                    // Resumen corto derivado de la historia (columna legacy
                    // `description`); `category` legacy = nombre de la categoría.
                    description: formData.story.slice(0, 200),
                    category: selectedCategory?.name ?? '',
                    goal_amount_usd: formData.is_open_ended ? 0 : parseFloat(formData.goal_amount_usd),
                    is_open_ended: formData.is_open_ended,
                    current_amount_usd: 0,
                    category_id: formData.category_id,
                    location: fullLocation || null,
                    urgency_level: formData.urgency_level,
                    campaign_type: crisisForced
                        ? 'crisis'
                        : (crisisEnabled && formData.campaign_type === 'crisis' ? 'crisis' : 'normal'),
                    main_image_url: mainImageUrl,
                    featured_image_url: mainImageUrl,
                    status: initialStatus
                })
                .select()
                .single()

            if (campaignError) {
                setError(campaignError.message)
                return
            }

            // Upload support documents in dedicated documents/<campaignId>/ folder
            const documentUrls = await Promise.all(
                formData.support_documents.map(file =>
                    handleFileUpload(file, 'campaigns', `documents/${campaign.id}`).then(url => { bumpProgress(); return url })
                )
            )

            setUploading(false)

            // Create campaign details (compatible with both support_documents and support_documents_urls schemas)
            const { error: detailsError } = await supabase
                .from('campaign_details')
                .insert({
                    campaign_id: campaign.id,
                    gallery_images: galleryUrls,
                    support_documents: documentUrls,
                    full_story: formData.story,
                })

            if (detailsError) {
                const shouldFallbackToLegacyColumn =
                    detailsError.message?.toLowerCase().includes('support_documents')

                if (!shouldFallbackToLegacyColumn) {
                    setError(detailsError.message)
                    return
                }

                const { error: detailsLegacyError } = await supabase
                    .from('campaign_details')
                    .insert({
                        campaign_id: campaign.id,
                        gallery_images: galleryUrls,
                        support_documents_urls: documentUrls,
                        full_story: formData.story,
                    })

                if (detailsLegacyError) {
                    setError(detailsLegacyError.message)
                    return
                }
            }

            // Cuentas para recibir (campañas crisis): se guardan una a una vía
            // API para reutilizar la validación server-side. Si alguna falla,
            // no se pierde la campaña: se avisa y se puede completar después.
            const isCrisis = campaign.campaign_type === 'crisis'
            let accountsSaved = 0
            let accountsFailed = 0
            if (isCrisis && formData.receiving_accounts.length > 0) {
                for (const account of formData.receiving_accounts) {
                    try {
                        const res = await fetch(`/api/campaigns/${campaign.id}/crisis-accounts`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(account),
                        })
                        if (res.ok) accountsSaved += 1
                        else accountsFailed += 1
                    } catch {
                        accountsFailed += 1
                    }
                }
            }

            // El borrador ya se convirtió en campaña: limpiarlo.
            try { localStorage.removeItem(DRAFT_KEY) } catch { /* noop */ }
            setDraftRestored(false)

            setCreated({
                id: campaign.id,
                title: campaign.title,
                isCrisis,
                accountsSaved,
                accountsFailed,
            })
            requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'smooth' }))

        } catch (err) {
            console.error('Campaign creation error:', err)
            setError(err instanceof Error ? err.message : 'Ocurrió un error inesperado')
        } finally {
            setLoading(false)
            setUploading(false)
        }
    }

    const selectedCategory = categories.find(c => c.id === formData.category_id)
    const fullLocation = [formData.location?.trim(), formData.state?.trim()].filter(Boolean).join(', ')
    const urgencyLabels: Record<string, string> = {
        low: 'Baja',
        medium: 'Media',
        high: 'Alta',
        critical: 'Crítica',
    }
    const urgencyDescriptions: Record<string, string> = {
        low: 'No hay prisa específica.',
        medium: 'Importante, pero no crítica.',
        high: 'Situación urgente que requiere atención pronta.',
        critical: 'Emergencia inmediata con alta prioridad.',
    }

    const isVerified = profile.kyc_status === 'verified'

    // Pantalla de "¿y ahora qué?": en vez de redirigir a ciegas, dejamos claro
    // qué quedó listo, qué falta (cuentas, KYC) y qué sigue (revisión).
    if (created) {
        const accountsOk = !created.isCrisis || (created.accountsSaved > 0 && created.accountsFailed === 0)
        const checklist: { key: string; done: boolean; pending?: boolean; title: string; body: string; action?: React.ReactNode }[] = [
            {
                key: 'campaign',
                done: true,
                title: 'Campaña creada',
                body: `"${created.title}" quedó guardada y enviada a revisión.`,
            },
            created.isCrisis
                ? {
                    key: 'accounts',
                    done: accountsOk,
                    title: accountsOk
                        ? `Cuentas para recibir: ${created.accountsSaved} lista${created.accountsSaved === 1 ? '' : 's'}`
                        : created.accountsFailed > 0
                            ? `No pudimos guardar ${created.accountsFailed} cuenta${created.accountsFailed === 1 ? '' : 's'}`
                            : 'Falta agregar tus cuentas para recibir',
                    body: accountsOk
                        ? 'Los donantes verán estos datos para pagarte directo. Puedes agregar o cambiar cuentas cuando quieras.'
                        : 'Sin cuentas nadie puede donarte. Agrégalas ahora, toma un minuto.',
                    action: (
                        <Button size="sm" variant={accountsOk ? 'outline' : 'default'} asChild>
                            <Link href={`/creator/campaigns/${created.id}/crisis`}>
                                <Wallet className="mr-2 h-4 w-4" />
                                {accountsOk ? 'Ver mis cuentas' : 'Agregar cuentas'}
                            </Link>
                        </Button>
                    ),
                }
                : {
                    key: 'withdrawal',
                    done: hasWithdrawalAccounts,
                    title: hasWithdrawalAccounts ? 'Cuenta de retiro configurada' : 'Configura una cuenta de retiro',
                    body: hasWithdrawalAccounts
                        ? 'Cuando recaudes, podrás solicitar retiros a esa cuenta desde "Mis campañas".'
                        : 'Es donde te enviaremos lo recaudado. Puedes hacerlo ahora o antes de tu primer retiro.',
                    action: !hasWithdrawalAccounts ? (
                        <Button size="sm" asChild>
                            <Link href="/profile">
                                <Wallet className="mr-2 h-4 w-4" />
                                Agregar cuenta de retiro
                            </Link>
                        </Button>
                    ) : undefined,
                },
            {
                key: 'kyc',
                done: isVerified,
                title: isVerified ? 'Identidad verificada' : 'Verifica tu identidad',
                body: isVerified
                    ? 'Tu campaña puede activarse en cuanto pase la revisión.'
                    : 'Sin verificación tu campaña no se activa ni recibe donaciones. Sube tu cédula en tu perfil.',
                action: !isVerified ? (
                    <Button size="sm" variant="outline" asChild>
                        <Link href="/profile">
                            <ShieldCheck className="mr-2 h-4 w-4" />
                            Verificar identidad
                        </Link>
                    </Button>
                ) : undefined,
            },
            {
                key: 'review',
                done: false,
                pending: true,
                title: 'Revisión del equipo LaVaca',
                body: 'Revisamos cada campaña a mano. Suele tomar entre 24 y 48 horas; te avisamos por correo y en tus notificaciones cuando esté activa.',
            },
        ]

        return (
            <div className="space-y-6" role="status" aria-live="polite">
                <div className="rounded-xl border border-primary/30 bg-primary/5 p-5 md:p-6">
                    <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                            <Check className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                            <h2 className="text-xl font-bold">¡Tu campaña fue enviada!</h2>
                            <p className="mt-1 text-sm text-foreground/80">
                                {accountsOk
                                    ? 'Ya está casi todo listo. Esto es lo que sigue:'
                                    : 'Queda un paso importante antes de que puedas recibir donaciones:'}
                            </p>
                        </div>
                    </div>
                </div>

                <ol className="space-y-3">
                    {checklist.map((item) => (
                        <li
                            key={item.key}
                            className={cn(
                                'flex items-start gap-3 rounded-xl border p-4',
                                item.done ? 'bg-card' : item.pending ? 'bg-muted/30' : 'border-accent/40 bg-accent/10'
                            )}
                        >
                            {item.done ? (
                                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-label="Listo" />
                            ) : item.pending ? (
                                <Clock className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-label="Pendiente" />
                            ) : (
                                <Circle className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-label="Falta" />
                            )}
                            <div className="min-w-0 flex-1 space-y-2">
                                <p className="font-medium leading-tight">{item.title}</p>
                                <p className="text-sm text-foreground/75">{item.body}</p>
                                {item.action}
                            </div>
                        </li>
                    ))}
                </ol>

                <div className="flex flex-col gap-2 border-t pt-4 sm:flex-row sm:justify-end">
                    <Button variant="outline" asChild>
                        <Link href={`/creator/campaigns/${created.id}/edit`}>Editar campaña</Link>
                    </Button>
                    <Button asChild>
                        <Link href="/creator/campaigns">
                            Ir a mis campañas
                            <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                    </Button>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-8">
            {/* Progress Steps */}
            <div id="campaign-steps" className="scroll-mt-24 rounded-xl border bg-muted/30 p-4 md:p-5">
                {/* Conectores flexibles (flex-1) y círculos shrink-0: la fila
                    se adapta de 320px en adelante sin desbordarse. */}
                <div className="flex items-center" aria-hidden="true">
                    {steps.map((step, index) => (
                        <Fragment key={step.number}>
                            <div className={`flex items-center justify-center w-8 h-8 shrink-0 rounded-full border-2 text-sm font-medium ${currentStep >= step.number
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'bg-background text-muted-foreground border-muted'
                                }`}>
                                {currentStep > step.number ? <Check className="h-4 w-4" /> : step.number}
                            </div>
                            {index < steps.length - 1 && (
                                <div className={`h-0.5 flex-1 mx-1.5 sm:mx-2 ${currentStep > step.number ? 'bg-primary' : 'bg-muted'
                                    }`} />
                            )}
                        </Fragment>
                    ))}
                </div>

                <div className="text-center mt-4">
                    <p className="text-xs text-muted-foreground">Paso {currentStep} de {steps.length}</p>
                    <h3 className="text-lg font-medium">{steps[currentStep - 1].title}</h3>
                    <p className="text-sm text-muted-foreground">{steps[currentStep - 1].description}</p>
                </div>
            </div>

            {draftRestored && (
                <Alert className="border-primary/30 bg-primary/5">
                    <AlertCircle className="h-4 w-4 text-primary" />
                    <AlertDescription className="text-foreground">
                        Recuperamos tu borrador. Revisa los datos y vuelve a adjuntar las imágenes y documentos antes de enviar.
                    </AlertDescription>
                </Alert>
            )}

            {error && (
                <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            <form
                onSubmit={handleSubmit}
                className="space-y-6"
                onKeyDown={(e) => {
                    // Enter en un input no debe "enviar a revisión" a medio camino:
                    // solo el botón de la pantalla final envía.
                    if (e.key === 'Enter' && currentStep < TOTAL_STEPS && (e.target as HTMLElement).tagName === 'INPUT') {
                        e.preventDefault()
                    }
                }}
            >
                {/* Step 1: Basic Information */}
                {currentStep === 1 && (
                    <div className="space-y-6 rounded-xl border bg-card p-4 md:p-6">
                        <div className="space-y-2">
                            <Label htmlFor="title">Título de la campaña *</Label>
                            <Input
                                id="title"
                                value={formData.title}
                                onChange={(e) => updateFormData('title', e.target.value)}
                                placeholder="Ej: Ayuda para cirugía de emergencia"
                                maxLength={100}
                                disabled={loading}
                                aria-invalid={!!fieldErrors.title}
                                aria-describedby={fieldErrors.title ? 'title-error' : undefined}
                            />
                            {fieldErrors.title && (
                                <p id="title-error" className="text-xs text-destructive">{fieldErrors.title}</p>
                            )}
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
                                <SelectTrigger
                                    id="category"
                                    aria-invalid={!!fieldErrors.category_id}
                                    aria-describedby={fieldErrors.category_id ? 'category-error' : undefined}
                                >
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
                            {fieldErrors.category_id && (
                                <p id="category-error" className="text-xs text-destructive">{fieldErrors.category_id}</p>
                            )}
                            {selectedCategory?.description && (
                                <p className="text-xs text-muted-foreground">
                                    {selectedCategory.description}
                                </p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="goal_amount_usd" className="flex items-center gap-2">
                                <DollarSign className="h-4 w-4" />
                                Meta de recaudación (USD) {formData.is_open_ended ? '' : '*'}
                            </Label>
                            <Input
                                id="goal_amount_usd"
                                type="number"
                                min="10"
                                step="0.01"
                                value={formData.is_open_ended ? '' : formData.goal_amount_usd}
                                onChange={(e) => updateFormData('goal_amount_usd', e.target.value)}
                                placeholder={formData.is_open_ended ? 'Sin meta fija' : '1500.00'}
                                disabled={loading || formData.is_open_ended}
                                aria-invalid={!!fieldErrors.goal_amount_usd}
                                aria-describedby={fieldErrors.goal_amount_usd ? 'goal-error' : undefined}
                            />
                            {fieldErrors.goal_amount_usd && (
                                <p id="goal-error" className="text-xs text-destructive">{fieldErrors.goal_amount_usd}</p>
                            )}

                            <label className="flex items-start gap-2 rounded-md border border-border bg-muted/30 p-3 cursor-pointer">
                                <Checkbox
                                    checked={formData.is_open_ended}
                                    onCheckedChange={(checked) => updateFormData('is_open_ended', Boolean(checked))}
                                    disabled={loading}
                                    className="mt-0.5"
                                />
                                <span className="text-sm">
                                    <span className="font-medium">Sin monto (campaña abierta)</span>
                                    <span className="block text-xs text-muted-foreground">
                                        Para causas benéficas donde el objetivo es ayudar, no alcanzar una cifra. No se muestra
                                        barra de objetivo y no hay límite: toda donación suma.
                                    </span>
                                </span>
                            </label>

                            {!formData.is_open_ended && (
                                <p className="text-xs text-muted-foreground">
                                    Monto mínimo: $10 USD. Sé realista con tu meta.
                                </p>
                            )}
                        </div>

                        <div className="grid md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="location">Ciudad (opcional)</Label>
                                <Input
                                    id="location"
                                    value={formData.location}
                                    onChange={(e) => updateFormData('location', e.target.value)}
                                    placeholder="Ej: Caracas"
                                    disabled={loading}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="state">Estado (opcional)</Label>
                                <Popover open={stateDropdownOpen} onOpenChange={setStateDropdownOpen}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            role="combobox"
                                            aria-expanded={stateDropdownOpen}
                                            className="w-full justify-between"
                                            disabled={loading}
                                        >
                                            {formData.state || 'Selecciona un estado'}
                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                                        <Command>
                                            <CommandInput placeholder="Buscar estado..." />
                                            <CommandList>
                                                <CommandEmpty>No se encontró el estado.</CommandEmpty>
                                                <CommandGroup>
                                                    {VENEZUELA_STATES.map((stateName) => (
                                                        <CommandItem
                                                            key={stateName}
                                                            value={stateName}
                                                            onSelect={(selected) => {
                                                                updateFormData('state', selected)
                                                                setStateDropdownOpen(false)
                                                            }}
                                                        >
                                                            <Check
                                                                className={cn(
                                                                    'mr-2 h-4 w-4',
                                                                    formData.state === stateName ? 'opacity-100' : 'opacity-0'
                                                                )}
                                                            />
                                                            {stateName}
                                                        </CommandItem>
                                                    ))}
                                                </CommandGroup>
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="urgency">Nivel de urgencia</Label>
                            <Select
                                value={formData.urgency_level}
                                onValueChange={(value) => updateFormData('urgency_level', value)}
                                disabled={loading}
                            >
                                <SelectTrigger id="urgency" className="h-11 px-3">
                                    <SelectValue placeholder="Selecciona un nivel" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="low" className="py-2">Baja</SelectItem>
                                    <SelectItem value="medium" className="py-2">Media</SelectItem>
                                    <SelectItem value="high" className="py-2">Alta</SelectItem>
                                    <SelectItem value="critical" className="py-2">Crítica</SelectItem>
                                </SelectContent>
                            </Select>
                            <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                                <span className="font-medium text-foreground">{urgencyLabels[formData.urgency_level] || 'Urgencia'}:</span>{' '}
                                {urgencyDescriptions[formData.urgency_level] || 'Selecciona el nivel que mejor describa tu caso.'}
                            </div>
                        </div>

                        {/* Modo crisis forzado: todas las campañas nacen en crisis, sin selector */}
                        {crisisForced && (
                            <div className="rounded-md border border-orange-200 dark:border-orange-900 bg-orange-50/50 dark:bg-orange-950/20 px-3 py-2 text-xs text-foreground/80">
                                <span className="font-medium"></span> por la emergencia, tu campaña
                                se creará en modo crisis. Podrás publicar tus propias cuentas para recibir pagos
                                directos y la plataforma no cobra comisión por estas campañas.
                            </div>
                        )}

                        {/* Tipo de campaña (solo si el modo crisis está habilitado y NO forzado) */}
                        {crisisEnabled && !crisisForced && (
                            <div className="space-y-2">
                                <Label htmlFor="campaign-type">Tipo de campaña</Label>
                                <Select
                                    value={formData.campaign_type}
                                    onValueChange={(value) => updateFormData('campaign_type', value)}
                                    disabled={loading}
                                >
                                    <SelectTrigger id="campaign-type" className="h-11 px-3">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="normal" className="py-2">Normal</SelectItem>
                                        <SelectItem value="crisis" className="py-2">Crisis (emergencia)</SelectItem>
                                    </SelectContent>
                                </Select>
                                <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                                    {formData.campaign_type === 'crisis' ? (
                                        <>
                                            <span className="font-medium text-foreground">Crisis:</span> además del método normal,
                                            podrás publicar tus propias cuentas de pago para que la gente te pague directo y tú confirmes
                                            esos aportes. Ideal para emergencias donde necesitas recibir ayuda lo antes posible.
                                        </>
                                    ) : (
                                        <>
                                            <span className="font-medium text-foreground">Normal:</span> las donaciones pasan por la
                                            plataforma (con comisión y retiros). Es el método estándar.
                                        </>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Step 2: Story */}
                {currentStep === 2 && (
                    <div className="space-y-6 rounded-xl border bg-card p-4 md:p-6">
                        <div className="space-y-2">
                            <Label htmlFor="story">Historia de tu campaña *</Label>
                            <Textarea
                                id="story"
                                value={formData.story}
                                onChange={(e) => updateFormData('story', e.target.value)}
                                placeholder="Cuenta tu historia de manera personal y auténtica. Explica por qué necesitas ayuda, cómo usarás los fondos y por qué es importante para ti..."
                                rows={12}
                                maxLength={2000}
                                disabled={loading}
                                className="resize-none"
                                aria-invalid={!!fieldErrors.story}
                                aria-describedby={fieldErrors.story ? 'story-error' : undefined}
                            />
                            {fieldErrors.story && (
                                <p id="story-error" className="text-xs text-destructive">{fieldErrors.story}</p>
                            )}
                            <div className="flex justify-between items-center text-xs text-muted-foreground">
                                <span>{formData.story.length}/2000 caracteres</span>
                                <span>Mínimo 50 caracteres</span>
                            </div>
                        </div>

                        <Card className="border-border/70 bg-muted/30">
                            <CardHeader>
                                <CardTitle className="text-base">Consejos para una buena historia</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="flex gap-3">
                                    <Users className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                                    <div>
                                        <p className="font-medium text-sm">Sé personal</p>
                                        <p className="text-xs text-muted-foreground">Comparte tu historia personal. La gente se conecta con experiencias reales.</p>
                                    </div>
                                </div>
                                <div className="flex gap-3">
                                    <Target className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                                    <div>
                                        <p className="font-medium text-sm">Sé específico</p>
                                        <p className="text-xs text-muted-foreground">Explica exactamente para qué necesitas el dinero y cómo lo usarás.</p>
                                    </div>
                                </div>
                                <div className="flex gap-3">
                                    <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
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
                    <div className="space-y-6 rounded-xl border bg-card p-4 md:p-6">
                        {/* Main Image */}
                        <div className="space-y-3">
                            <Label htmlFor="main-image-input">Imagen principal *</Label>
                            {formData.main_image ? (
                                <div className="border-2 border-dashed border-muted-foreground/25 bg-muted/20 rounded-lg p-6 text-center">
                                    <div className="space-y-2">
                                        <ImageIcon className="h-8 w-8 mx-auto text-primary" />
                                        <p className="text-sm font-medium text-primary">{formData.main_image.name}</p>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => {
                                                updateFormData('main_image', null)
                                                if (mainImageRef.current) mainImageRef.current.value = ''
                                            }}
                                        >
                                            Cambiar imagen
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    id="main-image-upload"
                                    onClick={() => mainImageRef.current?.click()}
                                    disabled={loading}
                                    aria-describedby={`main-image-hint${fieldErrors.main_image ? ' main-image-error' : ''}`}
                                    aria-invalid={!!fieldErrors.main_image}
                                    className={dropzoneClass}
                                >
                                    <div className="space-y-2">
                                        <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                                        <p className="text-sm">Haz clic o presiona Enter para subir la imagen principal</p>
                                        <p id="main-image-hint" className="text-xs text-muted-foreground">JPG, PNG hasta 5MB</p>
                                    </div>
                                </button>
                            )}
                            {fieldErrors.main_image && (
                                <p id="main-image-error" className="text-xs text-destructive">{fieldErrors.main_image}</p>
                            )}
                            <input
                                ref={mainImageRef}
                                id="main-image-input"
                                type="file"
                                accept="image/*"
                                onChange={(e) => handleImageSelect('main', e)}
                                className="hidden"
                                disabled={loading}
                            />
                        </div>

                        {/* Gallery Images */}
                        <div className="space-y-3">
                            <Label>Galería de imágenes (opcional)</Label>
                            <button
                                type="button"
                                onClick={() => galleryRef.current?.click()}
                                disabled={loading}
                                className={dropzoneClass}
                            >
                                <Upload className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
                                <p className="text-sm">Agregar más imágenes</p>
                            </button>
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
                                        <div key={index} className="relative bg-muted/60 border rounded-lg p-3">
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
                            <Label>Documentos de soporte (opcional)</Label>
                            <p className="text-xs text-muted-foreground">
                                Sube documentos que respalden tu campaña (informes médicos, presupuestos, etc.)
                            </p>
                            <button
                                type="button"
                                onClick={() => documentsRef.current?.click()}
                                disabled={loading}
                                className={dropzoneClass}
                            >
                                <FileText className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
                                <p className="text-sm">Agregar documentos</p>
                                <p className="text-xs text-muted-foreground">PDF, DOC, JPG hasta 10MB cada uno</p>
                            </button>
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
                                        <div key={index} className="flex items-center gap-3 p-3 bg-muted/60 border rounded-lg">
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

                {/* Step 4: Cómo recibir el dinero */}
                {currentStep === 4 && (
                    <div className="space-y-6 rounded-xl border bg-card p-4 md:p-6">
                        {isCrisisCampaign ? (
                            <>
                                <div className="space-y-1">
                                    <h3 className="flex items-center gap-2 text-lg font-semibold">
                                        <Wallet className="h-5 w-5 text-primary" />
                                        ¿Dónde te van a pagar?
                                    </h3>
                                    <p className="text-sm text-foreground/75">
                                        En esta campaña los donantes te pagan <strong>directo a tu cuenta</strong> y tú confirmas
                                        cada pago. Estos datos se mostrarán públicamente en tu campaña.{' '}
                                        <strong>Sin al menos una cuenta, nadie puede donarte.</strong>
                                    </p>
                                </div>

                                {fieldErrors.receiving_accounts && (
                                    <Alert variant="destructive" id="receiving-accounts-error">
                                        <AlertCircle className="h-4 w-4" />
                                        <AlertDescription>{fieldErrors.receiving_accounts}</AlertDescription>
                                    </Alert>
                                )}

                                {formData.receiving_accounts.length > 0 ? (
                                    <div className="space-y-2">
                                        <p className="text-sm font-medium">
                                            Cuentas agregadas ({formData.receiving_accounts.length})
                                        </p>
                                        <ul className="space-y-2">
                                            {formData.receiving_accounts.map((account, index) => (
                                                <li key={`${account.account_type}-${index}`}>
                                                    <ReceivingAccountItem
                                                        account={account}
                                                        actions={
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-9 w-9 p-0 text-muted-foreground hover:text-destructive"
                                                                onClick={() => removeReceivingAccount(index)}
                                                                aria-label={`Quitar cuenta ${RECEIVING_ACCOUNT_LABEL[account.account_type]}`}
                                                                disabled={loading}
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        }
                                                    />
                                                </li>
                                            ))}
                                        </ul>
                                        <p className="text-xs text-muted-foreground">
                                            Tip: PagoMóvil + Zelle cubre a casi todos los donantes. Puedes agregar más.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="rounded-lg border border-dashed border-accent/50 bg-accent/5 p-4 text-sm">
                                        <p className="font-medium">Aún no has agregado ninguna cuenta.</p>
                                        <p className="mt-1 text-foreground/75">
                                            Empieza por PagoMóvil: es lo que más usan los donantes en Venezuela.
                                        </p>
                                    </div>
                                )}

                                <div className="rounded-lg border bg-muted/30 p-4">
                                    <p className="mb-3 text-sm font-medium">
                                        {formData.receiving_accounts.length > 0 ? 'Agregar otra cuenta' : 'Agregar cuenta'}
                                    </p>
                                    <ReceivingAccountForm
                                        defaultHolderName={profile.full_name || ''}
                                        onAdd={addReceivingAccount}
                                        submitting={loading}
                                        submitLabel="Agregar a la lista"
                                    />
                                </div>

                                <p className="text-xs text-muted-foreground">
                                    Agrega solo cuentas a tu nombre o de un familiar de confianza. LaVaca no intermedia ni
                                    custodia estos pagos; tú los confirmas desde tu panel.
                                </p>
                            </>
                        ) : (
                            <>
                                <div className="space-y-1">
                                    <h3 className="flex items-center gap-2 text-lg font-semibold">
                                        <Wallet className="h-5 w-5 text-primary" />
                                        ¿Cómo recibirás lo recaudado?
                                    </h3>
                                    <p className="text-sm text-foreground/75">
                                        Las donaciones entran a LaVaca (tarjeta, PayPal, PagoMóvil, Zelle, cripto) y luego
                                        las retiras a una cuenta tuya. Necesitas al menos una cuenta de retiro para cobrar.
                                    </p>
                                </div>

                                {hasWithdrawalAccounts ? (
                                    <div className="flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
                                        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                                        <div className="text-sm">
                                            <p className="font-medium">Ya tienes una cuenta de retiro configurada</p>
                                            <p className="mt-1 text-foreground/75">
                                                Podrás solicitar retiros desde "Mis campañas" cuando tengas saldo.{' '}
                                                <Link href="/profile" target="_blank" className="font-medium text-primary underline">
                                                    Ver o cambiar cuentas
                                                </Link>
                                            </p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-3 rounded-lg border border-accent/40 bg-accent/10 p-4">
                                        <div className="flex items-start gap-3">
                                            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
                                            <div className="text-sm">
                                                <p className="font-medium">Todavía no tienes una cuenta de retiro</p>
                                                <p className="mt-1 text-foreground/75">
                                                    Puedes seguir y enviar tu campaña ahora. Para retirar el dinero necesitarás
                                                    registrar una cuenta (PagoMóvil, banco en Bs, Zelle, PayPal o cripto) en tu perfil.
                                                    Tu borrador se guarda solo, así que puedes ir y volver sin perder nada.
                                                </p>
                                            </div>
                                        </div>
                                        <Button type="button" variant="outline" size="sm" asChild>
                                            <Link href="/profile" target="_blank" rel="noopener noreferrer">
                                                Configurar cuenta de retiro
                                                <ExternalLink className="ml-2 h-3.5 w-3.5" />
                                            </Link>
                                        </Button>
                                    </div>
                                )}

                                <div className="grid gap-3 text-sm sm:grid-cols-3">
                                    <div className="rounded-lg border bg-muted/30 p-3">
                                        <p className="font-medium">1. Donan</p>
                                        <p className="text-xs text-muted-foreground">El donante paga con el método que tenga a mano.</p>
                                    </div>
                                    <div className="rounded-lg border bg-muted/30 p-3">
                                        <p className="font-medium">2. Se acredita</p>
                                        <p className="text-xs text-muted-foreground">Ves tu saldo en Bs y en USD por separado.</p>
                                    </div>
                                    <div className="rounded-lg border bg-muted/30 p-3">
                                        <p className="font-medium">3. Retiras</p>
                                        <p className="text-xs text-muted-foreground">Solicitas el retiro a tu cuenta y te lo enviamos.</p>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                )}

                {/* Step 5: Review */}
                {currentStep === 5 && (
                    <div className="space-y-6 rounded-xl border bg-card p-4 md:p-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Resumen de tu campaña</CardTitle>
                                <CardDescription>
                                    Revisa todos los detalles antes de enviar tu campaña para aprobación
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid md:grid-cols-2 gap-4">
                                    <div className="rounded-lg border bg-muted/30 p-3">
                                        <Label className="text-xs text-muted-foreground">Título</Label>
                                        <p className="font-medium">{formData.title}</p>
                                    </div>
                                    <div className="rounded-lg border bg-muted/30 p-3">
                                        <Label className="text-xs text-muted-foreground">Categoría</Label>
                                        <p className="font-medium">{selectedCategory?.name}</p>
                                    </div>
                                    <div className="rounded-lg border bg-muted/30 p-3">
                                        <Label className="text-xs text-muted-foreground">Meta</Label>
                                        <p className="font-medium font-mono">{formData.is_open_ended ? 'Sin meta fija' : formatUsd(parseFloat(formData.goal_amount_usd) || 0)}</p>
                                    </div>
                                    <div className="rounded-lg border bg-muted/30 p-3">
                                        <Label className="text-xs text-muted-foreground">Ubicación</Label>
                                        <p className="font-medium">{fullLocation || 'No especificada'}</p>
                                    </div>
                                </div>

                                <Separator />

                                <div className="rounded-lg border bg-muted/30 p-3">
                                    <Label className="text-xs text-muted-foreground">Historia</Label>
                                    <p className="text-sm mt-1 line-clamp-3">{formData.story}</p>
                                </div>

                                <Separator />

                                <div className="flex gap-4">
                                    <div>
                                        <Label className="text-xs text-muted-foreground">Imagen principal</Label>
                                        <p className="text-sm">{formData.main_image ? '✓ Subida' : '✗ Faltante'}</p>
                                    </div>
                                    <div>
                                        <Label className="text-xs text-muted-foreground">Galería</Label>
                                        <p className="text-sm">{formData.gallery_images.length} imágenes</p>
                                    </div>
                                    <div>
                                        <Label className="text-xs text-muted-foreground">Documentos</Label>
                                        <p className="text-sm">{formData.support_documents.length} archivos</p>
                                    </div>
                                </div>

                                <Separator />

                                {/* Cómo recibirás el dinero: visible en el resumen para que
                                    nadie envíe la campaña sin darse cuenta de que falta. */}
                                <div
                                    className={cn(
                                        'rounded-lg border p-3',
                                        isCrisisCampaign && formData.receiving_accounts.length === 0
                                            ? 'border-accent/50 bg-accent/10'
                                            : 'bg-muted/30'
                                    )}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <Label className="text-xs text-muted-foreground">Cómo recibirás el dinero</Label>
                                            {isCrisisCampaign ? (
                                                formData.receiving_accounts.length > 0 ? (
                                                    <ul className="mt-1 space-y-1 text-sm">
                                                        {formData.receiving_accounts.map((a, i) => (
                                                            <li key={i} className="flex items-center gap-2">
                                                                <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                                                                <span className="font-medium">{RECEIVING_ACCOUNT_LABEL[a.account_type]}</span>
                                                                <span className="truncate text-muted-foreground">{receivingAccountSummary(a)}</span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                ) : (
                                                    <p className="mt-1 text-sm font-medium text-foreground">
                                                        Sin cuentas: nadie podrá donarte hasta que agregues una.
                                                    </p>
                                                )
                                            ) : (
                                                <p className="mt-1 text-sm">
                                                    {hasWithdrawalAccounts
                                                        ? 'Retiros a tu cuenta configurada en el perfil.'
                                                        : 'Aún sin cuenta de retiro. Podrás configurarla en tu perfil antes de cobrar.'}
                                                </p>
                                            )}
                                        </div>
                                        <Button type="button" variant="outline" size="sm" onClick={() => setCurrentStep(4)} disabled={loading || uploading}>
                                            {isCrisisCampaign && formData.receiving_accounts.length === 0 ? 'Agregar' : 'Editar'}
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Alert className="bg-primary/10 border-primary/20">
                            <AlertCircle className="h-4 w-4 text-primary" />
                            <AlertDescription>
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
                                            <span>
                                                {uploadProgress.total > 0
                                                    ? `${uploadProgress.done} de ${uploadProgress.total}`
                                                    : 'Por favor espera'}
                                            </span>
                                        </div>
                                        <Progress
                                            value={uploadProgress.total > 0
                                                ? (uploadProgress.done / uploadProgress.total) * 100
                                                : 0}
                                            className="w-full"
                                        />
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
                        className="min-w-[120px]"
                    >
                        Anterior
                    </Button>

                    {currentStep < TOTAL_STEPS ? (
                        <Button
                            type="button"
                            onClick={nextStep}
                            disabled={loading || uploading}
                            className="min-w-[120px]"
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
                                'Enviar a revisión'
                            )}
                        </Button>
                    )}
                </div>
            </form>
        </div>
    )
}
