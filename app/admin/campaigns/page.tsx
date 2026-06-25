"use client"

import { useState, useEffect } from "react"
import { AdminSidebar } from "@/components/admin-sidebar"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
    Loader2,
    Search,
    CheckCircle,
    XCircle,
    AlertCircle,
    Eye,
    Ban,
    Play,
    Trash2,
    ExternalLink
} from 'lucide-react'
import Link from "next/link"

interface Campaign {
    id: string
    title: string
    slug: string
    story: string
    status: string
    campaign_type?: string
    goal_amount_usd: number
    current_amount_usd: number
    main_image_url: string | null
    created_at: string
    updated_at: string
    creator_id: string
    reviewed_by: string | null
    review_notes: string | null
    reviewed_at: string | null
    users: {
        full_name: string
        email: string
    }
    categories: {
        name: string
    }[]
}

export default function AdminCampaignsPage() {
    const ITEMS_PER_PAGE = 10

    const [campaigns, setCampaigns] = useState<Campaign[]>([])
    const [filteredCampaigns, setFilteredCampaigns] = useState<Campaign[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [searchTerm, setSearchTerm] = useState("")
    const [statusFilter, setStatusFilter] = useState<string>("all")
    const [processing, setProcessing] = useState<string | null>(null)
    const [currentPage, setCurrentPage] = useState(1)

    useEffect(() => {
        fetchCampaigns()
    }, [])

    useEffect(() => {
        filterCampaigns()
    }, [searchTerm, statusFilter, campaigns])

    useEffect(() => {
        setCurrentPage(1)
    }, [searchTerm, statusFilter])

    const fetchCampaigns = async () => {
        try {
            setLoading(true)
            const response = await fetch('/api/admin/campaigns', {
                method: 'GET',
                cache: 'no-store',
            })

            const result = await response.json()

            if (!response.ok) {
                throw new Error(result?.error || result?.details || 'No se pudieron cargar las campañas')
            }

            setCampaigns(result?.campaigns || [])
        } catch (err: any) {
            console.error('Error fetching campaigns:', err)
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    const filterCampaigns = () => {
        let filtered = campaigns

        // Filter by search term
        if (searchTerm) {
            filtered = filtered.filter(campaign =>
                campaign.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (campaign.users?.full_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (campaign.users?.email || '').toLowerCase().includes(searchTerm.toLowerCase())
            )
        }

        // Filter by status
        if (statusFilter !== "all") {
            filtered = filtered.filter(campaign => campaign.status === statusFilter)
        }

        setFilteredCampaigns(filtered)
    }

    const handleStatusChange = async (campaignId: string, currentStatus: string, newStatus: string, creatorId: string) => {
        if (!confirm(`¿Estás seguro de cambiar el estado a "${newStatus}"?`)) return

        try {
            setProcessing(campaignId)

            const requiresReviewNotes =
                currentStatus === 'pending_review' && ['active', 'rejected', 'completed', 'closed'].includes(newStatus)

            let reviewNotes: string | null = null
            if (requiresReviewNotes) {
                const inputNotes = window.prompt(
                    'Agrega notas internas de revisión (obligatorio para auditoría):',
                    ''
                )

                if (inputNotes === null) return

                reviewNotes = inputNotes.trim()

                if (!reviewNotes) {
                    alert('Debes agregar notas de revisión para continuar.')
                    return
                }
            }

            const response = await fetch(`/api/admin/campaigns/${campaignId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    status: newStatus,
                    reviewNotes,
                    creatorId,
                })
            })

            const result = await response.json()

            if (!response.ok) {
                throw new Error(result?.error || result?.details || 'No se pudo actualizar la campaña')
            }

            const statusLabel =
                newStatus === 'active'
                    ? 'activada'
                    : newStatus === 'rejected'
                        ? 'rechazada'
                        : 'actualizada'

            alert(`✅ Campaña ${statusLabel} exitosamente`)
            fetchCampaigns()
        } catch (err: any) {
            console.error('Error updating campaign:', err)
            alert('Error al actualizar: ' + err.message)
        } finally {
            setProcessing(null)
        }
    }

    const handleToggleType = async (campaignId: string, currentType: string) => {
        const nextType = currentType === 'crisis' ? 'normal' : 'crisis'
        if (!confirm(`¿Cambiar esta campaña a modo ${nextType === 'crisis' ? 'CRISIS' : 'NORMAL'}?`)) return
        try {
            setProcessing(campaignId)
            const response = await fetch(`/api/admin/campaigns/${campaignId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ campaign_type: nextType }),
            })
            const result = await response.json()
            if (!response.ok) throw new Error(result?.error || 'No se pudo cambiar el tipo')
            fetchCampaigns()
        } catch (err: any) {
            alert('Error: ' + err.message)
        } finally {
            setProcessing(null)
        }
    }

    const handleDelete = async (campaignId: string, title: string) => {
        if (!confirm(`⚠️ ¿Estás seguro de ELIMINAR la campaña "${title}"?\n\nEsta acción NO se puede deshacer.`)) return

        try {
            setProcessing(campaignId)
            const response = await fetch(`/api/admin/campaigns/${campaignId}`, {
                method: 'DELETE'
            })

            const result = await response.json()

            if (!response.ok) {
                throw new Error(result?.error || result?.details || 'No se pudo eliminar la campaña')
            }

            alert('✅ Campaña eliminada exitosamente')
            fetchCampaigns()
        } catch (err: any) {
            console.error('Error deleting campaign:', err)
            alert('Error al eliminar: ' + err.message)
        } finally {
            setProcessing(null)
        }
    }

    const getStatusBadge = (status: string) => {
        const variants: Record<string, { color: string; text: string; icon: any }> = {
            active: { color: 'bg-green-500', text: 'Activa', icon: CheckCircle },
            completed: { color: 'bg-blue-500', text: 'Completada', icon: CheckCircle },
            rejected: { color: 'bg-red-500', text: 'Rechazada', icon: Ban },
            pending_review: { color: 'bg-yellow-500', text: 'En Revisión', icon: AlertCircle },
            closed: { color: 'bg-slate-600', text: 'Cerrada', icon: XCircle },
            draft: { color: 'bg-gray-500', text: 'Borrador', icon: AlertCircle },
        }
        const variant = variants[status] || variants.draft
        const Icon = variant.icon
        return (
            <Badge className={variant.color}>
                <Icon className="w-3 h-3 mr-1" />
                {variant.text}
            </Badge>
        )
    }

    const getProgress = (current: number, goal: number) => {
        return goal > 0 ? Math.min((current / goal) * 100, 100) : 0
    }

    const getStatusText = (status: string) => {
        const labels: Record<string, string> = {
            active: 'Activas',
            completed: 'Completadas',
            rejected: 'Rechazadas',
            pending_review: 'En revisión',
            draft: 'Borradores',
            closed: 'Cerradas',
        }

        return labels[status] || status
    }

    const availableStatuses = Array.from(new Set(campaigns.map((campaign) => campaign.status))).filter(Boolean)
    const totalPages = Math.max(1, Math.ceil(filteredCampaigns.length / ITEMS_PER_PAGE))
    const paginatedCampaigns = filteredCampaigns.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    )

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
                        <AlertDescription>Error al cargar campañas: {error}</AlertDescription>
                    </Alert>
                </main>
            </div>
        )
    }

    return (
        <div className="flex min-h-screen bg-background">
            <AdminSidebar />

            <main className="flex-1 overflow-auto">
                {/* Header */}
                <div className="border-b border-border bg-card sticky top-0 z-40">
                    <div className="px-4 sm:px-8 py-4 sm:py-6">
                        <h1 className="text-3xl font-bold">Gestión de Campañas</h1>
                        <p className="text-muted-foreground mt-1">
                            {filteredCampaigns.length} de {campaigns.length} campañas
                        </p>
                    </div>
                </div>

                <div className="p-4 sm:p-8 space-y-4 sm:space-y-6">
                    {/* Filters */}
                    <Card>
                        <CardContent className="pt-6">
                            <div className="grid md:grid-cols-3 gap-4">
                                {/* Search */}
                                <div className="md:col-span-2">
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            placeholder="Buscar por título, creador o email..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="pl-10"
                                        />
                                    </div>
                                </div>

                                {/* Status Filter */}
                                <Select value={statusFilter} onValueChange={setStatusFilter}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Filtrar por estado" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Todos los estados</SelectItem>
                                        {availableStatuses.map((status) => (
                                            <SelectItem key={status} value={status}>
                                                {getStatusText(status)}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Campaigns List */}
                    {filteredCampaigns.length === 0 ? (
                        <Card>
                            <CardContent className="py-12 text-center">
                                <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                                <p className="text-muted-foreground">
                                    {searchTerm || statusFilter !== "all"
                                        ? "No se encontraron campañas con estos filtros"
                                        : "No hay campañas registradas"
                                    }
                                </p>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="space-y-4">
                            {paginatedCampaigns.map((campaign) => (
                                <Card key={campaign.id}>
                                    <CardContent className="pt-6">
                                        <div className="flex gap-4">
                                            {/* Image */}
                                            {campaign.main_image_url && (
                                                <img
                                                    src={campaign.main_image_url}
                                                    alt={campaign.title}
                                                    className="w-24 h-24 rounded-lg object-cover flex-shrink-0"
                                                />
                                            )}

                                            {/* Content */}
                                            <div className="flex-1 space-y-3">
                                                {/* Title and Status */}
                                                <div className="flex items-start justify-between gap-4">
                                                    <div>
                                                        <h3 className="font-bold text-lg">{campaign.title}</h3>
                                                        <p className="text-sm text-muted-foreground">
                                                            Por {campaign.users?.full_name || 'Desconocido'}
                                                        </p>
                                                        <p className="text-xs text-muted-foreground">
                                                            {campaign.users?.email}
                                                        </p>
                                                    </div>
                                                    <div className="flex flex-col items-end gap-1">
                                                        {getStatusBadge(campaign.status)}
                                                        {campaign.campaign_type === 'crisis' && (
                                                            <Badge className="bg-orange-500">Crisis</Badge>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Progress */}
                                                <div>
                                                    <div className="flex justify-between text-sm mb-1">
                                                        <span className="font-medium">
                                                            ${campaign.current_amount_usd.toLocaleString()} recaudados
                                                        </span>
                                                        <span className="text-muted-foreground">
                                                            Meta: ${campaign.goal_amount_usd.toLocaleString()}
                                                        </span>
                                                    </div>
                                                    <div className="w-full bg-muted rounded-full h-2">
                                                        <div
                                                            className="bg-primary h-2 rounded-full transition-all"
                                                            style={{ width: `${getProgress(campaign.current_amount_usd, campaign.goal_amount_usd)}%` }}
                                                        />
                                                    </div>
                                                    <p className="text-xs text-muted-foreground mt-1">
                                                        {getProgress(campaign.current_amount_usd, campaign.goal_amount_usd).toFixed(1)}% completado
                                                    </p>
                                                </div>

                                                {/* Metadata */}
                                                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                                                    {campaign.categories && campaign.categories.length > 0 && (
                                                        <Badge variant="outline">{campaign.categories[0].name}</Badge>
                                                    )}
                                                    <span>•</span>
                                                    <span>Creada: {new Date(campaign.created_at).toLocaleDateString('es-ES')}</span>
                                                    <span>•</span>
                                                    <span>ID: {campaign.id.slice(0, 8)}</span>
                                                </div>

                                                {/* Actions */}
                                                <div className="flex flex-wrap gap-2 pt-2 border-t">
                                                    {/* View */}
                                                    <Button size="sm" variant="outline" asChild>
                                                        <Link href={`/campaigns/${campaign.id}`} target="_blank">
                                                            <Eye className="w-4 h-4 mr-2" />
                                                            Ver campaña
                                                            <ExternalLink className="w-3 h-3 ml-1" />
                                                        </Link>
                                                    </Button>

                                                    {/* Toggle Normal/Crisis */}
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className={campaign.campaign_type === 'crisis' ? 'text-orange-600 hover:text-orange-700' : ''}
                                                        onClick={() => handleToggleType(campaign.id, campaign.campaign_type || 'normal')}
                                                        disabled={processing === campaign.id}
                                                    >
                                                        {campaign.campaign_type === 'crisis' ? 'Pasar a Normal' : 'Marcar Crisis'}
                                                    </Button>

                                                    {/* Activate */}
                                                    {campaign.status !== 'active' && (
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="text-green-600 hover:text-green-700"
                                                            onClick={() => handleStatusChange(campaign.id, campaign.status, 'active', campaign.creator_id)}
                                                            disabled={processing === campaign.id}
                                                        >
                                                            {processing === campaign.id ? (
                                                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                            ) : (
                                                                <Play className="w-4 h-4 mr-2" />
                                                            )}
                                                            Activar
                                                        </Button>
                                                    )}

                                                    {/* Close active */}
                                                    {campaign.status === 'active' && (
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="text-orange-600 hover:text-orange-700"
                                                            onClick={() => handleStatusChange(campaign.id, campaign.status, 'closed', campaign.creator_id)}
                                                            disabled={processing === campaign.id}
                                                        >
                                                            {processing === campaign.id ? (
                                                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                            ) : (
                                                                <XCircle className="w-4 h-4 mr-2" />
                                                            )}
                                                            Cerrar
                                                        </Button>
                                                    )}

                                                    {/* Reject pending review */}
                                                    {campaign.status === 'pending_review' && (
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="text-yellow-600 hover:text-yellow-700"
                                                            onClick={() => handleStatusChange(campaign.id, campaign.status, 'rejected', campaign.creator_id)}
                                                            disabled={processing === campaign.id}
                                                        >
                                                            {processing === campaign.id ? (
                                                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                            ) : (
                                                                <Ban className="w-4 h-4 mr-2" />
                                                            )}
                                                            Rechazar
                                                        </Button>
                                                    )}

                                                    {/* Delete */}
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="text-red-600 hover:text-red-700"
                                                        onClick={() => handleDelete(campaign.id, campaign.title)}
                                                        disabled={processing === campaign.id}
                                                    >
                                                        {processing === campaign.id ? (
                                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                        ) : (
                                                            <Trash2 className="w-4 h-4 mr-2" />
                                                        )}
                                                        Eliminar
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}

                            {totalPages > 1 && (
                                <Card>
                                    <CardContent className="py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                        <p className="text-sm text-muted-foreground">
                                            Página {currentPage} de {totalPages}
                                        </p>
                                        <div className="flex gap-2">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                                                disabled={currentPage === 1}
                                            >
                                                Anterior
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                                                disabled={currentPage === totalPages}
                                            >
                                                Siguiente
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            )}
                        </div>
                    )}
                </div>
            </main>
        </div>
    )
}
