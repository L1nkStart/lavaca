'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Flag, Loader2 } from 'lucide-react'

interface CampaignReportProps {
    campaignId: string
}

const reportCategories = [
    { value: 'fraud', label: 'Fraude o estafa' },
    { value: 'inappropriate_content', label: 'Contenido inapropiado' },
    { value: 'spam', label: 'Spam' },
    { value: 'misleading_information', label: 'Información engañosa' },
    { value: 'copyright', label: 'Violación de derechos de autor' },
    { value: 'other', label: 'Otro' },
]

export function CampaignReport({ campaignId }: CampaignReportProps) {
    const [open, setOpen] = useState(false)
    const [category, setCategory] = useState('')
    const [description, setDescription] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)

    const supabase = createClient()

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!category || !description.trim()) {
            setError('Por favor completa todos los campos')
            return
        }

        setLoading(true)
        setError(null)

        try {
            const { data: { user } } = await supabase.auth.getUser()

            const { error: insertError } = await supabase
                .from('campaign_reports')
                .insert({
                    campaign_id: campaignId,
                    reporter_id: user?.id || null,
                    category: category,
                    description: description.trim()
                })

            if (insertError) throw insertError

            setSuccess(true)
            setTimeout(() => {
                setOpen(false)
                setCategory('')
                setDescription('')
                setSuccess(false)
            }, 2000)
        } catch (err: any) {
            setError(err.message || 'Error al enviar el reporte')
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="text-muted-foreground">
                    <Flag className="h-4 w-4 mr-2" />
                    Reportar
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Reportar campaña</DialogTitle>
                    <DialogDescription>
                        Si crees que esta campaña viola nuestras políticas, por favor reportala.
                        Nuestro equipo la revisará en breve.
                    </DialogDescription>
                </DialogHeader>

                {success ? (
                    <Alert>
                        <AlertDescription>
                            Reporte enviado exitosamente. Gracias por ayudarnos a mantener la
                            plataforma segura.
                        </AlertDescription>
                    </Alert>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {error && (
                            <Alert variant="destructive">
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        )}

                        <div className="space-y-2">
                            <Label htmlFor="category">Categoría</Label>
                            <Select value={category} onValueChange={setCategory}>
                                <SelectTrigger id="category">
                                    <SelectValue placeholder="Selecciona una categoría" />
                                </SelectTrigger>
                                <SelectContent>
                                    {reportCategories.map((cat) => (
                                        <SelectItem key={cat.value} value={cat.value}>
                                            {cat.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="description">Descripción</Label>
                            <Textarea
                                id="description"
                                placeholder="Describe el problema con esta campaña..."
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                rows={4}
                                disabled={loading}
                            />
                        </div>

                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setOpen(false)}
                                disabled={loading}
                            >
                                Cancelar
                            </Button>
                            <Button type="submit" disabled={loading || !category || !description.trim()}>
                                {loading ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Enviando...
                                    </>
                                ) : (
                                    'Enviar reporte'
                                )}
                            </Button>
                        </DialogFooter>
                    </form>
                )}
            </DialogContent>
        </Dialog>
    )
}
