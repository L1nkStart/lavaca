import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from 'lucide-react';
import Link from "next/link";

interface Update {
  id: string;
  title: string;
  content: string;
  date: Date;
  image?: string;
}

interface CampaignUpdatesProps {
  updates: Update[];
}

export function CampaignUpdates({ updates }: CampaignUpdatesProps) {
  if (!updates.length) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">
          El creador aún no ha publicado actualizaciones
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {updates.map((update) => (
        <Card key={update.id} className="hover:shadow-md transition-shadow">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <CardTitle className="text-lg">{update.title}</CardTitle>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
                  <Calendar className="w-4 h-4" />
                  {update.date.toLocaleDateString("es-VE", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm leading-relaxed">{update.content}</p>
            {update.image && (
              <div className="relative h-48 rounded-lg overflow-hidden">
                <img
                  src={update.image || "/placeholder.svg"}
                  alt={update.title}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
