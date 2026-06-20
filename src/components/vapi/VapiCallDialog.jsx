import React, { useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Phone, PhoneOff, Loader2, Mic, PhoneIncoming } from 'lucide-react';
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

// Poll VAPI call status directly via the API
async function fetchVapiCallStatus(callId) {
    const res = await base44.functions.invoke('getVapiCallStatus', { callId });
    return res.data;
}

export default function VapiCallDialog({ lead, landlord, iconOnly = false }) {
    const [open, setOpen] = useState(false);
    const [assistants, setAssistants] = useState([]);
    const [selectedAssistant, setSelectedAssistant] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [loading, setLoading] = useState(false);
    const [fetchingAssistants, setFetchingAssistants] = useState(false);

    // call phases: idle | ringing | active | ended
    const [phase, setPhase] = useState('idle');
    const [activeCallId, setActiveCallId] = useState(null);
    const [callDuration, setCallDuration] = useState(0);
    const [hangingUp, setHangingUp] = useState(false);
    const [endReason, setEndReason] = useState('');

    const timerRef = useRef(null);
    const pollerRef = useRef(null);

    const entity = lead || landlord;
    const entityPhone = entity?.phone || entity?.whatsapp || '';
    const entityName = lead?.full_name || landlord?.full_name_en || landlord?.first_name || '';

    // Timer — only counts when active
    useEffect(() => {
        if (phase === 'active') {
            setCallDuration(0);
            timerRef.current = setInterval(() => setCallDuration(d => d + 1), 1000);
        } else {
            clearInterval(timerRef.current);
        }
        return () => clearInterval(timerRef.current);
    }, [phase]);

    // Poll VAPI for call status when we have an active call
    useEffect(() => {
        if (!activeCallId || phase === 'idle' || phase === 'ended') {
            clearInterval(pollerRef.current);
            return;
        }

        const poll = async () => {
            try {
                const res = await base44.functions.invoke('getVapiCallStatus', { callId: activeCallId });
                const status = res?.data?.status;
                const endedReason = res?.data?.endedReason;

                if (status === 'in-progress') {
                    setPhase('active');
                } else if (status === 'ringing' || status === 'queued') {
                    setPhase('ringing');
                } else if (status === 'ended' || status === 'failed' || status === 'cancelled') {
                    clearInterval(pollerRef.current);
                    setEndReason(endedReason || status);
                    setPhase('ended');
                }
            } catch (_) {}
        };

        poll(); // immediate first poll
        pollerRef.current = setInterval(poll, 3000);
        return () => clearInterval(pollerRef.current);
    }, [activeCallId, phase]);

    // Cleanup on unmount
    useEffect(() => () => {
        clearInterval(timerRef.current);
        clearInterval(pollerRef.current);
    }, []);

    const fmt = (s) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

    const loadAssistants = async () => {
        setFetchingAssistants(true);
        try {
            const response = await base44.functions.invoke('listVapiAssistants', {});
            if (response.data.success) {
                setAssistants(response.data.assistants);
                if (response.data.assistants.length > 0) setSelectedAssistant(response.data.assistants[0].id);
            }
        } catch (_) {
            toast.error('Failed to load Vapi assistants');
        } finally {
            setFetchingAssistants(false);
        }
    };

    const handleOpenChange = (isOpen) => {
        if (!isOpen && (phase === 'ringing' || phase === 'active')) return; // block close mid-call
        setOpen(isOpen);
        if (isOpen) {
            setPhoneNumber(entityPhone);
            setPhase('idle');
            setActiveCallId(null);
            setCallDuration(0);
            setEndReason('');
            if (assistants.length === 0) loadAssistants();
        }
    };

    const handleMakeCall = async () => {
        if (!selectedAssistant || !phoneNumber.trim()) {
            toast.error('Please select an assistant and enter a phone number');
            return;
        }
        setLoading(true);
        try {
            const response = await base44.functions.invoke('makeVapiCall', {
                assistantId: selectedAssistant,
                phoneNumber: phoneNumber.trim(),
                leadId: lead?.id,
                landlordId: landlord?.id,
                leadName: entityName,
            });
            if (response.data.success) {
                setActiveCallId(response.data.callId);
                setPhase('ringing');
                toast.success('AI voice call initiated!');
            } else {
                toast.error(response.data.error || 'Failed to make call');
            }
        } catch (error) {
            toast.error(error.response?.data?.error || 'Failed to make call');
        } finally {
            setLoading(false);
        }
    };

    const handleHangUp = async () => {
        setHangingUp(true);
        clearInterval(pollerRef.current);
        try {
            await base44.functions.invoke('hangupVapiCall', { callId: activeCallId });
            toast.success('Call ended');
        } catch (_) {
            toast.error('Failed to hang up — check VAPI dashboard');
        } finally {
            setHangingUp(false);
            setPhase('ended');
            setEndReason('hung_up');
        }
    };

    const trigger = iconOnly ? (
        <Button variant="ghost" size="icon" title="AI Voice Call (VAPI)">
            <Mic className="w-4 h-4 text-violet-400" />
        </Button>
    ) : (
        <Button variant="outline" className="gap-2">
            <Mic className="w-4 h-4" /> AI Voice Call
        </Button>
    );

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>{trigger}</DialogTrigger>

            <DialogContent className="p-0 overflow-hidden" style={{ background: '#0d1120', border: '1px solid rgba(139,92,246,0.25)', maxWidth: 360, borderRadius: 24 }}>
                <DialogTitle className="sr-only">VAPI AI Call</DialogTitle>

                {/* ── IDLE: Setup ── */}
                {phase === 'idle' && (
                    <div className="p-6 space-y-4">
                        <div className="text-center">
                            <div className="w-14 h-14 rounded-full mx-auto mb-3 flex items-center justify-center text-xl font-bold"
                                style={{ background: 'rgba(139,92,246,0.15)', border: '2px solid rgba(139,92,246,0.3)', color: '#c4b5fd' }}>
                                <Mic className="w-6 h-6" />
                            </div>
                            <p className="font-semibold text-white text-base">AI Voice Call</p>
                            <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>Powered by VAPI</p>
                        </div>

                        <div className="space-y-3">
                            <div>
                                <Label className="text-[10px] font-semibold uppercase tracking-widest mb-1.5 block" style={{ color: 'rgba(255,255,255,0.4)' }}>
                                    AI Assistant
                                </Label>
                                <Select value={selectedAssistant} onValueChange={setSelectedAssistant}>
                                    <SelectTrigger className="h-9 text-sm" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.9)' }}>
                                        <SelectValue placeholder="Select assistant" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {fetchingAssistants ? (
                                            <div className="p-2 text-sm flex items-center gap-2 text-muted-foreground">
                                                <Loader2 className="w-4 h-4 animate-spin" /> Loading…
                                            </div>
                                        ) : assistants.length > 0 ? assistants.map(a => (
                                            <SelectItem key={a.id} value={a.id}>
                                                <div className="flex items-center gap-2">
                                                    {a.name || 'Unnamed'}
                                                    {a.model?.model && <Badge variant="outline" className="text-xs">{a.model.model.replace('gpt-', '')}</Badge>}
                                                </div>
                                            </SelectItem>
                                        )) : (
                                            <div className="p-2 text-sm text-muted-foreground">No assistants found</div>
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <Label className="text-[10px] font-semibold uppercase tracking-widest mb-1.5 block" style={{ color: 'rgba(255,255,255,0.4)' }}>
                                    Phone Number to Call
                                </Label>
                                <Input
                                    value={phoneNumber}
                                    onChange={e => setPhoneNumber(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleMakeCall()}
                                    placeholder="+971 50 123 4567"
                                    className="text-base font-mono text-center"
                                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.95)' }}
                                />
                            </div>
                        </div>

                        <div className="flex gap-2">
                            <Button variant="outline" onClick={() => setOpen(false)} className="flex-1 text-sm">Cancel</Button>
                            <button
                                disabled={loading || !selectedAssistant || !phoneNumber.trim()}
                                onClick={handleMakeCall}
                                className="flex-1 py-2 rounded-xl font-bold text-white flex items-center justify-center gap-2 text-sm disabled:opacity-40"
                                style={{ background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)', boxShadow: '0 4px 20px rgba(139,92,246,0.4)' }}
                            >
                                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Phone className="w-4 h-4" />}
                                {loading ? 'Calling…' : 'Call Now'}
                            </button>
                        </div>
                    </div>
                )}

                {/* ── RINGING ── */}
                {phase === 'ringing' && (
                    <div className="px-6 py-10 flex flex-col items-center gap-6">
                        <div className="relative">
                            <div className="w-24 h-24 rounded-full absolute inset-0 border-2 border-violet-400/25 animate-ping" />
                            <div className="w-24 h-24 rounded-full flex items-center justify-center text-4xl font-bold relative"
                                style={{ background: 'rgba(139,92,246,0.15)', border: '2px solid rgba(139,92,246,0.4)', color: '#c4b5fd' }}>
                                {(entityName || '?').charAt(0).toUpperCase()}
                            </div>
                        </div>
                        <div className="text-center space-y-1">
                            <p className="text-violet-400 font-bold text-[11px] uppercase tracking-widest">Ringing…</p>
                            <p className="text-white text-xl font-bold">{entityName || 'Contact'}</p>
                            <p className="text-sm font-mono" style={{ color: 'rgba(255,255,255,0.4)' }}>{phoneNumber}</p>
                        </div>
                        <button onClick={handleHangUp} disabled={hangingUp}
                            className="w-14 h-14 rounded-full flex items-center justify-center active:scale-90 disabled:opacity-60"
                            style={{ background: 'linear-gradient(135deg,#ef4444,#dc2626)', boxShadow: '0 4px 20px rgba(239,68,68,0.5)' }}>
                            {hangingUp ? <Loader2 className="w-6 h-6 text-white animate-spin" /> : <PhoneOff className="w-6 h-6 text-white" />}
                        </button>
                    </div>
                )}

                {/* ── ACTIVE ── */}
                {phase === 'active' && (
                    <div className="px-6 pt-8 pb-8 flex flex-col items-center gap-5">
                        <div className="relative">
                            <div className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold"
                                style={{ background: 'rgba(139,92,246,0.2)', border: '2px solid rgba(139,92,246,0.5)', color: '#c4b5fd' }}>
                                {(entityName || '?').charAt(0).toUpperCase()}
                            </div>
                            <span className="absolute bottom-1 right-1 w-4 h-4 rounded-full bg-violet-400 border-2 animate-pulse"
                                style={{ borderColor: '#0d1120' }} />
                        </div>
                        <div className="text-center space-y-0.5">
                            <p className="text-violet-400 font-bold text-[11px] uppercase tracking-widest">Connected · AI Speaking</p>
                            <p className="text-white text-xl font-bold">{entityName || 'Contact'}</p>
                            <p className="text-2xl font-mono font-bold text-white mt-1">{fmt(callDuration)}</p>
                            <p className="text-xs font-mono" style={{ color: 'rgba(255,255,255,0.35)' }}>{phoneNumber}</p>
                        </div>
                        <button onClick={handleHangUp} disabled={hangingUp}
                            className="w-16 h-16 rounded-full flex items-center justify-center active:scale-90 disabled:opacity-60"
                            style={{ background: 'linear-gradient(135deg,#ef4444,#dc2626)', boxShadow: '0 4px 24px rgba(239,68,68,0.5)' }}>
                            {hangingUp ? <Loader2 className="w-7 h-7 text-white animate-spin" /> : <PhoneOff className="w-7 h-7 text-white" />}
                        </button>
                    </div>
                )}

                {/* ── ENDED ── */}
                {phase === 'ended' && (
                    <div className="px-6 py-10 flex flex-col items-center gap-5">
                        <div className="w-20 h-20 rounded-full flex items-center justify-center"
                            style={{ background: 'rgba(148,163,184,0.1)', border: '1px solid rgba(148,163,184,0.2)' }}>
                            <PhoneOff className="w-9 h-9 text-slate-400" />
                        </div>
                        <div className="text-center space-y-1">
                            <p className="text-xl font-semibold text-white">{entityName || phoneNumber}</p>
                            {callDuration > 0 && <p className="text-sm font-mono text-white/40">Duration: {fmt(callDuration)}</p>}
                            <p className="text-sm text-slate-400">{endReason === 'hung_up' ? 'Call ended by you' : endReason ? `Call ended: ${endReason.replace(/_/g, ' ')}` : 'Call ended'}</p>
                        </div>
                        <div className="flex gap-3">
                            <button onClick={() => { setPhase('idle'); setActiveCallId(null); setCallDuration(0); setEndReason(''); }}
                                className="px-4 py-2 rounded-xl text-sm font-semibold"
                                style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)', color: '#c4b5fd' }}>
                                Call Again
                            </button>
                            <button onClick={() => setOpen(false)}
                                className="px-4 py-2 rounded-xl text-sm font-semibold"
                                style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.6)' }}>
                                Close
                            </button>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}