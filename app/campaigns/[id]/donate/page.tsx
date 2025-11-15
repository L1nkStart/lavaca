"use client";

import { useParams } from 'next/navigation';
import Link from "next/link";
import { DonationCheckout } from "@/components/donation-checkout";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from 'lucide-react';

// Mock campaign title - should be fetched from database
const CAMPAIGN_TITLES: Record<string, string> = {
  "1": "Cirugía urgente - Niño con malformación cardíaca",
  "2": "Educación superior para jóvenes de bajos recursos",
  "3": "Microempresa de mujeres emprendedoras",
};

export default function DonatePage() {
  const params = useParams();
  const campaignId = params.id as string;
  const campaignTitle = CAMPAIGN_TITLES[campaignId] || "Campaña";

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
        
        <DonationCheckout
          campaignId={campaignId}
          campaignTitle={campaignTitle}
        />
      </div>
    </main>
  );
}
