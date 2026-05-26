import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Sparkles, Activity, Zap, Telescope, GitBranch, Dna, Plus, AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import ConstellationView from "@/components/aurora/ConstellationView";
import AuroraKanban from "@/components/aurora/AuroraKanban";
import ForecastGlassBox from "@/components/aurora/ForecastGlassBox";
import BottleneckXRay from "@/components/aurora/BottleneckXRay";
import TimeMachineModal from "@/components/aurora/TimeMachineModal";
import DealTwinChat from "@/components/aurora/DealTwinChat";
import DnaClusters from "@/components/aurora/DnaClusters";
import CreateDealDialog from "@/components/aurora/CreateDealDialog";
import PFDealsTab from "@/components/aurora/PFDealsTab";

export default function AuroraPipeline() {
  const [selectedDeal, setSelectedDeal] = useState(null);
  const [view, setView] = useState("constellation");
  const [simulation, setSimulation] = useState(null);
  const [bottlenecks, setBottlenecks] = useState(null);
  const [showTwinChat, setShowTwinChat] = useState(false);
  const [showCreateDeal, setShowCreateDeal] = useState(false);
  const [xrayLoading, setXrayLoading] = useState(false);
  const [tmLoading, setTmLoading] = useState(false);

  const { data: deals = [], isLoading } = useQuery({
    queryKey: ["aurora-deals"],
    queryFn: () => base44.entities.Deal.list("-aurora_score", 500)
  });

  const activeDeals = deals.filter(d => !["won","lost"].includes(d.stage));
  const pfDeals = activeDeals.filter(d => d.lead_source === "property_finder");

  async function runTimeMachine(deal) {
    setSelectedDeal(deal);
    setTmLoading(true);
    try {
      const res = await base44.functions.invoke("simulateDealFuture", { deal_id: deal.id, horizon_days: 14 });
      setSimulation(res.data);
    } catch(e) {
      console.error(e);
    } finally {
      setTmLoading(false);
    }
  }

  async function runDiagnose() {
    setXrayLoading(true);
    try {
      const res = await base44.functions.invoke("diagnoseBottleneck", { window_days: 60 });
      setBottlenecks(res.data);
    } catch(e) {
      console.error(e);
    } finally {
      setXrayLoading(false);
    }
  }

  const summary = {
    count: activeDeals.length,
    weightedValue: activeDeals.reduce((s, d) => s + (d.aurora_forecast?.weighted_value || 0), 0),
    avgProb: activeDeals.length ? activeDeals.reduce((s, d) => s + (d.aurora_forecast?.close_probability || 0), 0) / activeDeals.length : 0,
    hot: activeDeals.filter(d => ["hot","blazing"].includes(d.aurora_temperature)).length,
    needReview: activeDeals.filter(d => d.needs_human_review).length
  };

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Sparkles className="w-8 h-8 text-violet-600" />
            Aurora Pipeline
          </h1>
          <p className="text-muted-foreground text-sm">Your pipeline thinks for itself.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={runDiagnose} disabled={xrayLoading}>
            <Activity className="w-4 h-4 mr-1" /> {xrayLoading ? "Analyzing…" : "X-Ray"}
          </Button>
          <Button variant="outline" onClick={() => { setSelectedDeal(null); setShowTwinChat(true); }}>
            <Zap className="w-4 h-4 mr-1" /> Ask Aurora
          </Button>
          <Button onClick={() => setShowCreateDeal(true)}>
            <Plus className="w-4 h-4 mr-1" /> New Deal
          </Button>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <MetricCard label="Active Deals" value={summary.count} />
        <MetricCard label="Weighted Forecast" value={`${fmt(summary.weightedValue)} AED`} tone="emerald" />
        <MetricCard label="Avg Close Prob" value={`${(summary.avgProb * 100).toFixed(0)}%`} tone="blue" />
        <MetricCard label="🔥 Hot / Blazing" value={summary.hot} tone="orange" />
        <MetricCard label="⚠️ Need Review" value={summary.needReview} tone="red" />
      </div>

      <ForecastGlassBox deals={activeDeals} />

      {bottlenecks && <BottleneckXRay data={bottlenecks} onClose={() => setBottlenecks(null)} />}

      <Tabs value={view} onValueChange={setView}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="constellation"><Telescope className="w-4 h-4 mr-1" />Constellation</TabsTrigger>
          <TabsTrigger value="kanban"><GitBranch className="w-4 h-4 mr-1" />Kanban</TabsTrigger>
          <TabsTrigger value="dna"><Dna className="w-4 h-4 mr-1" />DNA Clusters</TabsTrigger>
          <TabsTrigger value="propertyfinder" className="text-amber-600">
            🏢 Property Finder ({pfDeals.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="constellation">
          {isLoading ? <div className="h-64 flex items-center justify-center text-muted-foreground">Loading deals…</div> :
            <ConstellationView deals={activeDeals} onDealClick={runTimeMachine} />
          }
        </TabsContent>

        <TabsContent value="kanban">
          <AuroraKanban
            deals={activeDeals}
            onDealClick={d => { setSelectedDeal(d); setShowTwinChat(true); }}
            onTimeMachine={runTimeMachine}
            tmLoading={tmLoading}
          />
        </TabsContent>

        <TabsContent value="dna">
          <DnaClusters deals={activeDeals} onDealClick={d => { setSelectedDeal(d); setShowTwinChat(true); }} />
        </TabsContent>

        <TabsContent value="propertyfinder">
          <PFDealsTab deals={pfDeals} onDealClick={d => { setSelectedDeal(d); setShowTwinChat(true); }} onTimeMachine={runTimeMachine} />
        </TabsContent>
      </Tabs>

      {simulation && (
        <TimeMachineModal deal={selectedDeal} simulation={simulation} onClose={() => setSimulation(null)} />
      )}
      {showTwinChat && (
        <DealTwinChat deal={selectedDeal} onClose={() => setShowTwinChat(false)} />
      )}
      {showCreateDeal && (
        <CreateDealDialog onClose={() => setShowCreateDeal(false)} />
      )}
    </div>
  );
}

function MetricCard({ label, value, tone = "slate" }) {
  const bg = { slate: "bg-slate-50", emerald: "bg-emerald-50", blue: "bg-blue-50", orange: "bg-orange-50", red: "bg-red-50" };
  return (
    <Card className={bg[tone]}>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}

function fmt(n) { return new Intl.NumberFormat().format(Math.round(n || 0)); }