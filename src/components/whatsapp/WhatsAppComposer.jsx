import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Sparkles, Mic, FileText, Home, MapPin, Clock, Languages, Paperclip, Wand2, Lock, RefreshCw } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { base44 } from "@/api/base44Client";
import ReplyAssistantPanel from "@/components/whatsapp/ReplyAssistantPanel";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

export default function WhatsAppComposer({ conversation, suggestions, onSend, onSendProperty, onScheduleSend, lead, landlord }) {
  const [text, setText] = useState("");
  const [showAssistant, setShowAssistant] = useState(false);
  const [isSendingTemplate, setIsSendingTemplate] = useState(false);

  // Check 24-hour window
  const lastInbound = conversation?.last_inbound_at;
  const isWithin24h = lastInbound
    ? (Date.now() - new Date(lastInbound).getTime()) < 24 * 60 * 60 * 1000
    : false;
  const windowLocked = !isWithin24h;

  // Fetch approved templates live from Meta
  const { data: metaData, refetch: refetchTemplates, isFetching: isSyncingTemplates, error: templateError } = useQuery({
    queryKey: ['meta_templates_live'],
    queryFn: async () => {
      const res = await base44.functions.invoke('getMetaTemplates', {});
      return res.data;
    },
    enabled: windowLocked,
    staleTime: 5 * 60 * 1000, // cache for 5 min
  });

  const displayTemplates = metaData?.templates || [];

  const handleSyncTemplates = () => refetchTemplates();

  const handleSendTemplate = async (template) => {
    if (!conversation?.id) return;
    setIsSendingTemplate(true);
    try {
      await base44.functions.invoke('sendWhatsAppMessage', {
        conversation_id: conversation.id,
        template_name: template.name,
        template_language: template.language || 'en_US',
      });
      toast.success(`Template "${template.name}" sent!`);
    } catch (e) {
      toast.error('Failed to send template.');
    } finally {
      setIsSendingTemplate(false);
    }
  };

  const handleSend = () => {
    if (!text.trim()) return;
    onSend(text.trim());
    setText("");
  };

  // ── 24-hour window locked ──────────────────────────────────────────────────
  if (windowLocked) {
    return (
      <div className="border-t" style={{ background: 'rgba(0,0,0,0.4)' }}>
        <div className="px-4 py-3 flex items-center gap-2" style={{ background: 'rgba(245,159,10,0.08)', borderBottom: '1px solid rgba(245,159,10,0.2)' }}>
          <Lock className="w-4 h-4 shrink-0" style={{ color: 'hsl(38 92% 50%)' }} />
          <p className="text-xs flex-1" style={{ color: 'rgba(255,255,255,0.7)' }}>
            24-hour messaging window is closed. Send a template to re-open the conversation.
          </p>
          <button
            onClick={handleSyncTemplates}
            disabled={isSyncingTemplates}
            className="shrink-0 text-xs px-2 py-1 rounded-lg"
            style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.6)' }}
          >
            <RefreshCw className={`w-3 h-3 inline mr-1 ${isSyncingTemplates ? 'animate-spin' : ''}`} />
            Sync
          </button>
        </div>

        <div className="p-3 max-h-52 overflow-y-auto space-y-1.5">
          {isSyncingTemplates ? (
            <div className="text-center py-6 text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>Loading templates from Meta…</div>
          ) : templateError || displayTemplates.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-xs mb-2" style={{ color: 'rgba(255,255,255,0.35)' }}>
                {templateError ? 'Failed to load templates.' : 'No approved templates found on Meta.'}
              </p>
              <Button size="sm" variant="outline" className="text-xs gap-1" onClick={handleSyncTemplates}>
                <RefreshCw className="w-3 h-3" /> Retry
              </Button>
            </div>
          ) : (
            displayTemplates.map(t => (
              <button
                key={t.name + t.language}
                onClick={() => handleSendTemplate(t)}
                disabled={isSendingTemplate}
                className="w-full text-left px-3 py-2 rounded-xl transition-all"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold truncate" style={{ color: 'rgba(255,255,255,0.9)' }}>{t.name}</p>
                  <span className="text-[10px] shrink-0 px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)' }}>{t.language}</span>
                </div>
                {t.body && <p className="text-[11px] mt-0.5 line-clamp-2" style={{ color: 'rgba(255,255,255,0.45)' }}>{t.body}</p>}
              </button>
            ))
          )}
        </div>
      </div>
    );
  }

  // ── Normal composer (within 24h window) ───────────────────────────────────
  return (
    <div className="border-t" style={{ background: 'rgba(255,255,255,0.04)' }}>
      {/* AI suggestions */}
      {suggestions?.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto px-3 pt-2 pb-1">
          {suggestions.slice(0, 3).map((s, i) => (
            <button
              key={i}
              onClick={() => setText(s.text)}
              className="shrink-0 max-w-[200px] text-left px-2.5 py-1.5 rounded-full text-xs transition"
              style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.8)' }}
            >
              <span style={{ color: 'hsl(38 92% 50%)' }}>{s.tone}</span> · {s.text.slice(0, 40)}{s.text.length > 40 ? '…' : ''}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2 px-3 py-2">
        <button type="button" className="mb-2 shrink-0" style={{ color: 'rgba(255,255,255,0.4)' }}>
          <Paperclip className="w-5 h-5" />
        </button>
        <div className="flex-1 rounded-2xl px-4 py-2" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}>
          <Textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Type a message…"
            rows={1}
            className="border-0 bg-transparent resize-none p-0 shadow-none focus-visible:ring-0 min-h-0 text-sm w-full"
            style={{ color: 'rgba(255,255,255,0.9)' }}
            dir={["ar", "ur", "fa"].includes(conversation?.detected_language) ? "rtl" : "ltr"}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          />
        </div>
        <div className="flex flex-col gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handleSend}
            disabled={!text.trim()}
            className="w-10 h-10 rounded-full flex items-center justify-center transition disabled:opacity-40"
            style={{ background: 'hsl(38 92% 50%)' }}
          >
            <Send className="w-4 h-4" style={{ color: 'hsl(222 47% 11%)' }} />
          </button>
          <Popover>
            <PopoverTrigger asChild>
              <button type="button" className="w-10 h-10 rounded-full flex items-center justify-center transition"
                style={{ border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.5)' }}>
                <Clock className="w-4 h-4" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-48">
              <p className="text-xs font-medium mb-2">Schedule send</p>
              {[15, 60, 240, 1440].map(min => (
                <button key={min} type="button" onClick={() => { onScheduleSend(text, min); setText(''); }}
                  className="w-full text-left px-2 py-1 hover:bg-muted text-xs rounded">
                  In {min < 60 ? `${min} min` : min < 1440 ? `${min/60}h` : '1 day'}
                </button>
              ))}
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* AI Reply Assistant */}
      {showAssistant && (
        <ReplyAssistantPanel
          conversation={conversation}
          lead={lead}
          landlord={landlord}
          onInsertMessage={(draft) => { setText(draft); setShowAssistant(false); }}
        />
      )}

      {/* Toolbar */}
      <div className="flex gap-0.5 px-3 pb-2 pt-1">
        <ToolButton icon={Wand2} label="AI Reply" onClick={() => setShowAssistant(!showAssistant)} />
        <ToolButton icon={Home} label="Property" onClick={onSendProperty} />
        <ToolButton icon={Languages} label="Translate" onClick={() => previewTranslate(text, setText)} />
      </div>
    </div>
  );
}

function ToolButton({ icon: Icon, label, onClick }) {
  return (
    <button type="button" onClick={onClick}
      className="flex items-center gap-1 px-2 py-1.5 rounded-lg transition"
      style={{ color: 'rgba(255,255,255,0.45)' }}
      onMouseEnter={e => e.currentTarget.style.color = 'rgba(255,255,255,0.8)'}
      onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.45)'}
    >
      <Icon className="w-3.5 h-3.5" /> <span className="text-[11px]">{label}</span>
    </button>
  );
}

async function previewTranslate(text, setter) {
  if (!text.trim()) return;
  try {
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `Translate to Arabic (Modern Standard, suitable for Dubai business WhatsApp). Just the translation, no quotes:\n\n${text}`
    });
    setter(result.trim());
  } catch (err) {
    console.error("Translation failed:", err);
  }
}