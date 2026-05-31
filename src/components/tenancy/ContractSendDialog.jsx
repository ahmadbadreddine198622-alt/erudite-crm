import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, MessageCircle, Mail } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

export default function ContractSendDialog({ open, onClose, contract }) {
  const [sending, setSending] = useState(null); // 'whatsapp' | 'email'
  const [whatsappNum, setWhatsappNum] = useState('');
  const [emailAddr, setEmailAddr] = useState('');

  React.useEffect(() => {
    if (contract) {
      setWhatsappNum(contract.tenant_phone || '');
      setEmailAddr(contract.tenant_email || '');
    }
  }, [contract]);

  if (!contract) return null;

  const pdfLink = contract.pdf_url;
  const contractLabel = [contract.tenant_name, contract.building_name].filter(Boolean).join(' — ') || 'Tenancy Contract';

  const sendWhatsApp = async () => {
    if (!whatsappNum) return toast.error('Enter a WhatsApp number');
    if (!pdfLink) return toast.error('Generate the PDF first');
    setSending('whatsapp');
    try {
      await base44.functions.invoke('sendWhatsAppMessage', {
        to: whatsappNum,
        message: `Dear ${contract.tenant_name || 'Tenant'},\n\nPlease find your Tenancy Contract (${contractLabel}) at the link below:\n${pdfLink}\n\nKindly review and revert with any questions.\n\nErudite Real Estate`,
      });
      toast.success('Sent via WhatsApp');
      onClose();
    } catch (err) {
      toast.error('WhatsApp send failed', { description: err?.message });
    } finally {
      setSending(null);
    }
  };

  const sendEmail = async () => {
    if (!emailAddr) return toast.error('Enter an email address');
    if (!pdfLink) return toast.error('Generate the PDF first');
    setSending('email');
    try {
      await base44.integrations.Core.SendEmail({
        to: emailAddr,
        subject: `Your Tenancy Contract — ${contractLabel}`,
        body: `Dear ${contract.tenant_name || 'Tenant'},\n\nPlease find your Tenancy Contract attached via the link below:\n\n${pdfLink}\n\nKindly review and let us know if you have any questions.\n\nBest regards,\nErudite Real Estate\n+971 58 180 6000`,
      });
      toast.success('Email sent');
      onClose();
    } catch (err) {
      toast.error('Email send failed', { description: err?.message });
    } finally {
      setSending(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm bg-card border-border">
        <DialogHeader>
          <DialogTitle>Send Contract</DialogTitle>
        </DialogHeader>

        {!pdfLink && (
          <div className="text-xs text-amber-400 bg-amber-400/10 border border-amber-400/30 rounded-lg p-3">
            ⚠️ PDF not generated yet. Generate the PDF first, then send.
          </div>
        )}

        <div className="space-y-4">
          {/* WhatsApp */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
              <MessageCircle className="w-3.5 h-3.5 text-green-400" /> Send via WhatsApp
            </Label>
            <div className="flex gap-2">
              <Input
                value={whatsappNum}
                onChange={e => setWhatsappNum(e.target.value)}
                placeholder="+971 50 000 0000"
                className="h-8 text-sm glass-input"
              />
              <Button
                size="sm" onClick={sendWhatsApp}
                disabled={sending === 'whatsapp' || !pdfLink}
                className="h-8 shrink-0"
              >
                {sending === 'whatsapp' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Send'}
              </Button>
            </div>
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-blue-400" /> Send via Email
            </Label>
            <div className="flex gap-2">
              <Input
                value={emailAddr}
                onChange={e => setEmailAddr(e.target.value)}
                placeholder="tenant@email.com"
                className="h-8 text-sm glass-input"
                type="email"
              />
              <Button
                size="sm" onClick={sendEmail}
                disabled={sending === 'email' || !pdfLink}
                className="h-8 shrink-0"
              >
                {sending === 'email' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Send'}
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}