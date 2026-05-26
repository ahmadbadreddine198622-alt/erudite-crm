import { useState, useEffect } from "react";
import { Clock, AlertTriangle } from "lucide-react";

export default function SLATimer({ dueAt, breached }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  if (!dueAt) return null;
  const ms = new Date(dueAt) - now;
  const isBreached = breached || ms < 0;
  const fmt = formatRemaining(Math.abs(ms));

  return (
    <div className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
      isBreached ? "bg-red-100 text-red-800" :
      ms < 5 * 60000 ? "bg-amber-100 text-amber-800" :
      "bg-emerald-100 text-emerald-800"
    }`}>
      {isBreached ? <AlertTriangle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
      {isBreached ? `Breached ${fmt}` : `Due in ${fmt}`}
    </div>
  );
}

function formatRemaining(ms) {
  const s = Math.floor(ms / 1000); const m = Math.floor(s / 60); const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}