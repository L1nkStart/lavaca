"use client";

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from "next/link";
import { DonationCheckout } from "@/components/donation-checkout-improved";
import { CrisisDirectDonate } from "@/components/crisis-direct-donate";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface CampaignRow {
  id: string;
  title: string;
  campaign_type?: string | null;
}

export default function DonatePage() {
  const params = useParams();
  const campaignId = params.id as string;
  const [campaignTitle, setCampaignTitle] = useState<string>("Campaña");
  const [campaignType, setCampaignType] = useState<string>("normal");
  const [crisisEnabled, setCrisisEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    const fetchCampaign = async () => {
      if (!campaignId) return;

      try {
        setLoading(true);
        const { data, error: fetchError } = await supabase
          .from('campaigns')
          .select('id, title, campaign_type')
          .eq('id', campaignId)
          .single();

        if (fetchError || !data) {
          throw fetchError || new Error('No se encontró la campaña');
        }

        const row = data as CampaignRow;
        setCampaignTitle(row.title || 'Campaña');
        setCampaignType(row.campaign_type || 'normal');
      } catch (err: any) {
        console.error('Error fetching campaign:', err);
        setError('No se pudo cargar la campaña.');
      } finally {
        setLoading(false);
      }
    };

    fetchCampaign();

    fetch('/api/crisis-status', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setCrisisEnabled(Boolean(d?.enabled)))
      .catch(() => setCrisisEnabled(false));
  }, [campaignId]);

  const isCrisis = crisisEnabled && campaignType === 'crisis';

  return (
    <main className="flex min-h-screen flex-col bg-background">
      <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        <Link
          href={`/campaigns/${campaignId}`}
          className="inline-flex items-center gap-2 text-sm font-medium text-foreground/60 transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Volver a campaña
        </Link>

        <h1 className="mt-4 mb-8 text-3xl font-black tracking-tight">
          Realizar donación
        </h1>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-10" role="status" aria-label="Cargando">
            <Loader2 className="size-6 animate-spin" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* En campañas crisis, el pago directo a las cuentas del organizador
                es el método principal (la plataforma no recibe ni cobra comisión). */}
            {isCrisis && <CrisisDirectDonate campaignId={campaignId} />}

            <DonationCheckout
              campaignId={campaignId}
              campaignTitle={campaignTitle}
              isCrisis={isCrisis}
            />
          </div>
        )}
      </div>
    </main>
  );
}
