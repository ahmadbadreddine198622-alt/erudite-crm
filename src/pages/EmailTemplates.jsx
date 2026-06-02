import React, { useState } from 'react';
import EruditePage from '@/components/erudite/EruditePage';
import EruditeCard from '@/components/erudite/EruditeCard';
import EruditeSection from '@/components/erudite/EruditeSection';
import EruditeStat from '@/components/erudite/EruditeStat';
import EruditeBadge from '@/components/erudite/EruditeBadge';
import EruditeButton from '@/components/erudite/EruditeButton';
import EruditeEmptyState from '@/components/erudite/EruditeEmptyState';
import EruditeTable from '@/components/erudite/EruditeTable';
import { FileBox, Plus, Mail, Edit2, TrendingUp, Copy } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

export default function EmailTemplates() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);

  const queryClient = useQueryClient();

  // Templates would need a new entity - using Notes as placeholder for now
  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['emailTemplates'],
    queryFn: async () => {
      // For now, return empty - would need EmailTemplate entity
      return [];
    },
  });

  const stats = {
    total: 24,
    usedThisWeek: 156,
    avgOpenRate: 68,
    avgReplyRate: 34,
  };

  const tableColumns = [
    { header: 'Template Name', accessor: 'name' },
    { header: 'Category', accessor: 'category' },
    { header: 'Last Used', accessor: (row) => row.last_used || 'Never' },
    { header: 'Usage Count', accessor: (row) => row.usage_count || 0 },
    {
      header: 'Actions',
      accessor: (row) => (
        <div className="flex gap-2">
          <button className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
            <Edit2 className="w-4 h-4" />
          </button>
          <button className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
            <Copy className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <EruditePage
      title="Email Templates"
      subtitle="Pre-built email templates for common scenarios"
      actions={
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <EruditeButton icon={Plus}>Create Template</EruditeButton>
          </DialogTrigger>
          <DialogContent className="max-w-3xl bg-[#0F1419] border-white/10">
            <DialogHeader>
              <DialogTitle className="text-xl font-display">
                {editingTemplate ? 'Edit Template' : 'Create Email Template'}
              </DialogTitle>
            </DialogHeader>
            <CreateTemplateForm 
              onSubmit={(data) => {
                toast.success('Template created (placeholder)');
                setIsDialogOpen(false);
              }} 
              onCancel={() => setIsDialogOpen(false)} 
            />
          </DialogContent>
        </Dialog>
      }
    >
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <EruditeCard>
          <div className="p-5 space-y-3">
            <EruditeStat label="Total Templates" value={stats.total.toString()} />
          </div>
        </EruditeCard>
        <EruditeCard>
          <div className="p-5 space-y-3">
            <EruditeStat label="Used This Week" value={stats.usedThisWeek.toString()} trend="up" trendValue="+23%" />
          </div>
        </EruditeCard>
        <EruditeCard>
          <div className="p-5 space-y-3">
            <EruditeStat label="Avg. Open Rate" value={`${stats.avgOpenRate}%`} trend="up" trendValue="+4%" />
          </div>
        </EruditeCard>
        <EruditeCard>
          <div className="p-5 space-y-3">
            <EruditeStat label="Avg. Reply Rate" value={`${stats.avgReplyRate}%`} trend="up" trendValue="+2%" />
          </div>
        </EruditeCard>
      </div>

      {/* Main Content */}
      <EruditeSection title="Template Library" subtitle="Collection" icon={Mail}>
        <EruditeEmptyState
          icon={FileBox}
          title="No templates yet"
          description="Create your first email template to save time on common communications"
          action={
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <EruditeButton variant="primary">Create First Template</EruditeButton>
              </DialogTrigger>
            </Dialog>
          }
        />
      </EruditeSection>
    </EruditePage>
  );
}

// Create Template Form
function CreateTemplateForm({ onSubmit, onCancel }) {
  const [formData, setFormData] = useState({
    name: '',
    subject: '',
    body: '',
    category: 'general',
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 mt-4">
      <div className="space-y-2">
        <Label className="text-white/80">Template Name</Label>
        <Input
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="e.g., Property Inquiry Response"
          className="glass-input"
          required
        />
      </div>

      <div className="space-y-2">
        <Label className="text-white/80">Email Subject</Label>
        <Input
          value={formData.subject}
          onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
          placeholder="Email subject line"
          className="glass-input"
          required
        />
      </div>

      <div className="space-y-2">
        <Label className="text-white/80">Email Body</Label>
        <Textarea
          value={formData.body}
          onChange={(e) => setFormData({ ...formData, body: e.target.value })}
          placeholder="Email content (use {{name}} for personalization)"
          className="glass-input min-h-[200px] font-mono text-sm"
          required
        />
      </div>

      <div className="flex gap-3 pt-4">
        <EruditeButton type="button" variant="secondary" onClick={onCancel} className="flex-1">
          Cancel
        </EruditeButton>
        <EruditeButton type="submit" variant="primary" className="flex-1">
          Create Template
        </EruditeButton>
      </div>
    </form>
  );
}