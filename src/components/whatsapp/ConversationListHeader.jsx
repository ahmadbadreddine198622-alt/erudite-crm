import React from 'react';
import { MessageCircle, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';

export default function ConversationListHeader({ search, onSearchChange }) {
  return (
    <div className="p-4 border-b bg-card">
      <div className="flex items-center gap-2 mb-3">
        <MessageCircle className="w-5 h-5 text-green-500" />
        <h2 className="font-bold text-lg">Messages</h2>
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search conversations..."
          className="pl-9 h-9 text-sm bg-muted/50"
          value={search}
          onChange={e => onSearchChange(e.target.value)}
        />
      </div>
    </div>
  );
}