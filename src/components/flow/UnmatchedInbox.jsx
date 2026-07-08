// UnmatchedInbox — groups Messages where landlord_id AND lead_id are both null
// (is_deleted false) by phone number, newest first.
//
// Each group has three actions:
//   "Link to Landlord" — search picker → sets landlord_id on ALL messages from that phone
//   "Link to Lead"     — same for lead_id
//   "Create Landlord"  — quick-create with phone prefilled, then link all

import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Loader2, Search, UserPlus, Link2, X, ChevronDown, ChevronRight } from 'lucide-react';

function css(str) {
  const o = {};
  String(str).split(';').forEach((decl) => {
    const i = decl.indexOf(':');
    if (i < 0) return;
    const k = decl.slice(0, i).trim();
    const v = decl.slice(i + 1).trim();
    if (!k) return;
    o[k.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = v;
  });
  return o;
}

function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return isNaN(d.getTime()) ? '' : d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function UnmatchedInbox() {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [searchOpen, setSearchOpen] = useState(null); // { phone, type: 'landlord'|'lead' }
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [creating, setCreating] = useState(null); // phone
  const [createName, setCreateName] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const messages = await base44.entities.Message.filter(
        { landlord_id: null, lead_id: null, is_deleted: { $ne: true } },
        '-timestamp', 500,
      ).catch(() => []);

      const byPhone = new Map();
      for (const m of messages) {
        if (!m.phone) continue;
        if (!byPhone.has(m.phone)) byPhone.set(m.phone, []);
        byPhone.get(m.phone).push(m);
      }

      const groupArr = [...byPhone.entries()].map(([phone, msgs]) => {
        msgs.sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());
        return { phone, count: msgs.length, lastText: msgs[0]?.text || '', lastTime: msgs[0]?.timestamp, messages: msgs };
      }).sort((a, b) => new Date(b.lastTime || 0).getTime() - new Date(a.lastTime || 0).getTime());

      setGroups(groupArr);
    } catch {
      setGroups([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const runSearch = async (type) => {
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const entity = type === 'landlord' ? 'Landlord' : 'Lead';
      const results = await base44.entities[entity].filter(
        { $or: [{ full_name: { $regex: searchQuery, $options: 'i' } }, { full_name_en: { $regex: searchQuery, $options: 'i' } }, { phone: { $regex: searchQuery } }, { email: { $regex: searchQuery, $options: 'i' } }] },
        '-created_date', 20,
      ).catch(() => []);
      setSearchResults(results);
    } finally {
      setSearching(false);
    }
  };

  const linkMessages = async (phone, type, entityId) => {
    const msgs = groups.find((g) => g.phone === phone)?.messages || [];
    const ids = msgs.map((m) => m.id);
    try {
      const updates = ids.map((id) => ({ id, [type === 'landlord' ? 'landlord_id' : 'lead_id']: entityId }));
      for (let i = 0; i < updates.length; i += 200) {
        await base44.entities.Message.bulkUpdate(updates.slice(i, i + 200));
      }
      toast.success(`Linked ${ids.length} message${ids.length !== 1 ? 's' : ''} to ${type}`);
      setSearchOpen(null);
      setSearchQuery('');
      setSearchResults([]);
      load();
    } catch (e) {
      toast.error('Failed to link: ' + (e?.message || ''));
    }
  };

  const createLandlord = async (phone) => {
    if (!createName.trim()) { toast.error('Name is required'); return; }
    try {
      const ll = await base44.entities.Landlord.create({
        full_name_en: createName.trim(),
        phone: '+' + phone,
        source: 'other',
        stage: 'initial_contact',
        assigned_agent_email: undefined,
      });
      await linkMessages(phone, 'landlord', ll.id);
      setCreating(null);
      setCreateName('');
    } catch (e) {
      toast.error('Failed to create landlord: ' + (e?.message || ''));
    }
  };

  if (loading) {
    return (
      <div style={css("display:flex; align-items:center; justify-content:center; height:100%;")}>
        <Loader2 className="animate-spin" style={{ color: 'hsl(38 92% 50%)' }} size={22} />
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div style={css("display:flex; align-items:center; justify-content:center; height:100%;")}>
        <span style={css("font-size:13px; color:rgba(255,255,255,0.3); font-family:'Inter',sans-serif;")}>No unmatched messages 🎉</span>
      </div>
    );
  }

  return (
    <div style={css("flex:1; overflow-y:auto; padding:8px; display:flex; flex-direction:column; gap:6px;")}>
      <div style={css("padding:4px 8px 8px; display:flex; align-items:center; justify-content:space-between;")}>
        <span style={css("font-size:12px; font-weight:700; color:rgba(255,255,255,0.7); font-family:'Inter',sans-serif;")}>{groups.length} unmatched phone{groups.length !== 1 ? 's' : ''}</span>
        <button onClick={load} style={css("font-size:10px; font-weight:600; cursor:pointer; padding:3px 9px; border-radius:99px; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.12); color:rgba(255,255,255,0.5); font-family:'Inter',sans-serif;")}>↻ Refresh</button>
      </div>

      {groups.map((g) => {
        const isExpanded = expanded === g.phone;
        const isSearchOpen = searchOpen?.phone === g.phone;
        const isCreating = creating === g.phone;
        return (
          <div key={g.phone} style={css("border-radius:10px; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); overflow:hidden;")}>
            {/* Group header */}
            <button type="button" onClick={() => setExpanded(isExpanded ? null : g.phone)}
              style={css("display:flex; align-items:center; gap:9px; width:100%; padding:9px 12px; cursor:pointer; background:transparent; border:none; text-align:left; font-family:'Inter',sans-serif;")}>
              {isExpanded ? <ChevronDown size={12} style={{ color: 'rgba(255,255,255,0.4)', flex: 'none' }} /> : <ChevronRight size={12} style={{ color: 'rgba(255,255,255,0.4)', flex: 'none' }} />}
              <span style={css("font-size:12px; font-weight:700; color:rgba(255,255,255,0.85);")}>+{g.phone}</span>
              <span style={css("font-size:9px; font-weight:600; padding:1px 6px; border-radius:99px; background:rgba(96,165,250,0.15); color:#93c5fd;")}>{g.count}</span>
              <span style={css("flex:1; min-width:0; font-size:11px; color:rgba(255,255,255,0.4); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; text-align:right;")}>{g.lastText.slice(0, 40)} · {formatTime(g.lastTime)}</span>
            </button>

            {/* Expanded actions */}
            {isExpanded && (
              <div style={css("padding:4px 12px 10px;")}>
                {/* Quick action buttons */}
                <div style={css("display:flex; gap:5px; margin-bottom:7px;")}>
                  <button type="button" onClick={() => { setSearchOpen(isSearchOpen ? null : { phone: g.phone, type: 'landlord' }); setSearchQuery(''); setSearchResults([]); }}
                    style={css("display:flex; align-items:center; gap:4px; padding:4px 9px; border-radius:7px; font-size:10px; font-weight:600; cursor:pointer; font-family:'Inter',sans-serif; background:rgba(37,211,102,0.12); color:#4ade80; border:1px solid rgba(37,211,102,0.25);")}>
                    <Link2 size={11} /> Link Landlord
                  </button>
                  <button type="button" onClick={() => { setSearchOpen(isSearchOpen ? null : { phone: g.phone, type: 'lead' }); setSearchQuery(''); setSearchResults([]); }}
                    style={css("display:flex; align-items:center; gap:4px; padding:4px 9px; border-radius:7px; font-size:10px; font-weight:600; cursor:pointer; font-family:'Inter',sans-serif; background:rgba(96,165,250,0.12); color:#93c5fd; border:1px solid rgba(96,165,250,0.25);")}>
                    <Link2 size={11} /> Link Lead
                  </button>
                  <button type="button" onClick={() => { setCreating(isCreating ? null : g.phone); setSearchOpen(null); }}
                    style={css("display:flex; align-items:center; gap:4px; padding:4px 9px; border-radius:7px; font-size:10px; font-weight:600; cursor:pointer; font-family:'Inter',sans-serif; background:rgba(245,158,11,0.12); color:hsl(38 92% 60%); border:1px solid rgba(245,158,11,0.25);")}>
                    <UserPlus size={11} /> Create Landlord
                  </button>
                </div>

                {/* Search picker */}
                {isSearchOpen && (
                  <div style={css("padding:8px; border-radius:8px; background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.08); margin-bottom:6px;")}>
                    <div style={css("display:flex; align-items:center; gap:5px; margin-bottom:6px;")}>
                      <Search size={12} style={{ color: 'rgba(255,255,255,0.3)', flex: 'none' }} />
                      <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && runSearch(searchOpen.type)} placeholder={`Search ${searchOpen.type}s by name, phone, or email…`}
                        style={css("flex:1; padding:4px 7px; border-radius:6px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); color:rgba(255,255,255,0.85); font-size:11px; font-family:'Inter',sans-serif; outline:none;")} />
                      <button type="button" onClick={() => runSearch(searchOpen.type)} disabled={searching}
                        style={css("padding:4px 8px; border-radius:6px; font-size:10px; font-weight:600; cursor:pointer; font-family:'Inter',sans-serif; background:hsl(38 92% 50% / 0.2); color:hsl(38 92% 60%); border:1px solid hsl(38 92% 50% / 0.3);")}>
                        {searching ? '…' : 'Find'}
                      </button>
                    </div>
                    {searchResults.length > 0 && (
                      <div style={css("max-height:160px; overflow-y:auto; display:flex; flex-direction:column; gap:3px;")}>
                        {searchResults.map((r) => (
                          <button key={r.id} type="button" onClick={() => linkMessages(g.phone, searchOpen.type, r.id)}
                            style={css("display:flex; flex-direction:column; gap:1px; text-align:left; width:100%; padding:5px 8px; border-radius:6px; cursor:pointer; font-family:'Inter',sans-serif; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08);")}>
                            <span style={css("font-size:11px; font-weight:600; color:rgba(255,255,255,0.8);")}>{r.full_name_en || r.full_name || 'Unnamed'}</span>
                            <span style={css("font-size:9px; color:rgba(255,255,255,0.35);")}>{r.phone || r.email || ''}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Create landlord */}
                {isCreating && (
                  <div style={css("padding:8px; border-radius:8px; background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.08); margin-bottom:6px;")}>
                    <div style={css("display:flex; align-items:center; gap:5px; margin-bottom:6px;")}>
                      <input value={createName} onChange={(e) => setCreateName(e.target.value)} placeholder="Landlord name"
                        style={css("flex:1; padding:4px 7px; border-radius:6px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); color:rgba(255,255,255,0.85); font-size:11px; font-family:'Inter',sans-serif; outline:none;")} />
                      <button type="button" onClick={() => createLandlord(g.phone)}
                        style={css("padding:4px 8px; border-radius:6px; font-size:10px; font-weight:600; cursor:pointer; font-family:'Inter',sans-serif; background:hsl(38 92% 50% / 0.2); color:hsl(38 92% 60%); border:1px solid hsl(38 92% 50% / 0.3);")}>
                        Create & Link
                      </button>
                    </div>
                    <span style={css("font-size:9px; color:rgba(255,255,255,0.3);")}>Phone: +{g.phone} · Stage: initial_contact</span>
                  </div>
                )}

                {/* Message previews */}
                {g.messages.slice(0, 5).map((m) => (
                  <div key={m.id} style={css("padding:5px 8px; margin-bottom:2px; border-radius:6px; background:rgba(255,255,255,0.02);")}>
                    <div style={css("display:flex; align-items:center; gap:5px; margin-bottom:2px;")}>
                      <span style={css("font-size:8px; font-weight:600; padding:0 4px; border-radius:4px; background:") + (m.direction === 'incoming' ? 'rgba(96,165,250,0.15); color:#93c5fd;' : 'rgba(245,158,11,0.15); color:hsl(38 92% 60%);')}>{m.direction === 'incoming' ? '← in' : '→ out'}</span>
                      <span style={css("font-size:9px; color:rgba(255,255,255,0.3);")}>{formatTime(m.timestamp)}</span>
                    </div>
                    <span style={css("font-size:10.5px; color:rgba(255,255,255,0.55); line-height:1.4;")}>{(m.text || '').slice(0, 120)}</span>
                  </div>
                ))}
                {g.messages.length > 5 && <span style={css("font-size:9px; color:rgba(255,255,255,0.25); padding:2px 8px;")}>+ {g.messages.length - 5} more</span>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}