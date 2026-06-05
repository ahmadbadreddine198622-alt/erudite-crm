import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { MessageSquare, Loader2, Copy, RefreshCw, Check } from 'lucide-react';
import { toast } from 'sonner';

export default function GroupBlurbGenerator({ landlordId }) {
  const [blurb, setBlurb] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await base44.functions.invoke('generateGroupBlurb', { landlord_id: landlordId });
      setBlurb(res?.data?.blurb || res?.blurb || '');
    } catch (err) {
      toast.error('Failed: ' + err.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = async () => {
    if (!blurb) return;
    await navigator.clipboard.writeText(blurb);
    setCopied(true);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-2">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-emerald-400" />
          <span className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.9)' }}>
            Broker Group Blurb
          </span>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={handleGenerate}
          disabled={generating}
          className="gap-1.5 text-xs"
        >
          {generating
            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
            : blurb ? <RefreshCw className="w-3.5 h-3.5" /> : <MessageSquare className="w-3.5 h-3.5" />}
          {generating ? 'Generating…' : blurb ? 'Regenerate' : 'Generate blurb'}
        </Button>
      </div>

      {/* Blurb output */}
      {blurb && (
        <div className="relative">
          <pre
            className="w-full rounded-lg px-3 py-3 text-xs leading-relaxed whitespace-pre-wrap font-mono"
            style={{
              background: 'rgba(16,185,129,0.06)',
              border: '1px solid rgba(16,185,129,0.2)',
              color: 'rgba(255,255,255,0.88)',
              minHeight: '80px',
            }}
          >
            {blurb}
          </pre>
          <button
            onClick={handleCopy}
            className="absolute top-2 right-2 flex items-center gap-1 text-[10px] px-2 py-1 rounded-md border border-white/20 hover:bg-white/10 transition-colors"
            style={{ color: copied ? 'rgb(52,211,153)' : 'rgba(255,255,255,0.6)' }}
            title="Copy to clipboard"
          >
            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      )}

      {!blurb && !generating && (
        <p className="text-xs text-muted-foreground pl-1">
          Generate a short WhatsApp teaser to share with broker groups. No owner info included.
        </p>
      )}
    </div>
  );
}