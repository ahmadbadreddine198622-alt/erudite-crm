import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export default function TermsAndConditionsDialog({ open, onClose, contractId }) {
  const queryClient = useQueryClient();
  const [terms, setTerms] = useState([]);

  const { data: existingTerms = [] } = useQuery({
    queryKey: ['terms-and-conditions', contractId],
    queryFn: () => base44.entities.TermsAndConditions.filter({ tenancy_contract_id: contractId }, '-term_number', 20),
    enabled: open && !!contractId,
  });

  useEffect(() => {
    if (existingTerms.length > 0) {
      setTerms(existingTerms);
    } else {
      // Initialize 20 empty term slots
      setTerms(Array.from({ length: 20 }, (_, i) => ({
        id: null,
        tenancy_contract_id: contractId,
        term_number: i + 1,
        term_en: '',
        term_ar: '',
      })));
    }
  }, [existingTerms, contractId, open]);

  const saveTerm = useMutation({
    mutationFn: async (term) => {
      if (term.id) {
        return base44.entities.TermsAndConditions.update(term.id, {
          term_en: term.term_en,
          term_ar: term.term_ar,
        });
      } else if (term.term_en || term.term_ar) {
        return base44.entities.TermsAndConditions.create({
          tenancy_contract_id: contractId,
          term_number: term.term_number,
          term_en: term.term_en,
          term_ar: term.term_ar,
        });
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['terms-and-conditions', contractId] }),
  });

  const deleteTerm = useMutation({
    mutationFn: (termId) => base44.entities.TermsAndConditions.delete(termId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['terms-and-conditions', contractId] }),
  });

  const handleSave = async () => {
    try {
      for (const term of terms) {
        if (term.term_en || term.term_ar) {
          await saveTerm.mutateAsync(term);
        } else if (term.id) {
          await deleteTerm.mutateAsync(term.id);
        }
      }
      toast.success('Terms saved successfully');
      onClose();
    } catch (error) {
      toast.error('Failed to save terms', { description: error?.message });
    }
  };

  const updateTerm = (index, field, value) => {
    const updated = [...terms];
    updated[index][field] = value;
    setTerms(updated);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Additional Terms and Conditions</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="text-xs text-muted-foreground">
            Add up to 20 bilingual terms. Leave empty to skip a term number.
          </div>

          <div className="space-y-4 max-h-[500px] overflow-y-auto">
            {terms.map((term, idx) => (
              <div key={idx} className="border border-border rounded-lg p-3 bg-card/50">
                <div className="flex items-start justify-between mb-3">
                  <Label className="font-semibold text-sm">Term {term.term_number}</Label>
                  {term.id && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                      onClick={() => {
                        deleteTerm.mutate(term.id);
                        updateTerm(idx, 'id', null);
                        updateTerm(idx, 'term_en', '');
                        updateTerm(idx, 'term_ar', '');
                      }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground block mb-1">English</Label>
                    <Textarea
                      placeholder="Enter term in English..."
                      value={term.term_en || ''}
                      onChange={(e) => updateTerm(idx, 'term_en', e.target.value)}
                      className="text-xs min-h-20"
                    />
                  </div>

                  <div>
                    <Label className="text-xs text-muted-foreground block mb-1">Arabic</Label>
                    <Textarea
                      placeholder="Enter term in Arabic..."
                      value={term.term_ar || ''}
                      onChange={(e) => updateTerm(idx, 'term_ar', e.target.value)}
                      className="text-xs min-h-20 text-right"
                      dir="rtl"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saveTerm.isPending || deleteTerm.isPending}>
            Save Terms
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}