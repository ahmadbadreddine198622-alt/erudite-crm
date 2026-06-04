import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Phone, Loader2, PhoneCall } from 'lucide-react';
import { toast } from 'sonner';

export default function TwilioCallDialog({ lead, contact, size = 'sm', iconOnly = false }) {
  const [open, setOpen] = useState(false);
  const [numbers, setNumbers] = useState([]);
  const [selectedNumber, setSelectedNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [calling, setCalling] = useState(false);

  const targetPhone = lead?.phone || contact?.phone;
  const targetName = lead?.full_name || lead?.name || contact?.full_name || contact?.name || targetPhone;
  const leadId = lead?.id || contact?.id;

  useEffect(() => {
    if (open && numbers.length === 0) {
      setLoading(true);
      base44.functions.invoke('getTwilioNumbers', {})
        .then(res => {
          const nums = res.data?.numbers || [];
          setNumbers(nums);
          if (nums.length > 0) setSelectedNumber(nums[0].phone_number);
        })
        .catch(() => toast.error('Could not load Twilio numbers'))
        .finally(() => setLoading(false));
    }
  }, [open]);

  const handleCall = async () => {
    if (!selectedNumber || !targetPhone) return;
    setCalling(true);
    try {
      const res = await base44.functions.invoke('twilioMakeCall', {
        lead_id: leadId,
        to_phone: targetPhone,
        from_phone: selectedNumber,
        lead_name: targetName,
      });
      if (res.data?.ok) {
        toast.success(`Calling ${targetName}…`);
        setOpen(false);
      } else {
        toast.error(res.data?.error || 'Call failed');
      }
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Call failed');
    } finally {
      setCalling(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size={size}
          variant="outline"
          className="gap-1.5"
          title={`Call ${targetName} via Twilio`}
          disabled={!targetPhone}
        >
          <Phone className="w-3.5 h-3.5" style={{ color: '#3b82f6' }} />
          {!iconOnly && <span>Call</span>}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PhoneCall className="w-5 h-5 text-blue-400" />
            Call via Twilio
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Target */}
          <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1">
            <p className="text-xs text-muted-foreground">Calling</p>
            <p className="font-semibold">{targetName}</p>
            <p className="text-sm text-muted-foreground">{targetPhone}</p>
          </div>

          {/* Number picker */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              Call from (Twilio number)
            </label>
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading numbers…
              </div>
            ) : numbers.length === 0 ? (
              <p className="text-sm text-amber-400">No Twilio numbers configured. Set up Twilio in the Twilio Hub.</p>
            ) : (
              <Select value={selectedNumber} onValueChange={setSelectedNumber}>
                <SelectTrigger>
                  <SelectValue placeholder="Select number" />
                </SelectTrigger>
                <SelectContent>
                  {numbers.map(n => (
                    <SelectItem key={n.phone_number} value={n.phone_number}>
                      {n.friendly_name || n.phone_number} — {n.phone_number}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            className="flex-1 gap-2"
            disabled={calling || !selectedNumber || !targetPhone}
            onClick={handleCall}
          >
            {calling ? <Loader2 className="w-4 h-4 animate-spin" /> : <Phone className="w-4 h-4" />}
            {calling ? 'Calling…' : 'Start Call'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}