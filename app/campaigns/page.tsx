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
    icon_emoji: string | null;
  } | null;
  users: {
    full_name: string;
    kyc_status: string;
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
      console.log('🔍 Iniciando fetchCampaigns...');

      const { data, error } = await supabase
        .from('campaigns')
        .select(`
          *,
          categories (
            name,
            icon_emoji
          ),
          users!campaigns_creator_id_fkey (
            full_name,
            kyc_status
          )
        `)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      console.log('📊 Resultado de la query:');
      console.log('- Data:', data);
      console.log('- Error:', error);
      console.log('- Número de campañas:', data?.length || 0);

      if (error) {
        console.error('❌ Error en la query principal:', error);
        throw error;
      }

      // Get donation counts
      console.log('💰 Obteniendo contadores de donaciones...');
      const campaignsWithCounts = await Promise.all(
        (data || []).map(async (campaign, index) => {
          const { count, error: countError } = await supabase
            .from('donations')
            .select('*', { count: 'exact', head: true })
            .eq('campaign_id', campaign.id)
            .eq('payment_status', 'completed');

          if (countError) {
            console.warn(`⚠️ Error contando donaciones para campaña ${index}:`, countError);
          }

          return {
            ...campaign,
            donation_count: count || 0
          };
        })
      );

      console.log('✅ Campañas con contadores:', campaignsWithCounts.length);
      setCampaigns(campaignsWithCounts);
    } catch (err: any) {
      console.error('❌ Error completo en fetchCampaigns:', err);
      console.error('- Message:', err.message);
      console.error('- Code:', err.code);
      console.error('- Details:', err.details);
      console.error('- Hint:', err.hint);
      setError(`Error al cargar las campañas: ${err.message || 'Error desconocido'}`);
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
    guarantor: undefined,
    donorCount: campaign.donation_count || 0,
  }));

  return (
    <main className="flex flex-col min-h-screen bg-background">
      <div className="flex-1 max-w-7xl mx-auto w-full px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Descubre campañas</h1>
          <p className="text-muted-foreground text-lg">
            {filteredCampaigns.length} campañas activas
          </p>
        </div>
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
