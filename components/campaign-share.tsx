"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Share2, MessageCircle, Mail, Copy, Check, Send, Smartphone, ClipboardCopy } from 'lucide-react';
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { appendRef, buildRefCode } from "@/lib/lavaca-campaign";

interface CampaignShareProps {
  campaignId: string;
  campaignTitle: string;
  campaignUrl: string;
  /** Frase corta de progreso, ej. "Ya va 45% de $1,500" o "Ya lleva $320". */
  progressText?: string;
  /** "compact": solo el botón Compartir. "full": WhatsApp destacado + Compartir. */
  variant?: "compact" | "full";
  className?: string;
}

/**
 * Mensaje listo para pegar en WhatsApp: en Venezuela la campaña vive en los
 * grupos de familia y trabajo, así que el texto tiene que sonar a persona,
 * no a plataforma, y decir cómo se puede ayudar.
 */
export function buildShareMessage(title: string, url: string, progressText?: string) {
  const lines = [
    `🙏 *${title}*`,
    progressText ? `${progressText}. Cada aporte cuenta, por pequeño que sea.` : `Cada aporte cuenta, por pequeño que sea.`,
    `Puedes ayudar por PagoMóvil, Zelle, tarjeta o cripto en menos de un minuto:`,
    url,
    `Si no puedes donar, compartirlo también ayuda muchísimo 💚`,
  ];
  return lines.join("\n");
}

export function CampaignShare({
  campaignId,
  campaignTitle,
  campaignUrl,
  progressText,
  variant = "compact",
  className,
}: CampaignShareProps) {
  const [copied, setCopied] = useState<"link" | "message" | null>(null);
  const [canNativeShare, setCanNativeShare] = useState(false);
  const [refCode, setRefCode] = useState("anon");

  useEffect(() => {
    setCanNativeShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
    // Código de referido: identifica (sin exponer datos) a quien comparte,
    // para medir qué enlaces traen donantes.
    createClient().auth.getUser()
      .then(({ data }) => setRefCode(buildRefCode(data.user?.id)))
      .catch(() => setRefCode("anon"));
  }, []);

  const shareUrl = appendRef(campaignUrl, refCode);
  const message = buildShareMessage(campaignTitle, shareUrl, progressText);
  // Para X/Telegram no se usa el negrita de WhatsApp (*...*).
  const plainMessage = message.replace(/\*/g, "");

  const trackShare = async (platform: string) => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('campaign_shares').insert({
        campaign_id: campaignId,
        user_id: user?.id || null,
        platform,
      });
    } catch (error) {
      console.error('Error tracking share:', error);
    }
  };

  const copy = async (text: string, kind: "link" | "message") => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      setTimeout(() => setCopied(null), 2000);
      trackShare(kind === "link" ? "link" : "message");
    } catch {
      // portapapeles bloqueado: el usuario aún puede seleccionar el enlace
    }
  };

  const handleNativeShare = async () => {
    try {
      await navigator.share({ title: campaignTitle, text: plainMessage, url: shareUrl });
      trackShare("native");
    } catch {
      // el usuario cerró la hoja de compartir: no es un error
    }
  };

  const handleWhatsApp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank", "noopener");
    trackShare("whatsapp");
  };

  const handleTelegram = () => {
    window.open(
      `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(plainMessage)}`,
      "_blank",
      "noopener"
    );
    trackShare("telegram");
  };

  const handleFacebook = () => {
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`, "_blank", "noopener");
    trackShare("facebook");
  };

  const handleEmail = () => {
    const subject = encodeURIComponent(`Ayuda para: ${campaignTitle}`);
    const body = encodeURIComponent(plainMessage);
    window.open(`mailto:?subject=${subject}&body=${body}`, "_blank");
    trackShare("email");
  };

  const handleX = () => {
    const text = `${campaignTitle} 🙏 ${progressText ? `${progressText}. ` : ""}Ayuda aquí: ${shareUrl}`;
    window.open(`https://x.com/intent/tweet?text=${encodeURIComponent(text)}`, "_blank", "noopener");
    trackShare("twitter");
  };

  const menu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 min-h-[36px]">
          <Share2 className="w-4 h-4" />
          Compartir
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {canNativeShare && (
          <>
            <DropdownMenuItem onClick={handleNativeShare} className="cursor-pointer">
              <Smartphone className="w-4 h-4 mr-2" />
              Estados, Instagram y más…
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem onClick={handleWhatsApp} className="cursor-pointer">
          <MessageCircle className="w-4 h-4 mr-2" />
          WhatsApp
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleTelegram} className="cursor-pointer">
          <Send className="w-4 h-4 mr-2" />
          Telegram
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleFacebook} className="cursor-pointer">
          <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M24 12.07C24 5.41 18.63 0 12 0S0 5.41 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.8-4.7 4.54-4.7 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.89v2.26h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07z" />
          </svg>
          Facebook
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleX} className="cursor-pointer">
          <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.6l-5.17-6.759-5.91 6.759h-3.308l7.73-8.835L2.42 2.25h6.76l4.6 6.088 5.25-6.088zM17.313 19.713h1.813L6.03 4.156H4.126l13.187 15.557z" />
          </svg>
          X (Twitter)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleEmail} className="cursor-pointer">
          <Mail className="w-4 h-4 mr-2" />
          Correo
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => copy(message, "message")} className="cursor-pointer">
          {copied === "message" ? <Check className="w-4 h-4 mr-2" /> : <ClipboardCopy className="w-4 h-4 mr-2" />}
          {copied === "message" ? "Mensaje copiado" : "Copiar mensaje listo"}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => copy(shareUrl, "link")} className="cursor-pointer">
          {copied === "link" ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
          {copied === "link" ? "Enlace copiado" : "Copiar enlace"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  if (variant === "compact") {
    return <div className={className}>{menu}</div>;
  }

  return (
    <div className={cn("flex flex-wrap items-center justify-center gap-2", className)}>
      <Button size="sm" variant="outline" className="gap-2 min-h-[36px]" onClick={handleWhatsApp}>
        <MessageCircle className="w-4 h-4" />
        WhatsApp
      </Button>
      {menu}
    </div>
  );
}
