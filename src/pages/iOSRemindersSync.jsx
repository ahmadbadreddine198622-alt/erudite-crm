import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Smartphone, Copy, Check, ExternalLink, Clock, Calendar, List } from 'lucide-react';
import { format } from 'date-fns';

export default function iOSRemindersSync() {
  const webhookUrl = `https://app-69cabceaeeb8bb5e3a62ead3.base44.app/functions/receiveiOSReminder`;

  const { data: iosReminders = [] } = useQuery({
    queryKey: ['ios-reminders'],
    queryFn: () => base44.entities.Reminder.filter({ source: 'ios_shortcut' }, '-created_date', 50),
    staleTime: 30000,
  });

  const copyShortcut = () => {
    const shortcut = `# iOS Shortcut: Send to CRM Reminders
# Add this to your iOS Reminders app

1. Open Shortcuts app on iPhone/iPad
2. Create New Shortcut
3. Add these actions:

## Get Current Reminder
- Action: "Get Current Reminder" (from Reminders app)

## Extract Details
- Action: "Text"
  - Title: [[Reminder Name]]
  - Notes: [[Reminder Notes]]
  - Due Date: [[Reminder Due Date]] (format as ISO8601)

## Send to CRM
- Action: "URL"
  - URL: ${webhookUrl}
  
- Action: "Dictionary"
  - title: [[Reminder Name]]
  - notes: [[Reminder Notes]]
  - due_date: [[Reminder Due Date]] (ISO8601)
  - priority: Low
  - list_name: [[Reminder List]]

- Action: "Make HTTP Request"
  - URL: ${webhookUrl}
  - Method: POST
  - Headers: Content-Type: application/json
  - Body: [[Dictionary]] (as JSON)

## Show Confirmation
- Action: "Show Result"
  - Input: HTTP Response JSON`;
    navigator.clipboard.writeText(shortcut);
  };

  return (
    <div className="min-h-screen page-root pb-24">
      <div className="max-w-[1200px] mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <Smartphone className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">iOS Reminders Sync</h1>
            <p className="text-sm text-muted-foreground">Connect your Apple Reminders to CRM</p>
          </div>
        </div>

        {/* Setup Instructions */}
        <div className="glass-card rounded-2xl p-6 border border-blue-500/20">
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <ExternalLink className="w-5 h-5 text-blue-500" />
            Setup Instructions
          </h2>
          
          <div className="space-y-4 text-sm">
            <div className="flex gap-3">
              <div className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-500 flex items-center justify-center text-xs font-bold shrink-0">1</div>
              <p className="text-muted-foreground">Open the <strong>Shortcuts</strong> app on your iPhone or iPad</p>
            </div>
            
            <div className="flex gap-3">
              <div className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-500 flex items-center justify-center text-xs font-bold shrink-0">2</div>
              <p className="text-muted-foreground">Tap <strong>+</strong> to create a new shortcut</p>
            </div>
            
            <div className="flex gap-3">
              <div className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-500 flex items-center justify-center text-xs font-bold shrink-0">3</div>
              <p className="text-muted-foreground">Copy the shortcut code below and paste it into your shortcut</p>
            </div>

            <div className="mt-4">
              <button
                onClick={copyShortcut}
                className="w-full py-3 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-semibold transition-colors flex items-center justify-center gap-2"
              >
                <Copy className="w-4 h-4" />
                Copy Shortcut Code
              </button>
            </div>

            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 mt-4">
              <p className="text-xs text-blue-400 font-mono break-all">
                Webhook URL: {webhookUrl}
              </p>
              <button
                onClick={() => navigator.clipboard.writeText(webhookUrl)}
                className="text-xs text-blue-500 hover:text-blue-400 mt-2 flex items-center gap-1"
              >
                <Copy className="w-3 h-3" />
                Copy URL
              </button>
            </div>
          </div>
        </div>

        {/* How It Works */}
        <div className="glass-card rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-purple-500" />
            How It Works
          </h2>
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>• When you create a reminder in iOS Reminders app, run the shortcut</p>
            <p>• The shortcut sends your reminder to this CRM automatically</p>
            <p>• Reminders appear here with all details (title, notes, due date)</p>
            <p>• You can then assign them to leads, set priorities, or track completion</p>
          </div>
        </div>

        {/* Synced Reminders List */}
        <div className="glass-card rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <List className="w-5 h-5 text-emerald-500" />
              Synced iOS Reminders
            </h2>
            <span className="text-xs text-muted-foreground">{iosReminders.length} total</span>
          </div>

          {iosReminders.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Smartphone className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p className="text-sm">No iOS reminders synced yet</p>
              <p className="text-xs mt-1">Set up the shortcut and run it from your iPhone</p>
            </div>
          ) : (
            <div className="space-y-2">
              {iosReminders.map((reminder) => (
                <div key={reminder.id} className="flex items-start gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 mt-2 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-medium text-foreground truncate">{reminder.title}</p>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        {reminder.ios_list_name || 'Reminders'}
                      </span>
                    </div>
                    {reminder.notes && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{reminder.notes}</p>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      {reminder.due_date && (
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {format(new Date(reminder.due_date), 'MMM d, yyyy HH:mm')}
                        </div>
                      )}
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        Synced: {format(new Date(reminder.created_date), 'MMM d, HH:mm')}
                      </div>
                    </div>
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