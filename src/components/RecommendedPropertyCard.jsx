import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";

export default function RecommendedPropertyCard({ rec, onSend }) {
  return (
    <div className="flex items-start justify-between gap-2 p-2 rounded border bg-white text-xs">
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{rec.property_id}</div>
        {rec.reasoning && <div className="text-muted-foreground line-clamp-2 mt-0.5">{rec.reasoning}</div>}
        {rec.match_score != null && (
          <div className="mt-1 text-violet-600 font-semibold">{rec.match_score}% match</div>
        )}
      </div>
      <Button size="sm" variant="outline" className="shrink-0 h-7 px-2 gap-1" onClick={onSend}>
        <Send className="w-3 h-3" /> Send
      </Button>
    </div>
  );
}