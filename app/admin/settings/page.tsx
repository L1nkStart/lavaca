"use client";

import { useEffect, useState } from "react";
import { AdminSidebar } from "@/components/admin-sidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Loader2, RefreshCw, Trash2 } from "lucide-react";

interface AdminConfig {
  id: string;
  platform_commission_percentage: number;
  bcv_exchange_rate: number;
  bcv_last_updated: string;
  auto_update_exchange_rate: boolean;
  min_withdrawal_usd: number;
  min_withdrawal_bs: number;
  updated_at: string;
}

interface Category {
  id: string;
  name: string;
  description: string | null;
  icon_emoji: string | null;
  order_index: number | null;
}

export default function AdminSettingsPage() {
  const [config, setConfig] = useState<AdminConfig | null>(null);
  const [exchangeRate, setExchangeRate] = useState("");
  const [commission, setCommission] = useState("");
  const [minWithdrawalUsd, setMinWithdrawalUsd] = useState("");
  const [minWithdrawalBs, setMinWithdrawalBs] = useState("");
  const [autoUpdate, setAutoUpdate] = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [savingRate, setSavingRate] = useState(false);
  const [savingCommission, setSavingCommission] = useState(false);
  const [refreshingRate, setRefreshingRate] = useState(false);

  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryEmoji, setNewCategoryEmoji] = useState("");
  const [savingCategory, setSavingCategory] = useState(false);

  const loadConfig = async () => {
    setLoadingConfig(true);
    try {
      const response = await fetch("/api/admin/settings", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Error cargando configuración");

      setConfig(data.config);
      setExchangeRate(String(data.config.bcv_exchange_rate ?? ""));
      setCommission(String(data.config.platform_commission_percentage ?? ""));
      setMinWithdrawalUsd(String(data.config.min_withdrawal_usd ?? "10"));
      setMinWithdrawalBs(String(data.config.min_withdrawal_bs ?? "500"));
      setAutoUpdate(Boolean(data.config.auto_update_exchange_rate));
    } catch (error: any) {
      toast.error(error?.message || "No se pudo cargar la configuración");
    } finally {
      setLoadingConfig(false);
    }
  };

  const loadCategories = async () => {
    setLoadingCategories(true);
    try {
      const response = await fetch("/api/admin/categories", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Error cargando categorías");
      setCategories(data.categories || []);
    } catch (error: any) {
      toast.error(error?.message || "No se pudieron cargar las categorías");
    } finally {
      setLoadingCategories(false);
    }
  };

  useEffect(() => {
    loadConfig();
    loadCategories();
  }, []);

  const saveRate = async () => {
    const rateNumber = parseFloat(exchangeRate);
    if (!Number.isFinite(rateNumber) || rateNumber <= 0) {
      toast.error("La tasa debe ser un número mayor a 0");
      return;
    }

    setSavingRate(true);
    try {
      const response = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bcv_exchange_rate: rateNumber,
          auto_update_exchange_rate: autoUpdate,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "No se pudo guardar la tasa");
      setConfig(data.config);
      toast.success("Tasa actualizada");
    } catch (error: any) {
      toast.error(error?.message || "Error al guardar la tasa");
    } finally {
      setSavingRate(false);
    }
  };

  const saveCommission = async () => {
    const commissionNumber = parseFloat(commission);
    if (!Number.isFinite(commissionNumber) || commissionNumber < 0 || commissionNumber > 100) {
      toast.error("La comisión debe ser un porcentaje entre 0 y 100");
      return;
    }

    const minUsdNumber = parseFloat(minWithdrawalUsd);
    const minBsNumber = parseFloat(minWithdrawalBs);
    if (!Number.isFinite(minUsdNumber) || minUsdNumber < 0) {
      toast.error("El mínimo de retiro en USD debe ser un número válido");
      return;
    }
    if (!Number.isFinite(minBsNumber) || minBsNumber < 0) {
      toast.error("El mínimo de retiro en Bs debe ser un número válido");
      return;
    }

    setSavingCommission(true);
    try {
      const response = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform_commission_percentage: commissionNumber,
          min_withdrawal_usd: minUsdNumber,
          min_withdrawal_bs: minBsNumber,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "No se pudo guardar la comisión");
      setConfig(data.config);
      toast.success("Comisión actualizada");
    } catch (error: any) {
      toast.error(error?.message || "Error al guardar la comisión");
    } finally {
      setSavingCommission(false);
    }
  };

  const refreshLiveRate = async () => {
    setRefreshingRate(true);
    try {
      const response = await fetch("/api/exchange-rate/update", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "No se pudo refrescar");

      if (Number.isFinite(Number(data?.rate))) {
        setExchangeRate(String(Number(data.rate).toFixed(2)));
      }
      toast.success("Tasa oficial BCV refrescada");
    } catch (error: any) {
      toast.error(error?.message || "Error al refrescar la tasa");
    } finally {
      setRefreshingRate(false);
    }
  };

  const addCategory = async () => {
    const name = newCategoryName.trim();
    if (!name) {
      toast.error("El nombre es obligatorio");
      return;
    }

    setSavingCategory(true);
    try {
      const response = await fetch("/api/admin/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          icon_emoji: newCategoryEmoji.trim() || null,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "No se pudo crear la categoría");

      setNewCategoryName("");
      setNewCategoryEmoji("");
      toast.success("Categoría creada");
      loadCategories();
    } catch (error: any) {
      toast.error(error?.message || "Error al crear la categoría");
    } finally {
      setSavingCategory(false);
    }
  };

  const deleteCategory = async (id: string) => {
    const confirmation = confirm("¿Eliminar esta categoría? No se puede deshacer.");
    if (!confirmation) return;

    try {
      const response = await fetch(`/api/admin/categories?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "No se pudo eliminar");

      toast.success("Categoría eliminada");
      loadCategories();
    } catch (error: any) {
      toast.error(error?.message || "Error al eliminar la categoría");
    }
  };

  const lastUpdatedLabel = config?.bcv_last_updated
    ? new Date(config.bcv_last_updated).toLocaleString("es-VE")
    : "Sin registro previo";

  return (
    <div className="flex min-h-screen bg-background">
      <AdminSidebar />

      <main className="flex-1 overflow-auto">
        <div className="border-b border-border bg-card sticky top-0 z-40">
          <div className="px-4 sm:px-8 py-4 sm:py-6">
            <h1 className="text-3xl font-bold">Configuración</h1>
            <p className="text-muted-foreground mt-1">
              Gestiona los parámetros de la plataforma
            </p>
          </div>
        </div>

        <div className="p-4 sm:p-8 space-y-6 sm:space-y-8">
          <Tabs defaultValue="exchange" className="space-y-4">
            <TabsList>
              <TabsTrigger value="exchange">Tasa de Cambio</TabsTrigger>
              <TabsTrigger value="commission">Comisión</TabsTrigger>
              <TabsTrigger value="categories">Categorías</TabsTrigger>
            </TabsList>

            <TabsContent value="exchange">
              <Card>
                <CardHeader>
                  <CardTitle>Tasa de Cambio BCV</CardTitle>
                  <CardDescription>
                    Tasa Bs/USD usada como respaldo cuando no hay tasa activa en la tabla
                    {" "}<code>exchange_rates</code>.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {loadingConfig ? (
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  ) : (
                    <>
                      <div>
                        <Label htmlFor="rate">Tasa BCV (Bs por USD)</Label>
                        <Input
                          id="rate"
                          type="number"
                          step="0.01"
                          value={exchangeRate}
                          onChange={(e) => setExchangeRate(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground mt-2">
                          Última actualización: {lastUpdatedLabel}
                        </p>
                      </div>

                      <div className="flex items-center justify-between rounded-lg border border-border p-3">
                        <div>
                          <p className="font-medium text-sm">Auto-refresco de la tasa oficial BCV</p>
                          <p className="text-xs text-muted-foreground">
                            Si está activo, un job programado puede actualizar la tasa
                            automáticamente vía <code>/api/exchange-rate/update</code>.
                          </p>
                        </div>
                        <Switch checked={autoUpdate} onCheckedChange={setAutoUpdate} />
                      </div>

                      <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg">
                        <p className="text-sm text-blue-900 dark:text-blue-100">
                          Con esta tasa, $1 USD = Bs. {(parseFloat(exchangeRate) || 0).toFixed(2)}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button onClick={saveRate} disabled={savingRate}>
                          {savingRate && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                          Guardar cambios
                        </Button>
                        <Button
                          variant="outline"
                          onClick={refreshLiveRate}
                          disabled={refreshingRate}
                        >
                          {refreshingRate ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <RefreshCw className="h-4 w-4 mr-2" />
                          )}
                          Refrescar tasa oficial BCV
                        </Button>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="commission">
              <Card>
                <CardHeader>
                  <CardTitle>Comisión de Plataforma</CardTitle>
                  <CardDescription>
                    Porcentaje que LaVaca retiene por donación al procesar retiros.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {loadingConfig ? (
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  ) : (
                    <>
                      <div>
                        <Label htmlFor="commission">Porcentaje (%)</Label>
                        <Input
                          id="commission"
                          type="number"
                          step="0.1"
                          min={0}
                          max={100}
                          value={commission}
                          onChange={(e) => setCommission(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground mt-2">
                          Ejemplo: Si alguien dona $100, LaVaca recibe ${" "}
                          {((100 * (parseFloat(commission) || 0)) / 100).toFixed(2)}
                        </p>
                      </div>

                      <div className="space-y-2 pt-4 border-t border-border">
                        <h4 className="font-semibold">Mínimos de retiro por moneda</h4>
                        <p className="text-xs text-muted-foreground">
                          Monto mínimo que un creador puede solicitar en cada solicitud de retiro.
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="min-usd">Mínimo en USD ($)</Label>
                            <Input
                              id="min-usd"
                              type="number"
                              step="1"
                              min={0}
                              value={minWithdrawalUsd}
                              onChange={(e) => setMinWithdrawalUsd(e.target.value)}
                            />
                          </div>
                          <div>
                            <Label htmlFor="min-bs">Mínimo en Bolívares (Bs)</Label>
                            <Input
                              id="min-bs"
                              type="number"
                              step="1"
                              min={0}
                              value={minWithdrawalBs}
                              onChange={(e) => setMinWithdrawalBs(e.target.value)}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2 pt-4 border-t border-border">
                        <h4 className="font-semibold">Comisión actual por donación:</h4>
                        <div className="grid grid-cols-3 gap-4">
                          {[10, 50, 100].map((amount) => (
                            <div key={amount} className="bg-muted p-3 rounded">
                              <p className="text-xs text-muted-foreground">
                                Donación ${amount}
                              </p>
                              <p className="text-lg font-bold text-primary">
                                ${((amount * (parseFloat(commission) || 0)) / 100).toFixed(2)}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>

                      <Button onClick={saveCommission} disabled={savingCommission}>
                        {savingCommission && (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        )}
                        Guardar cambios
                      </Button>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="categories">
              <Card>
                <CardHeader>
                  <CardTitle>Categorías de Campaña</CardTitle>
                  <CardDescription>
                    Administra las categorías disponibles para clasificar campañas.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {loadingCategories ? (
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  ) : (
                    <div className="space-y-2">
                      {categories.length === 0 && (
                        <p className="text-sm text-muted-foreground">
                          Aún no hay categorías. Crea la primera abajo.
                        </p>
                      )}
                      {categories.map((cat) => (
                        <div
                          key={cat.id}
                          className="flex items-center justify-between p-3 bg-muted rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            {cat.icon_emoji && (
                              <span className="text-xl">{cat.icon_emoji}</span>
                            )}
                            <div>
                              <p className="font-medium">{cat.name}</p>
                              {cat.description && (
                                <p className="text-xs text-muted-foreground">
                                  {cat.description}
                                </p>
                              )}
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => deleteCategory(cat.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="border-t border-border pt-4 space-y-2">
                    <h4 className="text-sm font-semibold">Agregar categoría</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-2">
                      <Input
                        placeholder="Nombre (ej: Mascotas)"
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                      />
                      <Input
                        placeholder="Emoji"
                        value={newCategoryEmoji}
                        onChange={(e) => setNewCategoryEmoji(e.target.value)}
                        className="w-full sm:w-24"
                      />
                      <Button onClick={addCategory} disabled={savingCategory}>
                        {savingCategory && (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        )}
                        Agregar
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
