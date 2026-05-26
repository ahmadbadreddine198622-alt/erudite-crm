import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Instagram, Plus, Copy, Check, UserPlus, MessageCircle, ArrowRight, Trash2, Tag } from 'lucide-react';
import { toast } from 'sonner';

const REPLY_TEMPLATES = {
  interested: 'Thank you for your interest! Please DM us or WhatsApp us for more details and pricing.',
  price: 'Hi! We would love to share pricing with you. Please DM us or drop your number below.',
  info: 'Thanks for reaching out! For full details, DM us or WhatsApp us directly.',
  details: 'Thanks for your comment! Please DM us for full details.',
  default: 'Thanks for your comment! Please DM us for more information.',
};

const DEFAULT_KEYWORDS = ['interested', 'price', 'info', 'details', 'how much', 'available', 'whatsapp', 'contact'];

export default function InstagramLeads() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ username: '', comment: '', post_url: '' });
  const [keywords, setKeywords] = useState(DEFAULT_KEYWORDS);
  const [newKeyword, setNewKeyword] = useState('');
  const [copied, setCopied] = useState(null);

  const { data: leads = [] } = useQuery({
    queryKey: ['instagram-leads'],
    queryFn: () => base44.entities.Lead.filter({ source: 'social_media' }, '-created_date', 50),
  });

  const instagramLeads = leads.filter(l => l.source_metadata?.channel === 'instagram');

  const createLead = useMutation({
    mutationFn: (data) => {
      const detectedKeyword = keywords.find(k => data.comment.toLowerCase().includes(k.toLowerCase()));
      return base44.entities.Lead.create({
        name: data.username,
        source: 'social_media',
        stage: 'new_lead',
        notes: `Instagram comment: "${data.comment}"` + (data.post_url ? `\nPost: ${data.post_url}` : ''),
        tags: ['instagram', detectedKeyword].filter(Boolean),
        source_metadata: {
          channel: 'instagram',
          username: data.username,
          comment: data.comment,
          post_url: data.post_url,
          keyword_triggered: detectedKeyword || 'manual',
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['instagram-leads']);
      setForm({ username: '', comment: '', post_url: '' });
      toast.success('Lead added to CRM!');
    },
  });

  const detectedKeyword = keywords.find(k => form.comment.toLowerCase().includes(k.toLowerCase()));
  const suggestedReply = detectedKeyword ? (REPLY_TEMPLATES[detectedKeyword] || REPLY_TEMPLATES.default) : null;

  const copyText = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    toast.success('Copied! Paste it on Instagram.');
    setTimeout(() => setCopied(null), 2000);
  };

  const addKeyword = () => {
    const kw = newKeyword.trim().toLowerCase();
    if (kw && !keywords.includes(kw)) {
      setKeywords([...keywords, kw]);
      setNewKeyword('');
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-6">

      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center shrink-0">
          <Instagram className="w-6 h-6 text-purple-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Instagram Lead Capture</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Someone comments a keyword on your post — log them here, they go straight into CRM</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-purple-600" />
                Log a Comment Lead
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Instagram Username *</label>
                <div className="flex items-center border rounded-md focus-within:ring-1 focus-within:ring-ring">
                  <span className="pl-3 text-muted-foreground text-sm">@</span>
                  <input
                    className="flex-1 h-9 px-2 text-sm bg-transparent outline-none"
                    placeholder="username"
                    value={form.username}
                    onChange={e => setForm({ ...form, username: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Their Comment</label>
                <Input
                  placeholder="Paste their comment here..."
                  value={form.comment}
                  onChange={e => setForm({ ...form, comment: e.target.value })}
                  className="h-9"
                />
                {detectedKeyword && (
                  <p className="text-xs text-purple-600 mt-1">
                    Keyword detected: <strong>{detectedKeyword}</strong>
                  </p>
                )}
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Post URL (optional)</label>
                <Input
                  placeholder="https://instagram.com/p/..."
                  value={form.post_url}
                  onChange={e => setForm({ ...form, post_url: e.target.value })}
                  className="h-9"
                />
              </div>

              {suggestedReply && (
                <div className="bg-purple-500/5 border border-purple-500/20 rounded-lg p-3 space-y-2">
                  <p className="text-xs font-medium text-purple-700">Suggested Reply — copy and paste on Instagram:</p>
                  <p className="text-xs text-muted-foreground italic">{suggestedReply}</p>
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => copyText(suggestedReply, 'reply')}>
                    {copied === 'reply' ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
                    Copy Reply
                  </Button>
                </div>
              )}

              <Button
                className="w-full gap-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:opacity-90"
                onClick={() => createLead.mutate(form)}
                disabled={!form.username || createLead.isPending}
              >
                <Plus className="w-4 h-4" />
                {createLead.isPending ? 'Adding...' : 'Add to CRM'}
                <ArrowRight className="w-4 h-4" />
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Tag className="w-4 h-4 text-amber-600" />
                Trigger Keywords
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">When a comment contains these words, a reply template is suggested automatically.</p>
              <div className="flex flex-wrap gap-1.5">
                {keywords.map(kw => (
                  <span key={kw} className="inline-flex items-center gap-1 bg-muted text-xs px-2 py-1 rounded-full">
                    {kw}
                    <button onClick={() => setKeywords(keywords.filter(k => k !== kw))} className="text-muted-foreground hover:text-red-500">
                      <Trash2 className="w-2.5 h-2.5" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Add keyword..."
                  value={newKeyword}
                  onChange={e => setNewKeyword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addKeyword()}
                  className="h-8 text-xs"
                />
                <Button size="sm" variant="outline" className="h-8 shrink-0" onClick={addKeyword}>
                  <Plus className="w-3 h-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center justify-between">
              <span className="flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-purple-600" />
                Recent Instagram Leads
              </span>
              <Badge className="bg-purple-500/10 text-purple-700 border-purple-500/20">{instagramLeads.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {instagramLeads.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <Instagram className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No Instagram leads yet</p>
                <p className="text-xs mt-1">Log your first comment lead on the left</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                {instagramLeads.map(lead => (
                  <div key={lead.id} className="border rounded-lg p-3 hover:bg-muted/30 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">@{lead.source_metadata?.username || lead.name}</p>
                        {lead.source_metadata?.comment && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">"{lead.source_metadata.comment}"</p>
                        )}
                        {lead.source_metadata?.post_url && (
                          <a href={lead.source_metadata.post_url} target="_blank" rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:underline">
                            View post
                          </a>
                        )}
                      </div>
                      <Badge className="bg-purple-500/10 text-purple-700 border-purple-500/20 text-xs shrink-0">
                        {lead.source_metadata?.keyword_triggered || 'manual'}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </div>
  );
}