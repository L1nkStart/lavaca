'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Loader2, Upload, FileText, AlertCircle, Shield, CheckCircle2, Check, ChevronsUpDown } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

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

/**
 * Estado visual del KYC, derivado de combinar:
 *   - `users.kyc_status` (lo que realmente determina si podés crear campañas)
 *   - `verification_requests` más reciente (log de la solicitud, incluye motivo de rechazo)
 *
 * Estados:
 *   - 'loading'   → consultando.
 *   - 'verified'  → ya aprobado, sin form (success card).
 *   - 'in_review' → solicitud en revisión, sin form.
 *   - 'rejected'  → mostrar motivo de rechazo + form para reenviar.
 *   - 'new'       → primer envío, form completo sin alertas.
 */
type KycViewState = 'loading' | 'verified' | 'in_review' | 'rejected' | 'new'

export function KYCFormImproved() {
    const router = useRouter()
    const supabase = createClient()

    // Form state
    const [verificationType, setVerificationType] = useState<'individual' | 'company'>('individual')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [viewState, setViewState] = useState<KycViewState>('loading')
    const [rejectionReason, setRejectionReason] = useState<string | null>(null)
    const [requestSubmittedAt, setRequestSubmittedAt] = useState<string | null>(null)
    const [verifiedAt, setVerifiedAt] = useState<string | null>(null)
    const [accountEmail, setAccountEmail] = useState('')
    const [stateDropdownOpen, setStateDropdownOpen] = useState(false)

    // Personal data
    const [fullName, setFullName] = useState('')
    const [documentType, setDocumentType] = useState<'cedula' | 'rif' | 'passport'>('cedula')
    const [documentNumber, setDocumentNumber] = useState('')
    const [birthDate, setBirthDate] = useState('')
    const [nationality, setNationality] = useState('Venezolana')
    const [phone, setPhone] = useState('')
    const [email, setEmail] = useState('')
    const [address, setAddress] = useState('')
    const [city, setCity] = useState('')
    const [state, setState] = useState('')

    // Company data
    const [companyName, setCompanyName] = useState('')
    const [companyRif, setCompanyRif] = useState('')
    const [companyType, setCompanyType] = useState('C.A.')

    // Documents
    const [documentFront, setDocumentFront] = useState<File | null>(null)
    const [documentBack, setDocumentBack] = useState<File | null>(null)
    const [selfie, setSelfie] = useState<File | null>(null)
    const [proofOfAddress, setProofOfAddress] = useState<File | null>(null)
    const [companyRegistration, setCompanyRegistration] = useState<File | null>(null)

    useEffect(() => {
        const loadInitialKycContext = async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser()

                if (!user) {
                    setError('No autenticado')
                    setViewState('new')
                    return
                }

                setAccountEmail(user.email || '')
                setEmail(user.email || '')

                // Consultamos las dos fuentes de verdad en paralelo:
                //   - public.users.kyc_status: lo que decide si podés crear campañas.
                //   - verification_requests más reciente: para mostrar motivo de rechazo
                //     o "en revisión" según el estado.
                const [profileResult, requestResult] = await Promise.all([
                    supabase
                        .from('users')
                        .select('kyc_status, verified_at, kyc_rejected_reason')
                        .eq('id', user.id)
                        .maybeSingle(),
                    supabase
                        .from('verification_requests')
                        .select('status, rejection_reason, rejection_details, created_at, reviewed_at')
                        .eq('user_id', user.id)
                        .order('created_at', { ascending: false })
                        .limit(1)
                        .maybeSingle(),
                ])

                const kycStatus = profileResult.data?.kyc_status
                const latestRequest = requestResult.data

                if (kycStatus === 'verified') {
                    setVerifiedAt(profileResult.data?.verified_at || latestRequest?.reviewed_at || null)
                    setViewState('verified')
                    return
                }

                if (latestRequest && ['pending', 'under_review'].includes(latestRequest.status)) {
                    setRequestSubmittedAt(latestRequest.created_at)
                    setViewState('in_review')
                    return
                }

                const rejectionMessage =
                    latestRequest?.status === 'rejected'
                        ? [latestRequest.rejection_reason, latestRequest.rejection_details].filter(Boolean).join(' — ')
                        : profileResult.data?.kyc_rejected_reason

                if (kycStatus === 'rejected' || latestRequest?.status === 'rejected') {
                    setRejectionReason(
                        rejectionMessage ||
                            'Tu solicitud fue rechazada. Revisa y corrige la información antes de reenviar.',
                    )
                    setViewState('rejected')
                    return
                }

                setViewState('new')
            } catch (err: any) {
                setError(err.message || 'No se pudo cargar la información de verificación')
                setViewState('new')
            }
        }

        loadInitialKycContext()
    }, [supabase])

    const isSubmissionBlocked = viewState === 'loading' || viewState === 'in_review' || viewState === 'verified'

    const handleFileChange = (setter: (file: File | null) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        // Validate
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf']
        if (!allowedTypes.includes(file.type)) {
            setError('Solo se permiten archivos JPG, PNG o PDF')
            return
        }

        const maxSize = 5 * 1024 * 1024 // 5MB
        if (file.size > maxSize) {
            setError('El archivo debe ser menor a 5MB')
            return
        }

        setter(file)
        setError(null)
    }

    const uploadFile = async (file: File, folder: string): Promise<string> => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('No autenticado')

        const fileExt = file.name.split('.').pop()
        const uniqueSuffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

        // Compatibility matrix across environments:
        // - Some environments use `kyc-documents` bucket with path `kyc-documents/<uid>_...`
        // - Others use `verification-documents` bucket with path `<uid>/...`
        const uploadCandidates = [
            {
                bucket: 'kyc-documents',
                path: `kyc-documents/${user.id}_${folder}_${uniqueSuffix}.${fileExt}`
            },
            {
                bucket: 'kyc-documents',
                path: `${user.id}/${folder}_${uniqueSuffix}.${fileExt}`
            },
            {
                bucket: 'verification-documents',
                path: `${user.id}/${folder}_${uniqueSuffix}.${fileExt}`
            },
        ]

        const uploadErrors: string[] = []

        for (const candidate of uploadCandidates) {
            const { error: uploadError } = await supabase.storage
                .from(candidate.bucket)
                .upload(candidate.path, file)

            if (!uploadError) {
                const { data: { publicUrl } } = supabase.storage
                    .from(candidate.bucket)
                    .getPublicUrl(candidate.path)

                return publicUrl
            }

            uploadErrors.push(`${candidate.bucket}/${candidate.path} -> ${uploadError.message}`)
        }

        throw new Error(`No se pudo subir el documento por políticas de acceso. Detalle: ${uploadErrors[uploadErrors.length - 1]}`)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        try {
            if (viewState === 'in_review') {
                throw new Error('Ya tienes una solicitud de verificación en revisión. Debes esperar a que sea aprobada o rechazada.')
            }
            if (viewState === 'verified') {
                throw new Error('Tu cuenta ya está verificada.')
            }

            // Validate
            if (!fullName || !documentNumber || !phone || !email || !address) {
                throw new Error('Por favor completa todos los campos requeridos')
            }

            if (!documentFront || !selfie) {
                throw new Error('Debes subir al menos el documento (frente) y una selfie')
            }

            if (verificationType === 'company' && (!companyName || !companyRif)) {
                throw new Error('Por favor completa los datos de la empresa')
            }

            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('No autenticado')

            // Upload documents
            console.log('📤 Subiendo documentos...')
            const documentFrontUrl = await uploadFile(documentFront, 'document_front')
            const selfieUrl = await uploadFile(selfie, 'selfie')

            let documentBackUrl = null
            let proofOfAddressUrl = null
            let companyRegistrationUrl = null

            if (documentBack) {
                documentBackUrl = await uploadFile(documentBack, 'document_back')
            }

            if (proofOfAddress) {
                proofOfAddressUrl = await uploadFile(proofOfAddress, 'proof_of_address')
            }

            if (verificationType === 'company' && companyRegistration) {
                companyRegistrationUrl = await uploadFile(companyRegistration, 'company_registration')
            }

            // Create verification request
            console.log('📝 Creando solicitud de verificación...')
            const { error: insertError } = await supabase
                .from('verification_requests')
                .insert({
                    user_id: user.id,
                    verification_type: verificationType,
                    full_name: fullName,
                    document_type: documentType,
                    document_number: documentNumber,
                    birth_date: birthDate || null,
                    nationality: nationality,
                    phone: phone,
                    email: email,
                    address: address,
                    city: city || null,
                    state: state || null,
                    country: 'Venezuela',
                    company_name: verificationType === 'company' ? companyName : null,
                    company_rif: verificationType === 'company' ? companyRif : null,
                    company_type: verificationType === 'company' ? companyType : null,
                    document_front_url: documentFrontUrl,
                    document_back_url: documentBackUrl,
                    selfie_url: selfieUrl,
                    proof_of_address_url: proofOfAddressUrl,
                    company_registration_url: companyRegistrationUrl,
                    status: 'pending',
                })

            if (insertError) throw insertError

            // Marcamos el perfil del usuario como kyc pendiente. (La tabla real
            // se llama `users`, no `profiles` — bug que existía antes.)
            await supabase
                .from('users')
                .update({
                    kyc_status: 'pending',
                    kyc_rejected_reason: null,
                })
                .eq('id', user.id)

            // Cambiamos al estado "en revisión" sin redirigir, así el usuario
            // ve de inmediato que su envío llegó. router.refresh() actualiza
            // cualquier server component que dependa del kyc_status.
            setRejectionReason(null)
            setRequestSubmittedAt(new Date().toISOString())
            setViewState('in_review')
            router.refresh()

        } catch (err: any) {
            console.error('Error:', err)
            setError(err.message || 'Ocurrió un error al enviar la solicitud')
        } finally {
            setLoading(false)
        }
    }

    // ============================================================
    // RENDERS CONDICIONALES — antes del form
    // ============================================================

    if (viewState === 'loading') {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="ml-3 text-sm text-muted-foreground">
                    Cargando estado de verificación…
                </span>
            </div>
        )
    }

    if (viewState === 'verified') {
        return (
            <Card className="border-primary/30 bg-primary/5">
                <CardContent className="pt-6 space-y-4">
                    <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                            <CheckCircle2 className="h-6 w-6 text-primary" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <h3 className="text-lg font-semibold text-foreground">
                                Tu cuenta está verificada ✓
                            </h3>
                            <p className="text-sm text-muted-foreground mt-1">
                                Ya pasaste el proceso de verificación de identidad.
                                Puedes crear campañas y recibir donaciones sin restricciones.
                            </p>
                            {verifiedAt && (
                                <p className="text-xs text-muted-foreground mt-2">
                                    Verificado el{' '}
                                    {new Date(verifiedAt).toLocaleDateString('es-VE', {
                                        year: 'numeric',
                                        month: 'long',
                                        day: 'numeric',
                                    })}
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="border-t border-primary/20 pt-4">
                        <p className="text-xs text-muted-foreground">
                            Si necesitas actualizar tu información personal, escríbenos
                            a{' '}
                            <a href="mailto:soporte@lavaca.com.ve" className="underline">
                                soporte@lavaca.com.ve
                            </a>
                            .
                        </p>
                    </div>
                </CardContent>
            </Card>
        )
    }

    if (viewState === 'in_review') {
        return (
            <Card className="border-accent/40 bg-accent/10">
                <CardContent className="pt-6 space-y-4">
                    <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-full bg-accent/15 flex items-center justify-center shrink-0">
                            <Loader2 className="h-6 w-6 text-accent animate-spin" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <h3 className="text-lg font-semibold text-foreground">
                                Tu solicitud está en revisión
                            </h3>
                            <p className="text-sm text-muted-foreground mt-1">
                                Recibimos tus documentos y nuestro equipo los está
                                verificando. Cuando aprobemos o rechacemos tu solicitud,
                                te avisamos por correo y este panel se actualizará.
                            </p>
                            {requestSubmittedAt && (
                                <p className="text-xs text-muted-foreground mt-2">
                                    Enviada el{' '}
                                    {new Date(requestSubmittedAt).toLocaleDateString('es-VE', {
                                        year: 'numeric',
                                        month: 'long',
                                        day: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                    })}
                                </p>
                            )}
                        </div>
                    </div>

                    <Alert className="border-accent/40 bg-accent/10">
                        <Shield className="h-4 w-4" />
                        <AlertDescription className="text-sm">
                            Tiempo estimado de revisión:{' '}
                            <strong>menos de 48 horas hábiles</strong>. Si pasaron
                            más de 72 horas y no recibiste respuesta, escríbenos a{' '}
                            <a href="mailto:soporte@lavaca.com.ve" className="underline font-medium">
                                soporte@lavaca.com.ve
                            </a>
                            .
                        </AlertDescription>
                    </Alert>
                </CardContent>
            </Card>
        )
    }

    // viewState === 'new' o 'rejected' → renderizamos el form completo.
    // En 'rejected' además mostramos el motivo arriba.

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            {viewState === 'rejected' && rejectionReason && (
                <Card className="border-destructive/30 bg-destructive/5">
                    <CardContent className="pt-6 space-y-3">
                        <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                                <AlertCircle className="h-5 w-5 text-destructive" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <h3 className="font-semibold text-destructive">
                                    Tu solicitud anterior fue rechazada
                                </h3>
                                <p className="text-sm mt-2">
                                    <strong>Motivo:</strong> {rejectionReason}
                                </p>
                                <p className="text-xs text-muted-foreground mt-3">
                                    Revisa la información y vuelve a enviar el formulario.
                                    Asegúrate de corregir lo que indicamos arriba.
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Info Alert */}
            <Alert>
                <Shield className="h-4 w-4" />
                <AlertDescription>
                    <strong>Importante:</strong> No podrás crear campañas mientras revisamos tu solicitud.
                    La verificación toma 24-48 horas.
                </AlertDescription>
            </Alert>

            {/* Verification Type */}
            <Card>
                <CardHeader>
                    <CardTitle>Tipo de verificación</CardTitle>
                </CardHeader>
                <CardContent>
                    <RadioGroup value={verificationType} onValueChange={(v) => setVerificationType(v as any)}>
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="individual" id="individual" />
                            <Label htmlFor="individual" className="cursor-pointer">
                                👤 Persona natural (individual)
                            </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="company" id="company" />
                            <Label htmlFor="company" className="cursor-pointer">
                                🏢 Empresa / organización
                            </Label>
                        </div>
                    </RadioGroup>
                </CardContent>
            </Card>

            {/* Company Data (if applicable) */}
            {verificationType === 'company' && (
                <Card>
                    <CardHeader>
                        <CardTitle>Datos de la empresa</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <Label htmlFor="companyName">Nombre de la empresa *</Label>
                            <Input
                                id="companyName"
                                value={companyName}
                                onChange={(e) => setCompanyName(e.target.value)}
                                placeholder="Empresa ABC C.A."
                                required
                            />
                        </div>
                        <div className="grid md:grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="companyRif">RIF *</Label>
                                <Input
                                    id="companyRif"
                                    value={companyRif}
                                    onChange={(e) => setCompanyRif(e.target.value)}
                                    placeholder="J-12345678-9"
                                    required
                                />
                            </div>
                            <div>
                                <Label htmlFor="companyType">Tipo</Label>
                                <Input
                                    id="companyType"
                                    value={companyType}
                                    onChange={(e) => setCompanyType(e.target.value)}
                                    placeholder="C.A., S.A., etc."
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Personal Data */}
            <Card>
                <CardHeader>
                    <CardTitle>
                        {verificationType === 'company' ? 'Datos del representante legal' : 'Datos personales'}
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div>
                        <Label htmlFor="fullName">Nombre completo *</Label>
                        <Input
                            id="fullName"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            placeholder="Juan Pérez"
                            required
                            disabled={loading || isSubmissionBlocked}
                        />
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="documentType">Tipo de documento *</Label>
                            <select
                                id="documentType"
                                value={documentType}
                                onChange={(e) => setDocumentType(e.target.value as any)}
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2"
                                disabled={loading || isSubmissionBlocked}
                            >
                                <option value="cedula">Cédula</option>
                                <option value="rif">RIF</option>
                                <option value="passport">Pasaporte</option>
                            </select>
                        </div>
                        <div>
                            <Label htmlFor="documentNumber">Número de documento *</Label>
                            <Input
                                id="documentNumber"
                                value={documentNumber}
                                onChange={(e) => setDocumentNumber(e.target.value)}
                                placeholder="V-12345678"
                                required
                                disabled={loading || isSubmissionBlocked}
                            />
                        </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="birthDate">Fecha de nacimiento</Label>
                            <Input
                                id="birthDate"
                                type="date"
                                value={birthDate}
                                onChange={(e) => setBirthDate(e.target.value)}
                                disabled={loading || isSubmissionBlocked}
                            />
                        </div>
                        <div>
                            <Label htmlFor="nationality">Nacionalidad</Label>
                            <Input
                                id="nationality"
                                value={nationality}
                                onChange={(e) => setNationality(e.target.value)}
                                disabled={loading || isSubmissionBlocked}
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Contact Info */}
            <Card>
                <CardHeader>
                    <CardTitle>Información de contacto</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid md:grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="phone">Teléfono *</Label>
                            <Input
                                id="phone"
                                type="tel"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                placeholder="+58 424-1234567"
                                required
                                disabled={loading || isSubmissionBlocked}
                            />
                        </div>
                        <div>
                            <Label htmlFor="email">Email *</Label>
                            <Input
                                id="email"
                                type="email"
                                value={accountEmail || email}
                                placeholder="tu@email.com"
                                required
                                readOnly
                                disabled
                            />
                            <p className="text-xs text-muted-foreground">
                                Este correo está vinculado a tu cuenta y no puede modificarse.
                            </p>
                        </div>
                    </div>

                    <div>
                        <Label htmlFor="address">Dirección *</Label>
                        <Input
                            id="address"
                            value={address}
                            onChange={(e) => setAddress(e.target.value)}
                            placeholder="Av. Principal #123, Edificio XYZ"
                            required
                            disabled={loading || isSubmissionBlocked}
                        />
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="city">Ciudad</Label>
                            <Input
                                id="city"
                                value={city}
                                onChange={(e) => setCity(e.target.value)}
                                placeholder="Caracas"
                                disabled={loading || isSubmissionBlocked}
                            />
                        </div>
                        <div>
                            <Label htmlFor="state">Estado</Label>
                            <Popover open={stateDropdownOpen} onOpenChange={setStateDropdownOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={stateDropdownOpen}
                                        className="w-full justify-between"
                                        disabled={loading || isSubmissionBlocked}
                                    >
                                        {state || 'Selecciona un estado'}
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
                                                            setState(selected)
                                                            setStateDropdownOpen(false)
                                                        }}
                                                    >
                                                        <Check
                                                            className={cn(
                                                                'mr-2 h-4 w-4',
                                                                state === stateName ? 'opacity-100' : 'opacity-0'
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
                </CardContent>
            </Card>

            {/* Documents */}
            <Card>
                <CardHeader>
                    <CardTitle>Documentos</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div>
                        <Label htmlFor="documentFront">Documento (frente) * <span className="text-xs text-muted-foreground">JPG, PNG o PDF (máx. 5MB)</span></Label>
                        <Input
                            id="documentFront"
                            type="file"
                            accept=".jpg,.jpeg,.png,.pdf"
                            onChange={handleFileChange(setDocumentFront)}
                            required
                            disabled={loading || isSubmissionBlocked}
                        />
                        {documentFront && (
                            <p className="text-sm text-primary mt-1 flex items-center gap-1">
                                <CheckCircle2 className="h-4 w-4" /> {documentFront.name}
                            </p>
                        )}
                    </div>

                    <div>
                        <Label htmlFor="documentBack">Documento (reverso) <span className="text-xs text-muted-foreground">Opcional</span></Label>
                        <Input
                            id="documentBack"
                            type="file"
                            accept=".jpg,.jpeg,.png,.pdf"
                            onChange={handleFileChange(setDocumentBack)}
                            disabled={loading || isSubmissionBlocked}
                        />
                        {documentBack && (
                            <p className="text-sm text-primary mt-1 flex items-center gap-1">
                                <CheckCircle2 className="h-4 w-4" /> {documentBack.name}
                            </p>
                        )}
                    </div>

                    <div>
                        <Label htmlFor="selfie">Selfie con documento * <span className="text-xs text-muted-foreground">Foto tuya sosteniendo el documento</span></Label>
                        <Input
                            id="selfie"
                            type="file"
                            accept=".jpg,.jpeg,.png"
                            onChange={handleFileChange(setSelfie)}
                            required
                            disabled={loading || isSubmissionBlocked}
                        />
                        {selfie && (
                            <p className="text-sm text-primary mt-1 flex items-center gap-1">
                                <CheckCircle2 className="h-4 w-4" /> {selfie.name}
                            </p>
                        )}
                    </div>

                    <div>
                        <Label htmlFor="proofOfAddress">Comprobante de domicilio <span className="text-xs text-muted-foreground">Recibo de servicio</span></Label>
                        <Input
                            id="proofOfAddress"
                            type="file"
                            accept=".jpg,.jpeg,.png,.pdf"
                            onChange={handleFileChange(setProofOfAddress)}
                            disabled={loading || isSubmissionBlocked}
                        />
                        {proofOfAddress && (
                            <p className="text-sm text-primary mt-1 flex items-center gap-1">
                                <CheckCircle2 className="h-4 w-4" /> {proofOfAddress.name}
                            </p>
                        )}
                    </div>

                    {verificationType === 'company' && (
                        <div>
                            <Label htmlFor="companyRegistration">Registro mercantil / acta constitutiva *</Label>
                            <Input
                                id="companyRegistration"
                                type="file"
                                accept=".jpg,.jpeg,.png,.pdf"
                                onChange={handleFileChange(setCompanyRegistration)}
                                required
                                disabled={loading || isSubmissionBlocked}
                            />
                            {companyRegistration && (
                                <p className="text-sm text-primary mt-1 flex items-center gap-1">
                                    <CheckCircle2 className="h-4 w-4" /> {companyRegistration.name}
                                </p>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Instructions */}
            <Alert>
                <FileText className="h-4 w-4" />
                <AlertDescription>
                    <strong>Instrucciones:</strong>
                    <ul className="mt-2 space-y-1 text-sm">
                        <li>• Asegúrate de que todos los documentos sean legibles</li>
                        <li>• Las fotos deben ser claras y sin reflejos</li>
                        <li>• La selfie debe mostrar claramente tu rostro y el documento</li>
                        <li>• Los documentos no deben estar vencidos</li>
                    </ul>
                </AlertDescription>
            </Alert>

            {/* Submit Button */}
            <Button
                type="submit"
                size="lg"
                className="w-full"
                disabled={loading || isSubmissionBlocked}
            >
                {loading ? (
                    <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Enviando solicitud...
                    </>
                ) : (
                    <>
                        <Upload className="mr-2 h-4 w-4" />
                        Enviar solicitud de verificación
                    </>
                )}
            </Button>
        </form>
    )
}
