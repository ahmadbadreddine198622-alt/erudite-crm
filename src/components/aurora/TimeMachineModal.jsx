import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, AlertCircle, TrendingUp } from "lucide-react";

export default function TimeMachineModal({ deal, simulation, onClose }) {
  if (!simulation) return null;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-violet-600" />
            Time Machine — {simulation.horizon_days}-day futures
            {deal && <span className="text-muted-foreground font-normal text-sm">for {deal.lead_name || deal.id?.slice(0,8)}</span>}
          </DialogTitle>
        </DialogHeader>

        <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 mb-4">
          <p className="text-sm font-semibold text-violet-900 flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4" /> Recommended: {simulation.recommended_scenario_name}
          </p>
          <p className="text-sm text-violet-800 mt-1">{simulation.recommendation_reasoning}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(simulation.scenarios || []).map(s => {
            const isRecommended = s.name === simulation.recommended_scenario_name;
            return (
              <Card key={s.name} className={`p-4 ${isRecommended ? "ring-2 ring-violet-500 shadow-lg" : ""}`}>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-sm">{s.name}</h3>
                  {isRecommended && <Badge className="bg-violet-100 text-violet-700 text-xs">Recommended</Badge>}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground mb-3">
                  <div className="bg-slate-50 rounded p-2">
                    <div className="text-base font-bold text-slate-800">{(s.probability_of_close * 100).toFixed(0)}%</div>
                    <div>Close prob</div>
                  </div>
                  <div className="bg-slate-50 rounded p-2">
                    <div className="text-base font-bold text-slate-800">{fmt(s.expected_value)}</div>
                    <div>EV (AED)</div>
                  </div>
                </div>

                <p className="text-xs text-slate-700 leading-relaxed mb-3">{s.narrative}</p>

                <div className="mb-3">
                  <p className="text-xs font-semibold uppercase text-slate-500 mb-1">Action Sequence</p>
                  <ol className="text-xs space-y-0.5 text-slate-700">
                    {(s.action_sequence || []).map((a, i) => (
                      <li key={i} className="flex gap-1">
                        <span className="text-violet-500 font-semibold">{i+1}.</span> {a}
                      </li>
                    ))}
                  </ol>
                </div>

                {s.risks?.length > 0 && (
                  <div className="bg-amber-50 rounded p-2">
                    <p className="text-xs font-semibold text-amber-800 flex items-center gap-1 mb-1">
                      <AlertCircle className="w-3 h-3" /> Risks
                    </p>
                    <ul className="text-xs text-amber-900 space-y-0.5">
                      {s.risks.map((r, i) => <li key={i}>• {r}</li>)}
                    </ul>
                  </div>
                )}

                {s.predicted_close_date && (
                  <p className="text-xs text-muted-foreground mt-2">📅 Predicted close: {s.predicted_close_date}</p>
                )}
              </Card>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function fmt(n) { return new Intl.NumberFormat().format(Math.round(n || 0)); }