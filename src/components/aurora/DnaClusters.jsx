import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const ARCHETYPE_COLORS = {
  first_time_buyer: "bg-blue-100 text-blue-700",
  upgrader: "bg-emerald-100 text-emerald-700",
  investor_yield: "bg-violet-100 text-violet-700",
  investor_capital_growth: "bg-purple-100 text-purple-700",
  international_buyer: "bg-amber-100 text-amber-700",
  luxury_buyer: "bg-rose-100 text-rose-700",
  off_plan_speculator: "bg-orange-100 text-orange-700",
  end_user_family: "bg-teal-100 text-teal-700",
};

export default function DnaClusters({ deals, onDealClick }) {
  const clusters = {};
  deals.forEach(d => {
    const archetype = d.aurora_dna?.markers?.buyer_archetype || "unknown";
    if (!clusters[archetype]) clusters[archetype] = [];
    clusters[archetype].push(d);
  });

  if (Object.keys(clusters).length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <p className="text-lg font-medium mb-2">No DNA data yet</p>
        <p className="text-sm">Run the Aurora orchestrator on your deals to generate DNA profiles.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {Object.entries(clusters).sort((a,b) => b[1].length - a[1].length).map(([archetype, archetypeDeals]) => (
        <div key={archetype}>
          <div className="flex items-center gap-2 mb-3">
            <Badge className={ARCHETYPE_COLORS[archetype] || "bg-slate-100 text-slate-700"}>
              {archetype.replace(/_/g," ")}
            </Badge>
            <span className="text-sm text-muted-foreground">{archetypeDeals.length} deals</span>
            <span className="text-sm text-muted-foreground">·</span>
            <span className="text-sm font-medium">
              {fmt(archetypeDeals.reduce((s, d) => s + (d.deal_value || 0), 0))} AED total
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {archetypeDeals.map(deal => (
              <Card key={deal.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => onDealClick(deal)}>
                <CardContent className="p-3">
                  <p className="text-xs font-medium truncate">{deal.lead_name || deal.id?.slice(0,8)}</p>
                  <p className="text-xs text-muted-foreground">{deal.stage?.replace(/_/g," ")}</p>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs font-semibold">{deal.aurora_score ?? "?"}</span>
                    <span className="text-xs">{tempEmoji(deal.aurora_temperature)}</span>
                  </div>
                  {deal.aurora_dna?.markers?.decision_speed && (
                    <p className="text-xs text-slate-400 mt-1">{deal.aurora_dna.markers.decision_speed}</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function tempEmoji(t) {
  return { frozen:"🧊", cold:"❄️", warming:"🌤", hot:"🔥", blazing:"⚡" }[t] || "·";
}

function fmt(n) { return new Intl.NumberFormat().format(Math.round(n || 0)); }