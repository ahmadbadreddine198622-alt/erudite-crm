import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Smartphone, Copy, ExternalLink, Clock, Calendar, List } from 'lucide-react';
import { format } from 'date-fns';

export default function iOSRemindersSync() {
  const webhookUrl = 'https://app-69cabceaeeb8bb5e3a62ead3.base44.app/functions/receiveiOSReminder';

  const { data: iosReminders = [] } = useQuery({
    queryKey: ['ios-reminders'],
    queryFn: () => base44.entities.Reminder.filter({ source: 'ios_shortcut' }, '-created_date', 50),
    staleTime: 30000,
  });

  const copyShortcut = () => {
    navigator.clipboard.writeText(`iOS Shortcut Webhook: ${webhookUrl}`);
  };

  return (
    <div className="min-h-screen page-root pb-24">
      <div className="max-w-[1200px] mx-auto space-y-6">
        
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <Smartphone className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">iOS Reminders Sync</h1>
            <p className="text-sm text-muted-foreground">Connect your Apple Reminders to CRM</p>
          </div>
        </div>

        <div className="glass-card rounded-2xl p-6 border border-blue-500/20">
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <ExternalLink className="w-5 h-5 text-blue-500" />
            Setup Instructions
          </h2>
          
          <div className="space-y-4 text-sm">
            <div className="flex gap-3">
              <div className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-500 flex items-center justify-center text-xs font-bold shrink-0">1</div>
              <p className="text-muted-foreground">Open Shortcuts app on iPhone/iPad</p>
            </div>
            
            <div className="flex gap-3">
              <div className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-500 flex items-center justify-center text-xs font-bold shrink-0">2</div>
              <p className="text-muted-foreground">Create new shortcut with webhook action</p>
            </div>
            
            <div className="flex gap-3">
              <div className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-500 flex items-center justify-center text-xs font-bold shrink-0">3</div>
              <p className="text-muted-foreground">Send POST request to webhook URL below</p>
            </div>

            <div className="mt-4">
              <button
                onClick={copyShortcut}
                className="w-full py-3 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-semibold transition-colors flex items-center justify-center gap-2"
              >
                <Copy className="w-4 h-4" />
                Copy Webhook URL
              </button>
            </div>

            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 mt-4">
              <p className="text-xs text-blue-400 font-mono break-all">{webhookUrl}</p>
            </div>
          </div>
        </div>

        <div className="glass-card rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <List className="w-5 h-5 text-emerald-500" />
            Synced Reminders
          </h2>

          {iosReminders.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Smartphone className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p className="text-sm">No iOS reminders synced yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {iosReminders.map((reminder) => (
                <div key={reminder.id} className="flex items-start gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 mt-2 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{reminder.title}</p>
                    {reminder.due_date && (
                      <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        {format(new Date(reminder.due_date), 'MMM d, yyyy HH:mm')}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}