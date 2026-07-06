// EmailTemplatePicker — a compact native <select> of the agent's visible email
// templates. Choosing one loads it into the composer. A "+" button creates a new
// template via the dialog. (Full edit/delete lives on the Email Templates page.)

import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Plus, Loader2 } from 'lucide-react';
import EmailTemplateDialog from './EmailTemplateDialog';

export default function EmailTemplatePicker({ onSelect, channel = 'email' }) {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['messageTemplates', channel],
    queryFn: async () => {
      const list = await base44.entities.MessageTemplate.filter({ channel, is_active: true }, '-updated_date', 200);
      return list || [];
    },
  });

  const handleChange = (e) => {
    const id = e.target.value;
    const t = templates.find((x) => x.id === id);
    e.target.value = ''; // reset so the same template can be re-picked
    if (!t) return;
    onSelect?.({ subject: t.subject || '', body: t.body || '', template: t });
    base44.entities.MessageTemplate.update(t.id, { usage_count: (t.usage_count || 0) + 1, last_used_at: new Date().toISOString() }).catch(() => {});
    qc.invalidateQueries({ queryKey: ['emailTemplates'] });
  };

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <select
          onChange={handleChange}
          value=""
          title="Choose a template"
          style={{
            height: 32, maxWidth: 190, padding: '0 8px', borderRadius: 8, cursor: 'pointer',
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
        <button onClick={() => { setEditing(null); setDialogOpen(true); }} title="New template"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: 7, cursor: 'pointer', background: 'hsl(38 92% 50% / 0.18)', border: '1px solid hsl(38 92% 50% / 0.4)', color: 'hsl(38 92% 64%)' }}>
          <Plus size={14} />
        </button>
      </div>

      <EmailTemplateDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        template={editing}
        channel={channel}
        onSaved={() => { qc.invalidateQueries({ queryKey: ['messageTemplates', channel] }); qc.invalidateQueries({ queryKey: ['emailTemplates'] }); }}
      />
    </>
  );
}