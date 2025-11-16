"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CampaignCard } from "@/components/campaign-card";
import { CampaignFilters, FilterState } from "@/components/campaign-filters";
import { Search, ArrowLeft, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Alert, AlertDescription } from '@/components/ui/alert';

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
    icon: string | null;
  } | null;
  users: {
    full_name: string;
    kyc_status: string;
  };
  guarantor?: {
    full_name: string;
  };
  donation_count?: number;
}

export default function CampaignsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filters, setFilters] = useState<FilterState>({});
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const fetchCampaigns = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('campaigns')
        .select(`
          *,
          categories (
            name,
            icon
          ),
          users!campaigns_creator_id_fkey (
            full_name,
            kyc_status
          ),
          guarantor:users!campaigns_guarantor_id_fkey (
            full_name
          )
        `)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      // Get donation counts
      const campaignsWithCounts = await Promise.all(
        (data || []).map(async (campaign) => {
          const { count } = await supabase
            .from('donations')
            .select('*', { count: 'exact', head: true })
            .eq('campaign_id', campaign.id)
            .eq('status', 'completed');

          return {
            ...campaign,
            donation_count: count || 0
          };
        })
      );

      setCampaigns(campaignsWithCounts);
    } catch (err) {
      console.error('Error fetching campaigns:', err);
      setError('Error al cargar las campañas');
    } finally {
      setLoading(false);
    }
  };

  const filteredCampaigns = useMemo(() => {
    return campaigns.filter((campaign) => {
      // Search filter
      if (
        searchTerm &&
        !campaign.title.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !campaign.story
          .toLowerCase()
          .includes(searchTerm.toLowerCase()) &&
        !campaign.users.full_name.toLowerCase().includes(searchTerm.toLowerCase())
      ) {
        return false;
      }

      // Category filter
      if (filters.category && campaign.categories?.name !== filters.category) {
        return false;
      }

      // Verified filter (campaigns from KYC verified creators)
      if (filters.verified && campaign.users.kyc_status !== 'verified') {
        return false;
      }

      return true;
    });
  }, [searchTerm, filters, campaigns]);

  // Convert to CampaignCard format
  const campaignCards = filteredCampaigns.map((campaign) => ({
    id: campaign.id,
    title: campaign.title,
    description: campaign.story.length > 150
      ? campaign.story.substring(0, 150) + '...'
      : campaign.story,
    image: campaign.main_image_url || '/placeholder.jpg',
    goalAmount: campaign.goal_amount_usd,
    raisedAmount: campaign.current_amount_usd,
    category: campaign.categories?.name || 'Sin categoría',
    creator: campaign.users.full_name,
    verified: campaign.users.kyc_status === 'verified',
    guarantor: campaign.guarantor?.full_name,
    donorCount: campaign.donation_count || 0,
  }));

  return (
    <main className="flex flex-col min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card sticky top-20 z-40">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver
          </Link>
          <h1 className="text-3xl font-bold mb-4">Todas las campañas</h1>
          <p className="text-muted-foreground">
            {filteredCampaigns.length} campañas encontradas
          </p>
        </div>
      </div>

      <div className="flex-1 max-w-7xl mx-auto w-full px-4 py-8">
        <div className="grid lg:grid-cols-4 gap-8">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <CampaignFilters onFilterChange={setFilters} />
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3 space-y-6">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                placeholder="Buscar campañas, creadores..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-background"
              />
            </div>

            {/* Error State */}
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Loading State */}
            {loading && (
              <div className="flex justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            )}

            {/* Campaigns Grid */}
            {!loading && !error && (
              <>
                {campaignCards.length > 0 ? (
                  <div className="grid md:grid-cols-2 gap-6">
                    {campaignCards.map((campaign) => (
                      <CampaignCard key={campaign.id} {...campaign} />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-16">
                    <p className="text-muted-foreground text-lg mb-4">
                      No se encontraron campañas
                    </p>
                    <Button variant="outline" onClick={() => {
                      setSearchTerm("");
                      setFilters({});
                    }}>
                      Limpiar búsqueda
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
