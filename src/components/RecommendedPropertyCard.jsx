import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";

export default function RecommendedPropertyCard({ rec, onSend }) {
  return (
    <div className="border rounded-lg p-2 bg-white">
      <div className="flex justify-between items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold truncate">{rec.title}</div>
          <div className="text-xs text-muted-foreground">{rec.price?.toLocaleString()} AED · {rec.bedrooms}BR · {rec.location}</div>
        </div>
        <div className="text-right">
          <div className="text-xs font-bold text-violet-700">{rec.match_score}%</div>
          <div className="text-[10px] text-muted-foreground">match</div>
        </div>
      </div>
      <p className="text-xs text-slate-600 mt-1 line-clamp-2">{rec.reasoning}</p>
      <Button size="sm" onClick={onSend} className="w-full mt-2 h-7 text-xs">
        <Send className="w-3 h-3 mr-1" /> Send with AI pitch
      </Button>
    </div>
  );
}