'use client';

import { useState, useTransition, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
    CalendarClock,
    ShieldCheck,
    SearchX,
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
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
        // Search is handled by the debounce effect; just prevent submission.
    };

    const clearFilters = () => {
        setSearchInput('');
        startTransition(() => {
            router.push('/campaigns');
        });
    };

    const hasActiveFilters = Object.keys(searchParams).some(
        key => key !== 'page' && key !== 'sort' && searchParams[key]
    );

    const verifiedActive = searchParams.verified === 'true';
    const categoryName = (id?: string) =>
        categories.find((c) => c.id === id)?.name;

    // Active filter chips (removable)
    const activeChips = [
        searchParams.search && {
            key: 'search',
            label: `"${searchParams.search}"`,
            onRemove: () => {
                setSearchInput('');
                updateParams({ search: undefined });
            },
        },
        searchParams.category && {
            key: 'category',
            label: categoryName(searchParams.category) || 'Categoría',
            onRemove: () => updateParams({ category: undefined }),
        },
        searchParams.location && {
            key: 'location',
            label: searchParams.location,
            onRemove: () => updateParams({ location: undefined }),
        },
        verifiedActive && {
            key: 'verified',
            label: 'Solo verificadas',
            onRemove: () => updateParams({ verified: undefined }),
        },
    ].filter(Boolean) as { key: string; label: string; onRemove: () => void }[];

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

    const inputSurface =
        'h-12 bg-card border-border';

    return (
        <main className="flex min-h-screen flex-col bg-background">
            {/* Header band */}
            <section className="border-b border-border bg-muted/40">
                <div className="mx-auto w-full max-w-7xl px-4 py-10 md:py-14">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                        <div className="max-w-2xl">
                            <h1 className="text-balance text-4xl font-black tracking-tight sm:text-5xl">
                                Descubre campañas{' '}
                                <span className="text-primary">verificadas</span>
                            </h1>
                            <p className="mt-3 text-pretty text-lg leading-relaxed text-foreground/70">
                                <span className="font-mono font-semibold text-foreground">
                                    {total}
                                </span>{' '}
                                {total === 1 ? 'causa activa' : 'causas activas'}, cada una
                                con identidad confirmada antes de publicarse.
                            </p>
                        </div>
                    </div>

                    {/* Search & toolbar */}
                    <div className="mt-8 space-y-4">
                        <div className="flex flex-col gap-3 md:flex-row md:flex-wrap">
                            {/* Search */}
                            <form onSubmit={handleSearch} className="flex-1 md:min-w-[260px]">
                                <div className="relative">
                                    <Search className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-foreground/50" />
                                    <Input
                                        placeholder="Buscar por título o historia..."
                                        value={searchInput}
                                        onChange={(e) => setSearchInput(e.target.value)}
                                        className={cn('pl-10 pr-10', inputSurface)}
                                        disabled={isPending}
                                        aria-label="Buscar campañas"
                                    />
                                    {searchInput && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSearchInput('');
                                                updateParams({ search: undefined });
                                            }}
                                            aria-label="Borrar búsqueda"
                                            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-sm text-foreground/50 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                        >
                                            <X className="size-4" />
                                        </button>
                                    )}
                                </div>
                            </form>

                            {/* Verified quick toggle — LaVaca's core trust filter, surfaced */}
                            <Button
                                type="button"
                                variant={verifiedActive ? 'default' : 'outline'}
                                onClick={() =>
                                    updateParams({ verified: verifiedActive ? undefined : 'true' })
                                }
                                disabled={isPending}
                                aria-pressed={verifiedActive}
                                className={cn('h-12', !verifiedActive && 'bg-card')}
                            >
                                <ShieldCheck className="size-5" />
                                Solo verificadas
                            </Button>

                            {/* Sort */}
                            <Select
                                value={searchParams.sort || 'recent'}
                                onValueChange={(value) => updateParams({ sort: value })}
                                disabled={isPending}
                            >
                                <SelectTrigger className={cn('w-full md:w-[190px]', inputSurface)}>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="recent">
                                        <div className="flex items-center gap-2">
                                            <Clock className="size-4" />
                                            Más recientes
                                        </div>
                                    </SelectItem>
                                    <SelectItem value="popular">
                                        <div className="flex items-center gap-2">
                                            <TrendingUp className="size-4" />
                                            Más recaudado
                                        </div>
                                    </SelectItem>
                                    <SelectItem value="goal">
                                        <div className="flex items-center gap-2">
                                            <Target className="size-4" />
                                            Mayor meta
                                        </div>
                                    </SelectItem>
                                    <SelectItem value="ending">
                                        <div className="flex items-center gap-2">
                                            <CalendarClock className="size-4" />
                                            Termina pronto
                                        </div>
                                    </SelectItem>
                                </SelectContent>
                            </Select>

                            {/* Toggle advanced filters */}
                            <Button
                                variant="outline"
                                onClick={() => setShowFilters(!showFilters)}
                                className={cn('h-12', 'bg-card')}
                                disabled={isPending}
                                aria-expanded={showFilters}
                            >
                                <SlidersHorizontal className="size-5" />
                                Filtros
                            </Button>
                        </div>

                        {/* Category quick-filters: surface discovery without opening the panel.
                            Scrolls horizontally on mobile, wraps on larger screens. */}
                        {categories.length > 0 && (
                            <div className="flex gap-2 overflow-x-auto pb-1 md:flex-wrap md:overflow-visible md:pb-0">
                                <button
                                    type="button"
                                    onClick={() => updateParams({ category: undefined })}
                                    disabled={isPending}
                                    aria-pressed={!searchParams.category}
                                    className={cn(
                                        'inline-flex min-h-9 shrink-0 items-center rounded-full border px-3.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                        !searchParams.category
                                            ? 'border-primary bg-primary text-primary-foreground'
                                            : 'border-border bg-card hover:bg-muted',
                                    )}
                                >
                                    Todas
                                </button>
                                {categories.map((cat) => {
                                    const active = searchParams.category === cat.id;
                                    return (
                                        <button
                                            key={cat.id}
                                            type="button"
                                            onClick={() =>
                                                updateParams({ category: active ? undefined : cat.id })
                                            }
                                            disabled={isPending}
                                            aria-pressed={active}
                                            className={cn(
                                                'inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                                active
                                                    ? 'border-primary bg-primary text-primary-foreground'
                                                    : 'border-border bg-card hover:bg-muted',
                                            )}
                                        >
                                            {cat.icon_emoji ? <span aria-hidden>{cat.icon_emoji}</span> : null}
                                            {cat.name}
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        {/* Active filter chips */}
                        {activeChips.length > 0 && (
                            <div className="flex flex-wrap items-center gap-2">
                                {activeChips.map((chip) => (
                                    <button
                                        key={chip.key}
                                        type="button"
                                        onClick={chip.onRemove}
                                        disabled={isPending}
                                        className="group inline-flex min-h-9 items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 py-1.5 pl-3.5 pr-2.5 text-sm font-medium text-primary transition-colors hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    >
                                        {chip.label}
                                        <X className="size-3.5 opacity-70 group-hover:opacity-100" />
                                    </button>
                                ))}
                                <button
                                    type="button"
                                    onClick={clearFilters}
                                    disabled={isPending}
                                    className="inline-flex min-h-9 items-center rounded-full px-3 py-1.5 text-sm font-medium text-foreground/60 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                >
                                    Limpiar todo
                                </button>
                            </div>
                        )}

                        {/* Advanced filters panel */}
                        {showFilters && (
                            <div className="rounded-xl border border-border bg-card p-4 animate-in fade-in slide-in-from-top-2">
                                <div className="grid gap-4 md:grid-cols-3">
                                    <div>
                                        <label className="mb-2 block text-sm font-medium">
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

                                    <div>
                                        <label className="mb-2 block text-sm font-medium">
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

                                    <div>
                                        <label className="mb-2 block text-sm font-medium">
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
                                                <SelectItem value="true">Solo verificados</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </section>

            {/* Results */}
            <section className="mx-auto w-full max-w-7xl flex-1 px-4 py-10 md:py-12">
                {error && (
                    <Alert variant="destructive" className="mb-6">
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}

                {isPending ? (
                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                        {[...Array(6)].map((_, i) => (
                            <div
                                key={i}
                                className="overflow-hidden rounded-xl border border-border bg-card"
                            >
                                <Skeleton className="h-48 w-full rounded-none" />
                                <div className="space-y-3 p-6">
                                    <Skeleton className="h-5 w-3/4" />
                                    <Skeleton className="h-4 w-1/3" />
                                    <Skeleton className="h-2 w-full" />
                                    <Skeleton className="h-9 w-full" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : campaignCards.length > 0 ? (
                    <>
                        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                            {campaignCards.map((campaign) => (
                                <CampaignCard key={campaign.id} {...campaign} />
                            ))}
                        </div>

                        {totalPages > 1 && (
                            <div className="mt-12 flex items-center justify-center gap-2">
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => updateParams({ page: String(currentPage - 1) })}
                                    disabled={currentPage === 1 || isPending}
                                    aria-label="Página anterior"
                                >
                                    <ChevronLeft className="size-4" />
                                </Button>

                                <div className="flex items-center gap-1">
                                    {[...Array(totalPages)].map((_, i) => {
                                        const page = i + 1;
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
                                                    aria-label={`Página ${page}`}
                                                    aria-current={currentPage === page ? 'page' : undefined}
                                                    className={cn(
                                                        'font-mono',
                                                        currentPage === page && 'pointer-events-none',
                                                    )}
                                                >
                                                    {page}
                                                </Button>
                                            );
                                        } else if (
                                            page === currentPage - 2 ||
                                            page === currentPage + 2
                                        ) {
                                            return (
                                                <span key={page} className="px-1 text-foreground/40">
                                                    …
                                                </span>
                                            );
                                        }
                                        return null;
                                    })}
                                </div>

                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => updateParams({ page: String(currentPage + 1) })}
                                    disabled={currentPage === totalPages || isPending}
                                    aria-label="Página siguiente"
                                >
                                    <ChevronRight className="size-4" />
                                </Button>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-20 text-center">
                        <span className="flex size-14 items-center justify-center rounded-full bg-muted text-foreground/50">
                            <SearchX className="size-7" />
                        </span>
                        <div>
                            <h3 className="text-xl font-bold">
                                {hasActiveFilters
                                    ? 'Ninguna campaña coincide con esos filtros'
                                    : 'Todavía no hay campañas activas'}
                            </h3>
                            <p className="mt-2 text-pretty leading-relaxed text-foreground/70">
                                {hasActiveFilters
                                    ? 'Prueba con menos filtros o cambia los términos de búsqueda.'
                                    : 'Cuando se publique la primera causa verificada, aparecerá aquí.'}
                            </p>
                        </div>
                        {hasActiveFilters && (
                            <Button onClick={clearFilters} disabled={isPending}>
                                Limpiar filtros
                            </Button>
                        )}
                    </div>
                )}
            </section>
        </main>
    );
}
