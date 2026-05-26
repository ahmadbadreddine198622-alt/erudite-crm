import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

export default function ScoreBadge({ score, trend }) {
  if (score == null) return null;

  const color =
    score >= 70 ? "bg-green-100 text-green-800 border-green-200" :
    score >= 40 ? "bg-amber-100 text-amber-800 border-amber-200" :
    "bg-red-100 text-red-800 border-red-200";

  const TrendIcon =
    trend === "rising" ? TrendingUp :
    trend === "falling" ? TrendingDown :
    Minus;

  const trendColor =
    trend === "rising" ? "text-green-600" :
    trend === "falling" ? "text-red-500" :
    "text-slate-400";

  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border", color)}>
      {score}
      <TrendIcon className={cn("w-3 h-3", trendColor)} />
    </span>
  );
}