import { useRef, useEffect } from "react";

const STAGES = ["discovery","qualified","viewing","offer_drafting","offer_submitted","negotiating","agreement","diligence","noc_signing","closing"];
const TEMP_COLOR = { frozen:"#3b82f6", cold:"#60a5fa", warming:"#fbbf24", hot:"#fb923c", blazing:"#ef4444" };

export default function ConstellationView({ deals, onDealClick }) {
  const canvasRef = useRef();
  const dealRefs = useRef([]);
  const W = 1400, H = 560;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, W, H);

    // Grid
    ctx.font = "10px system-ui";
    STAGES.forEach((s, i) => {
      const x = (i + 0.5) * (W / STAGES.length);
      ctx.strokeStyle = "#1e293b";
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H - 30); ctx.stroke();
      ctx.fillStyle = "#64748b";
      ctx.textAlign = "center";
      ctx.fillText(s.replace("_", " "), x, H - 12);
    });

    for (let s = 0; s <= 100; s += 20) {
      const y = (H - 40) - (s / 100) * (H - 70);
      ctx.strokeStyle = "#1e293b";
      ctx.beginPath(); ctx.moveTo(40, y); ctx.lineTo(W, y); ctx.stroke();
      ctx.fillStyle = "#475569";
      ctx.textAlign = "right";
      ctx.fillText(`${s}`, 36, y + 4);
    }

    dealRefs.current = [];

    deals.forEach(d => {
      const xIdx = STAGES.indexOf(d.stage);
      if (xIdx < 0) return;

      const seed = (d.id || "").split("").reduce((a, c) => a + c.charCodeAt(0), 0);
      const jitter = ((seed % 40) - 20);
      const x = (xIdx + 0.5) * (W / STAGES.length) + jitter;
      const y = (H - 40) - ((d.aurora_score || 30) / 100) * (H - 70);
      const r = Math.max(5, Math.min(26, Math.log10(Math.max(d.deal_value || 1e5, 1)) * 4 + 2));
      const color = TEMP_COLOR[d.aurora_temperature] || "#94a3b8";
      const glow = Math.max(0, d.aurora_velocity || 0) * 5;

      ctx.save();
      ctx.shadowColor = color;
      ctx.shadowBlur = glow + 4;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.88;
      ctx.fill();
      ctx.restore();

      if (d.needs_human_review) {
        ctx.strokeStyle = "#ef4444";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, r + 5, 0, Math.PI * 2);
        ctx.stroke();
      }

      dealRefs.current.push({ deal: d, x, y, r });
    });
  }, [deals]);

  function handleClick(e) {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const cx = (e.clientX - rect.left) * (W / rect.width);
    const cy = (e.clientY - rect.top) * (H / rect.height);
    const hit = dealRefs.current.find(({ x, y, r }) => Math.hypot(x - cx, y - cy) <= r + 6);
    if (hit) onDealClick(hit.deal);
  }

  return (
    <div className="rounded-xl overflow-hidden border border-slate-800 bg-slate-900">
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        onClick={handleClick}
        className="w-full cursor-pointer"
      />
      <div className="bg-slate-900 text-slate-400 px-4 py-2 text-xs flex gap-6 flex-wrap border-t border-slate-800">
        <span>X axis: Pipeline stage</span>
        <span>Y axis: Aurora score (0–100)</span>
        <span>Size: Deal value</span>
        <span>Color: Temperature</span>
        <span>Glow: Velocity</span>
        <span className="text-red-400">Red ring: Needs review</span>
        <span className="text-slate-500 ml-auto">Click a star to run Time Machine</span>
      </div>
    </div>
  );
}