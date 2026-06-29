import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Loader2, Send, X, Search } from 'lucide-react';

function extractVars(body) {
  if (!body) return [];
  return [...new Set([...body.matchAll(/\{\{([^}]+)\}\}/g)].map(m => m[1]))];
}

function TemplateRow({ t, landlordId, phone, onDone }) {
  const [expanded, setExpanded] = useState(false);
  const [sending, setSending] = useState(false);
  const [values, setValues] = useState({});
  const vars = extractVars(t.body);

  const send = async () => {
    setSending(true);
    try {
      // Meta supports both positional ({1}) and named ({{customer_name}}) params.
      // Named params require param_name key; positional just need text.
      const isNamed = vars.length > 0 && isNaN(Number(vars[0]));
      const template_components = vars.length > 0 ? [{
        type: 'body',
        parameters: vars.map(v => isNamed
          ? { type: 'text', parameter_name: v, text: values[v] || v }
          : { type: 'text', text: values[v] || v }
        )
      }] : [];
      const resolvedBody = vars.reduce((b, v) => b.replace(new RegExp(`\\{\\{${v}\\}\\}`, 'g'), values[v] || v), t.body || '');

      // Normalize phone to E.164
      const normalizedPhone = phone.replace(/[\s\-()]/g, '');
      const toPhone = normalizedPhone.startsWith('+') ? normalizedPhone : '+' + normalizedPhone;

      // Always send via to_phone — sendWhatsAppMessage uses Meta Business API (never personal channel)
      const res = await base44.functions.invoke('sendWhatsAppMessage', {
        to_phone: toPhone,
        landlord_id: landlordId,
        template_name: t.name,
        template_language: t.language || 'en',
        template_components,
        template_body: resolvedBody,
      });
      if (res?.data?.error) throw new Error(res.data.error);
      toast.success(`Template "${t.name}" sent`);
      onDone();
    } catch (e) {
      toast.error(e.message || 'Failed to send template');
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '10px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
        <button onClick={() => setExpanded(x => !x)} style={{ textAlign: 'left', flex: 1, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.9)', fontFamily: 'Inter,sans-serif' }}>{t.name}</span>
          {t.body && (
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 3, lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: expanded ? 'unset' : 2, WebkitBoxOrient: 'vertical', overflow: expanded ? 'visible' : 'hidden' }}>
              {t.body}
            </p>
          )}
        </button>
        <span style={{ fontSize: 10, fontWeight: 600, color: '#60a5fa', flexShrink: 0 }}>{t.category}</span>
      </div>
      {vars.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 7 }}>
          {vars.map(v => (
            <div key={v} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 10, fontWeight: 600, color: 'hsl(38 92% 55%)', flexShrink: 0, width: 90, overflow: 'hidden', textOverflow: 'ellipsis' }}>{`{{${v}}}`}</span>
              <input
                value={values[v] || ''}
                onChange={e => setValues(p => ({ ...p, [v]: e.target.value }))}
                placeholder={`Enter ${v}…`}
                style={{ flex: 1, padding: '3px 7px', borderRadius: 6, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.9)', fontSize: 11, fontFamily: 'Inter,sans-serif' }}
              />
            </div>
          ))}
        </div>
      )}
      <button
        onClick={send}
        disabled={sending}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 7, background: 'hsl(38 92% 50%)', color: 'hsl(222 47% 11%)', fontSize: 11, fontWeight: 700, cursor: 'pointer', border: 'none', fontFamily: 'Inter,sans-serif', opacity: sending ? 0.6 : 1 }}
      >
        {sending ? <><span style={{ display: 'inline-block', width: 11, height: 11, border: '2px solid rgba(0,0,0,0.3)', borderTopColor: '#000', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />Sending…</> : <><Send size={11} /> Send</>}
      </button>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

export default function ChatTemplatePanel({ landlordId, phone, onClose }) {
  const [search, setSearch] = useState('');

  const { data: metaData, isLoading } = useQuery({
    queryKey: ['meta_templates_live'],
    queryFn: async () => {
      const res = await base44.functions.invoke('getMetaTemplates', {});
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
  });
  const templates = (metaData?.templates || []).filter(t =>
    !search || t.name.toLowerCase().includes(search.toLowerCase()) || (t.body || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ borderRadius: 10, border: '1px solid rgba(245,158,11,0.3)', background: 'rgba(245,158,11,0.05)', marginBottom: 8, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'hsl(38 92% 60%)', letterSpacing: '0.04em', textTransform: 'uppercase', fontFamily: 'Inter,sans-serif' }}>Business Templates</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.45)', display: 'flex', alignItems: 'center' }}><X size={13} /></button>
      </div>
      <div style={{ padding: '6px 10px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ position: 'relative' }}>
          <Search size={12} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search templates…"
            style={{ width: '100%', paddingLeft: 26, paddingRight: 8, paddingTop: 4, paddingBottom: 4, borderRadius: 6, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.9)', fontSize: 11, fontFamily: 'Inter,sans-serif', boxSizing: 'border-box' }}
          />
        </div>
      </div>
      <div style={{ maxHeight: 220, overflowY: 'auto' }}>
        {isLoading ? (
          <div style={{ padding: '16px', textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <Loader2 size={13} style={{ animation: 'spin 0.7s linear infinite' }} /> Loading…
          </div>
        ) : templates.length === 0 ? (
          <div style={{ padding: '14px', textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>No templates found</div>
        ) : templates.map(t => (
          <TemplateRow key={t.name + t.language} t={t} landlordId={landlordId} phone={phone} onDone={onClose} />
        ))}
      </div>
    </div>
  );
}