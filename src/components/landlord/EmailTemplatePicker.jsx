// EmailTemplatePicker — a compact native <select> of the agent's visible
// email/iMessage/WhatsApp templates. Choosing one loads it into the composer
// with all {{merge_fields}} replaced from the current landlord + agent context.
//
// Props:
//   onSelect   (fn)      — called with { subject, body, template } (vars already replaced)
//   channel    (string)  — 'email' | 'imessage' | 'whatsapp' | 'telegram' | 'sms'
//   landlordId (string)  — current landlord id (used to build merge-field context)
//   compact    (bool)    — smaller dropdown width

import React, { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { buildTemplateContext, replaceTemplateVars } from '@/lib/templateVars';
import { filterVisibleTemplates } from '@/lib/templateVisibility';
import { useCurrentUser } from '@/lib/useCurrentUser';

export default function EmailTemplatePicker({ onSelect, channel = 'email', landlordId, compact, preferredLanguage }) {
  const qc = useQueryClient();
  const { user, isAdmin } = useCurrentUser();
  const [ctx, setCtx] = useState({});

  // Build the merge-field context once per landlord (landlord + current user).
  useEffect(() => {
    let mounted = true;
    const run = async () => {
      try {
        const [me, landlord] = await Promise.all([
          base44.auth.me().catch(() => null),
          landlordId ? base44.entities.Landlord.get(landlordId).catch(() => null) : Promise.resolve(null),
        ]);
        if (mounted) setCtx(buildTemplateContext(landlord, me));
      } catch {
        if (mounted) setCtx({});
      }
    };
    run();
    return () => { mounted = false; };
  }, [landlordId]);

  const { data: rawTemplates = [], isLoading } = useQuery({
    queryKey: ['messageTemplates', channel],
    queryFn: async () => {
      const list = await base44.entities.MessageTemplate.filter({ channel, is_active: true }, '-updated_date', 200);
      return list || [];
    },
  });

  // Apply explicit visibility logic so creators see their own private templates,
  // shared templates show to everyone, and specific_agents templates show to listed agents.
  const visible = filterVisibleTemplates(rawTemplates, user?.email, isAdmin);

  // Prefer templates matching the landlord's preferred language; fall back to 'en'.
  const lang = preferredLanguage || 'en';
  const langMatches = visible.filter(t => (t.language || 'en') === lang);
  const templates = langMatches.length ? langMatches : visible.filter(t => (t.language || 'en') === 'en');

  const handleChange = (e) => {
    const id = e.target.value;
    const t = templates.find((x) => x.id === id);
    e.target.value = ''; // reset so the same template can be re-picked
    if (!t) return;
    const subject = replaceTemplateVars(t.subject || '', ctx);
    const body = replaceTemplateVars(t.body || '', ctx);
    onSelect?.({ subject, body, template: t });
    base44.entities.MessageTemplate.update(t.id, { usage_count: (t.usage_count || 0) + 1, last_used_at: new Date().toISOString() }).catch(() => {});
    qc.invalidateQueries({ queryKey: ['emailTemplates'] });
    qc.invalidateQueries({ queryKey: ['messageTemplates'] });
  };

  return (
    <select
      onChange={handleChange}
      value=""
      title="Choose a template"
      style={{
        height: 32, maxWidth: compact ? 150 : 190, padding: '0 8px', borderRadius: 8, cursor: 'pointer',
        fontSize: 11, fontWeight: 600, fontFamily: "'Inter',sans-serif",
        background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.75)',
        border: '1px solid rgba(255,255,255,0.12)', outline: 'none',
      }}
    >
      <option value="" disabled style={{ background: '#1a2235', color: 'rgba(255,255,255,0.5)' }}>
        {isLoading ? 'Loading…' : 'Templates…'}
      </option>
      {templates.map((t) => (
        <option key={t.id} value={t.id} style={{ background: '#1a2235', color: '#fff' }}>{t.title}</option>
      ))}
    </select>
  );
}