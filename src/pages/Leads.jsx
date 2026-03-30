import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Plus, Search, Filter, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import { format } from 'date-fns';
import PageHeader from '@/components/shared/PageHeader';
import LeadScoreBadge from '@/components/shared/LeadScoreBadge';
import SourceBadge from '@/components/shared/SourceBadge';
import LeadDetailSheet from '@/components/leads/LeadDetailSheet';
import AddLeadDialog from '@/components/leads/AddLeadDialog';
import { PIPELINE_STAGES, formatAED, LEAD_TYPE_LABELS } from '@/lib/constants';

export default function Leads() {
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [selectedLead, setSelectedLead] = useState(null);
  const [showAddLead, setShowAddLead] = useState(false);

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['leads'],
    queryFn: () => base44.entities.Lead.list('-created_date', 500),
  });

  const filtered = leads.filter(l => {
    const matchSearch = !search ||
      l.name?.toLowerCase().includes(search.toLowerCase()) ||
      l.phone?.includes(search) ||
      l.email?.toLowerCase().includes(search.toLowerCase());
    const matchStage = stageFilter === 'all' || l.stage === stageFilter;
    const matchSource = sourceFilter === 'all' || l.source === sourceFilter;
    return matchSearch && matchStage && matchSource;
  });

  return (
    <div className="p-4 md:p-8 max-w-[1600px] mx-auto">
      <PageHeader title="Leads" subtitle={`${filtered.length} leads total`}>
        <Button size="sm" onClick={() => setShowAddLead(true)} className="bg-accent text-accent-foreground hover:bg-accent/90">
          <Plus className="w-4 h-4 mr-1" /> Add Lead
        </Button>
      </PageHeader>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, phone, email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <Select value={stageFilter} onValueChange={setStageFilter}>
          <SelectTrigger className="w-40 h-9"><SelectValue placeholder="Stage" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Stages</SelectItem>
            {PIPELINE_STAGES.map(s => (
              <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger className="w-40 h-9"><SelectValue placeholder="Source" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sources</SelectItem>
            <SelectItem value="property_finder">Property Finder</SelectItem>
            <SelectItem value="bayut">Bayut</SelectItem>
            <SelectItem value="whatsapp">WhatsApp</SelectItem>
            <SelectItem value="referral">Referral</SelectItem>
            <SelectItem value="website">Website</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="text-xs">Name</TableHead>
                <TableHead className="text-xs">Contact</TableHead>
                <TableHead className="text-xs">Source</TableHead>
                <TableHead className="text-xs">Stage</TableHead>
                <TableHead className="text-xs">Score</TableHead>
                <TableHead className="text-xs">Budget</TableHead>
                <TableHead className="text-xs">Type</TableHead>
                <TableHead className="text-xs">Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(lead => {
                const stage = PIPELINE_STAGES.find(s => s.id === lead.stage);
                return (
                  <TableRow
                    key={lead.id}
                    className="cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={() => setSelectedLead(lead)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center text-xs font-bold text-accent shrink-0">
                          {lead.name?.[0]?.toUpperCase()}
                        </div>
                        <span className="font-medium text-sm">{lead.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-xs">
                        <p>{lead.phone}</p>
                        <p className="text-muted-foreground">{lead.email}</p>
                      </div>
                    </TableCell>
                    <TableCell><SourceBadge source={lead.source} /></TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px] capitalize">
                        {stage?.label || lead.stage}
                      </Badge>
                    </TableCell>
                    <TableCell><LeadScoreBadge score={lead.lead_score} /></TableCell>
                    <TableCell className="text-sm">{formatAED(lead.budget_aed)}</TableCell>
                    <TableCell>
                      <span className="text-xs capitalize text-muted-foreground">
                        {LEAD_TYPE_LABELS[lead.type] || lead.type}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {lead.created_date && format(new Date(lead.created_date), 'MMM d, yyyy')}
                    </TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                    {isLoading ? 'Loading...' : 'No leads found'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {selectedLead && (
        <LeadDetailSheet lead={selectedLead} open={!!selectedLead} onClose={() => setSelectedLead(null)} />
      )}
      <AddLeadDialog open={showAddLead} onClose={() => setShowAddLead(false)} />
    </div>
  );
}