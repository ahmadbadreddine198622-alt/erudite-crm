import React from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export default function StatCard({ title, value, subtitle, icon: Icon, trend, trendUp }) {
  return (
    <Card className="p-5 relative overflow-hidden group hover:shadow-lg transition-shadow duration-300">
      <div className="flex justify-between items-start">
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
          <p className="text-2xl font-bold tracking-tight">{value}</p>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          {trend && (
            <p className={cn(
              "text-xs font-medium",
              trendUp ? "text-emerald-600" : "text-red-500"
            )}>
              {trendUp ? '↑' : '↓'} {trend}
            </p>
          )}
        </div>
        {Icon && (
          <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
            <Icon className="w-5 h-5 text-accent" />
          </div>
        )}
      </div>
    </Card>
  );
}