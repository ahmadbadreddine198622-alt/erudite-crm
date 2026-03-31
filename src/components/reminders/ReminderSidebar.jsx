import React from 'react';
import { CheckCircle2, Calendar, Star, List, Plus, Circle } from 'lucide-react';

const SMART_LISTS = [
  { id: 'today', label: 'Today', icon: Star, color: 'text-yellow-500', bg: 'bg-yellow-500' },
  { id: 'scheduled', label: 'Scheduled', icon: Calendar, color: 'text-red-500', bg: 'bg-red-500' },
  { id: 'all', label: 'All', icon: List, color: 'text-blue-500', bg: 'bg-blue-500' },
  { id: 'completed', label: 'Completed', icon: CheckCircle2, color: 'text-gray-400', bg: 'bg-gray-400' },
];

const LIST_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4'
];

export default function ReminderSidebar({ activeList, onSelectList, lists, counts, onAddList }) {
  return (
    <div className="w-56 flex-shrink-0 bg-[#1c1c1e] text-white flex flex-col h-full select-none">
      {/* Smart Lists */}
      <div className="px-3 pt-6 pb-2">
        <div className="grid grid-cols-2 gap-2 mb-6">
          {SMART_LISTS.map(({ id, label, icon: Icon, color, bg }) => (
            <button
              key={id}
              onClick={() => onSelectList(id)}
              className={`flex flex-col gap-2 p-3 rounded-2xl transition-all text-left ${
                activeList === id
                  ? 'bg-[#3a3a3c] ring-1 ring-white/10'
                  : 'bg-[#2c2c2e] hover:bg-[#3a3a3c]'
              }`}
            >
              <div className={`w-8 h-8 rounded-full ${bg} flex items-center justify-center`}>
                <Icon className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-[#8e8e93]">{label}</p>
                <p className="text-xl font-bold text-white">{counts[id] || 0}</p>
              </div>
            </button>
          ))}
        </div>

        {/* My Lists */}
        <div className="mb-2">
          <p className="text-xs font-semibold text-[#8e8e93] uppercase tracking-wider px-1 mb-2">My Lists</p>
          <div className="space-y-0.5">
            {lists.map(list => (
              <button
                key={list.name}
                onClick={() => onSelectList(`list:${list.name}`)}
                className={`w-full flex items-center gap-2.5 px-2 py-2 rounded-xl transition-all text-left ${
                  activeList === `list:${list.name}`
                    ? 'bg-[#3a3a3c]'
                    : 'hover:bg-[#2c2c2e]'
                }`}
              >
                <Circle
                  className="w-5 h-5 flex-shrink-0"
                  style={{ color: list.color || '#3b82f6', fill: list.color || '#3b82f6' }}
                />
                <span className="text-sm text-white flex-1 truncate">{list.name}</span>
                <span className="text-xs text-[#8e8e93]">{list.count || ''}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Add List */}
      <div className="mt-auto px-3 pb-4">
        <button
          onClick={onAddList}
          className="flex items-center gap-2 text-sm text-[#0a84ff] hover:text-blue-300 transition-colors px-2 py-1.5"
        >
          <Plus className="w-4 h-4" />
          Add List
        </button>
      </div>
    </div>
  );
}