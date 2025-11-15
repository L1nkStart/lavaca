"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CampaignCard } from "@/components/campaign-card";
import { CampaignFilters, FilterState } from "@/components/campaign-filters";
import { Search, ArrowLeft } from 'lucide-react';

// Mock data
const ALL_CAMPAIGNS = [
  {
    id: "1",
    title: "Cirugía urgente - Niño con malformación cardíaca",
    description:
      "Necesitamos $15,000 para una cirugía de corazón abierto para salvar la vida de un niño de 8 años.",
    image: "/medical-surgery-child.jpg",
    goalAmount: 15000,
    raisedAmount: 12500,
    category: "Salud",
    creator: "Fundación Salud Infantil",
    verified: true,
    guarantor: "Hospital Metropolitano",
    donorCount: 487,
  },
  {
    id: "2",
    title: "Educación superior para jóvenes de bajos recursos",
    description:
      "Becas completas para 50 estudiantes de comunidades vulnerables.",
    image:
      "/students-education-classroom.jpg",
    goalAmount: 50000,
    raisedAmount: 23400,
    category: "Educación",
    creator: "Fundación Educativa Venezuela",
    verified: true,
    donorCount: 892,
  },
  {
    id: "3",
    title: "Microempresa de mujeres emprendedoras",
    description: "Capital inicial para 20 mujeres de comunidades marginadas.",
    image:
      "/women-business-entrepreneurship.jpg",
    goalAmount: 25000,
    raisedAmount: 8900,
    category: "Emprendimiento",
    creator: "Red de Mujeres Emprendedoras",
    verified: true,
    donorCount: 234,
  },
  {
    id: "4",
    title: "Agua potable para comunidad indígena",
    description: "Sistema de purificación de agua para 500 personas.",
    image: "/water-community-indigenous.jpg",
    goalAmount: 12000,
    raisedAmount: 7200,
    category: "Comunitaria",
    creator: "ONG Agua Pura",
    verified: true,
    donorCount: 156,
  },
  {
    id: "5",
    title: "Medicinas para hospital comunitario",
    description: "Medicamentos urgentes para atender emergencias médicas.",
    image: "/hospital-medical-supplies.jpg",
    goalAmount: 8000,
    raisedAmount: 6400,
    category: "Salud",
    creator: "Clínica Comunitaria Bolívar",
    verified: false,
    donorCount: 98,
  },
  {
    id: "6",
    title: "Biblioteca rural en comunidad lejana",
    description: "Construcción de biblioteca y sala de estudios.",
    image: "/library-rural-education.jpg",
    goalAmount: 18000,
    raisedAmount: 9500,
    category: "Educación",
    creator: "Fundación Lectura Venezuela",
    verified: true,
    guarantor: "Ministerio de Educación",
    donorCount: 340,
  },
];

export default function CampaignsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filters, setFilters] = useState<FilterState>({});

  const filteredCampaigns = useMemo(() => {
    return ALL_CAMPAIGNS.filter((campaign) => {
      // Search filter
      if (
        searchTerm &&
        !campaign.title.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !campaign.description
          .toLowerCase()
          .includes(searchTerm.toLowerCase()) &&
        !campaign.creator.toLowerCase().includes(searchTerm.toLowerCase())
      ) {
        return false;
      }

      // Category filter
      if (filters.category && campaign.category !== filters.category) {
        return false;
      }

      // Verified filter
      if (filters.verified && !campaign.verified) {
        return false;
      }

      return true;
    });
  }, [searchTerm, filters]);

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

            {/* Campaigns Grid */}
            {filteredCampaigns.length > 0 ? (
              <div className="grid md:grid-cols-2 gap-6">
                {filteredCampaigns.map((campaign) => (
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
          </div>
        </div>
      </div>
    </main>
  );
}
