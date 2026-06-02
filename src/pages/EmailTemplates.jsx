import React, { useState } from 'react';
import iOSCard from '@/components/ios/iOSCard';
import iOSBadge from '@/components/ios/iOSBadge';
import { FileBox, Plus, Mail, Edit2, TrendingUp, Copy } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

export default function EmailTemplates() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);

  const stats = {
    total: 24,
    usedThisWeek: 156,
    avgOpenRate: 68,
    avgReplyRate: 34,
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Email Templates</h1>
            <p className="text-gray-500 mt-1">Pre-built email templates for common scenarios</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <button className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors">
                <Plus className="w-4 h-4" />
                Create Template
              </button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl">
              <DialogHeader>
                <DialogTitle>
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
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <iOSCard className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-gray-500 uppercase">Total Templates</span>
              <FileBox className="w-4 h-4 text-gray-400" />
            </div>
            <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
          </iOSCard>
          <iOSCard className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-gray-500 uppercase">Used This Week</span>
              <Mail className="w-4 h-4 text-gray-400" />
            </div>
            <p className="text-3xl font-bold text-gray-900">{stats.usedThisWeek}</p>
            <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              +23%
            </p>
          </iOSCard>
          <iOSCard className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-gray-500 uppercase">Avg. Open Rate</span>
              <TrendingUp className="w-4 h-4 text-gray-400" />
            </div>
            <p className="text-3xl font-bold text-gray-900">{stats.avgOpenRate}%</p>
            <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              +4%
            </p>
          </iOSCard>
          <iOSCard className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-gray-500 uppercase">Avg. Reply Rate</span>
              <TrendingUp className="w-4 h-4 text-gray-400" />
            </div>
            <p className="text-3xl font-bold text-gray-900">{stats.avgReplyRate}%</p>
            <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              +2%
            </p>
          </iOSCard>
        </div>

        {/* Main Content */}
        <iOSCard className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-blue-100">
              <Mail className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Template Library</h2>
              <p className="text-sm text-gray-500">Collection</p>
            </div>
          </div>

          <div className="flex flex-col items-center justify-center py-16 px-8 rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50">
            <FileBox className="w-12 h-12 mb-4 text-gray-400" />
            <h3 className="text-lg font-medium mb-2 text-gray-700">No templates yet</h3>
            <p className="text-sm text-center max-w-md text-gray-500">
              Create your first email template to save time on common communications
            </p>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <button className="mt-4 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors">
                  Create First Template
                </button>
              </DialogTrigger>
            </Dialog>
          </div>
        </iOSCard>
      </div>
    </div>
  );
}

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
        <Label>Template Name</Label>
        <Input
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="e.g., Property Inquiry Response"
          required
        />
      </div>

      <div className="space-y-2">
        <Label>Email Subject</Label>
        <Input
          value={formData.subject}
          onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
          placeholder="Email subject line"
          required
        />
      </div>

      <div className="space-y-2">
        <Label>Email Body</Label>
        <Textarea
          value={formData.body}
          onChange={(e) => setFormData({ ...formData, body: e.target.value })}
          placeholder="Email content (use {{name}} for personalization)"
          className="min-h-[200px] font-mono text-sm"
          required
        />
      </div>

      <div className="flex gap-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 px-4 py-2 border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
        >
          Create Template
        </button>
      </div>
    </form>
  );
}