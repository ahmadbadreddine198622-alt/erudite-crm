const STAGES = [
  { id: "new", label: "New" },
  { id: "contacted", label: "Contacted" },
  { id: "qualified", label: "Qualified" },
  { id: "viewing_scheduled", label: "Viewing" },
  { id: "offer_made", label: "Offer" },
  { id: "negotiating", label: "Negotiating" },
  { id: "contract_sent", label: "Contract" },
  { id: "won", label: "Won" }
];

export default function StagePipeline({ currentStage, onStageClick }) {
  const currentIdx = STAGES.findIndex(s => s.id === currentStage);
  return (
    <div className="flex items-center px-3 py-2 border-t bg-white">
      {STAGES.map((s, i) => {
        const done = i < currentIdx;
        const active = i === currentIdx;
        return (
          <div key={s.id} className="flex items-center flex-1">
            <button
              onClick={() => onStageClick(s.id)}
              className={`flex flex-col items-center gap-1 group ${done ? "text-emerald-700" : active ? "text-violet-700" : "text-slate-400"}`}
            >
              <div className={`w-3 h-3 rounded-full transition ${done ? "bg-emerald-500" : active ? "bg-violet-600 ring-4 ring-violet-200" : "bg-slate-300 group-hover:bg-slate-400"}`} />
              <span className="text-[10px] font-medium">{s.label}</span>
            </button>
            {i < STAGES.length - 1 && (
              <div className={`flex-1 h-0.5 mb-3 mx-1 ${i < currentIdx ? "bg-emerald-500" : "bg-slate-200"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}