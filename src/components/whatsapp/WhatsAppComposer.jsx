import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Sparkles, Mic, FileText, Home, MapPin, Clock, Languages } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { base44 } from "@/api/base44Client";

export default function WhatsAppComposer({ conversation, suggestions, onSend, onSendProperty, onScheduleSend }) {
  const [text, setText] = useState("");
  const [translatedPreview, setTranslatedPreview] = useState("");

  return (
    <div className="border-t bg-white p-3 space-y-2">
      {/* AI suggestions row */}
      {suggestions?.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {suggestions.slice(0, 3).map((s, i) => (
            <button
              key={i}
              onClick={() => setText(s.text)}
              className="shrink-0 max-w-xs text-left p-2 rounded-lg border bg-violet-50 hover:bg-violet-100 text-xs"
            >
              <div className="flex items-center gap-1 text-violet-700 font-medium mb-0.5">
                <Sparkles className="w-3 h-3" /> {s.tone} · {s.intent}
              </div>
              <div className="text-slate-700 line-clamp-3">{s.text}</div>
            </button>
          ))}
        </div>
      )}

      {/* Composer */}
      <div className="flex gap-2 items-end">
        <Textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Type a message…"
          rows={2}
          className="resize-none"
          dir={["ar", "ur", "fa"].includes(conversation.detected_language) ? "rtl" : "ltr"}
        />
        <div className="flex flex-col gap-1">
          <Button size="sm" onClick={() => { onSend(text); setText(""); }}>
            <Send className="w-4 h-4" />
          </Button>
          <Popover>
            <PopoverTrigger asChild><Button size="sm" variant="outline"><Clock className="w-4 h-4" /></Button></PopoverTrigger>
            <PopoverContent className="w-56">
              <p className="text-xs font-medium mb-2">Schedule send</p>
              {[15, 60, 240, 1440].map(min => (
                <button key={min} onClick={() => onScheduleSend(text, min)} className="w-full text-left px-2 py-1 hover:bg-slate-100 text-xs rounded">
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
      <div className="flex gap-1 text-xs">
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
    <button onClick={onClick} className="flex items-center gap-1 px-2 py-1 rounded hover:bg-slate-100">
      <Icon className="w-3.5 h-3.5" /> {label}
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