"use client";

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from "next/link";
import { DonationCheckout } from "@/components/donation-checkout-improved";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface CampaignRow {
  id: string;
  title: string;
}

export default function DonatePage() {
  const params = useParams();
  const campaignId = params.id as string;
  const [campaignTitle, setCampaignTitle] = useState<string>("Campaña");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    const fetchCampaignTitle = async () => {
      if (!campaignId) return;

      try {
        setLoading(true);
        const { data, error: fetchError } = await supabase
          .from('campaigns')
          .select('id, title')
          .eq('id', campaignId)
          .single();

        if (fetchError || !data) {
          throw fetchError || new Error('No se encontró la campaña');
        }

        setCampaignTitle((data as CampaignRow).title || 'Campaña');
      } catch (err: any) {
        console.error('Error fetching campaign title:', err);
        setError('No se pudo cargar el título de la campaña.');
      } finally {
        setLoading(false);
      }
    };

    fetchCampaignTitle();
  }, [campaignId]);

  return (
    <main className="flex flex-col min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <Link
            href={`/campaigns/${campaignId}`}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver a campaña
          </Link>
        </div>
      </div>

      <div className="flex-1 max-w-3xl mx-auto w-full px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Realizar donación</h1>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <DonationCheckout
            campaignId={campaignId}
            campaignTitle={campaignTitle}
          />
        )}
      </div>
    </main>
  );
}
