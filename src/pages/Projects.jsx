import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Building2, ChevronLeft, Users, LayoutList, TrendingUp, MapPin, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import PageHeader from '@/components/shared/PageHeader';
import SourceBadge from '@/components/shared/SourceBadge';
import LeadDetailSheet from '@/components/leads/LeadDetailSheet';

function formatAED(val) {
  if (!val || val <= 0) return '—';
  if (val >= 1_000_000) return `AED ${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `AED ${Math.round(val / 1_000)}K`;
  return `AED ${val}`;
}

export default function Projects() {
  const [selectedProject, setSelectedProject] = useState(null);
  const [selectedLead, setSelectedLead] = useState(null);

  const { data: projects = [], isLoading: projectsLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => base44.entities.Project.list('name', 200),
  });

  const { data: leads = [] } = useQuery({
    queryKey: ['leads'],
    queryFn: () => base44.entities.Lead.list('-created_date', 2000),
  });

  const { data: listings = [] } = useQuery({
    queryKey: ['pf-listings-projects'],
    queryFn: () => base44.entities.PFListing.list('-updated_date', 2000),
  });

  // Per-project stats
  const projectStats = useMemo(() => {
    const stats = {};
    for (const p of projects) {
      const projectLeads = leads.filter(l => l.project_id === p.id && l.status !== 'lost');
      const projectListings = listings.filter(l => l.project_id === p.id);
      stats[p.id] = {
        leadCount: projectLeads.length,
        unitCount: projectListings.length,
        totalValue: projectLeads.reduce((sum, l) => sum + (l.deal_value_aed || 0), 0),
      };
    }
    return stats;
  }, [projects, leads, listings]);

  // Detail view data
  const projectLeads = useMemo(() => {
    if (!selectedProject) return [];
    return leads.filter(l => l.project_id === selectedProject.id);
  }, [leads, selectedProject]);

  const projectListings = useMemo(() => {
    if (!selectedProject) return [];
    return listings.filter(l => l.project_id === selectedProject.id);
  }, [listings, selectedProject]);

  if (projectsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-accent/30 border-t-accent rounded-full animate-spin" />
      </div>
    );
  }

  // ── Detail View ──
  if (selectedProject) {
    const stats = projectStats[selectedProject.id] || {};
    return (
      <div className="p-4 md:p-6 max-w-[1400px] mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="sm" onClick={() => setSelectedProject(null)} className="gap-1">
            <ChevronLeft className="w-4 h-4" /> All Projects
          </Button>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center">
              <Building2 className="w-4 h-4 text-accent" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">{selectedProject.name}</h1>
              {selectedProject.location && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <MapPin className="w-3 h-3" />{selectedProject.location}
                </p>
              )}
            </div>
            <Badge variant={selectedProject.status === 'active' ? 'default' : 'secondary'} className="ml-2">
              {selectedProject.status}
            </Badge>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> Active Leads</p>
              <p className="text-2xl font-bold">{projectLeads.filter(l => l.status !== 'lost').length}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{projectLeads.length} total</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1.5"><LayoutList className="w-3.5 h-3.5" /> Units / Listings</p>
              <p className="text-2xl font-bold">{projectListings.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1.5"><TrendingUp className="w-3.5 h-3.5" /> Pipeline Value</p>
              <p className="text-xl font-bold text-blue-600">{formatAED(stats.totalValue)}</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="leads">
          <TabsList>
            <TabsTrigger value="leads">Leads ({projectLeads.length})</TabsTrigger>
            <TabsTrigger value="units">Units ({projectListings.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="leads" className="mt-4">
            <Card className="overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="text-xs">Name</TableHead>
                    <TableHead className="text-xs">Intent</TableHead>
                    <TableHead className="text-xs">Stage</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs">Agent</TableHead>
                    <TableHead className="text-xs">Deal (AED)</TableHead>
                    <TableHead className="text-xs">Source</TableHead>
                    <TableHead className="text-xs">Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projectLeads.map(lead => (
                    <TableRow key={lead.id} className="cursor-pointer hover:bg-muted/30" onClick={() => setSelectedLead(lead)}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-accent/10 flex items-center justify-center text-xs font-bold text-accent shrink-0">
                            {(lead.full_name || lead.name || '?')[0].toUpperCase()}
                          </div>
                          <span className="text-sm font-medium">{lead.full_name || lead.name || 'Unknown'}</span>
                        </div>
                      </TableCell>
                      <TableCell><span className="text-xs capitalize">{lead.intent || '—'}</span></TableCell>
                      <TableCell><span className="text-xs text-muted-foreground">{lead.stage?.replace(/_/g, ' ') || '—'}</span></TableCell>
                      <TableCell>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded border ${lead.status === 'active' ? 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20' : lead.status === 'lost' ? 'bg-red-500/10 text-red-700 border-red-500/20' : 'bg-amber-500/10 text-amber-700 border-amber-500/20'}`}>
                          {lead.status || '—'}
                        </span>
                      </TableCell>
                      <TableCell><span className="text-xs text-muted-foreground">{lead.assigned_agent_name || '—'}</span></TableCell>
                      <TableCell>
                        {lead.deal_value_aed > 0
                          ? <span className="text-xs font-semibold text-blue-600">{formatAED(lead.deal_value_aed)}</span>
                          : <span className="text-xs text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell><SourceBadge source={lead.source} /></TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {lead.created_date ? format(new Date(lead.created_date), 'MMM d, yy') : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                  {projectLeads.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-10 text-muted-foreground text-sm">
                        No leads tagged to this project yet
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          <TabsContent value="units" className="mt-4">
            <Card className="overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="text-xs">Title</TableHead>
                    <TableHead className="text-xs">Type</TableHead>
                    <TableHead className="text-xs">Beds</TableHead>
                    <TableHead className="text-xs">Price (AED)</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs">Agent</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projectListings.map(listing => (
                    <TableRow key={listing.id}>
                      <TableCell className="text-sm font-medium">{listing.title || listing.reference_number || '—'}</TableCell>
                      <TableCell className="text-xs capitalize">{listing.property_type || '—'}</TableCell>
                      <TableCell className="text-xs">{listing.bedrooms ?? '—'}</TableCell>
                      <TableCell className="text-xs font-semibold">{listing.price ? formatAED(listing.price) : '—'}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">{listing.status || '—'}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{listing.agent_name || '—'}</TableCell>
                    </TableRow>
                  ))}
                  {projectListings.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-10 text-muted-foreground text-sm">
                        No units tagged to this project yet
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>
        </Tabs>

        {selectedLead && (
          <LeadDetailSheet lead={selectedLead} open={!!selectedLead} onClose={() => setSelectedLead(null)} />
        )}
      </div>
    );
  }

  // ── Grid View ──
  return (
    <div className="p-4 md:p-6 max-w-[1400px] mx-auto">
      <PageHeader title="Projects" subtitle={`${projects.length} development${projects.length !== 1 ? 's' : ''}`} />

      {projects.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Building2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No projects yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {projects.map(project => {
            const stats = projectStats[project.id] || {};
            return (
              <Card
                key={project.id}
                className="cursor-pointer hover:border-accent/50 hover:shadow-md transition-all"
                onClick={() => setSelectedProject(project)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-sm font-semibold leading-tight">{project.name}</CardTitle>
                      {project.location && (
                        <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                          <MapPin className="w-3 h-3" />{project.location}
                        </p>
                      )}
                    </div>
                    <Badge variant={project.status === 'active' ? 'default' : 'secondary'} className="text-[10px] shrink-0">
                      {project.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pb-4">
                  <div className="grid grid-cols-3 gap-2 mt-1">
                    <div className="text-center">
                      <p className="text-lg font-bold">{stats.leadCount || 0}</p>
                      <p className="text-[10px] text-muted-foreground">Leads</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold">{stats.unitCount || 0}</p>
                      <p className="text-[10px] text-muted-foreground">Units</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs font-bold text-blue-600 leading-tight">
                        {stats.totalValue >= 1_000_000 ? `${(stats.totalValue / 1_000_000).toFixed(1)}M` : stats.totalValue > 0 ? `${Math.round(stats.totalValue / 1000)}K` : '—'}
                      </p>
                      <p className="text-[10px] text-muted-foreground">Pipeline</p>
                    </div>
                  </div>
                  {project.developer && (
                    <p className="text-[10px] text-muted-foreground mt-3 truncate">{project.developer}</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}