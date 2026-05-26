import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { FileText, Star, Plus, Search, MoreVertical, Edit, Trash2, Copy } from 'lucide-react';
import { toast } from 'sonner';

const CATEGORIES = [
  { value: 'greeting', label: 'Greeting' },
  { value: 'viewing', label: 'Viewing' },
  { value: 'pricing', label: 'Pricing' },
  { value: 'property_info', label: 'Property Info' },
  { value: 'negotiation', label: 'Negotiation' },
  { value: 'follow_up', label: 'Follow Up' },
  { value: 'closing', label: 'Closing' },
  { value: 'custom', label: 'Custom' },
];

export default function TemplateManager() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);

  const { data: templates = [] } = useQuery({
    queryKey: ['reply_templates'],
    queryFn: () => base44.entities.ReplyTemplate.list('-is_favorite', 100),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.ReplyTemplate.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reply_templates'] });
      toast.success('Template created');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ReplyTemplate.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reply_templates'] });
      toast.success('Template updated');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ReplyTemplate.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reply_templates'] });
      toast.success('Template deleted');
    },
  });

  const toggleFavorite = (template) => {
    updateMutation.mutate({
      id: template.id,
      data: { is_favorite: !template.is_favorite },
    });
  };

  const filtered = templates.filter(t => {
    const matchesSearch = t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.body.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || t.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search templates..."
            className="pl-9"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="w-32">
              {selectedCategory === 'all' ? 'All Categories' : CATEGORIES.find(c => c.value === selectedCategory)?.label}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => setSelectedCategory('all')}>All Categories</DropdownMenuItem>
            {CATEGORIES.map(cat => (
              <DropdownMenuItem key={cat.value} onClick={() => setSelectedCategory(cat.value)}>
                {cat.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <Dialog open={showAddDialog || !!editingTemplate} onOpenChange={(open) => {
          setShowAddDialog(open);
          if (!open) setEditingTemplate(null);
        }}>
          <DialogTrigger asChild>
            <Button onClick={() => setShowAddDialog(true)} className="gap-2">
              <Plus className="w-4 h-4" />
              New Template
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingTemplate ? 'Edit Template' : 'Create New Template'}
              </DialogTitle>
            </DialogHeader>
            <TemplateForm
              template={editingTemplate}
              onSave={(data) => {
                if (editingTemplate) {
                  updateMutation.mutate({ id: editingTemplate.id, data });
                } else {
                  createMutation.mutate(data);
                }
                setShowAddDialog(false);
                setEditingTemplate(null);
              }}
              onCancel={() => {
                setShowAddDialog(false);
                setEditingTemplate(null);
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Templates Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map(template => (
          <Card key={template.id} className="group relative">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-sm flex items-center gap-2">
                    {template.name}
                    {template.is_favorite && <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />}
                  </CardTitle>
                  <CardDescription className="text-xs mt-1">
                    <Badge variant="outline" className="text-[10px]">
                      {template.category}
                    </Badge>
                  </CardDescription>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity">
                      <MoreVertical className="w-3.5 h-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => toggleFavorite(template)}>
                      {template.is_favorite ? 'Remove from Favorites' : 'Add to Favorites'}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => {
                      navigator.clipboard.writeText(template.body);
                      toast.success('Copied to clipboard');
                    }}>
                      Copy Text
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setEditingTemplate(template)}>
                      Edit Template
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => deleteMutation.mutate(template.id)}
                      className="text-red-600"
                    >
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground line-clamp-3 mb-3">
                {template.body}
              </p>
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span>Used {template.usage_count || 0} times</span>
                {template.created_by && <span>by {template.created_by}</span>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <FileText className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p className="text-sm">No templates found</p>
          <Button
            variant="link"
            onClick={() => setShowAddDialog(true)}
            className="mt-2"
          >
            Create your first template
          </Button>
        </div>
      )}
    </div>
  );
}

function TemplateForm({ template, onSave, onCancel }) {
  const [name, setName] = useState(template?.name || '');
  const [category, setCategory] = useState(template?.category || 'custom');
  const [body, setBody] = useState(template?.body || '');
  const [isFavorite, setIsFavorite] = useState(template?.is_favorite || false);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      name,
      category,
      body,
      is_favorite: isFavorite,
      placeholders: extractPlaceholders(body),
    });
  };

  const extractPlaceholders = (text) => {
    const matches = text.match(/{\w+}/g) || [];
    return [...new Set(matches)];
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium">Template Name</label>
          <Input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g., Viewing Confirmation"
            required
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Category</label>
          <select
            value={category}
            onChange={e => setCategory(e.target.value)}
            className="w-full h-10 px-3 border rounded-md text-sm"
          >
            {CATEGORIES.map(cat => (
              <option key={cat.value} value={cat.value}>{cat.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Message Body</label>
        <Textarea
          value={body}
          onChange={e => setBody(e.target.value)}
          placeholder="Hi {name}, your viewing for {property} is scheduled on {date} at {time}..."
          className="min-h-[150px]"
          required
        />
        <p className="text-xs text-muted-foreground">
          Use placeholders like {'{name}'}, {'{property}'}, {'{date}'}, {'{time}'}, {'{price}'}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="favorite"
          checked={isFavorite}
          onChange={e => setIsFavorite(e.target.checked)}
          className="h-4 w-4 rounded border-gray-300"
        />
        <label htmlFor="favorite" className="text-sm">Mark as favorite</label>
      </div>

      <div className="flex gap-2 justify-end pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">
          {template ? 'Update' : 'Create'} Template
        </Button>
      </div>
    </form>
  );
}