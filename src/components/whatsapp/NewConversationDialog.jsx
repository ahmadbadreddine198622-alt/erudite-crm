import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Delete, Phone, Building2, User } from 'lucide-react';

const DIAL_KEYS = [
  ['1','2','3'],
  ['4','5','6'],
  ['7','8','9'],
  ['+','0','⌫'],
];

export default function NewConversationDialog({ open, onClose, onConversationCreated }) {
  const [phone, setPhone] = useState('');
  const [channel, setChannel] = useState('business');
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
      // Check if conversation already exists for this phone + channel
      const existing = await base44.entities.WhatsAppConversation.filter({ wa_phone_e164: e164, channel });
      let conv = existing[0];
      if (!conv) {
        conv = await base44.entities.WhatsAppConversation.create({
          wa_phone_e164: e164,
          phone_number: e164,
          wa_display_name: e164,
          status: 'new',
          channel,
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

  const handleClose = () => {
    setPhone('');
    setError('');
    setChannel('business');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) handleClose(); }}>
      <DialogContent className="sm:max-w-xs" style={{ background: 'hsl(222 47% 11%)', borderColor: 'rgba(255,255,255,0.12)' }}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white/90">
            <Phone className="w-4 h-4 text-green-500" /> New WhatsApp Conversation
          </DialogTitle>
        </DialogHeader>

        {/* Channel selector */}
        <div className="flex gap-2 mt-1">
          <button
            onClick={() => setChannel('business')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold border transition-all ${
              channel === 'business'
                ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10'
            }`}
          >
            <Building2 className="w-4 h-4" />
            Business
          </button>
          <button
            onClick={() => setChannel('personal')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold border transition-all ${
              channel === 'personal'
                ? 'bg-blue-500/20 border-blue-500/50 text-blue-400'
                : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10'
            }`}
          >
            <User className="w-4 h-4" />
            Personal
          </button>
          <button
            onClick={() => setChannel('malik')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold border transition-all ${
              channel === 'malik'
                ? 'bg-purple-500/20 border-purple-500/50 text-purple-400'
                : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10'
            }`}
          >
            <User className="w-4 h-4" />
            Malik
          </button>
        </div>

        <p className="text-[11px] text-white/40 text-center -mt-1">
          {channel === 'business' ? 'Sending from Business (+971 58 280 6000)' : channel === 'malik' ? 'Sending from Malik (+971 52 987 1277)' : 'Sending from Personal (+971 58 180 6000)'}
        </p>

        {/* Phone display */}
        <div className="relative">
          <Input
            value={phone}
            onChange={e => { setPhone(e.target.value); setError(''); }}
            placeholder="+971 50 123 4567"
            className="text-center text-xl font-mono tracking-widest h-12 pr-10"
            style={{ direction: 'ltr', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.9)' }}
            onKeyDown={e => e.key === 'Enter' && handleStart()}
          />
          {phone && (
            <button
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/80"
              onClick={() => setPhone('')}
            >
              <Delete className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Dial pad */}
        <div className="grid grid-cols-3 gap-2">
          {DIAL_KEYS.flat().map((key) => (
            <button
              key={key}
              onClick={() => handleDial(key)}
              className="h-12 rounded-xl text-lg font-medium transition-all select-none active:scale-95"
              style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.85)' }}
            >
              {key}
            </button>
          ))}
        </div>

        {error && <p className="text-xs text-red-400 text-center">{error}</p>}

        <Button
          onClick={handleStart}
          disabled={!phone.trim() || loading}
          className="w-full h-11 font-semibold"
          style={{
            background: channel === 'business' ? 'hsl(152 69% 40%)' : channel === 'malik' ? 'hsl(270 70% 55%)' : 'hsl(217 91% 60%)',
            color: 'white',
          }}
        >
          {loading ? 'Starting…' : `💬 Start via ${channel === 'business' ? 'Business' : channel === 'malik' ? 'Malik' : 'Personal'}`}
        </Button>
      </DialogContent>
    </Dialog>
  );
}