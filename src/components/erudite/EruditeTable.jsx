import React from 'react';
import { cn } from '@/lib/utils';

export default function EruditeTable({ columns, data, className }) {
  return (
    <div className={cn('overflow-hidden rounded-2xl border border-white/10', className)}>
      <table className="w-full">
        <thead>
          <tr className="border-b border-white/10">
            {columns.map((column, idx) => (
              <th
                key={idx}
                className={cn(
                  'px-4 py-3 text-left',
                  'text-xs font-semibold tracking-wider uppercase',
                  'bg-white/[0.03]'
                )}
                style={{ color: 'rgba(255,255,255,0.5)' }}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, rowIdx) => (
            <tr
              key={rowIdx}
              className={cn(
                'border-b border-white/5 last:border-0',
                'hover:bg-white/[0.04] transition-colors'
              )}
            >
              {columns.map((column, colIdx) => (
                <td key={colIdx} className="px-4 py-3">
                  {column.render ? column.render(row) : row[column.accessor]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}