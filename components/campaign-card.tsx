import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Heart, Share2, CheckCircle2 } from 'lucide-react';
import Image from "next/image";

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
}: CampaignCardProps) {
  const progressPercent = (raisedAmount / goalAmount) * 100;

  return (
    <Link href={`/campaigns/${id}`}>
      <Card className="h-full overflow-hidden hover:shadow-lg transition-shadow cursor-pointer">
        {/* Image Container */}
        <div className="relative h-48 w-full overflow-hidden bg-muted">
          <Image
            src={image || "/placeholder.svg"}
            alt={title}
            fill
            className="object-cover hover:scale-105 transition-transform duration-300"
          />
          {verified && (
            <div className="absolute top-3 right-3 bg-primary text-primary-foreground px-2 py-1 rounded-full flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4" />
              <span className="text-xs font-semibold">Verificado</span>
            </div>
          )}
          {guarantor && (
            <div className="absolute bottom-3 right-3 bg-accent text-accent-foreground px-2 py-1 rounded-full text-xs font-semibold">
              Avalado
            </div>
          )}
        </div>

        {/* Content */}
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <h3 className="font-bold text-lg leading-tight line-clamp-2 mb-2">
                {title}
              </h3>
              <Badge variant="secondary" className="text-xs">
                {category}
              </Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pb-3 space-y-3">
          <p className="text-sm text-muted-foreground line-clamp-2">
            {description}
          </p>

          {/* Progress */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="font-semibold text-primary">
                ${raisedAmount.toFixed(2)}
              </span>
              <span className="text-muted-foreground">
                de ${goalAmount.toFixed(2)}
              </span>
            </div>
            <Progress value={Math.min(progressPercent, 100)} className="h-2" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{Math.round(progressPercent)}% recaudado</span>
              <span>{donorCount} donantes</span>
            </div>
          </div>

          {/* Creator */}
          <div className="text-xs text-muted-foreground">
            Por <span className="font-semibold text-foreground">{creator}</span>
          </div>
        </CardContent>

        {/* Footer */}
        <CardFooter className="pt-0 flex gap-2">
          <Button size="sm" className="flex-1 bg-primary hover:bg-primary/90">
            Donar Ahora
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="px-3"
            asChild
          >
            <Share2 className="w-4 h-4" />
          </Button>
        </CardFooter>
      </Card>
    </Link>
  );
}
