import React, { useState } from 'react';
import { format } from 'date-fns';
import { ChevronDown, ChevronUp } from 'lucide-react';
import ReadAloudButton from '@/components/shared/ReadAloudButton';

export default function EmailThread({ emails, currentEmailId }) {
  const [expanded, setExpanded] = useState(false);
  const others = emails.filter(e => e.id !== currentEmailId);
  if (others.length === 0) return null;

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-muted/40 hover:bg-muted/60 transition-colors text-sm"
      >
        <span className="font-medium">{others.length} more message{others.length > 1 ? 's' : ''} in thread</span>
        {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      {expanded && (
        <div className="divide-y divide-border">
          {others.map(e => (
            <div key={e.id} className="px-4 py-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium">{e.from_name || e.from_email}</span>
                <div className="flex items-center gap-2">
                  <ReadAloudButton text={e.snippet || e.body_text || ''} title={`Email · ${e.from_name || e.from_email}`} size={20} />
                  <span className="text-xs text-muted-foreground">
                    {e.received_at && format(new Date(e.received_at), 'MMM d, h:mm a')}
                  </span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2">{e.snippet}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}