import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { toast } from 'sonner';

/**
 * CopyButton — a small icon button that copies a value to the clipboard
 * with a brief check-mark confirmation. Drop it next to any phone number,
 * email address, or other copyable text throughout the CRM.
 *
 * Props:
 *  - value:  the text to copy (renders nothing when empty)
 *  - label:  short noun shown in the toast ("Phone copied", "Email copied")
 *  - size:   icon pixel size (default 14)
 *  - className / style: overrides for the wrapper
 */
export default function CopyButton({ value, label = 'value', size = 14, className = '', style, title }) {
  const [copied, setCopied] = useState(false);
  if (!value) return null;

  const handleCopy = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(String(value));
      setCopied(true);
      toast.success(`${label} copied`);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      toast.error('Could not copy');
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={title || `Copy ${label}`}
      className={`inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-white/10 active:scale-95 transition-all ${className}`}
      style={{ width: size + 12, height: size + 12, flex: 'none', ...style }}
    >
      {copied ? <Check size={size} className="text-emerald-400" /> : <Copy size={size} />}
    </button>
  );
}