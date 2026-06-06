'use client';

import { useState, useTransition, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CampaignCard } from '@/components/campaign-card';
import {
    Search,
    SlidersHorizontal,
    X,
    ChevronLeft,
    ChevronRight,
    TrendingUp,
    Clock,
    Target,
    Sparkles
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface Campaign {
    id: string;
    title: string;
    story: string;
    goal_amount_usd: number;
    current_amount_usd: number;
    main_image_url: string | null;
    status: string;
    created_at: string;
    location: string | null;
    categories: {
        name: string;
        icon_emoji: string | null;
    } | null;
    users: {
        full_name: string;
        kyc_status: string;
    };
    donation_count?: number;
}

interface Category {
    id: string;
    name: string;
    icon_emoji: string | null;
}

interface Props {
    campaigns: Campaign[];
    categories: Category[];
    total: number;
    currentPage: number;
    totalPages: number;
    searchParams: Record<string, string | undefined>;
    error: string | null;
}

export default function CampaignsClient({
    campaigns,
    categories,
    total,
    currentPage,
    totalPages,
    searchParams,
    error,
}: Props) {
    const router = useRouter();
    const params = useSearchParams();
    const [isPending, startTransition] = useTransition();

    const [searchInput, setSearchInput] = useState(searchParams.search || '');
    const [showFilters, setShowFilters] = useState(false);

    // Debounce search to update as user types
    useEffect(() => {
        const debounceTimer = setTimeout(() => {
            if (searchInput !== (searchParams.search || '')) {
                updateParams({ search: searchInput || undefined });
            }
        }, 500); // Wait 500ms after user stops typing

        return () => clearTimeout(debounceTimer);
    }, [searchInput]);

    const updateParams = (updates: Record<string, string | undefined>) => {
        const newParams = new URLSearchParams(params.toString());

        Object.entries(updates).forEach(([key, value]) => {
            if (value) {
                newParams.set(key, value);
            } else {
                newParams.delete(key);
            }
        });

        // Reset to page 1 when filters change
        if (!updates.page) {
            newParams.delete('page');
        }

        startTransition(() => {
            router.push(`/campaigns?${newParams.toString()}`);
        });
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        // Search is now handled by useEffect debounce
        // This just prevents form submission
    };

    const clearFilters = () => {
        setSearchInput('');
        startTransition(() => {
            router.push('/campaigns');
        });
    };

    const hasActiveFilters = Object.keys(searchParams).some(
        key => key !== 'page' && searchParams[key]
    );

    // Convert to CampaignCard format
    const campaignCards = campaigns.map((campaign) => ({
        id: campaign.id,
        title: campaign.title,
        description:
            campaign.story.length > 150
                ? campaign.story.substring(0, 150) + '...'
                : campaign.story,
        image: campaign.main_image_url || '/placeholder.jpg',
        goalAmount: campaign.goal_amount_usd,
        raisedAmount: campaign.current_amount_usd,
        category: campaign.categories?.name || 'Sin categoría',
        creator: campaign.users.full_name,
        verified: campaign.users.kyc_status === 'verified',
        guarantor: undefined,
        donorCount: campaign.donation_count || 0,
    }));

    return (
        <main className="flex flex-col min-h-screen bg-gradient-to-b from-background to-muted/20">
            <div className="flex-1 max-w-7xl mx-auto w-full px-4 py-8">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-4xl md:text-5xl font-bold mb-3 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                        Descubre Campañas
                    </h1>
                    <p className="text-muted-foreground text-lg flex items-center gap-2">
                        <Sparkles className="w-5 h-5" />
                        {total} {total === 1 ? 'campaña activa' : 'campañas activas'}
                    </p>
                </div>

                {/* Search & Filters Bar */}
                <div className="mb-6 space-y-4">
                    <div className="flex flex-col md:flex-row gap-4">
                        {/* Search */}
                        <form onSubmit={handleSearch} className="flex-1">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                                <Input
                                    placeholder="Buscar por título, descripción..."
                                    value={searchInput}
                                    onChange={(e) => setSearchInput(e.target.value)}
                                    className="pl-10 pr-10 h-12 bg-background/60 backdrop-blur"
                                    disabled={isPending}
                                />
                                {searchInput && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSearchInput('');
                                            updateParams({ search: undefined });
                                        }}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        </form>

                        {/* Sort */}
                        <Select
                            value={searchParams.sort || 'recent'}
                            onValueChange={(value) => updateParams({ sort: value })}
                            disabled={isPending}
                        >
                            <SelectTrigger className="w-full md:w-[200px] h-12 bg-background/60 backdrop-blur">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="recent">
                                    <div className="flex items-center gap-2">
                                        <Clock className="w-4 h-4" />
                                        Más recientes
                                    </div>
                                </SelectItem>
                                <SelectItem value="popular">
                                    <div className="flex items-center gap-2">
                                        <TrendingUp className="w-4 h-4" />
                                        Más populares
                                    </div>
                                </SelectItem>
                                <SelectItem value="goal">
                                    <div className="flex items-center gap-2">
                                        <Target className="w-4 h-4" />
                                        Mayor meta
                                    </div>
                                </SelectItem>
                            </SelectContent>
                        </Select>

                        {/* Toggle Filters */}
                        <Button
                            variant="outline"
                            onClick={() => setShowFilters(!showFilters)}
                            className="h-12 md:w-auto bg-background/60 backdrop-blur"
                            disabled={isPending}
                        >
                            <SlidersHorizontal className="w-5 h-5 mr-2" />
                            Filtros
                            {hasActiveFilters && (
                                <Badge variant="secondary" className="ml-2">
                                    {Object.keys(searchParams).filter(k => k !== 'page' && k !== 'sort').length}
                                </Badge>
                            )}
                        </Button>
                    </div>

                    {/* Filters Panel */}
                    {showFilters && (
                        <div className="p-4 border rounded-lg bg-card space-y-4 animate-in slide-in-from-top-2">
                            <div className="grid md:grid-cols-3 gap-4">
                                {/* Category Filter */}
                                <div>
                                    <label className="text-sm font-medium mb-2 block">
                                        Categoría
                                    </label>
                                    <Select
                                        value={searchParams.category || 'all'}
                                        onValueChange={(value) =>
                                            updateParams({ category: value === 'all' ? undefined : value })
                                        }
                                        disabled={isPending}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Todas" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Todas las categorías</SelectItem>
                                            {categories.map((cat) => (
                                                <SelectItem key={cat.id} value={cat.id}>
                                                    {cat.icon_emoji} {cat.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Location Filter */}
                                <div>
                                    <label className="text-sm font-medium mb-2 block">
                                        Ubicación
                                    </label>
                                    <Input
                                        placeholder="Ciudad, estado..."
                                        value={searchParams.location || ''}
                                        onChange={(e) =>
                                            updateParams({ location: e.target.value || undefined })
                                        }
                                        disabled={isPending}
                                    />
                                </div>

                                {/* Verified Filter */}
                                <div>
                                    <label className="text-sm font-medium mb-2 block">
                                        Creadores
                                    </label>
                                    <Select
                                        value={searchParams.verified || 'all'}
                                        onValueChange={(value) =>
                                            updateParams({ verified: value === 'all' ? undefined : value })
                                        }
                                        disabled={isPending}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Todos</SelectItem>
                                            <SelectItem value="true">✓ Solo verificados</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {hasActiveFilters && (
                                <div className="flex justify-end">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={clearFilters}
                                        disabled={isPending}
                                    >
                                        <X className="w-4 h-4 mr-2" />
                                        Limpiar filtros
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Error State */}
                {error && (
                    <Alert variant="destructive" className="mb-6">
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}

                {/* Loading Overlay */}
                {isPending && (
                    <div className="mb-6">
                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {[...Array(6)].map((_, i) => (
                                <div key={i} className="space-y-3">
                                    <Skeleton className="h-48 w-full" />
                                    <Skeleton className="h-4 w-3/4" />
                                    <Skeleton className="h-4 w-1/2" />
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Campaigns Grid */}
                {!isPending && (
                    <>
                        {campaignCards.length > 0 ? (
                            <>
                                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                                    {campaignCards.map((campaign) => (
                                        <CampaignCard key={campaign.id} {...campaign} />
                                    ))}
                                </div>

                                {/* Pagination */}
                                {totalPages > 1 && (
                                    <div className="flex items-center justify-center gap-2">
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            onClick={() => updateParams({ page: String(currentPage - 1) })}
                                            disabled={currentPage === 1 || isPending}
                                        >
                                            <ChevronLeft className="w-4 h-4" />
                                        </Button>

                                        <div className="flex items-center gap-1">
                                            {[...Array(totalPages)].map((_, i) => {
                                                const page = i + 1;
                                                // Show first, last, current, and adjacent pages
                                                if (
                                                    page === 1 ||
                                                    page === totalPages ||
                                                    (page >= currentPage - 1 && page <= currentPage + 1)
                                                ) {
                                                    return (
                                                        <Button
                                                            key={page}
                                                            variant={currentPage === page ? 'default' : 'outline'}
                                                            size="icon"
                                                            onClick={() => updateParams({ page: String(page) })}
                                                            disabled={isPending}
                                                            className={cn(
                                                                currentPage === page && 'pointer-events-none'
                                                            )}
                                                        >
                                                            {page}
                                                        </Button>
                                                    );
                                                } else if (
                                                    page === currentPage - 2 ||
                                                    page === currentPage + 2
                                                ) {
                                                    return <span key={page} className="px-1">...</span>;
                                                }
                                                return null;
                                            })}
                                        </div>

                                        <Button
                                            variant="outline"
                                            size="icon"
                                            onClick={() => updateParams({ page: String(currentPage + 1) })}
                                            disabled={currentPage === totalPages || isPending}
                                        >
                                            <ChevronRight className="w-4 h-4" />
                                        </Button>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="text-center py-16">
                                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
                                    <Search className="w-8 h-8 text-muted-foreground" />
                                </div>
                                <h3 className="text-xl font-semibold mb-2">
                                    No se encontraron campañas
                                </h3>
                                <p className="text-muted-foreground mb-6">
                                    Intenta ajustar tus filtros o búsqueda
                                </p>
                                {hasActiveFilters && (
                                    <Button onClick={clearFilters} disabled={isPending}>
                                        Limpiar filtros
                                    </Button>
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>
        </main>
    );
}
