import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";

export default function CreateDealDialog({ onClose }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    lead_id: "",
    deal_value: "",
    currency: "AED",
    stage: "discovery",
    assigned_agent_email: "",
    autopilot_mode: "supervised"
  });

  const { data: leads = [] } = useQuery({
    queryKey: ["leads-for-deal"],
    queryFn: () => base44.entities.Lead.list("-created_date", 100)
  });

  const create = useMutation({
    mutationFn: (data) => base44.entities.Deal.create({
      ...data,
      deal_value: data.deal_value ? parseFloat(data.deal_value) : undefined,
      lead_name: leads.find(l => l.id === data.lead_id)?.full_name || "",
      lead_source: leads.find(l => l.id === data.lead_id)?.source || "",
      stage_entered_at: new Date().toISOString(),
      aurora_score: 30,
      aurora_temperature: "warming",
      aurora_risk_score: 50
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["aurora-deals"] });
      onClose();
    }
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create New Deal</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Lead</Label>
            <Select value={form.lead_id} onValueChange={v => setForm({...form, lead_id: v})}>
              <SelectTrigger><SelectValue placeholder="Select lead..." /></SelectTrigger>
              <SelectContent>
                {leads.map(l => <SelectItem key={l.id} value={l.id}>{l.full_name} — {l.source}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Deal Value (AED)</Label>
            <Input type="number" placeholder="e.g. 2500000" value={form.deal_value} onChange={e => setForm({...form, deal_value: e.target.value})} />
          </div>
          <div>
            <Label>Agent Email</Label>
            <Input type="email" placeholder="agent@brokerage.com" value={form.assigned_agent_email} onChange={e => setForm({...form, assigned_agent_email: e.target.value})} />
          </div>
          <div>
            <Label>Stage</Label>
            <Select value={form.stage} onValueChange={v => setForm({...form, stage: v})}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["discovery","qualified","viewing","offer_drafting","offer_submitted","negotiating"].map(s =>
                  <SelectItem key={s} value={s}>{s.replace(/_/g," ")}</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Autopilot Mode</Label>
            <Select value={form.autopilot_mode} onValueChange={v => setForm({...form, autopilot_mode: v})}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="off">Off — suggestions only</SelectItem>
                <SelectItem value="supervised">Supervised — Aurora drafts, you approve</SelectItem>
                <SelectItem value="autonomous">Autonomous — Aurora acts</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button className="flex-1" onClick={() => create.mutate(form)} disabled={!form.lead_id || create.isPending}>
              {create.isPending ? "Creating…" : "Create Deal"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}