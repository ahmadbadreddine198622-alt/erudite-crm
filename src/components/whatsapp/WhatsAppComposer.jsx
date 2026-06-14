import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Send, Home, Clock, Languages, Paperclip, Wand2, Lock, Zap, FileText, UserCheck, Building2, User } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { base44 } from "@/api/base44Client";
import ReplyAssistantPanel from "@/components/whatsapp/ReplyAssistantPanel";
import TemplatesModal from "@/components/whatsapp/TemplatesModal";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

export default function WhatsAppComposer({ conversation, suggestions, onSend, onSendProperty, onScheduleSend, lead, landlord, selectedChannel, onChannelChange }) {
  const [text, setText] = useState("");
  const [showAssistant, setShowAssistant] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [isSendingTemplate, setIsSendingTemplate] = useState(false);
  const [showNameToken, setShowNameToken] = useState(false);
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [showChannelPicker, setShowChannelPicker] = useState(false);

  // Determine if this is a new conversation (no messages sent yet from either channel)
  const isNewConversation = !conversation?.last_outbound_at && !conversation?.last_message_at;

  const contactName = landlord?.full_name_en || lead?.full_name || conversation?.wa_display_name;

  const lastInbound = conversation?.last_inbound_at;
  const windowLocked = lastInbound
    ? (Date.now() - new Date(lastInbound).getTime()) >= 24 * 60 * 60 * 1000
    : false;

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

  const insertNameToken = () => {
    const token = contactName ? `{{${contactName}}}` : '{{contact_name}}';
    setText(prev => prev + ' ' + token);
    setShowNameToken(false);
  };

  const handleSend = () => {
    if (!text.trim() || windowLocked) return;
    if (isInternalNote) {
      toast.success('Internal note saved to timeline');
      setText("");
      setIsInternalNote(false);
      return;
    }
    // If no channel is set yet (new conversation), show the channel picker first
    if (!selectedChannel) {
      setShowChannelPicker(true);
      return;
    }
    onSend(text.trim());
    setText("");
  };

  const handleChannelSelect = (channel) => {
    onChannelChange(channel);
    setShowChannelPicker(false);
    if (text.trim()) {
      onSend(text.trim());
      setText("");
    }
  };

  return (
    <div className="border-t relative flex-shrink-0" style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.08)' }}>

      {/* 24h window warning */}
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

      {/* Internal note banner */}
      {isInternalNote && (
        <div className="px-3 py-1.5 flex items-center gap-2" style={{ background: 'rgba(255,191,0,0.08)', borderBottom: '1px solid rgba(255,191,0,0.2)' }}>
          <Lock className="w-3.5 h-3.5" style={{ color: 'hsl(38 92% 50%)' }} />
          <p className="text-xs font-medium flex-1" style={{ color: 'rgba(255,255,255,0.8)' }}>Internal note — NOT sent to WhatsApp</p>
          <button onClick={() => setIsInternalNote(false)} className="text-xs underline" style={{ color: 'hsl(38 92% 50%)' }}>Exit</button>
        </div>
      )}

      {/* Channel picker modal — shown on first send */}
      {showChannelPicker && (
        <div className="absolute inset-0 z-50 flex items-end justify-center pb-4 px-4" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
          <div className="w-full max-w-sm rounded-2xl p-5 space-y-4" style={{ background: 'hsl(222 47% 11%)', border: '1px solid rgba(255,255,255,0.15)' }}>
            <p className="text-sm font-semibold text-white text-center">Send from which number?</p>
            <p className="text-xs text-center" style={{ color: 'rgba(255,255,255,0.5)' }}>This chat will be pinned to the chosen number</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleChannelSelect('business')}
                className="flex flex-col items-center gap-2 p-4 rounded-xl border transition hover:scale-105"
                style={{ background: 'hsl(152 69% 40% / 0.1)', borderColor: 'hsl(152 69% 40% / 0.4)' }}
              >
                <Building2 className="w-6 h-6" style={{ color: 'hsl(152 69% 55%)' }} />
                <span className="text-xs font-semibold" style={{ color: 'hsl(152 69% 55%)' }}>Business</span>
                <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>+971582806000</span>
              </button>
              <button
                onClick={() => handleChannelSelect('personal')}
                className="flex flex-col items-center gap-2 p-4 rounded-xl border transition hover:scale-105"
                style={{ background: 'hsl(217 91% 60% / 0.1)', borderColor: 'hsl(217 91% 60% / 0.4)' }}
              >
                <User className="w-6 h-6" style={{ color: 'hsl(217 91% 70%)' }} />
                <span className="text-xs font-semibold" style={{ color: 'hsl(217 91% 70%)' }}>Personal</span>
                <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>+971581806000</span>
              </button>
            </div>
            <button onClick={() => setShowChannelPicker(false)} className="w-full text-xs text-center" style={{ color: 'rgba(255,255,255,0.35)' }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Action icons row — no channel switcher */}
      <div className="flex items-center gap-1 px-3 pt-1.5 pb-0.5 flex-wrap">
        {/* Small channel indicator (read-only, shows which number is active) */}
        {selectedChannel && (
          <div className="flex items-center gap-1 px-2 py-1 rounded-lg mr-1 text-[10px] font-semibold"
            style={{
              background: selectedChannel === 'business' ? 'hsl(152 69% 40% / 0.12)' : 'hsl(217 91% 60% / 0.12)',
              border: selectedChannel === 'business' ? '1px solid hsl(152 69% 40% / 0.3)' : '1px solid hsl(217 91% 60% / 0.3)',
              color: selectedChannel === 'business' ? 'hsl(152 69% 55%)' : 'hsl(217 91% 70%)',
            }}
          >
            {selectedChannel === 'business' ? <Building2 className="w-3 h-3 mr-0.5" /> : <User className="w-3 h-3 mr-0.5" />}
            {selectedChannel === 'business' ? 'Business' : 'Personal'}
          </div>
        )}

        <div className="flex items-center gap-0.5">
          {/* Templates — always visible */}
          <ActionIcon
            icon={Zap}
            title={`Templates${displayTemplates.length > 0 ? ` (${displayTemplates.length})` : ''}`}
            onClick={() => setShowTemplates(true)}
            gold={windowLocked}
          />

          {!windowLocked && (
            <>
              <ActionIcon icon={Wand2} title="AI Reply" onClick={() => setShowAssistant(!showAssistant)} active={showAssistant} />
              <ActionIcon icon={Home} title="Property" onClick={onSendProperty} />
              <ActionIcon icon={Languages} title="Translate" onClick={() => previewTranslate(text, setText)} />

              {/* Insert Name */}
              <Popover open={showNameToken} onOpenChange={setShowNameToken}>
                <PopoverTrigger asChild>
                  <button type="button" title="Insert Name"
                    className="p-1.5 rounded-lg transition hover:bg-white/10"
                    style={{ color: 'rgba(255,255,255,0.45)' }}
                    onMouseEnter={e => e.currentTarget.style.color = 'rgba(255,255,255,0.85)'}
                    onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.45)'}
                  >
                    <UserCheck className="w-4 h-4" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-56" style={{ background: 'hsl(222 47% 11%)', borderColor: 'rgba(255,255,255,0.15)' }}>
                  <p className="text-xs font-medium mb-2" style={{ color: 'rgba(255,255,255,0.9)' }}>Insert contact name</p>
                  <button type="button" onClick={insertNameToken}
                    className="w-full text-left px-2 py-1.5 rounded text-xs hover:bg-white/10 transition"
                    style={{ color: 'rgba(255,255,255,0.8)' }}
                  >
                    {contactName ? `{{${contactName}}}` : '{{contact_name}}'}
                  </button>
                </PopoverContent>
              </Popover>

              {/* Internal Note */}
              <button type="button" title="Internal Note"
                onClick={() => setIsInternalNote(!isInternalNote)}
                className="p-1.5 rounded-lg transition hover:bg-white/10"
                style={{ color: isInternalNote ? 'hsl(38 92% 50%)' : 'rgba(255,255,255,0.45)' }}
              >
                <FileText className="w-4 h-4" />
              </button>

              {/* Schedule */}
              <Popover>
                <PopoverTrigger asChild>
                  <button type="button" title="Schedule"
                    className="p-1.5 rounded-lg transition hover:bg-white/10"
                    style={{ color: 'rgba(255,255,255,0.45)' }}
                    onMouseEnter={e => e.currentTarget.style.color = 'rgba(255,255,255,0.85)'}
                    onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.45)'}
                  >
                    <Clock className="w-4 h-4" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-48" style={{ background: 'hsl(222 47% 11%)', borderColor: 'rgba(255,255,255,0.15)' }}>
                  <p className="text-xs font-medium mb-2" style={{ color: 'rgba(255,255,255,0.9)' }}>Schedule send</p>
                  {[15, 60, 240, 1440].map(min => (
                    <button key={min} type="button" onClick={() => { onScheduleSend(text, min); setText(''); }}
                      className="w-full text-left px-2 py-1 hover:bg-white/10 text-xs rounded transition"
                      style={{ color: 'rgba(255,255,255,0.8)' }}
                    >
                      In {min < 60 ? `${min} min` : min < 1440 ? `${min / 60}h` : '1 day'}
                    </button>
                  ))}
                </PopoverContent>
              </Popover>
            </>
          )}
        </div>
      </div>

      {/* Composer input row */}
      <div className="flex items-end gap-2 px-3 pb-2">
        <button type="button" className="mb-1.5 shrink-0" style={{ color: 'rgba(255,255,255,0.35)' }}>
          <Paperclip className="w-4 h-4" />
        </button>

        <div className={`flex-1 rounded-2xl px-3 py-1.5 border transition-colors ${
          isInternalNote ? 'bg-yellow-500/10 border-yellow-500/30' : 'bg-white/7 border-white/10'
        }`}>
          <Textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder={
              isInternalNote ? "Write an internal note (saved to timeline, not sent)…" :
              windowLocked ? "Window closed — use a template to message…" : "Type a message…"
            }
            rows={1}
            className="border-0 bg-transparent resize-none p-0 shadow-none focus-visible:ring-0 min-h-0 text-sm w-full"
            style={{ color: isInternalNote ? 'hsl(38 92% 50%)' : (windowLocked ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.9)') }}
            dir={["ar", "ur", "fa"].includes(conversation?.detected_language) ? "rtl" : "ltr"}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          />
        </div>

        <button
          type="button"
          onClick={handleSend}
          disabled={!text.trim() || windowLocked}
          title={isInternalNote ? "Save internal note" : (windowLocked ? "24-hour window closed" : "Send")}
          className={`mb-0.5 w-9 h-9 rounded-full flex items-center justify-center transition disabled:opacity-30 disabled:cursor-not-allowed shrink-0 ${isInternalNote ? 'animate-pulse' : ''}`}
          style={{ background: isInternalNote ? 'hsl(38 92% 50%)' : ((!text.trim() || windowLocked) ? 'rgba(255,255,255,0.1)' : 'hsl(38 92% 50%)') }}
        >
          {isInternalNote
            ? <FileText className="w-3.5 h-3.5" style={{ color: 'hsl(222 47% 11%)' }} />
            : windowLocked
            ? <Lock className="w-3.5 h-3.5" style={{ color: 'rgba(255,255,255,0.4)' }} />
            : <Send className="w-3.5 h-3.5" style={{ color: 'hsl(222 47% 11%)' }} />}
        </button>
      </div>

      {/* AI Reply Assistant panel */}
      {showAssistant && (
        <ReplyAssistantPanel
          conversation={conversation}
          lead={lead}
          landlord={landlord}
          onInsertMessage={(draft) => { setText(draft); setShowAssistant(false); }}
        />
      )}

      <TemplatesModal
        open={showTemplates}
        onClose={() => setShowTemplates(false)}
        templates={displayTemplates}
        onSelect={async (t, comps, resolvedBody) => { await handleSendTemplate(t, comps, resolvedBody); }}
        isSending={isSendingTemplate}
        channel={selectedChannel || conversation?.channel}
      />
    </div>
  );
}

function ActionIcon({ icon: Icon, title, onClick, active, gold }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="p-1.5 rounded-lg transition hover:bg-white/10"
      style={{ color: gold ? 'hsl(38 92% 55%)' : active ? 'hsl(38 92% 50%)' : 'rgba(255,255,255,0.45)' }}
      onMouseEnter={e => { if (!gold && !active) e.currentTarget.style.color = 'rgba(255,255,255,0.85)'; }}
      onMouseLeave={e => { if (!gold && !active) e.currentTarget.style.color = 'rgba(255,255,255,0.45)'; }}
    >
      <Icon className="w-3.5 h-3.5" />
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