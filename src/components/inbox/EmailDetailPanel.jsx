import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import {
  ArrowLeft, ExternalLink, UserPlus, Paperclip, Star, ChevronDown, ChevronUp, Mail
} from 'lucide-react';
import { Link } from 'react-router-dom';
import EmailThread from '@/components/inbox/EmailThread';

const TAG_COLORS = {
  sales: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  support: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  inquiry: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  spam: 'bg-red-500/10 text-red-600 border-red-500/20',
  follow_up: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
  viewing_request: 'bg-sky-500/10 text-sky-600 border-sky-500/20',
  offer: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  document: 'bg-cyan-500/10 text-cyan-600 border-cyan-500/20',
};

export default function EmailDetailPanel({ email, onClose, onLeadCreated }) {
  const [showHtml, setShowHtml] = useState(false);
  const [creatingLead, setCreatingLead] = useState(false);
  const queryClient = useQueryClient();

  const { data: lead } = useQuery({
    queryKey: ['lead', email.lead_id],
    queryFn: () => base44.entities.Lead.filter({ id: email.lead_id }),
    enabled: !!email.lead_id,
    select: (data) => data[0],
  });

  // Thread emails
  const { data: threadEmails = [] } = useQuery({
    queryKey: ['thread', email.gmail_thread_id],
    queryFn: () => base44.entities.Email.filter({ gmail_thread_id: email.gmail_thread_id }, '-received_at', 20),
    enabled: !!email.gmail_thread_id,
  });

  const importantMutation = useMutation({
    mutationFn: () => base44.entities.Email.update(email.id, { is_important: !email.is_important }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['emails'] }),
  });

  const handleCreateLead = async () => {
    setCreatingLead(true);
    const newLead = await base44.entities.Lead.create({
      name: email.from_name || email.from_email,
      email: email.from_email,
      source: 'other',
      stage: 'new_lead',
      last_contact_date: email.received_at,
    });
    await base44.entities.Email.update(email.id, { lead_id: newLead.id });
    await base44.entities.Activity.create({
      lead_id: newLead.id,
      type: 'email',
      title: email.subject,
      description: email.snippet,
      metadata: { gmail_message_id: email.gmail_message_id, email_id: email.id },
    });
    queryClient.invalidateQueries({ queryKey: ['emails'] });
    onLeadCreated?.();
    setCreatingLead(false);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border shrink-0">
        <Button variant="ghost" size="sm" onClick={onClose} className="gap-1 text-muted-foreground md:hidden">
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>
        <div className="flex items-center gap-2 ml-auto">
          <Button
            variant="ghost"
            size="icon"
            className={`h-8 w-8 ${email.is_important ? 'text-amber-500' : 'text-muted-foreground'}`}
            onClick={() => importantMutation.mutate()}
          >
            <Star className={`w-4 h-4 ${email.is_important ? 'fill-amber-500' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Email Content */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {/* Subject */}
        <h2 className="text-xl font-semibold leading-tight">{email.subject}</h2>

        {/* Tags */}
        {email.auto_tags?.length > 0 && (
          <div className="flex gap-1.5 flex-wrap">
            {email.auto_tags.map(tag => (
              <Badge key={tag} variant="outline" className={`text-[10px] ${TAG_COLORS[tag] || ''}`}>{tag}</Badge>
            ))}
          </div>
        )}

        {/* Sender Info */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-accent/20 text-accent flex items-center justify-center font-bold text-sm shrink-0">
              {email.from_name?.[0]?.toUpperCase() || '?'}
            </div>
            <div>
              <p className="text-sm font-medium">{email.from_name || email.from_email}</p>
              <p className="text-xs text-muted-foreground">{email.from_email}</p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xs text-muted-foreground">
              {email.received_at && format(new Date(email.received_at), 'MMM d, yyyy h:mm a')}
            </p>
          </div>
        </div>

        {/* Lead Link or Create Button */}
        <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border border-border">
          <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
          {lead ? (
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span className="text-sm text-muted-foreground">Lead:</span>
              <span className="text-sm font-medium truncate">{lead.name}</span>
              <Badge variant="outline" className="text-[10px] capitalize shrink-0">{lead.stage?.replace('_', ' ')}</Badge>
              <Link to="/leads" className="ml-auto shrink-0">
                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-accent">
                  <ExternalLink className="w-3 h-3" /> View
                </Button>
              </Link>
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-1">
              <span className="text-sm text-muted-foreground">Not a known lead</span>
              <Button
                size="sm"
                className="ml-auto h-7 text-xs bg-accent text-accent-foreground hover:bg-accent/90 gap-1"
                onClick={handleCreateLead}
                disabled={creatingLead}
              >
                <UserPlus className="w-3 h-3" />
                {creatingLead ? 'Creating...' : 'Create Lead'}
              </Button>
            </div>
          )}
        </div>

        {/* Attachments */}
        {email.attachments?.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {email.attachments.map((att, i) => (
              <div key={i} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-muted border border-border text-xs">
                <Paperclip className="w-3 h-3 text-muted-foreground" />
                <span className="truncate max-w-[160px]">{att.filename}</span>
              </div>
            ))}
          </div>
        )}

        {/* Body Toggle */}
        <div className="flex gap-2 border-b border-border pb-2">
          <button
            onClick={() => setShowHtml(false)}
            className={`text-xs px-2 py-1 rounded ${!showHtml ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            Plain Text
          </button>
          {email.body_html && (
            <button
              onClick={() => setShowHtml(true)}
              className={`text-xs px-2 py-1 rounded ${showHtml ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              HTML
            </button>
          )}
        </div>

        {/* Body */}
        <div className="text-sm leading-relaxed">
          {showHtml && email.body_html ? (
            <iframe
              srcDoc={email.body_html}
              className="w-full min-h-[400px] border-0 rounded"
              sandbox="allow-same-origin"
              title="email-html"
            />
          ) : (
            <pre className="whitespace-pre-wrap font-sans text-sm text-foreground/90">
              {email.body_text || email.snippet || '(No content)'}
            </pre>
          )}
        </div>

        {/* Thread */}
        {threadEmails.length > 1 && (
          <EmailThread emails={threadEmails} currentEmailId={email.id} />
        )}
      </div>
    </div>
  );
}