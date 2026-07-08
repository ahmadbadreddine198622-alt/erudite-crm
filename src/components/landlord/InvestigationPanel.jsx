// InvestigationPanel — collapsible "Identity Profile" panel rendered inside
// the AIIntelligenceCard. Shows the results of an AI identity investigation
// (web research on the landlord), with confidence badge, summary, occupation,
// companies, LinkedIn/social links, articles, wealth signals, talking points,
// sources, and confirm/wrong-person/re-run actions.
//
// Props:
//   landlordId        (string)
//   investigation      (object) — { profile, status, investigatedAt, matchStatus, hint }
//   onInvestigate      (fn)     — start a new investigation
//   onConfirmMatch     (fn)     — set match_status to "confirmed"
//   onWrongPerson      (fn)     — set match_status to "wrong_person"
//   onReinvestigate    (fn)     — re-run with hint (hintText passed as arg)
//   busy               (bool)   — investigation in progress (button spinner)

import React, { useState } from 'react';
import { Search, Check, X, ExternalLink, RotateCw, ChevronDown, Linkedin, Globe } from 'lucide-react';

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

function relativeTime(iso) {
  if (!iso) return '';
  const ts = new Date(iso).getTime();
  if (isNaN(ts)) return '';
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

const CONF_META = {
  high: { color: '#34d399', bg: 'rgba(16,185,129,0.15)', border: 'rgba(16,185,129,0.35)', label: 'High confidence' },
  medium: { color: 'hsl(38 92% 62%)', bg: 'hsl(38 92% 50% / 0.15)', border: 'hsl(38 92% 50% / 0.35)', label: 'Medium confidence' },
  low: { color: '#f87171', bg: 'rgba(239,68,68,0.15)', border: 'rgba(239,68,68,0.35)', label: 'Low confidence' },
};

const MATCH_META = {
  confirmed: { color: '#34d399', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.3)', label: '✓ Match confirmed' },
  wrong_person: { color: '#f87171', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.3)', label: '✕ Wrong person' },
  unconfirmed: { color: 'rgba(255,255,255,0.5)', bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.12)', label: 'Unconfirmed' },
};

export default function InvestigationPanel({
  landlordId, investigation, onInvestigate, onConfirmMatch, onWrongPerson, onReinvestigate, busy,
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [showHintInput, setShowHintInput] = useState(false);
  const [hintText, setHintText] = useState(investigation?.hint || '');

  if (!investigation) return null;

  const status = investigation.status || 'not_run';
  const profile = investigation.profile || null;
  const matchStatus = investigation.matchStatus || 'unconfirmed';
  const investigatedAt = investigation.investigatedAt;

  // not_run → show only the button
  if (status === 'not_run') {
    return (
      <div style={css('margin-bottom:8px;')}>
        <button
          onClick={() => onInvestigate(landlordId)}
          disabled={busy}
          title="Research this landlord's identity online"
          style={css(
            'display:inline-flex; align-items:center; gap:5px; padding:5px 11px; border-radius:8px; ' +
            'font-size:10.5px; font-weight:700; cursor:pointer; font-family:Inter,sans-serif; ' +
            'background:rgba(59,130,246,0.1); border:1px solid rgba(59,130,246,0.35); color:#93c5fd; ' +
            'opacity:' + (busy ? '0.6' : '1') + ';'
          )}
        >
          {busy
            ? <span style={css('display:inline-block; width:11px; height:11px; border:2px solid rgba(59,130,246,0.25); border-top-color:#93c5fd; border-radius:50%; animation:ld-spin 0.8s linear infinite;')} />
            : <Search size={12} />}
          {busy ? 'Investigating…' : '🔍 Investigate Identity'}
        </button>
      </div>
    );
  }

  // in_progress → show spinner
  if (status === 'in_progress' || busy) {
    return (
      <div style={css('margin-bottom:8px; padding:7px 10px; border-radius:9px; background:rgba(59,130,246,0.08); border:1px solid rgba(59,130,246,0.25); display:flex; align-items:center; gap:7px;')}>
        <span style={css('display:inline-block; width:11px; height:11px; border:2px solid rgba(59,130,246,0.25); border-top-color:#93c5fd; border-radius:50%; animation:ld-spin 0.8s linear infinite;')} />
        <span style={css('font-size:11px; color:#93c5fd; font-family:Inter,sans-serif;')}>Investigating identity…</span>
      </div>
    );
  }

  // failed → show error
  if (status === 'failed') {
    return (
      <div style={css('margin-bottom:8px;')}>
        <div style={css('padding:7px 10px; border-radius:9px; background:rgba(239,68,68,0.08); border:1px solid rgba(239,68,68,0.25); margin-bottom:6px;')}>
          <span style={css('font-size:11px; color:#f87171; font-family:Inter,sans-serif;')}>⚠ Investigation failed</span>
          {profile?.summary && <p style={css('margin:4px 0 0; font-size:10px; color:rgba(255,255,255,0.5);')}>{profile.summary}</p>}
        </div>
        <button
          onClick={() => onInvestigate(landlordId)}
          title="Retry investigation"
          style={css('display:inline-flex; align-items:center; gap:4px; padding:4px 10px; border-radius:7px; font-size:10px; font-weight:600; cursor:pointer; font-family:Inter,sans-serif; background:rgba(59,130,246,0.1); border:1px solid rgba(59,130,246,0.35); color:#93c5fd;')}
        >
          <RotateCw size={11} /> Retry
        </button>
      </div>
    );
  }

  // completed → render the full collapsible panel
  if (!profile) return null;

  const conf = CONF_META[profile.confidence] || CONF_META.low;
  const match = MATCH_META[matchStatus] || MATCH_META.unconfirmed;
  const companies = Array.isArray(profile.companies) ? profile.companies : [];
  const socialLinks = Array.isArray(profile.social_links) ? profile.social_links : [];
  const articles = Array.isArray(profile.articles) ? profile.articles : [];
  const wealthSignals = Array.isArray(profile.wealth_signals) ? profile.wealth_signals : [];
  const talkingPoints = Array.isArray(profile.talking_points) ? profile.talking_points : [];
  const sources = Array.isArray(profile.sources) ? profile.sources : [];

  return (
    <div style={css('margin-bottom:8px; border-radius:9px; background:rgba(59,130,246,0.05); border:1px solid rgba(59,130,246,0.2); overflow:hidden;')}>
      {/* Header — collapsible toggle + confidence badge */}
      <button
        onClick={() => setCollapsed(c => !c)}
        style={css('width:100%; display:flex; align-items:center; gap:7px; padding:7px 10px; background:none; border:none; cursor:pointer; font-family:Inter,sans-serif;')}
      >
        <ChevronDown size={11} style={{ transform: collapsed ? 'rotate(-90deg)' : 'none', transition: 'transform 0.15s ease', color: 'rgba(255,255,255,0.4)' }} />
        <span style={css('font-size:8.5px; font-weight:700; letter-spacing:0.06em; text-transform:uppercase; color:#93c5fd;')}>Identity Profile</span>
        {/* Confidence badge with hover tooltip */}
        <div style={{ position: 'relative', display: 'inline-flex', marginLeft: 'auto' }}>
          <span
            title={profile.confidence_reason || conf.label}
            style={css('display:inline-flex; align-items:center; gap:3px; padding:2px 7px; border-radius:99px; font-size:9px; font-weight:700; background:' + conf.bg + '; border:1px solid ' + conf.border + '; color:' + conf.color + ';')}
          >
            {profile.confidence || 'low'}
          </span>
        </div>
        {/* Match status badge */}
        <span style={css('display:inline-flex; align-items:center; padding:2px 7px; border-radius:99px; font-size:9px; font-weight:600; background:' + match.bg + '; border:1px solid ' + match.border + '; color:' + match.color + ';')}>
          {match.label}
        </span>
      </button>

      {!collapsed && (
        <div style={css('padding:0 10px 9px;')}>
          {/* Summary */}
          {profile.summary && (
            <p style={css('margin:0 0 7px; font-size:11.5px; line-height:1.5; color:rgba(255,255,255,0.82);')}>{profile.summary}</p>
          )}

          {/* Occupation + Companies */}
          {(profile.occupation || companies.length > 0) && (
            <div style={css('margin-bottom:7px;')}>
              {profile.occupation && (
                <div style={css('font-size:11px; color:rgba(255,255,255,0.7);')}>
                  <span style={css('font-size:8.5px; font-weight:700; letter-spacing:0.04em; text-transform:uppercase; color:rgba(255,255,255,0.4); margin-right:5px;')}>Occupation</span>
                  {profile.occupation}
                </div>
              )}
              {companies.length > 0 && (
                <div style={css('display:flex; flex-wrap:wrap; gap:4px; margin-top:4px;')}>
                  {companies.map((c, i) => (
                    <span key={i} style={css('display:inline-flex; padding:2px 7px; border-radius:6px; font-size:9.5px; font-weight:600; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.1); color:rgba(255,255,255,0.7);')}>{c}</span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* LinkedIn + Social links */}
          {(profile.linkedin_url || socialLinks.length > 0) && (
            <div style={css('display:flex; flex-wrap:wrap; gap:5px; margin-bottom:7px;')}>
              {profile.linkedin_url && (
                <a href={profile.linkedin_url} target='_blank' rel='noopener noreferrer' title='LinkedIn profile'
                  style={css('display:inline-flex; align-items:center; gap:3px; padding:3px 8px; border-radius:7px; font-size:10px; font-weight:600; text-decoration:none; background:rgba(10,102,194,0.15); border:1px solid rgba(10,102,194,0.35); color:#4bb1e0;')}>
                  <Linkedin size={11} /> LinkedIn <ExternalLink size={9} style={{ opacity: 0.5 }} />
                </a>
              )}
              {socialLinks.map((s, i) => (
                <a key={i} href={s.url} target='_blank' rel='noopener noreferrer' title={s.platform || 'Social profile'}
                  style={css('display:inline-flex; align-items:center; gap:3px; padding:3px 8px; border-radius:7px; font-size:10px; font-weight:600; text-decoration:none; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.12); color:rgba(255,255,255,0.7);')}>
                  <Globe size={11} /> {s.platform || 'Link'} <ExternalLink size={9} style={{ opacity: 0.5 }} />
                </a>
              ))}
            </div>
          )}

          {/* Articles */}
          {articles.length > 0 && (
            <div style={css('margin-bottom:7px;')}>
              <span style={css('display:block; font-size:8.5px; font-weight:700; letter-spacing:0.04em; text-transform:uppercase; color:rgba(255,255,255,0.4); margin-bottom:3px;')}>Articles & Mentions</span>
              {articles.map((a, i) => (
                <a key={i} href={a.url} target='_blank' rel='noopener noreferrer' title={a.note || ''}
                  style={css('display:block; font-size:10.5px; color:#93c5fd; text-decoration:none; margin-bottom:2px;')}>
                  {a.title || a.url} <ExternalLink size={8} style={{ display: 'inline', opacity: 0.5 }} />
                </a>
              ))}
            </div>
          )}

          {/* Wealth signals */}
          {wealthSignals.length > 0 && (
            <div style={css('margin-bottom:7px;')}>
              <span style={css('display:block; font-size:8.5px; font-weight:700; letter-spacing:0.04em; text-transform:uppercase; color:hsl(38 92% 62%); margin-bottom:3px;')}>Wealth Signals</span>
              <div style={css('display:flex; flex-wrap:wrap; gap:4px;')}>
                {wealthSignals.map((w, i) => (
                  <span key={i} style={css('display:inline-flex; padding:2px 7px; border-radius:6px; font-size:9.5px; font-weight:600; background:hsl(38 92% 50% / 0.12); border:1px solid hsl(38 92% 50% / 0.3); color:hsl(38 92% 62%);')}>{w}</span>
                ))}
              </div>
            </div>
          )}

          {/* Talking points */}
          {talkingPoints.length > 0 && (
            <div style={css('margin-bottom:7px; padding:7px 10px; border-radius:8px; background:rgba(52,211,153,0.06); border:1px solid rgba(52,211,153,0.2); border-left:2px solid rgba(52,211,153,0.5);')}>
              <span style={css('display:block; font-size:8.5px; font-weight:700; letter-spacing:0.04em; text-transform:uppercase; color:#34d399; margin-bottom:4px;')}>Talking Points</span>
              <div style={css('display:flex; flex-direction:column; gap:3px;')}>
                {talkingPoints.map((t, i) => (
                  <span key={i} style={css('font-size:11px; line-height:1.4; color:rgba(255,255,255,0.8);')}>• {t}</span>
                ))}
              </div>
            </div>
          )}

          {/* Sources */}
          {sources.length > 0 && (
            <div style={css('margin-bottom:7px;')}>
              <span style={css('display:block; font-size:8px; font-weight:600; letter-spacing:0.04em; text-transform:uppercase; color:rgba(255,255,255,0.35); margin-bottom:3px;')}>Sources</span>
              <div style={css('display:flex; flex-wrap:wrap; gap:3px;')}>
                {sources.slice(0, 8).map((s, i) => {
                  let label = s;
                  try { label = new URL(s).hostname.replace('www.', ''); } catch (_) { /* keep raw */ }
                  return (
                    <a key={i} href={s} target='_blank' rel='noopener noreferrer' title={s}
                      style={css('font-size:8.5px; color:rgba(255,255,255,0.4); text-decoration:none;')}>
                      [{i + 1}] {label}
                    </a>
                  );
                })}
              </div>
            </div>
          )}

          {/* Investigated at */}
          {investigatedAt && (
            <div style={css('font-size:8.5px; color:rgba(255,255,255,0.3); margin-bottom:7px;')}>Investigated {relativeTime(investigatedAt)}</div>
          )}

          {/* Actions */}
          <div style={css('display:flex; align-items:center; gap:5px; flex-wrap:wrap; padding-top:6px; border-top:1px solid rgba(255,255,255,0.06);')}>
            {matchStatus !== 'confirmed' && matchStatus !== 'wrong_person' && (
              <>
                <button
                  onClick={onConfirmMatch}
                  title='Confirm this is the right person'
                  style={css('display:inline-flex; align-items:center; gap:3px; padding:3px 9px; border-radius:7px; font-size:9.5px; font-weight:600; cursor:pointer; font-family:Inter,sans-serif; background:rgba(16,185,129,0.1); border:1px solid rgba(16,185,129,0.3); color:#34d399;')}
                >
                  <Check size={11} /> Confirm match
                </button>
                <button
                  onClick={() => { onWrongPerson(); setShowHintInput(true); }}
                  title='This is the wrong person — provide a hint and re-investigate'
                  style={css('display:inline-flex; align-items:center; gap:3px; padding:3px 9px; border-radius:7px; font-size:9.5px; font-weight:600; cursor:pointer; font-family:Inter,sans-serif; background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.3); color:#f87171;')}
                >
                  <X size={11} /> Wrong person
                </button>
              </>
            )}
            {matchStatus === 'confirmed' && (
              <span style={css('font-size:9.5px; font-weight:600; color:#34d399; display:inline-flex; align-items:center; gap:3px;')}>
                <Check size={11} /> Match confirmed
              </span>
            )}
            {/* Re-run — always available after completion */}
            <button
              onClick={() => onInvestigate(landlordId)}
              disabled={busy}
              title='Re-run investigation'
              style={css('display:inline-flex; align-items:center; gap:3px; padding:3px 9px; border-radius:7px; font-size:9.5px; font-weight:600; cursor:pointer; font-family:Inter,sans-serif; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.12); color:rgba(255,255,255,0.6); margin-left:auto;')}
            >
              <RotateCw size={11} /> Re-run
            </button>
          </div>

          {/* Hint input — revealed after "Wrong person" */}
          {showHintInput && (
            <div style={css('margin-top:7px; display:flex; flex-direction:column; gap:5px;')}>
              <span style={css('font-size:9.5px; color:rgba(255,255,255,0.5);')}>Add a hint (company name, profession, or context) to improve the next search:</span>
              <input
                type='text'
                value={hintText}
                onChange={(e) => setHintText(e.target.value)}
                placeholder='e.g. CEO of Al Futtaim, or architect based in Abu Dhabi'
                style={css('width:100%; padding:5px 8px; border-radius:7px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.15); color:rgba(255,255,255,0.9); font-size:10.5px; font-family:Inter,sans-serif; outline:none;')}
              />
              <button
                onClick={() => { onReinvestigate(hintText.trim()); setShowHintInput(false); }}
                disabled={busy || !hintText.trim()}
                title='Re-investigate with this hint'
                style={css('display:inline-flex; align-items:center; gap:3px; padding:4px 11px; border-radius:7px; font-size:10px; font-weight:700; cursor:pointer; font-family:Inter,sans-serif; background:rgba(59,130,246,0.15); border:1px solid rgba(59,130,246,0.4); color:#93c5fd; align-self:flex-start; opacity:' + (busy || !hintText.trim() ? '0.5' : '1') + ';')}
              >
                <Search size={11} /> Re-investigate
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}