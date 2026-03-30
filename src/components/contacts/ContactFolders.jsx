import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Loader2, FolderOpen, Tag, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ContactFolders({ selectedFolderId, onSelectFolder }) {
  const { data: folders = [], isLoading } = useQuery({
    queryKey: ['folders'],
    queryFn: () => base44.entities.ContactFolder.list('-updated_date', 100),
  });

  if (isLoading) {
    return <div className="flex items-center justify-center h-32"><Loader2 className="w-5 h-5 animate-spin" /></div>;
  }

  // Group by type
  const sourceFolders = folders.filter(f => f.folder_type === 'source_based');
  const tagFolders = folders.filter(f => f.folder_type === 'tag_based');
  const smartGroups = folders.filter(f => f.folder_type === 'smart_group');

  return (
    <div className="space-y-4 p-4 border-r max-h-[80vh] overflow-y-auto">
      {/* Source-Based Folders */}
      {sourceFolders.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-muted-foreground px-2">SOURCES</h3>
          {sourceFolders.map((folder) => (
            <button
              key={folder.id}
              onClick={() => onSelectFolder(folder.id)}
              className={cn(
                'w-full text-left p-2 rounded transition-colors flex items-center justify-between gap-2 text-sm',
                selectedFolderId === folder.id
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-accent text-foreground'
              )}
            >
              <div className="flex items-center gap-2">
                <FolderOpen className="w-4 h-4" />
                {folder.folder_name}
              </div>
              <span className={cn(
                'text-xs px-2 py-0.5 rounded',
                selectedFolderId === folder.id
                  ? 'bg-primary-foreground/20'
                  : 'bg-gray-200'
              )}>
                {folder.contact_count || 0}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Tag-Based Folders */}
      {tagFolders.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-muted-foreground px-2">TAGS</h3>
          {tagFolders.map((folder) => (
            <button
              key={folder.id}
              onClick={() => onSelectFolder(folder.id)}
              className={cn(
                'w-full text-left p-2 rounded transition-colors flex items-center justify-between gap-2 text-sm',
                selectedFolderId === folder.id
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-accent text-foreground'
              )}
            >
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4" />
                {folder.tag}
              </div>
              <span className={cn(
                'text-xs px-2 py-0.5 rounded',
                selectedFolderId === folder.id
                  ? 'bg-primary-foreground/20'
                  : 'bg-gray-200'
              )}>
                {folder.contact_count || 0}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Smart Groups */}
      {smartGroups.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-muted-foreground px-2">SMART GROUPS</h3>
          {smartGroups.map((folder) => (
            <button
              key={folder.id}
              onClick={() => onSelectFolder(folder.id)}
              className={cn(
                'w-full text-left p-2 rounded transition-colors flex items-center justify-between gap-2 text-sm',
                selectedFolderId === folder.id
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-accent text-foreground'
              )}
            >
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4" />
                {folder.folder_name}
              </div>
              <span className={cn(
                'text-xs px-2 py-0.5 rounded',
                selectedFolderId === folder.id
                  ? 'bg-primary-foreground/20'
                  : 'bg-gray-200'
              )}>
                {folder.contact_count || 0}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}