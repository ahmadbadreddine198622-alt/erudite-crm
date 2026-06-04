import { FileText } from 'lucide-react';
import FormAUploadFlow from '@/components/landlord/FormAUploadFlow';

export default function FormAInbox() {
  return (
    <div className="page-root max-w-2xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center">
            <FileText className="w-5 h-5 text-amber-400" />
          </div>
          <h1 className="page-title text-2xl">Form A Inbox</h1>
        </div>
        <p className="page-subtitle ml-12">Upload a signed DLD Form A — auto-matches to the landlord and proposes the mandate update for your review before writing anything.</p>
      </div>
      <FormAUploadFlow />
    </div>
  );
}