import { Card, CardContent } from "@/components/ui/card";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Info } from "lucide-react";

export default function ForecastGlassBox({ deals }) {
  const total = deals.reduce((s, d) => s + (d.aurora_forecast?.weighted_value || 0), 0);
  const top = [...deals]
    .sort((a, b) => (b.aurora_forecast?.weighted_value || 0) - (a.aurora_forecast?.weighted_value || 0))
    .slice(0, 8);

  if (deals.length === 0) return null;

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-sm">Glass-Box Forecast</h3>
            <p className="text-xs text-muted-foreground">Click any row to see Aurora's reasoning chain</p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold">{fmt(total)}</div>
            <div className="text-xs text-muted-foreground">AED weighted</div>
          </div>
        </div>
        <div className="space-y-1">
          {top.map(d => (
            <Popover key={d.id}>
              <PopoverTrigger asChild>
                <button className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-slate-50 text-sm border border-transparent hover:border-slate-200 transition-all">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: tempColor(d.aurora_temperature) }} />
                    <span className="truncate text-left">{d.lead_name || d.id?.slice(0,8)}</span>
                    <span className="text-muted-foreground text-xs flex-shrink-0">{d.stage?.replace(/_/g," ")}</span>
                  </div>
                  <span className="flex items-center gap-2 flex-shrink-0 ml-2">
                    <span className="text-muted-foreground text-xs">
                      {d.aurora_forecast?.close_probability != null ? `${(d.aurora_forecast.close_probability * 100).toFixed(0)}%` : "—"}
                    </span>
                    <span className="font-semibold text-sm">{fmt(d.aurora_forecast?.weighted_value)}</span>
                    <Info className="w-3 h-3 text-slate-400" />
                  </span>
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-96 text-sm" side="bottom" align="end">
                <p className="font-semibold mb-2">Why this forecast?</p>
                <p className="text-slate-700 text-xs leading-relaxed">
                  {d.aurora_forecast?.reasoning_trace || "No reasoning available — run the Aurora orchestrator to generate insights."}
                </p>
                {d.aurora_forecast?.drivers?.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs font-semibold text-emerald-700 mb-1">✅ Drivers</p>
                    <ul className="text-xs text-emerald-800 space-y-0.5">
                      {d.aurora_forecast.drivers.map((dr, i) => <li key={i}>• {dr}</li>)}
                    </ul>
                  </div>
                )}
                {d.aurora_forecast?.blockers?.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs font-semibold text-red-700 mb-1">🚫 Blockers</p>
                    <ul className="text-xs text-red-800 space-y-0.5">
                      {d.aurora_forecast.blockers.map((bl, i) => <li key={i}>• {bl}</li>)}
                    </ul>
                  </div>
                )}
                {d.aurora_dna?.playbook_recommendation && (
                  <div className="mt-2 p-2 bg-violet-50 rounded text-xs text-violet-800">
                    💡 {d.aurora_dna.playbook_recommendation}
                  </div>
                )}
              </PopoverContent>
            </Popover>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function tempColor(t) {
  return { frozen:"#3b82f6", cold:"#60a5fa", warming:"#fbbf24", hot:"#fb923c", blazing:"#ef4444" }[t] || "#94a3b8";
}

function fmt(n) { return new Intl.NumberFormat().format(Math.round(n || 0)); }