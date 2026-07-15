import React, { useState, useEffect, useCallback, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { Send, Phone, CheckCircle2, Loader2, AlertCircle, Lock, ArrowRight, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

const STATUS_META = {
  connected:    { label: 'Connected',     color: '#34d399', bg: 'rgba(52,211,153,0.15)',  icon: CheckCircle2, spin: false },
  connecting:   { label: 'Connecting…',   color: '#fbbf24', bg: 'rgba(251,191,36,0.15)',  icon: Loader2,      spin: true  },
  error:        { label: 'Error',         color: '#f87171', bg: 'rgba(248,113,113,0.15)', icon: AlertCircle,  spin: false },
  disconnected: { label: 'Disconnected',  color: '#94a3b8', bg: 'rgba(148,163,184,0.15)', icon: AlertCircle,  spin: false },
};

function StatusBadge({ status }) {
  const meta = STATUS_META[status] || STATUS_META.disconnected;
  const Icon = meta.icon;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 99, fontSize: 12, fontWeight: 600, background: meta.bg, color: meta.color, border: `1px solid ${meta.color}40` }}>
      <Icon size={14} className={meta.spin ? 'animate-spin' : ''} />
      {meta.label}
    </span>
  );
}

export default function TelegramSettings() {
  const { user, isAdmin } = useCurrentUser();
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState('idle'); // idle | code | password | done
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [loginId, setLoginId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [allSessions, setAllSessions] = useState([]);
  const [startError, setStartError] = useState(null);
  const pollRef = useRef(null);

  const loadSession = useCallback(async () => {
  if (!user?.email) return;
  try {
    const res = await base44.entities.TelegramSession.filter({ agent_email: user.email }, '-updated_date', 1);
    setSession(res?.[0] || null);
    if (res?.[0]?.status === 'connected') {
      setStep('done');
    } else if (res?.[0]?.status === 'connecting') {
      // Restore the code-entry step using the login_id stored on the session
      // record so the user can enter their Telegram login code even after a
      // page refresh.
      if (res?.[0]?.login_id) {
        setLoginId(res[0].login_id);
        setStep('code');
      }
    }
  } catch { setSession(null); }
  finally { setLoading(false); }
  }, [user?.email]);

  const loadAllSessions = useCallback(async () => {
    if (!isAdmin) return;
    try { setAllSessions(await base44.entities.TelegramSession.list('-updated_date', 100) || []); }
    catch { setAllSessions([]); }
  }, [isAdmin]);

  useEffect(() => {
    if (!user?.email) return;
    loadSession();
    loadAllSessions();
  }, [user?.email]);

  // Poll status during the code step
  const pollStatus = useCallback(async () => {
    if (!loginId) return;
    try {
      const res = await base44.functions.invoke('telegramConnectStatus', { login_id: loginId });
      const data = res.data || res;
      if (data.status === 'complete' || data.status === 'connected') {
        setStep('done'); loadSession(); loadAllSessions();
        toast.success('Telegram connected!');
        if (pollRef.current) clearInterval(pollRef.current);
      } else if (data.status === 'waiting_password') {
        setStep('password');
        if (pollRef.current) clearInterval(pollRef.current);
      } else if (data.status === 'error') {
        setStep('idle');
        toast.error('Telegram login failed');
        if (pollRef.current) clearInterval(pollRef.current);
      }
    } catch { /* ignore poll errors */ }
  }, [loginId, loadSession, loadAllSessions]);

  useEffect(() => {
    if (step !== 'code' || !loginId) return;
    pollRef.current = setInterval(pollStatus, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [step, loginId, pollStatus]);

  const handleStart = async () => {
    if (!phone.trim()) return;
    setBusy(true);
    setStartError(null);
    try {
      const res = await base44.functions.invoke('telegramConnectStart', { phone: phone.trim() });
      const data = res.data || res;
      if (data.login_id) {
        setLoginId(data.login_id);
        setStep('code');
        toast.success('Code sent to your Telegram app');
      }
      else {
        setStartError(data.error || 'Failed to start login — the Telegram relay service may be down.');
        toast.error(data.error || 'Failed to start login');
      }
    } catch (e) {
      const msg = e?.response?.data?.error || e?.message || 'Failed to start';
      setStartError(msg + ' — the Telegram relay service may be temporarily unavailable. Please try again in a few minutes.');
      toast.error(msg);
    }
    finally { setBusy(false); }
  };

  const handleSubmitCode = async () => {
    if (!code.trim()) return;
    setBusy(true);
    try {
      const res = await base44.functions.invoke('telegramConnectSubmit', { login_id: loginId, code: code.trim() });
      const data = res.data || res;
      if (data.status === 'complete' || data.status === 'connected') {
        setStep('done'); loadSession(); loadAllSessions(); toast.success('Telegram connected!');
      } else if (data.status === 'waiting_password') {
        setStep('password');
      } else if (data.status === 'error') {
        toast.error('Login failed: ' + (data.error || ''));
        setStep('idle');
      }
    } catch (e) { toast.error(e?.response?.data?.error || e?.message || 'Failed to submit code'); }
    finally { setBusy(false); }
  };

  const handleSubmitPassword = async () => {
    if (!password.trim()) return;
    setBusy(true);
    try {
      const res = await base44.functions.invoke('telegramConnectSubmit', { login_id: loginId, password: password.trim() });
      const data = res.data || res;
      if (data.status === 'complete' || data.status === 'connected') {
        setStep('done'); loadSession(); loadAllSessions(); toast.success('Telegram connected!');
      } else if (data.status === 'error') {
        toast.error('Login failed: ' + (data.error || '')); setStep('idle');
      }
    } catch (e) { toast.error(e?.response?.data?.error || e?.message || 'Failed to submit password'); }
    finally { setBusy(false); }
  };

  if (loading) {
    return <div className="page-root flex items-center justify-center"><Loader2 className="animate-spin text-accent" size={28} /></div>;
  }

  const btnStyle = {
    padding: '10px 18px', borderRadius: 8, background: '#d4af37', color: '#1a1205',
    border: 'none', fontWeight: 700, fontSize: 14, cursor: 'pointer',
    opacity: 1, display: 'flex', alignItems: 'center', gap: 6,
  };
  const inputStyle = {
    flex: 1, padding: '10px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: 14, outline: 'none',
  };

  return (
    <div className="page-root page-enter">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <div style={{ width: 48, height: 48, borderRadius: 12, background: 'linear-gradient(135deg, #0088cc, #005577)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Send size={24} color="#fff" />
        </div>
        <div>
          <h1 className="page-title text-xl">Telegram Settings</h1>
          <p className="page-subtitle">Connect your personal Telegram account to send messages to landlords</p>
        </div>
      </div>

      {/* Current session status */}
      <div className="glass-card" style={{ padding: 20, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)' }}>Your Telegram Account</span>
          <StatusBadge status={session?.status || 'disconnected'} />
        </div>
        {session?.status === 'connected' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: 'rgba(255,255,255,0.9)' }}>
              <Phone size={16} color="#d4af37" /> {session.phone}
            </div>
            {session.telegram_username && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 14, color: 'rgba(255,255,255,0.7)' }}>
                <span style={{ color: '#d4af37' }}>@</span>{session.telegram_username}
              </div>
            )}
            {session.connected_at && (
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
                Connected {new Date(session.connected_at).toLocaleString()}
              </div>
            )}
          </div>
        ) : session?.status === 'connecting' ? (
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>Connection in progress — complete the steps below.</p>
        ) : session?.status === 'error' ? (
          <p style={{ fontSize: 13, color: '#f87171' }}>Connection failed. Try again below.</p>
        ) : (
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>No Telegram account connected yet.</p>
        )}
      </div>

      {/* Connect flow */}
      {step !== 'done' && (
        <div className="glass-card" style={{ padding: 20 }}>
          {step === 'idle' && (
            <>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginBottom: 8, display: 'block' }}>Phone Number</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input type="tel" placeholder="+9715XXXXXXXX" value={phone} onChange={e => setPhone(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleStart()} style={inputStyle} />
                <button onClick={handleStart} disabled={busy || !phone.trim()} style={{ ...btnStyle, opacity: (busy || !phone.trim()) ? 0.5 : 1 }}>
                  {busy ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />} Start
                </button>
              </div>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 8 }}>Enter your phone in international format. Telegram will send a login code to your app.</p>
              {startError && (
                <div style={{ marginTop: 10, padding: '10px 14px', borderRadius: 8, background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <AlertCircle size={16} color="#f87171" style={{ flex: 'none', marginTop: 1 }} />
                  <span style={{ fontSize: 12, color: '#fca5a5', lineHeight: 1.4 }}>{startError}</span>
                </div>
              )}
            </>
          )}
          {step === 'code' && (
            <>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginBottom: 8, display: 'block' }}>Enter the code Telegram just sent you</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input type="text" placeholder="12345" value={code} onChange={e => setCode(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSubmitCode()} style={{ ...inputStyle, fontSize: 16, letterSpacing: '0.1em', textAlign: 'center' }} />
                <button onClick={handleSubmitCode} disabled={busy || !code.trim()} style={{ ...btnStyle, opacity: (busy || !code.trim()) ? 0.5 : 1 }}>
                  {busy ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />} Submit
                </button>
              </div>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 8 }}>Checking status automatically every 3 seconds…</p>
            </>
          )}
          {step === 'password' && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Lock size={14} color="#d4af37" />
                <label style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>This account has 2FA — enter your Telegram password</label>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSubmitPassword()} style={inputStyle} />
                <button onClick={handleSubmitPassword} disabled={busy || !password.trim()} style={{ ...btnStyle, opacity: (busy || !password.trim()) ? 0.5 : 1 }}>
                  {busy ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />} Submit
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Success state */}
      {step === 'done' && (
        <div className="glass-card" style={{ padding: 20, borderColor: 'rgba(52,211,153,0.3)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <CheckCircle2 size={24} color="#34d399" />
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#34d399' }}>Telegram Connected!</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>You can now send Telegram messages to landlords from the CRM.</div>
          </div>
        </div>
      )}

      {/* Admin: all sessions table */}
      {isAdmin && allSessions.length > 0 && (
        <div className="glass-card" style={{ padding: 20, marginTop: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)' }}>All Agent Sessions</span>
            <button onClick={loadAllSessions} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d4af37', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
              <RefreshCw size={12} /> Refresh
            </button>
          </div>
          <table className="glass-table w-full" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>Agent</th>
                <th style={{ textAlign: 'left' }}>Phone</th>
                <th style={{ textAlign: 'left' }}>Status</th>
                <th style={{ textAlign: 'left' }}>Connected</th>
              </tr>
            </thead>
            <tbody>
              {allSessions.map(s => (
                <tr key={s.id}>
                  <td>{s.agent_email}</td>
                  <td>{s.phone || '—'}</td>
                  <td><StatusBadge status={s.status} /></td>
                  <td>{s.connected_at ? new Date(s.connected_at).toLocaleString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}