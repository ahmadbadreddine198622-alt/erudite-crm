import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Sparkles, Mic, FileText, Home, MapPin, Clock, Languages, Paperclip } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { base44 } from "@/api/base44Client";

export default function WhatsAppComposer({ conversation, suggestions, onSend, onSendProperty, onScheduleSend }) {
  const [text, setText] = useState("");
  const [translatedPreview, setTranslatedPreview] = useState("");

  return (
    <div className="border-t bg-white">
      {/* AI suggestions row */}
      {suggestions?.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto px-3 pt-2 pb-1">
          {suggestions.slice(0, 3).map((s, i) => (
            <button
              key={i}
              onClick={() => setText(s.text)}
              className="shrink-0 max-w-[200px] text-left px-2.5 py-1.5 rounded-full bg-gray-100 hover:bg-gray-200 text-xs border border-gray-200 transition"
            >
              <span className="text-[#00A884] font-medium">{s.tone}</span> · <span className="text-gray-600">{s.text.slice(0, 40)}{s.text.length > 40 ? '…' : ''}</span>
            </button>
          ))}
        </div>
      )}

      {/* Composer */}
      <div className="flex items-end gap-2 px-3 py-2">
        <button type="button" className="text-gray-400 hover:text-gray-600 mb-2 shrink-0">
          <Paperclip className="w-5 h-5" />
        </button>
        <div className="flex-1 bg-[#F0F2F5] rounded-2xl px-4 py-2">
          <Textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Type a message…"
            rows={1}
            className="border-0 bg-transparent resize-none p-0 shadow-none focus-visible:ring-0 min-h-0 text-sm w-full"
            dir={["ar", "ur", "fa"].includes(conversation.detected_language) ? "rtl" : "ltr"}
          />
        </div>
        <div className="flex flex-col gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => { onSend(text); setText(""); }}
            className="w-10 h-10 bg-[#00A884] rounded-full flex items-center justify-center hover:bg-[#008f71] transition"
          >
            <Send className="w-4 h-4 text-white" />
          </button>
          <Popover>
            <PopoverTrigger asChild>
              <button type="button" className="w-10 h-10 border border-gray-200 rounded-full flex items-center justify-center hover:bg-gray-100 transition">
                <Clock className="w-4 h-4 text-gray-500" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-56">
              <p className="text-xs font-medium mb-2">Schedule send</p>
              {[15, 60, 240, 1440].map(min => (
                <button key={min} type="button" onClick={() => onScheduleSend(text, min)} className="w-full text-left px-2 py-1 hover:bg-slate-100 text-xs rounded">
                  In {min < 60 ? `${min} min` : min < 1440 ? `${min/60}h` : `${min/1440}d`}
                </button>
              ))}
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Translated preview */}
      {translatedPreview && (
        <div className="text-xs p-2 bg-blue-50 border border-blue-200 rounded" dir="rtl">
          <span className="text-blue-700 font-medium">AR preview: </span>{translatedPreview}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex gap-0.5 px-3 pb-2.5 border-t border-gray-100 pt-1.5">
        <ToolButton icon={Home} label="Property" onClick={onSendProperty} />
        <ToolButton icon={MapPin} label="Location" />
        <ToolButton icon={FileText} label="Document" />
        <ToolButton icon={Mic} label="Voice" />
        <ToolButton icon={Languages} label="Translate" onClick={() => previewTranslate(text, setTranslatedPreview)} />
      </div>
    </div>
  );
}

function ToolButton({ icon: Icon, label, onClick }) {
  return (
    <button type="button" onClick={onClick} className="flex items-center gap-1 px-2 py-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition">
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