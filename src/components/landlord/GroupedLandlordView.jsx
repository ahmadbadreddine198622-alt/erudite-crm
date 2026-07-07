// GroupedLandlordView — a simpler collapsible grouped layout for the "Board" tab
// when group-by is Project or Assigned Agent (instead of Stage).
// Each group is a collapsible section containing KanbanCardRow cards.
//
// Props:
//   groups (array)     — [{ key, label, color, landlords: [...] }]
//   selectedLandlordId, selectedIds, onSelectLandlord, onToggleSelect,
//   users, onSingleAssign, photographyTasks, getPhotoForPhone

import React, { useState } from 'react';
import { ChevronDown, Users } from 'lucide-react';
import KanbanCardRow from './KanbanCardRow';

const LDC = { gold: '#c9a24b', ink: '#e8ecf6', slate: '#8b96b0', dim: '#5f6a85' };

export default function GroupedLandlordView({
  groups, selectedLandlordId, selectedIds, onSelectLandlord, onToggleSelect,
  users, onSingleAssign, photographyTasks, getPhotoForPhone,
}) {
  // Collapse groups with 0 landlords by default; expand all others.
  const [collapsed, setCollapsed] = useState(() => {
    const set = new Set();
    groups.forEach((g) => { if (!g.landlords.length) set.add(g.key); });
    return set;
  });

  const toggle = (key) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className="flex flex-col gap-3 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 200px)' }}>
      {groups.map((g) => {
        const isCollapsed = collapsed.has(g.key);
        return (
          <div
            key={g.key}
            className="rounded-2xl overflow-hidden"
            style={{
              background: 'linear-gradient(180deg,rgba(255,255,255,.032) 0%,rgba(255,255,255,.007) 100%)',
              border: '1px solid rgba(255,255,255,.08)',
            }}
          >
            {/* Group header */}
            <button
              onClick={() => toggle(g.key)}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 transition-colors"
              style={{ borderBottom: isCollapsed ? 'none' : '1px solid rgba(255,255,255,.06)' }}
            >
              <ChevronDown
                className="w-4 h-4 shrink-0 transition-transform duration-200"
                style={{ color: g.color || LDC.gold, transform: isCollapsed ? 'rotate(-90deg)' : 'none' }}
              />
              <span className="text-sm font-semibold truncate" style={{ fontFamily: "'Cormorant',serif", color: LDC.ink }}>
                {g.label}
              </span>
              <div
                className="flex items-center gap-1.5 px-2.5 h-6 rounded-md text-xs font-semibold shrink-0"
                style={{
                  background: `${g.color || LDC.gold}14`,
                  border: `1px solid ${g.color || LDC.gold}3a`,
                  color: g.color || LDC.gold,
                }}
              >
                <Users className="w-2.5 h-2.5" />
                {g.landlords.length}
              </div>
            </button>
            {/* Cards */}
            {!isCollapsed && (
              <div className="p-2.5 flex flex-col gap-2">
                {g.landlords.length === 0 ? (
                  <div className="flex items-center justify-center h-16 text-xs" style={{ color: LDC.dim }}>
                    No landlords
                  </div>
                ) : (
                  g.landlords.map((landlord) => (
                    <KanbanCardRow
                      key={landlord.id}
                      landlord={landlord}
                      selectedLandlordId={selectedLandlordId}
                      selectedIds={selectedIds}
                      onSelectLandlord={onSelectLandlord}
                      onToggleSelect={onToggleSelect}
                      users={users}
                      onSingleAssign={onSingleAssign}
                      photographyTasks={photographyTasks}
                      getPhotoForPhone={getPhotoForPhone}
                      isActive={false}
                      onStageChange={() => {}}
                    />
                  ))
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}