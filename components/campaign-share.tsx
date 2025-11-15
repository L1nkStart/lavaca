"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Share2, MessageCircle, Mail, Copy, Check } from 'lucide-react';
import { useState } from "react";

interface CampaignShareProps {
  campaignId: string;
  campaignTitle: string;
  campaignUrl: string;
}

export function CampaignShare({
  campaignId,
  campaignTitle,
  campaignUrl,
}: CampaignShareProps) {
  const [copied, setCopied] = useState(false);

  const shareText = `Ayuda con esta campaña urgente: ${campaignTitle}. Únete a nosotros en LaVaca para marcar la diferencia.`;
  const shareUrl = campaignUrl;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWhatsApp = () => {
    const encodedText = encodeURIComponent(
      `${shareText}\n\n${shareUrl}`
    );
    window.open(
      `https://wa.me/?text=${encodedText}`,
      "_blank"
    );
  };

  const handleEmail = () => {
    const subject = encodeURIComponent(`Campaña: ${campaignTitle}`);
    const body = encodeURIComponent(`${shareText}\n\n${shareUrl}`);
    window.open(
      `mailto:?subject=${subject}&body=${body}`,
      "_blank"
    );
  };

  const handleX = () => {
    const encodedText = encodeURIComponent(
      `${shareText}\n\n${shareUrl}`
    );
    window.open(
      `https://x.com/intent/tweet?text=${encodedText}`,
      "_blank"
    );
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Share2 className="w-4 h-4" />
          Compartir
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handleWhatsApp} className="cursor-pointer">
          <MessageCircle className="w-4 h-4 mr-2" />
          WhatsApp
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleX} className="cursor-pointer">
          <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.6l-5.17-6.759-5.91 6.759h-3.308l7.73-8.835L2.42 2.25h6.76l4.6 6.088 5.25-6.088zM17.313 19.713h1.813L6.03 4.156H4.126l13.187 15.557z" />
          </svg>
          X (Twitter)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleEmail} className="cursor-pointer">
          <Mail className="w-4 h-4 mr-2" />
          Correo
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleCopyLink} className="cursor-pointer">
          <Copy className="w-4 h-4 mr-2" />
          {copied ? "Copiado" : "Copiar enlace"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
