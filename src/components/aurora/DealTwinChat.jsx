import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Sparkles, Send } from "lucide-react";
import { base44 } from "@/api/base44Client";

const QUICK_PROMPTS = [
  "What's the main blocker right now?",
  "Draft a follow-up WhatsApp message",
  "Should we walk away from this deal?",
  "What's the best next action?",
  "Who should we talk to next?"
];

export default function DealTwinChat({ deal, onClose }) {
  const [messages, setMessages] = useState([{
    role: "assistant",
    content: deal
      ? `I'm the Twin of this ${deal.stage} deal. Score: ${deal.aurora_score ?? "?"}/100, Temperature: ${deal.aurora_temperature || "unknown"}. Ask me anything — blockers, next move, draft messages, whether to push or wait.`
      : `I'm Aurora, your pipeline intelligence. Ask me anything about your deals, pipeline health, or what to do next.`
  }]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const bottomRef = useRef();

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function send(text) {
    const msg = text || input;
    if (!msg.trim() || thinking) return;
    const newMsgs = [...messages, { role: "user", content: msg }];
    setMessages(newMsgs);
    setInput("");
    setThinking(true);

    try {
      const context = deal ? JSON.stringify({
        stage: deal.stage, sub_stage: deal.sub_stage, value: deal.deal_value, currency: deal.currency,
        score: deal.aurora_score, temperature: deal.aurora_temperature, risk_factors: deal.aurora_risk_factors,
        forecast: deal.aurora_forecast, dna: deal.aurora_dna?.markers, next_action: deal.next_aurora_action,
        needs_review: deal.needs_human_review, review_reason: deal.review_reason
      }, null, 2) : "No specific deal selected — general pipeline context.";

      const reply = await base44.integrations.Core.InvokeLLM({
        model: "claude_opus_4_7",
        prompt: `You are the digital twin of a real-estate deal. Speak in first person ("I'm at stage X. My blocker is Y."). Be tactical, honest, concise (under 150 words unless drafting content).

DEAL CONTEXT:
${context}

CONVERSATION:
${newMsgs.map(m => `${m.role.toUpperCase()}: ${m.content}`).join("\n")}

Respond as the Twin.`
      });

      setMessages([...newMsgs, { role: "assistant", content: reply }]);
    } catch (e) {
      setMessages([...newMsgs, { role: "assistant", content: "Something went wrong. Please try again." }]);
    } finally {
      setThinking(false);
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl h-[75vh] flex flex-col p-0">
        <DialogHeader className="px-5 pt-5 pb-3 border-b">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-violet-600" />
            {deal ? `Deal Twin · ${deal.stage?.replace(/_/g," ")} · score ${deal.aurora_score ?? "?"}` : "Ask Aurora"}
          </DialogTitle>
        </DialogHeader>

        {/* Quick prompts */}
        <div className="px-4 py-2 flex gap-2 flex-wrap border-b bg-slate-50">
          {QUICK_PROMPTS.map((p) => (
            <button key={p} onClick={() => send(p)} className="text-xs px-2 py-1 rounded-full bg-white border border-slate-200 hover:border-violet-400 hover:text-violet-700 transition-colors">
              {p}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-sm whitespace-pre-wrap ${m.role === "assistant" ? "bg-violet-50 text-violet-900" : "bg-slate-800 text-white"}`}>
                {m.content}
              </div>
            </div>
          ))}
          {thinking && (
            <div className="flex justify-start">
              <div className="bg-violet-50 text-violet-600 px-4 py-2 rounded-2xl text-sm animate-pulse">
                Twin is thinking…
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="px-4 pb-4 pt-2 border-t flex gap-2">
          <Input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && send()}
            placeholder="Ask the deal anything…"
            disabled={thinking}
          />
          <Button onClick={() => send()} disabled={thinking || !input.trim()}>
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}