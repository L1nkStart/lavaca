import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Heart, CheckCircle2 } from 'lucide-react';
import Image from "next/image";

const usd = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n || 0);

interface CampaignCardProps {
  id: string;
  title: string;
  description: string;
  image: string;
  goalAmount: number;
  raisedAmount: number;
  category: string;
  creator: string;
  verified: boolean;
  guarantor?: string;
  donorCount: number;
  /** Campaña sin meta fija: no se muestra barra ni objetivo. */
  openEnded?: boolean;
}

export function CampaignCard({
  id,
  title,
  description,
  image,
  goalAmount,
  raisedAmount,
  category,
  creator,
  verified,
  guarantor,
  donorCount,
  openEnded = false,
}: CampaignCardProps) {
  const progressPercent = goalAmount > 0 ? (raisedAmount / goalAmount) * 100 : 0;

  return (
    <Card className="group relative flex h-full flex-col overflow-hidden transition-shadow hover:shadow-lg">
      {/* Image Container */}
      <div className="relative h-48 w-full overflow-hidden bg-muted">
        <Image
          src={image || "/placeholder.svg"}
          alt={title}
          fill
          className="object-cover transition-transform duration-300 group-hover:scale-105"
        />
        {verified && (
          <div className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-primary px-2 py-1 text-primary-foreground">
            <CheckCircle2 className="h-4 w-4" />
            <span className="text-xs font-semibold">Verificado</span>
          </div>
        )}
        {guarantor && (
          <div className="absolute bottom-3 right-3 rounded-full bg-accent px-2 py-1 text-xs font-semibold text-accent-foreground">
            Avalado
          </div>
        )}
      </div>

      {/* Content */}
      <CardHeader className="pb-3">
        <h3 className="mb-2 line-clamp-2 text-lg font-bold leading-tight">
          {/* Stretched link: makes the whole card navigate to the detail page,
              while the "Donar ahora" button below stays an independent link. */}
          <Link
            href={`/campaigns/${id}`}
            className="rounded-sm before:absolute before:inset-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {title}
          </Link>
        </h3>
        <Badge variant="secondary" className="w-fit text-xs">
          {category}
        </Badge>
      </CardHeader>

      <CardContent className="flex-1 space-y-3 pb-3">
        <p className="line-clamp-2 text-sm text-muted-foreground">
          {description}
        </p>

        {/* Progress */}
        {openEnded ? (
          <div className="space-y-1">
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="font-mono font-semibold text-primary">
                {usd(raisedAmount)}
              </span>
              <span className="text-xs text-muted-foreground">recaudados</span>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Sin meta fija · toda ayuda suma</span>
              <span>
                {donorCount} {donorCount === 1 ? "donante" : "donantes"}
              </span>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="font-mono font-semibold text-primary">
                {usd(raisedAmount)}
              </span>
              <span className="font-mono text-muted-foreground">
                de {usd(goalAmount)}
              </span>
            </div>
            <Progress value={Math.min(progressPercent, 100)} className="h-2" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{Math.round(progressPercent)}% recaudado</span>
              <span>
                {donorCount} {donorCount === 1 ? "donante" : "donantes"}
              </span>
            </div>
          </div>
        )}

        {/* Creator */}
        <p className="text-xs text-muted-foreground">
          Por <span className="font-semibold text-foreground">{creator}</span>
        </p>
      </CardContent>

      {/* Footer: real link straight to the donate flow */}
      <CardFooter className="pt-0">
        <Button asChild className="relative z-10 w-full">
          <Link href={`/campaigns/${id}/donate`}>
            <Heart className="h-4 w-4" />
            Donar ahora
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
