import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Send, Home, Clock, Languages, Paperclip, Wand2, Lock, Zap } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { base44 } from "@/api/base44Client";
import ReplyAssistantPanel from "@/components/whatsapp/ReplyAssistantPanel";
import TemplatesModal from "@/components/whatsapp/TemplatesModal";
import ChannelSwitcher from "@/components/whatsapp/ChannelSwitcher";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

export default function WhatsAppComposer({ conversation, suggestions, onSend, onSendProperty, onScheduleSend, lead, landlord, selectedChannel, onChannelChange }) {
  const [text, setText] = useState("");
  const [showAssistant, setShowAssistant] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [isSendingTemplate, setIsSendingTemplate] = useState(false);

  // Check 24-hour window — only locked if there WAS an inbound message but it's >24h ago
  // If no inbound ever, window is open (new outbound conversations use templates separately)
  const lastInbound = conversation?.last_inbound_at;
  const windowLocked = lastInbound
    ? (Date.now() - new Date(lastInbound).getTime()) >= 24 * 60 * 60 * 1000
    : false;

  // Always fetch templates
  const { data: metaData } = useQuery({
    queryKey: ['meta_templates_live'],
    queryFn: async () => {
      const res = await base44.functions.invoke('getMetaTemplates', {});
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const displayTemplates = metaData?.templates || [];

  const handleSendTemplate = async (template, template_components, resolvedBody) => {
    if (!conversation?.id) return;
    setIsSendingTemplate(true);
    try {
      const res = await base44.functions.invoke('sendWhatsAppMessage', {
        conversation_id: conversation.id,
        template_name: template.name,
        template_language: template.language || 'en',
        template_components: template_components || [],
        template_body: resolvedBody || template.body || '',
      });
      if (res.data?.error) throw new Error(res.data.error);
      toast.success(`Template "${template.name}" sent!`);
    } catch (e) {
      toast.error(e.message || 'Failed to send template.');
    } finally {
      setIsSendingTemplate(false);
    }
  };

  const handleSend = () => {
    if (!text.trim() || windowLocked) return;
    onSend(text.trim());
    setText("");
  };

  return (
    <div className="border-t" style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.08)' }}>

      {/* 24h window warning banner */}
      {windowLocked && (
        <div className="px-3 py-2 flex items-center gap-2" style={{ background: 'rgba(245,159,10,0.08)', borderBottom: '1px solid rgba(245,159,10,0.15)' }}>
          <Lock className="w-3.5 h-3.5 shrink-0" style={{ color: 'hsl(38 92% 50%)' }} />
          <p className="text-xs flex-1" style={{ color: 'rgba(255,255,255,0.6)' }}>
            24-hour window closed — use a <button onClick={() => setShowTemplates(true)} className="underline font-medium" style={{ color: 'hsl(38 92% 55%)' }}>template</button> to re-open
          </p>
        </div>
      )}

      {/* AI suggestions strip */}
      {!windowLocked && suggestions?.length > 0 && (
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

      {/* Channel switcher */}
      <div className="px-3 pt-2 pb-1">
        <ChannelSwitcher
          selectedChannel={selectedChannel || 'business'}
          onChannelChange={onChannelChange}
        />
      </div>

      {/* Composer row */}
      <div className="flex items-end gap-2 px-3 py-2">
        <button type="button" className="mb-2 shrink-0" style={{ color: 'rgba(255,255,255,0.35)' }}>
          <Paperclip className="w-5 h-5" />
        </button>

        <div className="flex-1 rounded-2xl px-4 py-2" style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <Textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder={windowLocked ? "Window closed — use a template to message…" : "Type a message…"}
            rows={1}
            className="border-0 bg-transparent resize-none p-0 shadow-none focus-visible:ring-0 min-h-0 text-sm w-full"
            style={{ color: windowLocked ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.9)' }}
            dir={["ar", "ur", "fa"].includes(conversation?.detected_language) ? "rtl" : "ltr"}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          />
        </div>

        {/* Send button */}
        <button
          type="button"
          onClick={handleSend}
          disabled={!text.trim() || windowLocked}
          title={windowLocked ? "24-hour window closed" : "Send"}
          className="mb-0.5 w-10 h-10 rounded-full flex items-center justify-center transition disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
          style={{ background: (!text.trim() || windowLocked) ? 'rgba(255,255,255,0.1)' : 'hsl(38 92% 50%)' }}
        >
          {windowLocked
            ? <Lock className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.4)' }} />
            : <Send className="w-4 h-4" style={{ color: 'hsl(222 47% 11%)' }} />
          }
        </button>
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
      <div className="flex items-center gap-0.5 px-3 pb-2 pt-0">
        {/* Templates button — lightning bolt, always visible */}
        <button
          type="button"
          onClick={() => setShowTemplates(true)}
          title="WhatsApp Templates"
          className="flex items-center gap-1 px-2 py-1.5 rounded-lg transition"
          style={{
            color: windowLocked ? 'hsl(38 92% 55%)' : 'rgba(255,255,255,0.5)',
            background: windowLocked ? 'rgba(245,159,10,0.1)' : 'transparent',
            border: windowLocked ? '1px solid rgba(245,159,10,0.25)' : '1px solid transparent',
          }}
          onMouseEnter={e => { if (!windowLocked) e.currentTarget.style.color = 'rgba(255,255,255,0.9)'; }}
          onMouseLeave={e => { if (!windowLocked) e.currentTarget.style.color = 'rgba(255,255,255,0.5)'; }}
        >
          <Zap className="w-3.5 h-3.5" />
          <span className="text-[11px]">
            Templates{displayTemplates.length > 0 ? ` (${displayTemplates.length})` : ''}
          </span>
        </button>

        {!windowLocked && (
          <>
            <ToolButton icon={Wand2} label="AI Reply" onClick={() => setShowAssistant(!showAssistant)} />
            <ToolButton icon={Home} label="Property" onClick={onSendProperty} />
            <ToolButton icon={Languages} label="Translate" onClick={() => previewTranslate(text, setText)} />
            <div className="ml-auto">
              <Popover>
                <PopoverTrigger asChild>
                  <button type="button" className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs transition"
                    style={{ color: 'rgba(255,255,255,0.45)' }}
                    onMouseEnter={e => e.currentTarget.style.color = 'rgba(255,255,255,0.8)'}
                    onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.45)'}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span className="text-[11px]">Schedule</span>
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-48">
                  <p className="text-xs font-medium mb-2">Schedule send</p>
                  {[15, 60, 240, 1440].map(min => (
                    <button key={min} type="button" onClick={() => { onScheduleSend(text, min); setText(''); }}
                      className="w-full text-left px-2 py-1 hover:bg-muted text-xs rounded">
                      In {min < 60 ? `${min} min` : min < 1440 ? `${min / 60}h` : '1 day'}
                    </button>
                  ))}
                </PopoverContent>
              </Popover>
            </div>
          </>
        )}
      </div>

      {/* Templates Modal */}
      <TemplatesModal
        open={showTemplates}
        onClose={() => setShowTemplates(false)}
        templates={displayTemplates}
        onSelect={async (t, comps, resolvedBody) => { await handleSendTemplate(t, comps, resolvedBody); }}
        isSending={isSendingTemplate}
      />
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