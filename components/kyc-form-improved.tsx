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

export function KYCFormImproved() {
    const router = useRouter()
    const supabase = createClient()

    // Form state
    const [verificationType, setVerificationType] = useState<'individual' | 'company'>('individual')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [checkingExistingRequest, setCheckingExistingRequest] = useState(true)
    const [existingRequestStatus, setExistingRequestStatus] = useState<string | null>(null)
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
                    return
                }

                setAccountEmail(user.email || '')
                setEmail(user.email || '')

                const { data: latestRequest } = await supabase
                    .from('verification_requests')
                    .select('status, created_at')
                    .eq('user_id', user.id)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle()

                if (latestRequest && ['pending', 'under_review'].includes(latestRequest.status)) {
                    setExistingRequestStatus(latestRequest.status)
                }
            } catch (err: any) {
                setError(err.message || 'No se pudo cargar la información de verificación')
            } finally {
                setCheckingExistingRequest(false)
            }
        }

        loadInitialKycContext()
    }, [supabase])

    const isSubmissionBlocked = checkingExistingRequest || !!existingRequestStatus

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
            if (existingRequestStatus) {
                throw new Error('Ya tienes una solicitud de verificación en revisión. Debes esperar a que sea aprobada o rechazada.')
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

            // Update profile to allow campaign creation
            await supabase
                .from('profiles')
                .update({ kyc_status: 'pending' })
                .eq('id', user.id)

            router.push('/creator/campaigns/create')
            router.refresh()

        } catch (err: any) {
            console.error('Error:', err)
            setError(err.message || 'Ocurrió un error al enviar la solicitud')
        } finally {
            setLoading(false)
        }
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            {/* Info Alert */}
            <Alert className="bg-blue-50 border-blue-200">
                <Shield className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-800">
                    <strong>Importante:</strong> No podrás crear campañas mientras revisamos tu solicitud.
                    La verificación toma 24-48 horas.
                </AlertDescription>
            </Alert>

            {checkingExistingRequest && (
                <Alert>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <AlertDescription>Verificando estado de solicitudes previas...</AlertDescription>
                </Alert>
            )}

            {existingRequestStatus && (
                <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                        Ya tienes una solicitud de verificación {existingRequestStatus === 'under_review' ? 'en revisión' : 'pendiente'}.
                        Debes esperar a que sea aprobada o rechazada para enviar una nueva.
                    </AlertDescription>
                </Alert>
            )}

            {/* Verification Type */}
            <Card>
                <CardHeader>
                    <CardTitle>Tipo de Verificación</CardTitle>
                </CardHeader>
                <CardContent>
                    <RadioGroup value={verificationType} onValueChange={(v) => setVerificationType(v as any)}>
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="individual" id="individual" />
                            <Label htmlFor="individual" className="cursor-pointer">
                                👤 Persona Natural (Individual)
                            </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="company" id="company" />
                            <Label htmlFor="company" className="cursor-pointer">
                                🏢 Empresa / Organización
                            </Label>
                        </div>
                    </RadioGroup>
                </CardContent>
            </Card>

            {/* Company Data (if applicable) */}
            {verificationType === 'company' && (
                <Card>
                    <CardHeader>
                        <CardTitle>Datos de la Empresa</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <Label htmlFor="companyName">Nombre de la Empresa *</Label>
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
                        {verificationType === 'company' ? 'Datos del Representante Legal' : 'Datos Personales'}
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div>
                        <Label htmlFor="fullName">Nombre Completo *</Label>
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
                            <Label htmlFor="documentType">Tipo de Documento *</Label>
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
                            <Label htmlFor="documentNumber">Número de Documento *</Label>
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
                            <Label htmlFor="birthDate">Fecha de Nacimiento</Label>
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
                    <CardTitle>Información de Contacto</CardTitle>
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
                        <Label htmlFor="documentFront">Documento (Frente) * <span className="text-xs text-muted-foreground">JPG, PNG o PDF (máx. 5MB)</span></Label>
                        <Input
                            id="documentFront"
                            type="file"
                            accept=".jpg,.jpeg,.png,.pdf"
                            onChange={handleFileChange(setDocumentFront)}
                            required
                            disabled={loading || isSubmissionBlocked}
                        />
                        {documentFront && (
                            <p className="text-sm text-green-600 mt-1 flex items-center gap-1">
                                <CheckCircle2 className="h-4 w-4" /> {documentFront.name}
                            </p>
                        )}
                    </div>

                    <div>
                        <Label htmlFor="documentBack">Documento (Reverso) <span className="text-xs text-muted-foreground">Opcional</span></Label>
                        <Input
                            id="documentBack"
                            type="file"
                            accept=".jpg,.jpeg,.png,.pdf"
                            onChange={handleFileChange(setDocumentBack)}
                            disabled={loading || isSubmissionBlocked}
                        />
                        {documentBack && (
                            <p className="text-sm text-green-600 mt-1 flex items-center gap-1">
                                <CheckCircle2 className="h-4 w-4" /> {documentBack.name}
                            </p>
                        )}
                    </div>

                    <div>
                        <Label htmlFor="selfie">Selfie con Documento * <span className="text-xs text-muted-foreground">Foto tuya sosteniendo el documento</span></Label>
                        <Input
                            id="selfie"
                            type="file"
                            accept=".jpg,.jpeg,.png"
                            onChange={handleFileChange(setSelfie)}
                            required
                            disabled={loading || isSubmissionBlocked}
                        />
                        {selfie && (
                            <p className="text-sm text-green-600 mt-1 flex items-center gap-1">
                                <CheckCircle2 className="h-4 w-4" /> {selfie.name}
                            </p>
                        )}
                    </div>

                    <div>
                        <Label htmlFor="proofOfAddress">Comprobante de Domicilio <span className="text-xs text-muted-foreground">Recibo de servicio</span></Label>
                        <Input
                            id="proofOfAddress"
                            type="file"
                            accept=".jpg,.jpeg,.png,.pdf"
                            onChange={handleFileChange(setProofOfAddress)}
                            disabled={loading || isSubmissionBlocked}
                        />
                        {proofOfAddress && (
                            <p className="text-sm text-green-600 mt-1 flex items-center gap-1">
                                <CheckCircle2 className="h-4 w-4" /> {proofOfAddress.name}
                            </p>
                        )}
                    </div>

                    {verificationType === 'company' && (
                        <div>
                            <Label htmlFor="companyRegistration">Registro Mercantil / Acta Constitutiva *</Label>
                            <Input
                                id="companyRegistration"
                                type="file"
                                accept=".jpg,.jpeg,.png,.pdf"
                                onChange={handleFileChange(setCompanyRegistration)}
                                required
                                disabled={loading || isSubmissionBlocked}
                            />
                            {companyRegistration && (
                                <p className="text-sm text-green-600 mt-1 flex items-center gap-1">
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
                        Enviar Solicitud de Verificación
                    </>
                )}
            </Button>
        </form>
    )
}
