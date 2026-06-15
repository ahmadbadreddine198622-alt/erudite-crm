import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Phone, MessageCircle, Trash2, Search, ExternalLink, RefreshCw, UserX, ArrowRight, Link2, CheckCircle2 } from "lucide-react";
import LetterAvatar from "@/components/shared/LetterAvatar";
import { toast } from "sonner";

const STAGE_COLORS = {
  intake_clarify: "bg-slate-500/10 text-slate-400 border-slate-500/20",
  contact_identity: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  financial_qualification: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  intent_lock: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  unit_matching: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  viewing: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  objection_offer: "bg-rose-500/10 text-rose-400 border-rose-500/20",
  negotiation_deal_lock: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  closing_dld: "bg-pink-500/10 text-pink-400 border-pink-500/20",
  closed: "bg-green-500/10 text-green-400 border-green-500/20",
};

const AGENT_MAP = {
  "ahmad@erudite-estate.com": "Ahmad",
  "manu@erudite-estate.com": "Manuchehr",
  "aizah@erudite-estate.com": "Aizah",
  "alisher@erudite-estate.com": "Alisher",
  "amna@erudite-estate.com": "Amna",
};

const BUYER_STAGES = [
  "intake_clarify",
  "contact_identity",
  "financial_qualification",
  "intent_lock",
  "unit_matching",
  "viewing",
  "objection_offer",
  "negotiation_deal_lock",
  "closing_dld",
  "closed",
];

const AGENT_EMAILS = Object.keys(AGENT_MAP);

function getAgentName(email) {
  if (!email) return "Unassigned";
  return AGENT_MAP[email] || email.split("@")[0];
}

function isAnonymous(lead) {
  return lead.full_name === "Ahmad Erudite Property";
}

function extractRespondLink(notes) {
  if (!notes) return null;
  const match = notes.match(/respond:(https?:\/\/[^\s|]+)/i);
  return match ? match[1] : null;
}

function LinkLandlordDialog({ lead, onClose, onLinked }) {
  const [landlords, setLandlords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState(false);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const ref = lead.closing_property_ref;
        let results = [];
        if (ref) {
          results = await base44.entities.Landlord.filter({ unit_reference: ref });
        }
        if (results.length === 0) {
          results = await base44.entities.Landlord.list("-created_date", 50);
        }
        setLandlords(results);
      } catch (err) {
        toast.error("Failed to load landlords");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [lead.closing_property_ref]);

  async function handleLink() {
    if (!selected) return;
    setLinking(true);
    try {
      await base44.entities.Lead.update(lead.id, { landlord_id: selected.id });
      onLinked(lead.id, selected);
      toast.success(`Linked to ${selected.full_name_en || selected.first_name || "landlord"}`);
      onClose();
    } catch (err) {
      toast.error("Failed to link landlord");
    } finally {
      setLinking(false);
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Link to Landlord</DialogTitle>
          <DialogDescription>
            {lead.closing_property_ref
              ? `Showing landlords matching listing ref: ${lead.closing_property_ref}`
              : "Select a landlord to link this lead to"}
          </DialogDescription>
        </DialogHeader>
        {loading ? (
          <div className="py-6 text-center text-sm text-muted-foreground">Loading…</div>
        ) : landlords.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">No matching landlords found</div>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {landlords.map((l) => {
              const name = l.full_name_en || [l.first_name, l.last_name].filter(Boolean).join(" ") || "Unknown";
              const isSelected = selected?.id === l.id;
              return (
                <button
                  key={l.id}
                  onClick={() => setSelected(l)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all border ${
                    isSelected
                      ? "border-accent/60 bg-accent/10 text-accent"
                      : "border-white/10 bg-white/5 hover:bg-white/8 text-foreground"
                  }`}
                >
                  <div className="font-medium">{name}</div>
                  {l.unit_reference && (
                    <div className="text-xs text-muted-foreground mt-0.5 font-mono">{l.unit_reference}</div>
                  )}
                  {l.project_name && (
                    <div className="text-xs text-muted-foreground">{l.project_name}</div>
                  )}
                </button>
              );
            })}
          </div>
        )}
        <div className="flex justify-end gap-2 mt-2">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={handleLink} disabled={!selected || linking}>
            {linking ? "Linking…" : "Link Landlord"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function PropertyFinderLeads() {
  const navigate = useNavigate();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [agentFilter, setAgentFilter] = useState("all");
  const [stageFilter, setStageFilter] = useState("all");
  const [anonFilter, setAnonFilter] = useState("all");
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [updatingStage, setUpdatingStage] = useState(null);
  const [reassigning, setReassigning] = useState(null);
  const [linkLandlordLead, setLinkLandlordLead] = useState(null);

  const loadLeads = useCallback(async () => {
    try {
      setLoading(true);
      const allLeads = await base44.entities.Lead.filter(
        { source: "property_finder" },
        "-created_date",
        300
      );
      setLeads(allLeads || []);
    } catch (err) {
      toast.error("Failed to load leads");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLeads();
  }, [loadLeads]);

  async function updateStage(leadId, newStage) {
    setUpdatingStage(leadId);
    try {
      await base44.entities.Lead.update(leadId, {
        stage: newStage,
        stage_entered_at: new Date().toISOString(),
      });
      setLeads((prev) => prev.map((l) => l.id === leadId ? { ...l, stage: newStage } : l));
    } catch (err) {
      toast.error("Failed to update stage");
    } finally {
      setUpdatingStage(null);
    }
  }

  async function reassignAgent(leadId, agentEmail) {
    setReassigning(leadId);
    try {
      await base44.entities.Lead.update(leadId, { assigned_agent_email: agentEmail });
      setLeads((prev) => prev.map((l) => l.id === leadId ? { ...l, assigned_agent_email: agentEmail } : l));
      toast.success(`Assigned to ${getAgentName(agentEmail)}`);
    } catch (err) {
      toast.error("Failed to reassign agent");
    } finally {
      setReassigning(null);
    }
  }

  async function deleteLead(leadId) {
    try {
      await base44.entities.Lead.delete(leadId);
      setLeads((prev) => prev.filter((l) => l.id !== leadId));
      setDeleteConfirm(null);
      toast.success("Lead deleted");
    } catch (err) {
      toast.error("Failed to delete lead");
    }
  }

  async function sendToPipeline(lead) {
    const nextStage = lead.stage === "intake_clarify" ? "contact_identity" : lead.stage;
    try {
      if (nextStage !== lead.stage) {
        await base44.entities.Lead.update(lead.id, {
          stage: nextStage,
          stage_entered_at: new Date().toISOString(),
        });
        setLeads((prev) => prev.map((l) => l.id === lead.id ? { ...l, stage: nextStage } : l));
      }
      toast.success("Lead sent to pipeline");
      navigate("/pipeline");
    } catch (err) {
      toast.error("Failed to push to pipeline");
    }
  }

  function handleLinked(leadId, landlord) {
    setLeads((prev) => prev.map((l) => l.id === leadId ? { ...l, landlord_id: landlord.id } : l));
  }

  async function handleSync() {
    setSyncing(true);
    try {
      const result = await base44.functions.invoke("syncPropertyFinderLeads", {});
      const data = result.data;
      const newCount = data.created_count || 0;
      toast.success(`Synced — ${newCount} new lead${newCount !== 1 ? "s" : ""}`, { duration: 3000 });
      await loadLeads();
    } catch (err) {
      toast.error("Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  const filteredLeads = leads.filter((lead) => {
    if (agentFilter !== "all" && lead.assigned_agent_email !== agentFilter) return false;
    if (stageFilter !== "all" && lead.stage !== stageFilter) return false;
    if (anonFilter === "anonymous" && !isAnonymous(lead)) return false;
    if (anonFilter === "named" && isAnonymous(lead)) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      lead.full_name?.toLowerCase().includes(q) ||
      lead.phone?.toLowerCase().includes(q) ||
      lead.closing_property_ref?.toLowerCase().includes(q) ||
      lead.pf_lead_id?.toLowerCase().includes(q)
    );
  });

  const anonymousCount = leads.filter(isAnonymous).length;
  const linkedCount = leads.filter(l => l.landlord_id).length;

  return (
    <div className="page-root">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="page-title text-2xl mb-1">Property Finder Leads</h1>
            <p className="page-subtitle">Latest 300 leads · newest first · auto-synced every 5 min</p>
          </div>
          <Button size="sm" variant="outline" onClick={handleSync} disabled={syncing} className="gap-1.5 text-xs shrink-0">
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Syncing…" : "Sync Now"}
          </Button>
        </div>

        <div className="mb-4 flex flex-col sm:flex-row gap-3 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search name, phone, listing ref, PF lead ID…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 glass-input"
            />
          </div>
          <Select value={agentFilter} onValueChange={setAgentFilter}>
            <SelectTrigger className="w-[150px] glass-input">
              <SelectValue placeholder="All Agents" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Agents</SelectItem>
              {AGENT_EMAILS.map((email) => (
                <SelectItem key={email} value={email}>{AGENT_MAP[email]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={stageFilter} onValueChange={setStageFilter}>
            <SelectTrigger className="w-[160px] glass-input">
              <SelectValue placeholder="All Stages" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Stages</SelectItem>
              {BUYER_STAGES.map((s) => (
                <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={anonFilter} onValueChange={setAnonFilter}>
            <SelectTrigger className="w-[150px] glass-input">
              <SelectValue placeholder="All Leads" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Leads</SelectItem>
              <SelectItem value="named">Named only</SelectItem>
              <SelectItem value="anonymous">Anonymous only</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="mb-5 flex items-center gap-3 flex-wrap">
          <Badge className="jewel-pill jewel-gold">{filteredLeads.length} leads</Badge>
          {anonymousCount > 0 && (
            <Badge className="jewel-pill jewel-rose">
              <UserX className="w-3 h-3" />
              {anonymousCount} anonymous
            </Badge>
          )}
          {linkedCount > 0 && (
            <Badge className="jewel-pill jewel-emerald">
              <Link2 className="w-3 h-3" />
              {linkedCount} linked to landlord
            </Badge>
          )}
          {leads.length > filteredLeads.length && (
            <span className="text-xs text-muted-foreground">{leads.length - filteredLeads.length} filtered out</span>
          )}
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Loading leads…</p>
          </div>
        ) : filteredLeads.length === 0 ? (
          <div className="text-center py-16 glass-card rounded-lg">
            <p className="text-muted-foreground">No Property Finder leads found</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {filteredLeads.map((lead) => {
              const respondLink = extractRespondLink(lead.notes);
              const anonymous = isAnonymous(lead);
              const stageColor = STAGE_COLORS[lead.stage] || STAGE_COLORS.intake_clarify;
              const isLinked = !!lead.landlord_id;

              return (
                <div
                  key={lead.id}
                  className={`glass-card rounded-lg p-4 transition-all ${anonymous ? "border-l-2 border-l-amber-500/40" : isLinked ? "border-l-2 border-l-emerald-500/40" : ""}`}
                >
                  <div className="flex items-start gap-3">
                    <LetterAvatar name={lead.full_name} size="9" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm text-foreground">
                            {anonymous ? (
                              <span className="flex items-center gap-1.5">
                                <UserX className="w-3.5 h-3.5 text-amber-400" />
                                <span className="text-amber-400/80 italic">Anonymous buyer</span>
                              </span>
                            ) : lead.full_name}
                          </span>
                          {lead.phone && !anonymous && (
                            <span className="text-xs text-muted-foreground">{lead.phone}</span>
                          )}
                          {isLinked && (
                            <span className="flex items-center gap-1 text-xs text-emerald-400">
                              <CheckCircle2 className="w-3 h-3" /> Landlord linked
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                          <Badge className={stageColor + " text-xs px-1.5 py-0"}>{lead.stage?.replace(/_/g, " ")}</Badge>
                          <Badge className="jewel-pill jewel-gold text-xs">{getAgentName(lead.assigned_agent_email)}</Badge>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 mb-2.5 text-xs text-muted-foreground flex-wrap">
                        {lead.closing_property_ref ? (
                          <span className="font-mono bg-white/5 px-1.5 py-0.5 rounded">{lead.closing_property_ref}</span>
                        ) : (
                          <span className="opacity-40">No listing ref</span>
                        )}
                        {respondLink && (
                          <a href={respondLink} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline flex items-center gap-1">
                            Respond on PF <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                        <span className="ml-auto opacity-50">
                          {new Date(lead.created_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        {!anonymous && lead.phone && (
                          <>
                            <a href={`https://wa.me/${lead.phone.replace(/^\+/, "")}`} target="_blank" rel="noopener noreferrer">
                              <Button size="sm" variant="outline" className="h-7 gap-1 text-xs px-2">
                                <MessageCircle className="w-3 h-3" /> WA
                              </Button>
                            </a>
                            <a href={`tel:${lead.phone}`}>
                              <Button size="sm" variant="outline" className="h-7 gap-1 text-xs px-2">
                                <Phone className="w-3 h-3" /> Call
                              </Button>
                            </a>
                          </>
                        )}
                        <Button size="sm" variant="outline" className="h-7 gap-1 text-xs px-2 text-accent border-accent/30 hover:bg-accent/10" onClick={() => sendToPipeline(lead)}>
                          <ArrowRight className="w-3 h-3" /> Pipeline
                        </Button>
                        <Button size="sm" variant="outline" className={`h-7 gap-1 text-xs px-2 ${isLinked ? "text-emerald-400 border-emerald-500/30" : "text-muted-foreground"}`} onClick={() => setLinkLandlordLead(lead)}>
                          <Link2 className="w-3 h-3" />
                          {isLinked ? "Re-link" : "Link Landlord"}
                        </Button>
                        <Select value={lead.stage} onValueChange={(v) => updateStage(lead.id, v)} disabled={updatingStage === lead.id}>
                          <SelectTrigger className="h-7 w-36 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {BUYER_STAGES.map((s) => (
                              <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select value={lead.assigned_agent_email || ""} onValueChange={(v) => reassignAgent(lead.id, v)} disabled={reassigning === lead.id}>
                          <SelectTrigger className="h-7 w-32 text-xs">
                            <SelectValue placeholder="Assign…" />
                          </SelectTrigger>
                          <SelectContent>
                            {AGENT_EMAILS.map((email) => (
                              <SelectItem key={email} value={email}>{AGENT_MAP[email]}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive ml-auto" onClick={() => setDeleteConfirm(lead.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Lead?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete this Property Finder lead. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteLead(deleteConfirm)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {linkLandlordLead && (
        <LinkLandlordDialog
          lead={linkLandlordLead}
          onClose={() => setLinkLandlordLead(null)}
          onLinked={handleLinked}
        />
      )}
    </div>
  );
}