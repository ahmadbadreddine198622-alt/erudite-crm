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

// V3 Phase 2 (REMEMBER): tiny auto-scaled sparkline + a labelled trend cell, for the deal trajectory.
function Spark({ series, color }) {
  if (!Array.isArray(series) || series.length < 2) return null;
  const w = 44, h = 14, pad = 2;
  const lo = Math.min(...series), hi = Math.max(...series), span = (hi - lo) || 1;
  const pts = series.map((v, i) => {
    const x = pad + (i * (w - pad * 2)) / (series.length - 1);
    const y = pad + (h - pad * 2) * (1 - (v - lo) / span);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  return <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true" style={{ display: "block" }}><polyline points={pts} fill="none" stroke={color} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function TrendCell({ label, series, suffix, color, invert }) {
  if (!Array.isArray(series) || series.length < 2) return null;
  const latest = series[series.length - 1];
  const delta = Math.round(latest - series[series.length - 2]);
  const up = delta > 0;
  const dColor = delta === 0 ? "#94a3b8" : invert ? (up ? "#fb7185" : "#34d399") : (up ? "#34d399" : "#fb7185");
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[8px] font-semibold uppercase tracking-wider text-slate-400">{label}</span>
      <Spark series={series} color={color} />
      <span className="flex items-baseline gap-1">
        <span className="text-[11px] font-bold text-slate-700">{Math.round(latest)}{suffix || ""}</span>
        {delta !== 0 && <span className="text-[9px] font-bold" style={{ color: dColor }}>{up ? "▲" : "▼"}{Math.abs(delta)}</span>}
      </span>
    </div>
  );
}

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

  // V3 Phase 2 (REMEMBER): load this deal's append-only score history (degrades silently if the
  // DealScoreSnapshot entity isn't live yet) and derive score/win/risk trajectories.
  const [snaps, setSnaps] = useState([]);
  useEffect(() => {
    let alive = true;
    if (!deal?.id) return undefined;
    (async () => {
      try {
        const rows = await base44.entities.DealScoreSnapshot.filter({ deal_id: deal.id }, "-captured_at", 30);
        if (alive) setSnaps(Array.isArray(rows) ? rows : []);
      } catch { /* entity not live yet — degrade silently */ }
    })();
    return () => { alive = false; };
  }, [deal?.id]);

  const chrono = [...snaps].reverse();
  const scoreSeries = chrono.map(s => s.aurora_score).filter(v => typeof v === "number" && isFinite(v)).slice(-12);
  const winSeries = chrono.map(s => (typeof s.close_probability === "number" ? s.close_probability * 100 : null)).filter(v => typeof v === "number" && isFinite(v)).slice(-12);
  const riskSeries = chrono.map(s => s.aurora_risk_score).filter(v => typeof v === "number" && isFinite(v)).slice(-12);
  const hasTrend = scoreSeries.length >= 2 || winSeries.length >= 2 || riskSeries.length >= 2;

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

        {/* V3 P2 REMEMBER: deal trajectory across the orchestrator's run history (Risk inverted: up = bad) */}
        {hasTrend && (
          <div className="px-5 py-2 border-b flex items-center gap-4 bg-white">
            <span className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">Trajectory</span>
            <TrendCell label="Score" series={scoreSeries} color="#8b5cf6" />
            <TrendCell label="Win" series={winSeries} suffix="%" color="#3b82f6" />
            <TrendCell label="Risk" series={riskSeries} color="#fbbf24" invert />
          </div>
        )}

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