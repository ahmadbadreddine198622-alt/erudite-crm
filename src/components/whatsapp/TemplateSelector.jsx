import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { FileText, Star, Plus } from 'lucide-react';
import AddTemplateDialog from './AddTemplateDialog';

export default function TemplateSelector({ onSelectTemplate }) {
  const [showAddDialog, setShowAddDialog] = useState(false);

  const { data: templates = [] } = useQuery({
    queryKey: ['reply_templates'],
    queryFn: () => base44.entities.ReplyTemplate.list('-is_favorite', 20),
  });

  const favorites = templates.filter(t => t.is_favorite);
  const byCategory = {};
  templates.forEach(t => {
    if (!byCategory[t.category]) byCategory[t.category] = [];
    byCategory[t.category].push(t);
  });

  const handleSelectTemplate = (template) => {
    onSelectTemplate(template.body);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="outline" className="gap-1 text-xs">
            <FileText className="w-3.5 h-3.5" />
            Templates
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-72">
          {favorites.length > 0 && (
            <>
              <DropdownMenuLabel className="text-[11px] font-semibold">
                ⭐ Favorites
              </DropdownMenuLabel>
              {favorites.map(template => (
                <button
                  key={template.id}
                  onClick={() => handleSelectTemplate(template)}
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-accent rounded-sm transition-colors"
                >
                  <p className="font-medium">{template.name}</p>
                  <p className="text-muted-foreground text-[10px] truncate">
                    {template.body.substring(0, 60)}...
                  </p>
                </button>
              ))}
              <DropdownMenuSeparator className="my-1" />
            </>
          )}

          {Object.entries(byCategory).map(([category, items]) => (
            <div key={category}>
              <DropdownMenuLabel className="text-[11px] font-semibold capitalize">
                {category}
              </DropdownMenuLabel>
              {items.map(template => (
                <button
                  key={template.id}
                  onClick={() => handleSelectTemplate(template)}
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-accent rounded-sm transition-colors"
                >
                  <p className="font-medium">{template.name}</p>
                </button>
              ))}
              <DropdownMenuSeparator className="my-1" />
            </div>
          ))}

          <button
            onClick={() => setShowAddDialog(true)}
            className="w-full text-left px-3 py-1.5 text-xs hover:bg-accent rounded-sm transition-colors flex items-center gap-2"
          >
            <Plus className="w-3 h-3" />
            Create Template
          </button>
        </DropdownMenuContent>
      </DropdownMenu>

      <AddTemplateDialog open={showAddDialog} onOpenChange={setShowAddDialog} />
    </>
  );
}