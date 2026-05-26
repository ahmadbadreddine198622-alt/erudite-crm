import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, Zap, AlertCircle } from "lucide-react";

const STAGES = ["discovery","qualified","viewing","offer_drafting","offer_submitted","negotiating","agreement","diligence","noc_signing","closing"];
const TEMP_COLORS = { frozen:"bg-blue-100 text-blue-700", cold:"bg-sky-100 text-sky-700", warming:"bg-yellow-100 text-yellow-700", hot:"bg-orange-100 text-orange-700", blazing:"bg-red-100 text-red-700" };
const TEMP_EMOJI = { frozen:"🧊", cold:"❄️", warming:"🌤", hot:"🔥", blazing:"⚡" };

export default function AuroraKanban({ deals, onDealClick, onTimeMachine, tmLoading }) {
  const byStage = {};
  STAGES.forEach(s => { byStage[s] = []; });
  deals.forEach(d => {
    if (byStage[d.stage]) byStage[d.stage].push(d);
    else if (byStage["discovery"]) byStage["discovery"].push(d);
  });

  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-3 min-w-max">
        {STAGES.map(stage => (
          <div key={stage} className="w-52 flex-shrink-0">
            <div className="text-xs font-semibold uppercase text-muted-foreground mb-2 px-1">
              {stage.replace(/_/g," ")}
              <span className="ml-1 text-slate-400">({byStage[stage].length})</span>
            </div>
            <div className="space-y-2">
              {byStage[stage].map(deal => (
                <DealCard key={deal.id} deal={deal} onClick={() => onDealClick(deal)} onTimeMachine={() => onTimeMachine(deal)} tmLoading={tmLoading} />
              ))}
              {byStage[stage].length === 0 && (
                <div className="h-16 border-2 border-dashed border-slate-200 rounded-lg flex items-center justify-center text-xs text-slate-400">
                  Empty
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DealCard({ deal, onClick, onTimeMachine, tmLoading }) {
  const temp = deal.aurora_temperature || "cold";
  return (
    <div
      className={`bg-white border rounded-lg p-3 cursor-pointer hover:shadow-md transition-shadow ${deal.needs_human_review ? "border-red-400 border-2" : "border-slate-200"}`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium truncate">{deal.lead_name || deal.lead_id?.slice(0,8) || "Deal"}</span>
        {deal.needs_human_review && <AlertCircle className="w-3 h-3 text-red-500 flex-shrink-0" />}
      </div>
      <div className="text-xs text-muted-foreground mb-2">
        {deal.deal_value ? `${new Intl.NumberFormat().format(deal.deal_value)} ${deal.currency || "AED"}` : "No value"}
      </div>
      <div className="flex items-center justify-between">
        <Badge className={`text-xs py-0 ${TEMP_COLORS[temp]}`}>
          {TEMP_EMOJI[temp]} {temp}
        </Badge>
        <span className="text-xs font-semibold text-slate-700">{deal.aurora_score ?? "—"}</span>
      </div>
      {deal.aurora_forecast?.close_probability != null && (
        <div className="mt-1 w-full bg-slate-100 rounded-full h-1">
          <div
            className="bg-violet-500 h-1 rounded-full"
            style={{ width: `${(deal.aurora_forecast.close_probability * 100).toFixed(0)}%` }}
          />
        </div>
      )}
      {deal.next_aurora_action?.action && deal.next_aurora_action.action !== "do_nothing" && (
        <div className="mt-2 text-xs text-violet-700 flex items-center gap-1">
          <Zap className="w-3 h-3" />
          <span className="truncate">{deal.next_aurora_action.action.replace(/_/g," ")}</span>
        </div>
      )}
      <Button
        size="sm"
        variant="ghost"
        className="w-full mt-2 h-6 text-xs text-slate-500"
        onClick={e => { e.stopPropagation(); onTimeMachine(); }}
        disabled={tmLoading}
      >
        <Clock className="w-3 h-3 mr-1" /> Time Machine
      </Button>
    </div>
  );
}