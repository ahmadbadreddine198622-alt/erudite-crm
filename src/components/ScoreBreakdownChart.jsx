const DIMS = [
  { key: "budget_fit", label: "Budget" },
  { key: "authority", label: "Authority" },
  { key: "need_clarity", label: "Need" },
  { key: "timeline_urgency", label: "Timeline" },
  { key: "engagement", label: "Engagement" },
  { key: "inventory_match", label: "Inventory" },
  { key: "responsiveness", label: "Response" },
];

export default function ScoreBreakdownChart({ breakdown }) {
  if (!breakdown) return null;
  return (
    <div className="space-y-1.5">
      {DIMS.map(({ key, label }) => {
        const val = breakdown[key] ?? 0;
        return (
          <div key={key} className="flex items-center gap-2 text-xs">
            <span className="w-20 text-muted-foreground shrink-0">{label}</span>
            <div className="flex-1 bg-slate-100 rounded-full h-1.5">
              <div
                className="h-1.5 rounded-full bg-violet-500 transition-all"
                style={{ width: `${val}%` }}
              />
            </div>
            <span className="w-6 text-right font-medium">{Math.round(val)}</span>
          </div>
        );
      })}
    </div>
  );
}