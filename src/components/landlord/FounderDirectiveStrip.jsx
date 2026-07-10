// FounderDirectiveStrip — the Founder's Directive band for the Landlord Detail page.
// Rendered under the page header, above the communication tabs.
//
// Three states:
//   a. Active/acknowledged directive → prominent gold-bordered navy band with
//      crown icon, directive text, priority badge, issued-by + date.
//      Non-admin agents: Acknowledge button + optional reply input.
//      Admins: Edit, Resolve, plus ack state with agent reply.
//   b. Admin-only, no active directive → slim "+ Founder Directive" collapsed control
//      that expands to text input + priority selector + Save.
//   c. Admin-only Founder Lens stat line inside the strip (both states):
//      days in stage, last outbound, next touch, total outbound touches, ai_momentum.
//   d. History toggle listing resolved directives chronologically.

import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Crown, ChevronDown, Plus, X, Check, Edit3, History, Loader2, Flag } from 'lucide-react';
import FounderBossVoiceButton from './FounderBossVoiceButton';

const GOLD = '#C9A24B';

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

function fmtDate(d) {
  if (!d) return '?';
  const x = new Date(d);
  if (isNaN(x)) return String(d);
  return x.toISOString().slice(0, 16).replace('T', ' ');
}

function fmtShortDate(d) {
  if (!d) return '—';
  const x = new Date(d);
  if (isNaN(x)) return '—';
  return x.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

const PRIORITY_META = {
  critical: { label: 'CRITICAL', color: '#ef4444', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.4)' },
  high: { label: 'HIGH', color: GOLD, bg: 'rgba(201,162,75,0.12)', border: 'rgba(201,162,75,0.4)' },
  normal: { label: 'NORMAL', color: '#93c5fd', bg: 'rgba(147,197,253,0.1)', border: 'rgba(147,197,253,0.3)' },
};

export default function FounderDirectiveStrip({ landlordId, landlord, currentUser, isAdmin }) {
  const [directives, setDirectives] = useState([]);
  const [loading, setLoading] = useState(true);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [ackSaving, setAckSaving] = useState(false);

  // Create/edit form state
  const [draftText, setDraftText] = useState('');
  const [draftPriority, setDraftPriority] = useState('high');

  // Acknowledge form state
  const [ackReply, setAckReply] = useState('');

  // Founder lens stats
  const [lens, setLens] = useState(null);

  const fetchDirectives = useCallback(async () => {
    if (!landlordId) return;
    try {
      const list = await base44.entities.LandlordDirective.filter(
        { landlord_id: landlordId },
        '-created_date',
        50
      );
      setDirectives(list || []);
    } catch (err) {
      // surface error — no silent swallowing
      console.error('FounderDirective fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [landlordId]);

  const fetchLens = useCallback(async () => {
    if (!landlordId) return;
    try {
      const [msgs, ims, tgs, ems, fups, appts] = await Promise.all([
        base44.entities.Message.filter({ landlord_id: landlordId, direction: 'outgoing' }, '-timestamp', 500).catch(() => []),
        base44.entities.IMessage.filter({ landlord_id: landlordId, direction: 'outbound' }, '-sent_at', 500).catch(() => []),
        base44.entities.TelegramMessage.filter({ landlord_id: landlordId, direction: 'outbound' }, '-sent_at', 500).catch(() => []),
        base44.entities.Email.filter({ landlord_id: landlordId, direction: 'outbound' }, '-received_at', 500).catch(() => []),
        base44.entities.Followup.filter({ landlord_id: landlordId, status: 'pending' }, 'scheduled_at', 50).catch(() => []),
        base44.entities.LandlordAppointment.filter({ landlord_id: landlordId, status: 'scheduled' }, 'datetime', 50).catch(() => []),
      ]);

      const allTs = [];
      const pushTs = (arr, field) => {
        (arr || []).forEach(r => {
          if (r[field]) {
            const t = new Date(r[field]).getTime();
            if (!isNaN(t)) allTs.push(t);
          }
        });
      };
      pushTs(msgs, 'timestamp');
      pushTs(ims, 'sent_at');
      pushTs(tgs, 'sent_at');
      pushTs(ems, 'received_at');

      const lastOutbound = allTs.length > 0 ? Math.max(...allTs) : null;
      const totalTouches = allTs.length;

      const now = Date.now();
      const futureFup = (fups || []).find(f => f.scheduled_at && new Date(f.scheduled_at).getTime() > now);
      const futureAppt = (appts || []).find(a => a.datetime && new Date(a.datetime).getTime() > now);
      const nextTouch = [futureFup?.scheduled_at, futureAppt?.datetime]
        .filter(Boolean)
        .map(d => new Date(d).getTime())
        .filter(t => !isNaN(t) && t > now)
        .sort((a, b) => a - b)[0] || null;

      const stageEntered = landlord?.stage_entered_at ? new Date(landlord.stage_entered_at).getTime() : null;
      const daysInStage = stageEntered ? Math.floor((now - stageEntered) / 86400000) : null;

      setLens({
        daysInStage,
        lastOutbound,
        nextTouch,
        totalTouches,
        aiMomentum: landlord?.ai_momentum || null,
      });
    } catch (err) {
      console.error('FounderLens fetch error:', err);
    }
  }, [landlordId, landlord]);

  useEffect(() => {
    fetchDirectives();
    fetchLens();
  }, [fetchDirectives, fetchLens]);

  const activeDirective = directives.find(d => d.status === 'active' || d.status === 'acknowledged');
  const resolvedDirectives = directives.filter(d => d.status === 'resolved');

  const handleCreate = async () => {
    if (!draftText.trim()) { toast.error('Directive text cannot be empty'); return; }
    setSaving(true);
    try {
      const user = currentUser || (await base44.auth.me().catch(() => null));
      await base44.entities.LandlordDirective.create({
        landlord_id: landlordId,
        directive_text: draftText.trim(),
        priority: draftPriority,
        status: 'active',
        created_by_email: user?.email || null,
        created_by_name: user?.full_name || user?.email?.split('@')[0] || null,
      });
      toast.success('Founder directive issued');
      setDraftText('');
      setDraftPriority('high');
      setCreateOpen(false);
      fetchDirectives();
    } catch (err) {
      toast.error('Failed to issue directive: ' + (err?.message || 'unknown'));
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async () => {
    if (!draftText.trim()) { toast.error('Directive text cannot be empty'); return; }
    if (!activeDirective) return;
    setSaving(true);
    try {
      await base44.entities.LandlordDirective.update(activeDirective.id, {
        directive_text: draftText.trim(),
        priority: draftPriority,
      });
      toast.success('Directive updated');
      setEditMode(false);
      setDraftText('');
      fetchDirectives();
    } catch (err) {
      toast.error('Failed to update: ' + (err?.message || 'unknown'));
    } finally {
      setSaving(false);
    }
  };

  const handleAcknowledge = async () => {
    if (!activeDirective) return;
    setAckSaving(true);
    try {
      const user = currentUser || (await base44.auth.me().catch(() => null));
      const update = {
        status: 'acknowledged',
        acknowledged_by_email: user?.email || null,
        acknowledged_by_name: user?.full_name || user?.email?.split('@')[0] || null,
        acknowledged_at: new Date().toISOString(),
      };
      if (ackReply.trim()) update.agent_response = ackReply.trim();
      await base44.entities.LandlordDirective.update(activeDirective.id, update);
      toast.success('Directive acknowledged');
      setAckReply('');
      fetchDirectives();
    } catch (err) {
      toast.error('Failed to acknowledge: ' + (err?.message || 'unknown'));
    } finally {
      setAckSaving(false);
    }
  };

  const handleResolve = async () => {
    if (!activeDirective) return;
    setSaving(true);
    try {
      await base44.entities.LandlordDirective.update(activeDirective.id, {
        status: 'resolved',
        resolved_at: new Date().toISOString(),
      });
      toast.success('Directive resolved');
      fetchDirectives();
    } catch (err) {
      toast.error('Failed to resolve: ' + (err?.message || 'unknown'));
    } finally {
      setSaving(false);
    }
  };

  const startEdit = () => {
    setDraftText(activeDirective?.directive_text || '');
    setDraftPriority(activeDirective?.priority || 'high');
    setEditMode(true);
    setCreateOpen(false);
  };

  // ── LOADING STATE ──
  if (loading) {
    return (
      <div style={css("flex:none; margin:0 0 6px; display:flex; align-items:center; gap:6px; padding:6px 14px;")}>
        <Loader2 size={12} className="animate-spin" style={{ color: 'rgba(255,255,255,0.3)' }} />
        <span style={css("font-size:10px; color:rgba(255,255,255,0.3); font-family:'Inter',sans-serif;")}>Loading directives…</span>
      </div>
    );
  }

  const prio = activeDirective ? PRIORITY_META[activeDirective.priority] || PRIORITY_META.normal : null;

  // ── FOUNDER LENS (admin only, compact stat line) ──
  const renderLens = () => {
    if (!isAdmin || !lens) return null;
    const stats = [];
    if (lens.daysInStage != null) stats.push(`${lens.daysInStage}d in stage`);
    stats.push(`Last out: ${fmtShortDate(lens.lastOutbound)}`);
    stats.push(`Next: ${fmtShortDate(lens.nextTouch)}`);
    stats.push(`${lens.totalTouches} touches`);
    if (lens.aiMomentum) stats.push(lens.aiMomentum);
    return (
      <div style={css("display:flex; align-items:center; gap:10px; flex-wrap:wrap; margin-top:6px; padding-top:6px; border-top:1px solid rgba(255,255,255,0.06);")}>
        <span style={css("font-size:8.5px; font-weight:700; letter-spacing:0.05em; text-transform:uppercase; color:rgba(255,255,255,0.25); font-family:'Inter',sans-serif;")}>Founder Lens</span>
        {stats.map((s, i) => (
          <span key={i} style={css("font-size:9.5px; color:rgba(255,255,255,0.4); font-family:'Inter',sans-serif;")}>{s}</span>
        ))}
      </div>
    );
  };

  // ── STATE A: Active or acknowledged directive ──
  if (activeDirective && !editMode) {
    return (
      <div style={css("flex:none; margin:0 0 6px;")}>
        <div style={css(
          "border-radius:12px; border:1px solid " + (prio?.border || 'rgba(201,162,75,0.4)') + "; " +
          "background:linear-gradient(135deg, rgba(201,162,75,0.06), rgba(255,255,255,0.02)); " +
          "padding:10px 14px; display:flex; flex-direction:column; gap:4px;"
        )}>
          {/* Header row */}
          <div style={css("display:flex; align-items:flex-start; gap:8px;")}>
            <Crown size={15} style={{ flex: 'none', color: GOLD, marginTop: 1 }} />
            <div style={css("flex:1; min-width:0;")}>
              <div style={css("display:flex; align-items:center; gap:6px; flex-wrap:wrap; margin-bottom:3px;")}>
                <span style={css("font-size:9px; font-weight:700; letter-spacing:0.06em; text-transform:uppercase; color:" + GOLD + "; font-family:'Inter',sans-serif;")}>Founder Directive</span>
                {prio && (
                  <span style={css("font-size:8px; font-weight:700; letter-spacing:0.04em; text-transform:uppercase; padding:1px 6px; border-radius:99px; color:" + prio.color + "; background:" + prio.bg + "; border:1px solid " + prio.border + "; font-family:'Inter',sans-serif;")}>{prio.label}</span>
                )}
                {activeDirective.status === 'acknowledged' && (
                  <span style={css("font-size:8px; font-weight:600; padding:1px 6px; border-radius:99px; color:#34d399; background:rgba(16,185,129,0.12); border:1px solid rgba(16,185,129,0.3); font-family:'Inter',sans-serif;")}>Acknowledged</span>
                )}
              </div>
              <p style={css("font-size:12px; line-height:1.45; color:rgba(255,255,255,0.9); margin:0; font-family:'Inter',sans-serif;")}>{activeDirective.directive_text}</p>
              <div style={css("display:flex; align-items:center; gap:8px; margin-top:4px; font-size:9px; color:rgba(255,255,255,0.35); font-family:'Inter',sans-serif;")}>
                <span>Issued by {activeDirective.created_by_name || activeDirective.created_by_email || 'founder'}</span>
                <span>·</span>
                <span>{fmtDate(activeDirective.created_date)}</span>
              </div>
              {/* Acknowledgment details */}
              {activeDirective.status === 'acknowledged' && activeDirective.acknowledged_by_name && (
                <div style={css("margin-top:4px; padding:4px 8px; border-radius:6px; background:rgba(16,185,129,0.06); border:1px solid rgba(16,185,129,0.15);")}>
                  <span style={css("font-size:9px; color:#34d399; font-weight:600; font-family:'Inter',sans-serif;")}>✓ {activeDirective.acknowledged_by_name}</span>
                  {activeDirective.acknowledged_at && <span style={css("font-size:9px; color:rgba(255,255,255,0.3); margin-left:6px;")}>{fmtDate(activeDirective.acknowledged_at)}</span>}
                  {activeDirective.agent_response && (
                    <p style={css("font-size:10.5px; color:rgba(255,255,255,0.6); margin:3px 0 0; font-style:italic; font-family:'Inter',sans-serif;")}>“{activeDirective.agent_response}”</p>
                  )}
                </div>
              )}
            </div>
            {/* Action buttons */}
            <div style={css("flex:none; display:flex; align-items:center; gap:4px;")}>
              {!isAdmin && activeDirective.status === 'active' && (
                <button onClick={handleAcknowledge} disabled={ackSaving} title="Acknowledge this directive"
                  style={css("display:inline-flex; align-items:center; gap:4px; padding:5px 10px; border-radius:7px; font-size:10px; font-weight:700; cursor:pointer; font-family:'Inter',sans-serif; background:rgba(16,185,129,0.12); color:#34d399; border:1px solid rgba(16,185,129,0.3);")}>
                  {ackSaving ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />} Acknowledge
                </button>
              )}
              {isAdmin && (
                <>
                  <button onClick={startEdit} disabled={saving} title="Edit directive"
                    style={css("display:inline-flex; align-items:center; justify-content:center; width:28px; height:28px; border-radius:7px; cursor:pointer; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); color:rgba(255,255,255,0.5);")}>
                    <Edit3 size={12} />
                  </button>
                  <button onClick={handleResolve} disabled={saving} title="Resolve directive"
                    style={css("display:inline-flex; align-items:center; gap:4px; padding:5px 10px; border-radius:7px; font-size:10px; font-weight:700; cursor:pointer; font-family:'Inter',sans-serif; background:rgba(255,255,255,0.05); color:rgba(255,255,255,0.6); border:1px solid rgba(255,255,255,0.12);")}>
                    {saving ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />} Resolve
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Non-admin reply input (only when active, not yet acknowledged) */}
          {!isAdmin && activeDirective.status === 'active' && (
            <div style={css("display:flex; align-items:center; gap:6px; margin-top:4px;")}>
              <input
                value={ackReply}
                onChange={(e) => setAckReply(e.target.value)}
                placeholder="Optional reply to the founder…"
                style={css("flex:1; min-width:0; height:28px; padding:0 10px; border-radius:7px; font-size:11px; font-family:'Inter',sans-serif; background:rgba(255,255,255,0.04); color:rgba(255,255,255,0.8); border:1px solid rgba(255,255,255,0.08); outline:none;")}
              />
            </div>
          )}

          {renderLens()}

          {/* History toggle */}
          {resolvedDirectives.length > 0 && (
            <div style={css("margin-top:4px;")}>
              <button onClick={() => setHistoryOpen(!historyOpen)}
                style={css("display:inline-flex; align-items:center; gap:4px; font-size:9px; color:rgba(255,255,255,0.3); cursor:pointer; background:none; border:none; font-family:'Inter',sans-serif;")}>
                <History size={11} /> {historyOpen ? 'Hide' : 'Show'} history ({resolvedDirectives.length})
                <ChevronDown size={11} style={{ transform: historyOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
              </button>
              {historyOpen && (
                <div style={css("display:flex; flex-direction:column; gap:4px; margin-top:4px;")}>
                  {resolvedDirectives.map(d => {
                    const p = PRIORITY_META[d.priority] || PRIORITY_META.normal;
                    return (
                      <div key={d.id} style={css("padding:6px 8px; border-radius:7px; background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.05);")}>
                        <div style={css("display:flex; align-items:center; gap:5px; margin-bottom:2px;")}>
                          <span style={css("font-size:8px; font-weight:600; padding:1px 5px; border-radius:99px; color:" + p.color + "; background:" + p.bg + "; border:1px solid " + p.border + ";")}>{p.label}</span>
                          <span style={css("font-size:8.5px; color:rgba(255,255,255,0.25);")}>{fmtDate(d.created_date)}</span>
                          {d.resolved_at && <span style={css("font-size:8.5px; color:rgba(16,185,129,0.4); margin-left:auto;")}>resolved {fmtShortDate(d.resolved_at)}</span>}
                        </div>
                        <p style={css("font-size:10.5px; color:rgba(255,255,255,0.5); margin:0; font-family:'Inter',sans-serif;")}>{d.directive_text}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── STATE A (edit mode for admins) ──
  if (activeDirective && editMode && isAdmin) {
    return (
      <div style={css("flex:none; margin:0 0 6px;")}>
        <div style={css("border-radius:12px; border:1px solid rgba(201,162,75,0.35); background:rgba(201,162,75,0.04); padding:10px 14px; display:flex; flex-direction:column; gap:6px;")}>
          <div style={css("display:flex; align-items:center; gap:6px;")}>
            <Crown size={14} style={{ color: GOLD }} />
            <span style={css("font-size:10px; font-weight:700; letter-spacing:0.05em; text-transform:uppercase; color:" + GOLD + "; font-family:'Inter',sans-serif;")}>Edit Founder Directive</span>
            <button onClick={() => setEditMode(false)} style={css("margin-left:auto; cursor:pointer; background:none; border:none; color:rgba(255,255,255,0.4); display:flex;")}>
              <X size={13} />
            </button>
          </div>
          <textarea
            value={draftText}
            onChange={(e) => setDraftText(e.target.value)}
            rows={2}
            placeholder="Directive text…"
            style={css("width:100%; padding:6px 10px; border-radius:8px; font-size:12px; font-family:'Inter',sans-serif; background:rgba(255,255,255,0.04); color:rgba(255,255,255,0.9); border:1px solid rgba(255,255,255,0.08); outline:none; resize:vertical; min-height:44px;")}
          />
          <div style={css("display:flex; align-items:center; gap:6px; flex-wrap:wrap;")}>
            <FounderBossVoiceButton
              draftText={draftText}
              onApply={(text) => setDraftText(text)}
              landlordId={landlordId}
              landlord={landlord}
              lens={lens}
            />
            {Object.entries(PRIORITY_META).map(([key, meta]) => (
              <button key={key} onClick={() => setDraftPriority(key)}
                style={css(
                  "padding:3px 9px; border-radius:99px; font-size:9px; font-weight:700; text-transform:uppercase; cursor:pointer; font-family:'Inter',sans-serif; " +
                  (draftPriority === key
                    ? "color:" + meta.color + "; background:" + meta.bg + "; border:1px solid " + meta.border + ";"
                    : "color:rgba(255,255,255,0.3); background:transparent; border:1px solid rgba(255,255,255,0.08);")
                )}>
                {meta.label}
              </button>
            ))}
            <button onClick={handleEdit} disabled={saving}
              style={css("margin-left:auto; display:inline-flex; align-items:center; gap:4px; padding:5px 12px; border-radius:7px; font-size:10px; font-weight:700; cursor:pointer; font-family:'Inter',sans-serif; background:linear-gradient(180deg, hsl(38 92% 52%), hsl(38 92% 46%)); color:#1a1205; border:1px solid hsl(38 92% 50% / 0.5);")}>
              {saving ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />} Save
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── STATE B: Admin-only, no active directive → collapsed create control ──
  if (isAdmin && !activeDirective) {
    if (!createOpen) {
      return (
        <div style={css("flex:none; margin:0 0 6px;")}>
          <button onClick={() => { setCreateOpen(true); setDraftPriority('high'); }}
            style={css("display:inline-flex; align-items:center; gap:5px; padding:5px 12px; border-radius:8px; font-size:10px; font-weight:600; cursor:pointer; font-family:'Inter',sans-serif; background:rgba(201,162,75,0.04); color:rgba(201,162,75,0.7); border:1px solid rgba(201,162,75,0.15);")}>
            <Plus size={12} /> Founder Directive
          </button>
          {renderLens()}
        </div>
      );
    }
    return (
      <div style={css("flex:none; margin:0 0 6px;")}>
        <div style={css("border-radius:12px; border:1px solid rgba(201,162,75,0.25); background:rgba(201,162,75,0.03); padding:10px 14px; display:flex; flex-direction:column; gap:6px;")}>
          <div style={css("display:flex; align-items:center; gap:6px;")}>
            <Crown size={14} style={{ color: GOLD }} />
            <span style={css("font-size:10px; font-weight:700; letter-spacing:0.05em; text-transform:uppercase; color:" + GOLD + "; font-family:'Inter',sans-serif;")}>New Founder Directive</span>
            <button onClick={() => { setCreateOpen(false); setDraftText(''); }} style={css("margin-left:auto; cursor:pointer; background:none; border:none; color:rgba(255,255,255,0.4); display:flex;")}>
              <X size={13} />
            </button>
          </div>
          <textarea
            value={draftText}
            onChange={(e) => setDraftText(e.target.value)}
            rows={2}
            placeholder="What must the agent prioritize for this landlord?"
            style={css("width:100%; padding:6px 10px; border-radius:8px; font-size:12px; font-family:'Inter',sans-serif; background:rgba(255,255,255,0.04); color:rgba(255,255,255,0.9); border:1px solid rgba(255,255,255,0.08); outline:none; resize:vertical; min-height:44px;")}
          />
          <div style={css("display:flex; align-items:center; gap:6px; flex-wrap:wrap;")}>
            <FounderBossVoiceButton
              draftText={draftText}
              onApply={(text) => setDraftText(text)}
              landlordId={landlordId}
              landlord={landlord}
              lens={lens}
            />
            {Object.entries(PRIORITY_META).map(([key, meta]) => (
              <button key={key} onClick={() => setDraftPriority(key)}
                style={css(
                  "padding:3px 9px; border-radius:99px; font-size:9px; font-weight:700; text-transform:uppercase; cursor:pointer; font-family:'Inter',sans-serif; " +
                  (draftPriority === key
                    ? "color:" + meta.color + "; background:" + meta.bg + "; border:1px solid " + meta.border + ";"
                    : "color:rgba(255,255,255,0.3); background:transparent; border:1px solid rgba(255,255,255,0.08);")
                )}>
                {meta.label}
              </button>
            ))}
            <button onClick={handleCreate} disabled={saving}
              style={css("margin-left:auto; display:inline-flex; align-items:center; gap:4px; padding:5px 12px; border-radius:7px; font-size:10px; font-weight:700; cursor:pointer; font-family:'Inter',sans-serif; background:linear-gradient(180deg, hsl(38 92% 52%), hsl(38 92% 46%)); color:#1a1205; border:1px solid hsl(38 92% 50% / 0.5);")}>
              {saving ? <Loader2 size={11} className="animate-spin" /> : <Flag size={11} />} Issue Directive
            </button>
          </div>
          {renderLens()}
        </div>
      </div>
    );
  }

  // ── STATE C: Non-admin, no active directive → render nothing (or just the lens if admin) ──
  return null;
}