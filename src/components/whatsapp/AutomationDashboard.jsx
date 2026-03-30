import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, ToggleLeft, ToggleRight, Zap } from 'lucide-react';
import AddAutomationDialog from './AddAutomationDialog';

export default function AutomationDashboard() {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const queryClient = useQueryClient();

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ['automation_rules'],
    queryFn: () => base44.entities.AutomationRule.list('-priority', 50),
  });

  const toggleRuleMutation = useMutation({
    mutationFn: ({ id, is_active }) =>
      base44.entities.AutomationRule.update(id, { is_active: !is_active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['automation_rules'] }),
  });

  const deleteRuleMutation = useMutation({
    mutationFn: (id) => base44.entities.AutomationRule.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['automation_rules'] }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-base flex items-center gap-2">
          <Zap className="w-4 h-4 text-yellow-500" /> Automation Rules
        </h3>
        <Button size="sm" onClick={() => setShowAddDialog(true)} className="gap-1">
          <Plus className="w-3.5 h-3.5" /> Add Rule
        </Button>
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading rules...</p>
      ) : rules.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-8">No automation rules yet</p>
      ) : (
        <div className="space-y-2">
          {rules.map((rule) => (
            <Card key={rule.id} className="p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium text-sm">{rule.name}</p>
                    <Badge variant="outline" className="text-[10px]">
                      {rule.trigger_type}
                    </Badge>
                    {rule.is_active ? (
                      <Badge className="bg-green-500/10 text-green-700 text-[10px]">Active</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px]">Inactive</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">{rule.description}</p>
                  <div className="text-xs space-y-1">
                    <div>
                      <span className="text-muted-foreground">Conditions: </span>
                      <code className="bg-muted px-1.5 py-0.5 rounded text-[10px]">
                        {JSON.stringify(rule.trigger_conditions).substring(0, 50)}...
                      </code>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Actions: </span>
                      <span className="text-foreground">{rule.actions?.length || 0} action(s)</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Executions: </span>
                      <span className="text-foreground">{rule.execution_count || 0}x</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => toggleRuleMutation.mutate({ id: rule.id, is_active: rule.is_active })}
                  >
                    {rule.is_active ? (
                      <ToggleRight className="w-4 h-4 text-green-600" />
                    ) : (
                      <ToggleLeft className="w-4 h-4 text-muted-foreground" />
                    )}
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => deleteRuleMutation.mutate(rule.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <AddAutomationDialog open={showAddDialog} onOpenChange={setShowAddDialog} />
    </div>
  );
}