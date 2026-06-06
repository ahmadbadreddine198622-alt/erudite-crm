import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import { Search, MessageSquare, ArrowDownLeft, ArrowUpRight, ExternalLink } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

// Global Messages inbox — READ ONLY. Lists every Message record (newest first),
// resolves the linked Landlord (landlord_id -> full_name_en), with search by
// landlord name / phone. Does not modify the Message entity or any webhook.
export default function Messages() {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['messages-all'],
    queryFn: () => base44.entities.Message.list('-timestamp', 1000),
  });
  // landlords loaded once to resolve landlord_id -> name (no relation expand on the entity)
  const { data: landlords = [] } = useQuery({
    queryKey: ['landlords-for-messages'],
    queryFn: () => base44.entities.Landlord.list('-updated_date', 2000),
  });

  const landlordById = useMemo(() => {
    const m = {};
    for (const l of landlords) m[l.id] = l;
    return m;
  }, [landlords]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return messages
      .map((msg) => {
        const ll = msg.landlord_id ? landlordById[msg.landlord_id] : null;
        return { msg, landlord: ll, landlordName: ll ? ll.full_name_en : null };
      })
      .filter((r) => {
        if (!q) return true;
        const name = (r.landlordName || '').toLowerCase();
        const phone = (r.msg.phone || '').toLowerCase();
        return name.includes(q) || phone.includes(q);
      });
  }, [messages, landlordById, search]);

  const fmt = (ts) => {
    try { return ts ? format(new Date(ts), 'd MMM yyyy, HH:mm') : ''; } catch { return ts || ''; }
  };
  // status is the WhatsApp delivery status, not a dedicated read-flag; treat an
  // incoming message that is not yet 'read' as unread (best-effort indicator).
  const isUnread = (msg) => msg.direction === 'incoming' && msg.status !== 'read';

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-1">
        <MessageSquare className="w-6 h-6 text-amber-500" />
        <h1 className="text-2xl font-bold">Messages</h1>
        <span className="text-sm text-muted-foreground">{rows.length}</span>
      </div>
      <p className="text-sm text-muted-foreground mb-4">All messages across the CRM, newest first.</p>

      <div className="relative mb-4">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by landlord name or phone number…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground py-12 text-center">Loading messages…</div>
      ) : rows.length === 0 ? (
        <div className="text-sm text-muted-foreground py-12 text-center">No messages found.</div>
      ) : (
        <div className="rounded-xl border border-white/10 divide-y divide-white/5 overflow-hidden">
          {rows.map((r) => (
            <button
              key={r.msg.id}
              onClick={() => setSelected(r)}
              className="w-full text-left px-4 py-3 hover:bg-white/5 transition flex items-start gap-3"
            >
              <span className="mt-1.5 block w-2 h-2 shrink-0 rounded-full"
                style={{ background: isUnread(r.msg) ? 'hsl(38 92% 50%)' : 'transparent' }} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  {r.msg.direction === 'incoming'
                    ? <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    : <ArrowUpRight className="w-3.5 h-3.5 text-blue-500 shrink-0" />}
                  <span className="font-medium truncate">
                    {r.landlordName || <span className="text-muted-foreground italic">Unmatched</span>}
                  </span>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">· {r.msg.phone}</span>
                </div>
                <div className="text-sm text-muted-foreground truncate">{r.msg.text}</div>
              </div>
              <div className="text-xs text-muted-foreground whitespace-nowrap mt-0.5">{fmt(r.msg.timestamp)}</div>
            </button>
          ))}
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selected?.landlordName || 'Unmatched'} · {selected?.msg?.phone}
            </DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="outline">{selected.msg.direction}</Badge>
                {selected.msg.status && <Badge variant="outline">{selected.msg.status}</Badge>}
                <span>{fmt(selected.msg.timestamp)}</span>
              </div>
              <div className="whitespace-pre-wrap text-sm bg-white/5 rounded-lg p-3">{selected.msg.text}</div>
              {selected.landlord ? (
                <Link
                  to={`/landlords?landlord=${selected.landlord.id}`}
                  className="inline-flex items-center gap-1.5 text-sm text-amber-500 hover:underline"
                >
                  <ExternalLink className="w-4 h-4" /> Open {selected.landlordName}'s profile
                </Link>
              ) : (
                <div className="text-xs text-muted-foreground">No landlord linked to this message.</div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
