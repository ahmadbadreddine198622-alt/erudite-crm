import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Clock, Zap, ExternalLink, Building2, AlertCircle } from "lucide-react";

const STAGE_COLORS = {
  discovery: "bg-slate-100 text-slate-600",
  qualified: "bg-blue-100 text-blue-700",
  viewing: "bg-cyan-100 text-cyan-700",
  offer_drafting: "bg-yellow-100 text-yellow-700",
  offer_submitted: "bg-orange-100 text-orange-700",
  negotiating: "bg-amber-100 text-amber-700",
  agreement: "bg-lime-100 text-lime-700",
  diligence: "bg-emerald-100 text-emerald-700",
  noc_signing: "bg-teal-100 text-teal-700",
  closing: "bg-violet-100 text-violet-700",
};

const TEMP_EMOJI = { frozen:"🧊", cold:"❄️", warming:"🌤", hot:"🔥", blazing:"⚡" };

export default function PFDealsTab({ deals, onDealClick, onTimeMachine }) {
  if (deals.length === 0) {
    return (
      <div className="text-center py-16">
        <Building2 className="w-12 h-12 text-amber-400 mx-auto mb-3" />
        <p className="font-semibold text-lg mb-1">No Property Finder deals yet</p>
        <p className="text-muted-foreground text-sm">Deals created from Property Finder leads will appear here automatically.</p>
        <p className="text-xs text-muted-foreground mt-2">Make sure deals have <code className="bg-slate-100 px-1 rounded">lead_source: "property_finder"</code></p>
      </div>
    );
  }

  const total = deals.reduce((s, d) => s + (d.deal_value || 0), 0);
  const weightedForecast = deals.reduce((s, d) => s + (d.aurora_forecast?.weighted_value || 0), 0);
  const hot = deals.filter(d => ["hot","blazing"].includes(d.aurora_temperature)).length;

  return (
    <div className="space-y-4">
      {/* PF summary strip */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
          <p className="text-xs text-amber-700">PF Deals</p>
          <p className="text-2xl font-bold text-amber-800">{deals.length}</p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
          <p className="text-xs text-amber-700">Total Value</p>
          <p className="text-xl font-bold text-amber-800">{fmt(total)} AED</p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
          <p className="text-xs text-amber-700">Weighted Forecast</p>
          <p className="text-xl font-bold text-amber-800">{fmt(weightedForecast)} AED</p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
          <p className="text-xs text-amber-700">Hot / Blazing</p>
          <p className="text-2xl font-bold text-amber-800">🔥 {hot}</p>
        </div>
      </div>

      {/* PF deals list */}
      <div className="space-y-2">
        {deals.map(deal => (
          <Card key={deal.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => onDealClick(deal)}>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-amber-600" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-medium text-sm truncate">{deal.lead_name || "Unknown lead"}</span>
                  {deal.needs_human_review && <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className={`text-xs py-0 ${STAGE_COLORS[deal.stage] || "bg-slate-100 text-slate-600"}`}>
                    {deal.stage?.replace(/_/g," ")}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {TEMP_EMOJI[deal.aurora_temperature] || "·"} {deal.aurora_temperature || "unknown"}
                  </span>
                  <span className="text-xs text-violet-700 font-medium">
                    Score: {deal.aurora_score ?? "—"}
                  </span>
                  {deal.next_aurora_action?.action && deal.next_aurora_action.action !== "do_nothing" && (
                    <span className="text-xs text-slate-500 flex items-center gap-1">
                      <Zap className="w-3 h-3 text-violet-400" />
                      {deal.next_aurora_action.action.replace(/_/g," ")}
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="font-semibold text-sm">{deal.deal_value ? `${fmt(deal.deal_value)} AED` : "No value"}</div>
                {deal.aurora_forecast?.close_probability != null && (
                  <div className="text-xs text-muted-foreground">{(deal.aurora_forecast.close_probability * 100).toFixed(0)}% close</div>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="flex-shrink-0 text-xs"
                onClick={e => { e.stopPropagation(); onTimeMachine(deal); }}
              >
                <Clock className="w-3 h-3 mr-1" /> TM
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function fmt(n) { return new Intl.NumberFormat().format(Math.round(n || 0)); }