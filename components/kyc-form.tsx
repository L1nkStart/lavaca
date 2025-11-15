'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { Loader2, Upload, FileText, Check, X, AlertCircle, Shield } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Profile {
    id: string
    full_name: string
    email: string
    phone: string | null
    kyc_status: string
    kyc_document_url: string | null
    kyc_document_type: string | null
    kyc_rejected_reason: string | null
    role: string
}

interface KYCFormProps {
    profile: Profile
}

export function KYCForm({ profile }: KYCFormProps) {
    const [documentType, setDocumentType] = useState(profile.kyc_document_type || 'cedula')
    const [loading, setLoading] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [uploadProgress, setUploadProgress] = useState(0)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)
    const [selectedFile, setSelectedFile] = useState<File | null>(null)

    const fileInputRef = useRef<HTMLInputElement>(null)
    const router = useRouter()
    const supabase = createClient()

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        // Validate file type
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf']
        if (!allowedTypes.includes(file.type)) {
            setError('Solo se permiten archivos JPG, PNG o PDF')
            return
        }

        // Validate file size (max 5MB)
        const maxSize = 5 * 1024 * 1024 // 5MB
        if (file.size > maxSize) {
            setError('El archivo debe ser menor a 5MB')
            return
        }

        setSelectedFile(file)
        setError(null)
    }

    const uploadDocument = async (file: File): Promise<string> => {
        const fileExt = file.name.split('.').pop()
        const fileName = `${profile.id}_${documentType}_${Date.now()}.${fileExt}`
        const filePath = `kyc-documents/${fileName}`

        setUploading(true)
        setUploadProgress(0)

        const { data, error } = await supabase.storage
            .from('kyc-documents')
            .upload(filePath, file, {
                cacheControl: '3600',
                upsert: false
            })

        if (error) {
            throw new Error(`Error uploading file: ${error.message}`)
        }

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
            .from('kyc-documents')
            .getPublicUrl(filePath)

        setUploading(false)
        return publicUrl
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!selectedFile && !profile.kyc_document_url) {
            setError('Por favor selecciona un documento para subir')
            return
        }

        setLoading(true)
        setError(null)
        setSuccess(null)

        try {
            let documentUrl = profile.kyc_document_url

            // Upload new document if selected
            if (selectedFile) {
                documentUrl = await uploadDocument(selectedFile)
            }

            // Update profile with KYC information
            const { error: updateError } = await supabase
                .from('users')
                .update({
                    kyc_document_url: documentUrl,
                    kyc_document_type: documentType,
                    kyc_status: 'pending',
                    kyc_rejected_reason: null, // Clear any previous rejection reason
                    updated_at: new Date().toISOString()
                })
                .eq('id', profile.id)

            if (updateError) {
                setError(updateError.message)
                return
            }

            setSuccess('Documento enviado correctamente. Tu verificación está pendiente de revisión.')
            setSelectedFile(null)

            // Reset file input
            if (fileInputRef.current) {
                fileInputRef.current.value = ''
            }

            // Refresh page after delay
            setTimeout(() => {
                router.refresh()
            }, 2000)

        } catch (err) {
            console.error('KYC submission error:', err)
            setError(err instanceof Error ? err.message : 'Ocurrió un error inesperado')
        } finally {
            setLoading(false)
            setUploading(false)
            setUploadProgress(0)
        }
    }

    const getStatusIcon = () => {
        switch (profile.kyc_status) {
            case 'verified':
                return <Check className="h-5 w-5 text-green-600" />
            case 'rejected':
                return <X className="h-5 w-5 text-red-600" />
            case 'pending':
                return <AlertCircle className="h-5 w-5 text-yellow-600" />
            default:
                return <Shield className="h-5 w-5 text-gray-400" />
        }
    }

    const getStatusText = () => {
        switch (profile.kyc_status) {
            case 'verified':
                return 'Tu identidad ha sido verificada correctamente'
            case 'rejected':
                return `Tu verificación fue rechazada: ${profile.kyc_rejected_reason || 'Motivo no especificado'}`
            case 'pending':
                return 'Tu verificación está siendo revisada por nuestro equipo'
            default:
                return 'Completa tu verificación de identidad para acceder a todas las funciones'
        }
    }

    const getStatusColor = () => {
        switch (profile.kyc_status) {
            case 'verified':
                return 'bg-green-50 text-green-800 border-green-200'
            case 'rejected':
                return 'bg-red-50 text-red-800 border-red-200'
            case 'pending':
                return 'bg-yellow-50 text-yellow-800 border-yellow-200'
            default:
                return 'bg-blue-50 text-blue-800 border-blue-200'
        }
    }

    const isDisabled = loading || uploading || (profile.kyc_status === 'verified')

    return (
        <div className="space-y-6">
            {/* Status Alert */}
            <Alert className={getStatusColor()}>
                <div className="flex items-start gap-3">
                    {getStatusIcon()}
                    <div className="flex-1">
                        <AlertDescription className="font-medium">
                            {getStatusText()}
                        </AlertDescription>
                        {profile.kyc_status === 'verified' && (
                            <p className="text-sm mt-2 opacity-90">
                                ¡Felicitaciones! Ya puedes crear campañas y acceder a todas las funciones.
                            </p>
                        )}
                    </div>
                </div>
            </Alert>

            {profile.kyc_status !== 'verified' && (
                <form onSubmit={handleSubmit} className="space-y-6">
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

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="documentType">Tipo de documento</Label>
                            <Select
                                value={documentType}
                                onValueChange={setDocumentType}
                                disabled={isDisabled}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecciona el tipo de documento" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="cedula">
                                        <div className="space-y-1">
                                            <div className="font-medium">Cédula de Identidad</div>
                                            <div className="text-sm text-muted-foreground">Para personas naturales</div>
                                        </div>
                                    </SelectItem>
                                    <SelectItem value="rif">
                                        <div className="space-y-1">
                                            <div className="font-medium">RIF</div>
                                            <div className="text-sm text-muted-foreground">Para organizaciones y empresas</div>
                                        </div>
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="document">
                                Documento {documentType === 'cedula' ? 'de Identidad' : '(RIF)'}
                            </Label>
                            <div className="space-y-2">
                                <Input
                                    ref={fileInputRef}
                                    id="document"
                                    type="file"
                                    accept=".jpg,.jpeg,.png,.pdf"
                                    onChange={handleFileSelect}
                                    disabled={isDisabled}
                                    className="cursor-pointer"
                                />
                                <p className="text-xs text-muted-foreground">
                                    Formatos permitidos: JPG, PNG, PDF. Tamaño máximo: 5MB
                                </p>
                            </div>

                            {selectedFile && (
                                <div className="flex items-center gap-2 p-2 bg-blue-50 rounded border border-blue-200">
                                    <FileText className="h-4 w-4 text-blue-600" />
                                    <span className="text-sm font-medium text-blue-800">
                                        {selectedFile.name}
                                    </span>
                                    <span className="text-xs text-blue-600">
                                        ({(selectedFile.size / 1024 / 1024).toFixed(1)} MB)
                                    </span>
                                </div>
                            )}

                            {profile.kyc_document_url && !selectedFile && (
                                <div className="flex items-center gap-2 p-2 bg-gray-50 rounded border">
                                    <FileText className="h-4 w-4 text-gray-600" />
                                    <span className="text-sm text-gray-700">
                                        Documento actual: {profile.kyc_document_type?.toUpperCase()}
                                    </span>
                                </div>
                            )}
                        </div>

                        {uploading && (
                            <div className="space-y-2">
                                <div className="flex items-center justify-between text-sm">
                                    <span>Subiendo documento...</span>
                                    <span>{uploadProgress}%</span>
                                </div>
                                <Progress value={uploadProgress} className="w-full" />
                            </div>
                        )}
                    </div>

                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <h4 className="font-medium text-blue-900 mb-2">Instrucciones importantes:</h4>
                        <ul className="text-sm text-blue-800 space-y-1">
                            <li>• Asegúrate de que el documento sea legible y esté completo</li>
                            <li>• Las fotos deben ser claras y sin reflejos</li>
                            <li>• Para organizaciones, incluye el RIF completo</li>
                            <li>• La verificación toma usualmente 24-48 horas</li>
                        </ul>
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t">
                        <div className="text-sm text-muted-foreground">
                            {profile.kyc_status === 'pending' ? (
                                'Tu documento está en revisión'
                            ) : profile.kyc_status === 'rejected' ? (
                                'Puedes enviar un nuevo documento'
                            ) : (
                                'Este proceso es necesario para crear campañas'
                            )}
                        </div>

                        <Button
                            type="submit"
                            disabled={isDisabled}
                            className="min-w-[140px]"
                        >
                            {loading || uploading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    {uploading ? 'Subiendo...' : 'Enviando...'}
                                </>
                            ) : (
                                <>
                                    <Upload className="mr-2 h-4 w-4" />
                                    {profile.kyc_status === 'rejected' ? 'Reenviar' : 'Enviar para revisión'}
                                </>
                            )}
                        </Button>
                    </div>
                </form>
            )}

            {/* Requirements for different roles */}
            {(profile.role === 'creator' || profile.role === 'guarantor') && profile.kyc_status !== 'verified' && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <h4 className="font-medium text-amber-900 mb-2">
                        Requerimientos para {profile.role === 'creator' ? 'Creadores' : 'Garantes'}:
                    </h4>
                    <p className="text-sm text-amber-800">
                        {profile.role === 'creator'
                            ? 'Para crear y gestionar campañas, necesitas verificar tu identidad. Esto garantiza la confianza de los donantes.'
                            : 'Para avalar campañas como garante, necesitas verificar tu identidad y credenciales profesionales.'
                        }
                    </p>
                </div>
            )}
        </div>
    )
}
