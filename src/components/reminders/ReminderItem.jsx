import React, { useState } from 'react';
import { Circle, CheckCircle2, ChevronRight, ChevronDown, Flag, Calendar, User, Tag } from 'lucide-react';
import { format, isToday, isPast } from 'date-fns';

const PRIORITY_FLAGS = {
  urgent: 'text-red-500',
  high: 'text-orange-500',
  medium: 'text-blue-500',
  low: 'text-gray-400',
  none: null,
};

export default function ReminderItem({ reminder, onComplete, onEdit }) {
  const [expanded, setExpanded] = useState(false);
  const isCompleted = reminder.status === 'completed';
  const isOverdue = reminder.due_date && isPast(new Date(reminder.due_date)) && !isToday(new Date(reminder.due_date)) && !isCompleted;
  const hasSubtasks = reminder.subtasks?.length > 0;
  const completedSubs = reminder.subtasks?.filter(s => s.completed).length || 0;
  const flagColor = PRIORITY_FLAGS[reminder.priority];

  const formatDate = (d) => {
    if (!d) return null;
    const date = new Date(d);
    if (isToday(date)) return `Today ${format(date, 'h:mm a')}`;
    return format(date, 'MMM d, h:mm a');
  };

  return (
    <div className={`group border-b border-[#F2F2F7] last:border-0 ${isCompleted ? 'opacity-50' : ''}`}>
      <div
        className="flex items-start gap-3 px-5 py-3 hover:bg-[#F9F9FB] transition-colors cursor-pointer"
        onClick={() => onEdit(reminder)}
      >
        {/* Checkbox */}
        <button
          onClick={e => { e.stopPropagation(); onComplete(reminder.id); }}
          className="mt-0.5 flex-shrink-0 transition-transform hover:scale-110"
        >
          {isCompleted
            ? <CheckCircle2 className="w-5 h-5 text-blue-500" />
            : <Circle className="w-5 h-5 text-[#C7C7CC] hover:text-blue-400" />
          }
        </button>

        <div className="flex-1 min-w-0">
          {/* Title row */}
          <div className="flex items-start justify-between gap-2">
            <p className={`text-sm text-[#1C1C1E] leading-snug ${isCompleted ? 'line-through text-[#8E8E93]' : ''}`}>
              {reminder.title}
            </p>
            <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
              {flagColor && <Flag className={`w-3.5 h-3.5 ${flagColor}`} fill="currentColor" />}
              {hasSubtasks && (
                <button
                  onClick={e => { e.stopPropagation(); setExpanded(v => !v); }}
                  className="text-[#8E8E93] hover:text-[#1C1C1E]"
                >
                  {expanded
                    ? <ChevronDown className="w-3.5 h-3.5" />
                    : <ChevronRight className="w-3.5 h-3.5" />
                  }
                </button>
              )}
            </div>
          </div>

          {/* Notes preview */}
          {reminder.notes && !expanded && (
            <p className="text-xs text-[#8E8E93] mt-0.5 truncate">{reminder.notes}</p>
          )}

          {/* Meta row */}
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            {reminder.due_date && (
              <span className={`flex items-center gap-1 text-[11px] font-medium ${isOverdue ? 'text-red-500' : 'text-[#8E8E93]'}`}>
                <Calendar className="w-3 h-3" />
                {formatDate(reminder.due_date)}
                {isOverdue && ' · Overdue'}
              </span>
            )}
            {reminder.lead_name && (
              <span className="flex items-center gap-1 text-[11px] text-[#8E8E93]">
                <User className="w-3 h-3" />
                {reminder.lead_name}
              </span>
            )}
            {reminder.tags?.map(tag => (
              <span key={tag} className="flex items-center gap-1 text-[11px] text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded-full">
                <Tag className="w-2.5 h-2.5" />{tag}
              </span>
            ))}
            {hasSubtasks && (
              <span className="text-[11px] text-[#8E8E93]">{completedSubs}/{reminder.subtasks.length}</span>
            )}
          </div>
        </div>
      </div>

      {/* Subtasks */}
      {expanded && hasSubtasks && (
        <div className="pl-13 pr-5 pb-2 space-y-1">
          {reminder.subtasks.map((sub, i) => (
            <div key={sub.id || i} className="flex items-center gap-2 pl-8">
              {sub.completed
                ? <CheckCircle2 className="w-4 h-4 text-blue-400" />
                : <Circle className="w-4 h-4 text-[#C7C7CC]" />
              }
              <p className={`text-xs ${sub.completed ? 'line-through text-[#8E8E93]' : 'text-[#1C1C1E]'}`}>
                {sub.title}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}