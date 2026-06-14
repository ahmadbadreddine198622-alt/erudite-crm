import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
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
import { Phone, MessageCircle, Trash2, Search, ExternalLink, RefreshCw } from "lucide-react";
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

const AGENT_NAMES = {
  "ahmad@erudite-estate.com": "Ahmad",
  "manu@erudite-estate.com": "Manuchehr",
  "aizah@erudite-estate.com": "Aizah",
  "alisher@erudite-estate.com": "Alisher",
  "amna@erudite-estate.com": "Amna",
};

function getAgentName(email) {
  if (!email) return "Unassigned";
  const name = AGENT_NAMES[email];
  if (name) return name;
  return email.split("@")[0] || email;
}

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

function extractPFLinks(notes) {
  if (!notes) return { respondLink: null, listingLink: null };
  const respondMatch = notes.match(/respond:(https?:\/\/[^\s]+)/i);
  const listingMatch = notes.match(/listing:([^\s|]+)/i);
  return {
    respondLink: respondMatch ? respondMatch[1] : null,
    listingLink: listingMatch ? listingMatch[1] : null,
  };
}

export default function PropertyFinderLeads() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [updatingStage, setUpdatingStage] = useState(null);

  useEffect(() => {
    loadLeads();
  }, []);

  async function loadLeads() {
    try {
      setLoading(true);
      const allLeads = await base44.entities.Lead.filter(
        { source: "property_finder" },
        "-created_date"
      );
      setLeads(allLeads || []);
    } catch (err) {
      console.error("Failed to load PF leads:", err);
    } finally {
      setLoading(false);
    }
  }

  async function updateStage(leadId, newStage) {
    setUpdatingStage(leadId);
    try {
      await base44.entities.Lead.update(leadId, {
        stage: newStage,
        stage_entered_at: new Date().toISOString(),
      });
      setLeads((prev) =>
        prev.map((l) =>
          l.id === leadId
            ? { ...l, stage: newStage, stage_entered_at: new Date().toISOString() }
            : l
        )
      );
    } catch (err) {
      console.error("Failed to update stage:", err);
    } finally {
      setUpdatingStage(null);
    }
  }

  async function deleteLead(leadId) {
    try {
      await base44.entities.Lead.delete(leadId);
      setLeads((prev) => prev.filter((l) => l.id !== leadId));
      setDeleteConfirm(null);
    } catch (err) {
      console.error("Failed to delete lead:", err);
    }
  }

  async function handleSync() {
    setSyncing(true);
    try {
      const result = await base44.functions.invoke("syncPropertyFinderLeads", {});
      const data = result.data;
      const newCount = data.created_count || 0;
      const updatedCount = data.skipped_count || 0;
      
      toast.success(
        `Synced — ${newCount} new lead${newCount !== 1 ? "s" : ""}${updatedCount > 0 ? `, ${updatedCount} updated` : ""}`,
        { duration: 3000 }
      );
      
      await loadLeads();
    } catch (err) {
      console.error("Sync failed:", err);
      toast.error("Sync failed — check console for details", { duration: 4000 });
    } finally {
      setSyncing(false);
    }
  }

  const filteredLeads = leads.filter((lead) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      lead.full_name?.toLowerCase().includes(q) ||
      lead.phone?.toLowerCase().includes(q) ||
      lead.closing_property_ref?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="page-root">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="page-title text-2xl mb-2">Property Finder Leads</h1>
          <p className="page-subtitle">
            Triage and qualify Property Finder buyer leads
          </p>
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by buyer name, phone, or listing reference..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 glass-input max-w-md"
            />
          </div>
          <div className="mt-3 flex items-center gap-2">
            <Badge variant="outline" className="jewel-pill jewel-gold">
              {filteredLeads.length} leads
            </Badge>
            {leads.length > 0 && (
              <span className="text-xs text-muted-foreground">
                {leads.length - filteredLeads.length} filtered out
              </span>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={handleSync}
              disabled={syncing}
              className="h-7 gap-1.5 text-xs ml-auto"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Syncing…" : "Refresh"}
            </Button>
          </div>
        </div>

        {/* Leads List */}
        {loading ? (
          <div className="text-center py-12">
            <div className="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Loading leads...</p>
          </div>
        ) : filteredLeads.length === 0 ? (
          <div className="text-center py-16 glass-card rounded-lg">
            <p className="text-muted-foreground mb-2">No Property Finder leads found</p>
            <p className="text-xs text-muted-foreground/60">
              Leads synced from Property Finder API will appear here
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredLeads.map((lead) => {
              const { respondLink, listingLink } = extractPFLinks(lead.notes);
              const stageColor = STAGE_COLORS[lead.stage] || STAGE_COLORS.intake_clarify;

              return (
                <div
                  key={lead.id}
                  className="glass-card rounded-lg p-4 hover:bg-white/8 transition-all"
                >
                  <div className="flex items-start gap-4">
                    {/* Avatar */}
                    <LetterAvatar
                      name={lead.full_name}
                      size="md"
                      showPhoto={false}
                    />

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div>
                          <h3 className="font-semibold text-foreground mb-1">
                            {lead.full_name}
                          </h3>
                          <div className="flex items-center gap-3 text-sm text-muted-foreground">
                            <a
                              href={`tel:${lead.phone}`}
                              className="hover:text-accent transition-colors"
                            >
                              {lead.phone}
                            </a>
                            {lead.email && (
                              <span className="truncate">{lead.email}</span>
                            )}
                          </div>
                        </div>
                        <Badge className={stageColor}>{lead.stage.replace(/_/g, " ")}</Badge>
                      </div>

                      {/* Property Reference & Links */}
                      <div className="flex items-center gap-3 mb-3 text-xs">
                        {lead.closing_property_ref && (
                          <span className="text-muted-foreground">
                            📍 {lead.closing_property_ref}
                          </span>
                        )}
                        {respondLink && (
                          <a
                            href={respondLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-accent hover:underline flex items-center gap-1"
                          >
                            Respond <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                        {listingLink && (
                          <span className="text-muted-foreground/60">
                            Listing: {listingLink}
                          </span>
                        )}
                        <span className="text-muted-foreground/40 ml-auto">
                          {new Date(lead.created_date).toLocaleDateString("en-GB", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        <a
                          href={`https://wa.me/${lead.phone?.replace(/^\+/, "")}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 gap-1.5 text-xs"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            WhatsApp
                          </Button>
                        </a>
                        <a href={`tel:${lead.phone}`}>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 gap-1.5 text-xs"
                          >
                            <Phone className="w-3.5 h-3.5" />
                            Call
                          </Button>
                        </a>
                        <Select
                          value={lead.stage}
                          onValueChange={(value) => updateStage(lead.id, value)}
                          disabled={updatingStage === lead.id}
                        >
                          <SelectTrigger className="h-8 w-40 text-xs">
                            <SelectValue placeholder="Select stage" />
                          </SelectTrigger>
                          <SelectContent>
                            {BUYER_STAGES.map((stage) => (
                              <SelectItem key={stage} value={stage}>
                                {stage.replace(/_/g, " ")}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 gap-1.5 text-xs text-destructive hover:text-destructive"
                          onClick={() => setDeleteConfirm(lead.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Delete
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Lead?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this Property Finder lead. This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteLead(deleteConfirm)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}