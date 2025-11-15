import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Heart } from 'lucide-react';

interface Donation {
  id: string;
  amount: number;
  donorName: string;
  isAnonymous: boolean;
  date: Date;
}

interface CampaignDonorsListProps {
  donations: Donation[];
}

export function CampaignDonorsList({ donations }: CampaignDonorsListProps) {
  const recentDonations = donations.slice(0, 10);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Heart className="w-5 h-5 text-accent" />
            Donantes Recientes
          </CardTitle>
          <Badge variant="secondary">{donations.length} donantes</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {recentDonations.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Sé el primero en donar para esta campaña
            </p>
          ) : (
            recentDonations.map((donation) => (
              <div
                key={donation.id}
                className="flex items-center justify-between py-3 border-b border-border last:border-0"
              >
                <div className="flex-1">
                  <p className="font-medium text-sm">
                    {donation.isAnonymous ? "Donante anónimo" : donation.donorName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {donation.date.toLocaleDateString("es-VE", {
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                </div>
                <p className="font-bold text-primary text-sm">
                  ${donation.amount.toFixed(2)}
                </p>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
