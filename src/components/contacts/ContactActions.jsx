import React, { useState } from 'react';
import { Phone, MessageSquare, Mail, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

export default function ContactActions({ contact, onClose }) {
  const [showWhatsApp, setShowWhatsApp] = useState(false);
  const [showEmail, setShowEmail] = useState(false);
  const [whatsappMessage, setWhatsappMessage] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [sending, setSending] = useState(false);

  const primaryPhone = contact.phone || contact.phones?.[0]?.number;
  const primaryEmail = contact.email || contact.emails?.[0]?.address;

  const handleCall = async () => {
    if (!primaryPhone) {
      toast.error('No phone number available');
      return;
    }
    
    try {
      setSending(true);
      // Use Aircall to initiate a call
      const response = await base44.functions.invoke('twilioMakeCall', {
        to: primaryPhone,
        agent_name: contact.full_name || contact.name,
      });
      toast.success('Call initiated via Aircall');
    } catch (err) {
      toast.error('Failed to initiate call: ' + err.message);
    } finally {
      setSending(false);
    }
  };

  const handleSendWhatsApp = async () => {
    if (!primaryPhone) {
      toast.error('No phone number available');
      return;
    }
    if (!whatsappMessage.trim()) {
      toast.error('Message cannot be empty');
      return;
    }

    try {
      setSending(true);
      await base44.functions.invoke('sendWhatsAppMessageFromCRM', {
        phone: primaryPhone,
        message: whatsappMessage,
        lead_id: contact.id,
      });
      toast.success('WhatsApp message sent');
      setWhatsappMessage('');
      setShowWhatsApp(false);
    } catch (err) {
      toast.error('Failed to send WhatsApp: ' + err.message);
    } finally {
      setSending(false);
    }
  };

  const handleSendEmail = async () => {
    if (!primaryEmail) {
      toast.error('No email available');
      return;
    }
    if (!emailBody.trim()) {
      toast.error('Email body cannot be empty');
      return;
    }

    try {
      setSending(true);
      await base44.integrations.Core.SendEmail({
        to: primaryEmail,
        subject: `Message to ${contact.full_name || contact.name}`,
        body: emailBody,
      });
      toast.success('Email sent successfully');
      setEmailBody('');
      setShowEmail(false);
    } catch (err) {
      toast.error('Failed to send email: ' + err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-1.5">
        <Button
          size="icon"
          variant="ghost"
          className="w-7 h-7 text-emerald-400 hover:bg-emerald-500/10"
          onClick={() => setShowWhatsApp(true)}
          disabled={!primaryPhone}
          title="WhatsApp"
        >
          <MessageSquare className="w-4 h-4" />
        </Button>

        <Button
          size="icon"
          variant="ghost"
          className="w-7 h-7 text-blue-400 hover:bg-blue-500/10"
          onClick={handleCall}
          disabled={!primaryPhone || sending}
          title="Call via Aircall"
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Phone className="w-4 h-4" />}
        </Button>

        <Button
          size="icon"
          variant="ghost"
          className="w-7 h-7 text-amber-400 hover:bg-amber-500/10"
          onClick={() => setShowEmail(true)}
          disabled={!primaryEmail}
          title="Send Email"
        >
          <Mail className="w-4 h-4" />
        </Button>
      </div>

      {/* WhatsApp Modal */}
      <Dialog open={showWhatsApp} onOpenChange={setShowWhatsApp}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Send WhatsApp Message</DialogTitle>
            <DialogDescription>{primaryPhone || 'No phone'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              value={whatsappMessage}
              onChange={(e) => setWhatsappMessage(e.target.value)}
              placeholder="Type your message..."
              className="min-h-24"
            />
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowWhatsApp(false)}
                disabled={sending}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSendWhatsApp}
                disabled={!whatsappMessage.trim() || sending}
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Send
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Email Modal */}
      <Dialog open={showEmail} onOpenChange={setShowEmail}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Send Email</DialogTitle>
            <DialogDescription>{primaryEmail || 'No email'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              value={emailBody}
              onChange={(e) => setEmailBody(e.target.value)}
              placeholder="Type your email message..."
              className="min-h-24"
            />
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowEmail(false)}
                disabled={sending}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSendEmail}
                disabled={!emailBody.trim() || sending}
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Send
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}