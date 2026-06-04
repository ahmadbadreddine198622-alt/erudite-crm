import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FileText } from 'lucide-react';
import FormAUploadFlow from './FormAUploadFlow';

export default function FormAUploadDialog({ open, onClose, onSuccess }) {
  const handleSuccess = () => {
    onSuccess?.();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" style={{ background: 'hsl(222 47% 9%)', border: '1px solid rgba(255,255,255,0.1)' }}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <div className="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-500/25 flex items-center justify-center">
              <FileText className="w-4 h-4 text-amber-400" />
            </div>
            Upload Form A
          </DialogTitle>
        </DialogHeader>
        <p className="text-xs text-white/40 -mt-1">Upload a signed DLD Form A — auto-matches to the landlord and shows a preview before writing anything.</p>
        <FormAUploadFlow onSuccess={handleSuccess} />
      </DialogContent>
    </Dialog>
  );
}