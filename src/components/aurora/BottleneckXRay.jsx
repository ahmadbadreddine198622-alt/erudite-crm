import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X, AlertCircle, TrendingDown } from "lucide-react";

const PRIORITY_COLOR = { critical: "bg-red-100 text-red-700", high: "bg-orange-100 text-orange-700", medium: "bg-yellow-100 text-yellow-700" };

export default function BottleneckXRay({ data, onClose }) {
  if (!data) return null;
  return (
    <Card className="border-2 border-orange-200 bg-orange-50/50">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-orange-900">
            <AlertCircle className="w-5 h-5" />
            Bottleneck X-Ray
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
        </div>
        {data.headline_insight && (
          <p className="text-sm text-orange-800 font-medium mt-1">{data.headline_insight}</p>
        )}
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(data.bottlenecks || []).map((b, i) => (
            <div key={i} className="bg-white rounded-xl p-4 border border-orange-100 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-sm">{b.name}</span>
                <Badge className={PRIORITY_COLOR[b.priority]}>{b.priority}</Badge>
              </div>
              <p className="text-xs text-muted-foreground mb-2">
                <span className="font-medium text-slate-700">{b.transition}</span>
              </p>
              {(b.your_rate != null || b.benchmark_rate != null) && (
                <div className="flex gap-4 text-xs mb-2">
                  <span>You: <span className="font-semibold text-red-600">{b.your_rate != null ? `${(b.your_rate * 100).toFixed(0)}%` : "—"}</span></span>
                  <span>Benchmark: <span className="font-semibold text-emerald-600">{b.benchmark_rate != null ? `${(b.benchmark_rate * 100).toFixed(0)}%` : "—"}</span></span>
                </div>
              )}
              <p className="text-xs text-slate-700 mb-2"><TrendingDown className="w-3 h-3 inline mr-1 text-orange-500" />{b.detected_pattern}</p>
              {b.hypothesized_root_cause && (
                <p className="text-xs text-slate-500 italic mb-2">Root cause: {b.hypothesized_root_cause}</p>
              )}
              <div className="bg-emerald-50 rounded p-2 text-xs text-emerald-800">
                <span className="font-semibold">Fix: </span>{b.recommended_change}
                {b.measurable_target && <span className="block mt-0.5 text-emerald-600">Target: {b.measurable_target}</span>}
              </div>
              {b.estimated_impact && (
                <p className="text-xs text-violet-700 mt-2 font-medium">💰 {b.estimated_impact}</p>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}