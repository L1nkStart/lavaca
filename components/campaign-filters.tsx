"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { X } from 'lucide-react';

interface CampaignFiltersProps {
  onFilterChange?: (filters: FilterState) => void;
}

export interface FilterState {
  category?: string;
  status?: string;
  location?: string;
  verified?: boolean;
}

const CATEGORIES = [
  "Salud",
  "Educación",
  "Emprendimiento",
  "Comunitaria",
  "Emergencia",
];

const LOCATIONS = ["Caracas", "Miranda", "Carabobo", "Zulia", "Otro"];

export function CampaignFilters({ onFilterChange }: CampaignFiltersProps) {
  const [filters, setFilters] = useState<FilterState>({});

  const handleFilterChange = (newFilters: FilterState) => {
    setFilters(newFilters);
    onFilterChange?.(newFilters);
  };

  const clearFilters = () => {
    handleFilterChange({});
  };

  const hasFilters = Object.values(filters).some((v) => v !== undefined && v !== false);

  return (
    <div className="space-y-4 p-4 bg-card rounded-lg border border-border">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-foreground">Filtrar por:</h3>
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="text-xs"
          >
            <X className="w-3 h-3 mr-1" />
            Limpiar
          </Button>
        )}
      </div>

      <div className="space-y-3">
        {/* Category Filter */}
        <div>
          <label className="text-sm font-medium text-muted-foreground mb-2 block">
            Categoría
          </label>
          <Select
            value={filters.category || ""}
            onValueChange={(value) =>
              handleFilterChange({
                ...filters,
                category: value || undefined,
              })
            }
          >
            <SelectTrigger className="bg-background">
              <SelectValue placeholder="Todas las categorías" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todas</SelectItem>
              {CATEGORIES.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Location Filter */}
        <div>
          <label className="text-sm font-medium text-muted-foreground mb-2 block">
            Ubicación
          </label>
          <Select
            value={filters.location || ""}
            onValueChange={(value) =>
              handleFilterChange({
                ...filters,
                location: value || undefined,
              })
            }
          >
            <SelectTrigger className="bg-background">
              <SelectValue placeholder="Todas las ubicaciones" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todas</SelectItem>
              {LOCATIONS.map((loc) => (
                <SelectItem key={loc} value={loc}>
                  {loc}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Status Filter */}
        <div>
          <label className="text-sm font-medium text-muted-foreground mb-2 block">
            Estado
          </label>
          <Select
            value={filters.status || ""}
            onValueChange={(value) =>
              handleFilterChange({
                ...filters,
                status: value || undefined,
              })
            }
          >
            <SelectTrigger className="bg-background">
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todas</SelectItem>
              <SelectItem value="active">En recaudación</SelectItem>
              <SelectItem value="urgent">Urgentes</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Verification Badge */}
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="verified"
            checked={filters.verified || false}
            onChange={(e) =>
              handleFilterChange({
                ...filters,
                verified: e.target.checked || undefined,
              })
            }
            className="rounded border-border"
          />
          <label
            htmlFor="verified"
            className="text-sm font-medium cursor-pointer"
          >
            Solo verificadas
          </label>
        </div>
      </div>
    </div>
  );
}
