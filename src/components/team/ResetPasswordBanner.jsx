import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { KeyRound } from 'lucide-react';

export default function ResetPasswordBanner() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleReset = async () => {
    if (!email.trim()) return;
    setLoading(true);
    try {
      await base44.users.inviteUser(email.trim(), 'user');
      toast.success(`Password reset link sent to ${email}`);
      setEmail('');
    } catch (e) {
      toast.error(e.message || 'Failed to send reset link');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl p-5" style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.35)' }}>
      <h2 className="text-base font-bold mb-3 flex items-center gap-2" style={{ color: '#a5b4fc' }}>
        <KeyRound className="w-5 h-5" /> Reset Password
      </h2>
      <div className="flex gap-3 flex-wrap">
        <Input
          placeholder="Enter email e.g. ahmad@erudite-estate.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleReset()}
          className="flex-1 min-w-52 glass-input text-base"
          style={{ minHeight: 44 }}
        />
        <Button
          onClick={handleReset}
          disabled={loading || !email.trim()}
          className="gap-2 font-bold text-base px-6"
          style={{ background: '#6366f1', color: '#fff', minHeight: 44 }}
        >
          <KeyRound className="w-5 h-5" />
          {loading ? 'Sending...' : 'Send Reset Link'}
        </Button>
      </div>
      <p className="text-xs mt-2" style={{ color: 'rgba(255,255,255,0.5)' }}>
        Sends a new login/password setup link to the specified email address.
      </p>
    </div>
  );
}