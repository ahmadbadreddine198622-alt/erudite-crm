import { useEffect, useState } from "react";
import { Clock, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export default function SLATimer({ dueAt, breached }) {
  const [remaining, setRemaining] = useState(null);

  useEffect(() => {
    if (!dueAt) return;
    const update = () => {
      const diff = new Date(dueAt) - Date.now();
      setRemaining(diff);
    };
    update();
    const id = setInterval(update, 10000);
    return () => clearInterval(id);
  }, [dueAt]);

  if (!dueAt && !breached) return null;

  if (breached || remaining < 0) {
    return (
      <div className="flex items-center gap-1 text-xs text-red-600 bg-red-50 border border-red-200 px-2 py-1 rounded-lg shrink-0">
        <AlertTriangle className="w-3.5 h-3.5" />
        SLA breached
      </div>
    );
  }

  const minutes = Math.floor(remaining / 60000);
  const hours = Math.floor(minutes / 60);
  const label = hours > 0 ? `${hours}h ${minutes % 60}m` : `${minutes}m`;
  const urgent = minutes < 30;

  return (
    <div className={cn(
      "flex items-center gap-1 text-xs px-2 py-1 rounded-lg border shrink-0",
      urgent ? "text-orange-600 bg-orange-50 border-orange-200" : "text-muted-foreground bg-muted/40 border-border"
    )}>
      <Clock className="w-3.5 h-3.5" />
      SLA {label}
    </div>
  );
}