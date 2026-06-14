import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import LetterAvatar from '@/components/shared/LetterAvatar';
import { Phone, Mail, MessageSquare } from 'lucide-react';

const ContactCard = ({ contact }) => {
  const { data } = contact;

  return (
    <Card className="glass-card flex flex-col">
      <CardHeader className="flex-row items-center gap-4 space-y-0 pb-4">
        <LetterAvatar name={data.full_name} size={10} />
        <div className="flex-1">
          <CardTitle className="text-base font-bold text-foreground">
            {data.full_name}
          </CardTitle>
          {data.source && (
            <Badge variant="secondary" className="mt-1 font-mono text-xs">
              {data.source}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-grow">
        <div className="space-y-3 text-sm text-muted-foreground">
          {data.phone && (
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4" />
              <span>{data.phone}</span>
            </div>
          )}
          {data.whatsapp && (
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-emerald-500" />
              <span>{data.whatsapp}</span>
            </div>
          )}
          {data.email && (
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              <span className="truncate">{data.email}</span>
            </div>
          )}
          {data.notes && (
            <p className="pt-2 text-xs border-t border-border mt-3 italic">
              {data.notes}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default ContactCard;