import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Delete, Phone } from 'lucide-react';

const DIAL_KEYS = [
  ['1','2','3'],
  ['4','5','6'],
  ['7','8','9'],
  ['+','0','⌫'],
];

export default function NewConversationDialog({ open, onClose, onConversationCreated }) {
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleDial = (key) => {
    if (key === '⌫') {
      setPhone(p => p.slice(0, -1));
    } else {
      setPhone(p => p.length < 20 ? p + key : p);
    }
    setError('');
  };

  const normalizePhone = (raw) => {
    let n = raw.replace(/[\s\-().]/g, '');
    if (!n.startsWith('+')) n = '+' + n;
    return n;
  };

  const handleStart = async () => {
    if (!phone.trim()) return;
    const e164 = normalizePhone(phone.trim());
    setLoading(true);
    setError('');
    try {
      // Check if conversation already exists
      const existing = await base44.entities.WhatsAppConversation.filter({ wa_phone_e164: e164 });
      let conv = existing[0];
      if (!conv) {
        conv = await base44.entities.WhatsAppConversation.create({
          wa_phone_e164: e164,
          phone_number: e164,
          wa_display_name: e164,
          status: 'new',
          last_message: 'New conversation',
          last_message_at: new Date().toISOString(),
          unread_count: 0,
        });
      }
      setPhone('');
      onConversationCreated(conv.id);
      onClose();
    } catch (e) {
      setError('Failed to create conversation. Check the number and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) { setPhone(''); setError(''); onClose(); } }}>
      <DialogContent className="sm:max-w-xs">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="w-4 h-4 text-green-600" /> New WhatsApp Conversation
          </DialogTitle>
        </DialogHeader>

        {/* Phone display */}
        <div className="relative mt-2">
          <Input
            value={phone}
            onChange={e => { setPhone(e.target.value); setError(''); }}
            placeholder="+971 50 123 4567"
            className="text-center text-xl font-mono tracking-widest h-12 pr-10"
            style={{ direction: 'ltr' }}
            onKeyDown={e => e.key === 'Enter' && handleStart()}
          />
          {phone && (
            <button
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => setPhone('')}
            >
              <Delete className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Dial pad */}
        <div className="grid grid-cols-3 gap-2 mt-1">
          {DIAL_KEYS.flat().map((key) => (
            <button
              key={key}
              onClick={() => handleDial(key)}
              className="h-12 rounded-xl text-lg font-medium bg-muted hover:bg-muted/70 active:scale-95 transition-all select-none"
            >
              {key}
            </button>
          ))}
        </div>

        {error && <p className="text-xs text-destructive text-center">{error}</p>}

        <Button
          onClick={handleStart}
          disabled={!phone.trim() || loading}
          className="w-full bg-green-600 hover:bg-green-700 text-white mt-1"
        >
          {loading ? 'Starting…' : '💬 Start Conversation'}
        </Button>
      </DialogContent>
    </Dialog>
  );
}