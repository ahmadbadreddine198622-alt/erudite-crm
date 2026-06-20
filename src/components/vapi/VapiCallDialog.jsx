import React, { useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Phone, PhoneOff, Loader2, Mic } from 'lucide-react';
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

export default function VapiCallDialog({ lead, landlord, iconOnly = false }) {
    const [open, setOpen] = useState(false);
    const [assistants, setAssistants] = useState([]);
    const [selectedAssistant, setSelectedAssistant] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [loading, setLoading] = useState(false);
    const [fetchingAssistants, setFetchingAssistants] = useState(false);
    const [activeCallId, setActiveCallId] = useState(null);
    const [callDuration, setCallDuration] = useState(0);
    const [hangingUp, setHangingUp] = useState(false);
    const timerRef = useRef(null);

    const entity = lead || landlord;
    const entityPhone = entity?.phone || entity?.whatsapp || '';
    const entityName = lead?.full_name || landlord?.full_name_en || landlord?.first_name || '';

    useEffect(() => {
        if (activeCallId) {
            setCallDuration(0);
            timerRef.current = setInterval(() => setCallDuration(d => d + 1), 1000);
        } else {
            clearInterval(timerRef.current);
        }
        return () => clearInterval(timerRef.current);
    }, [activeCallId]);

    const formatDuration = (secs) => {
        const m = Math.floor(secs / 60).toString().padStart(2, '0');
        const s = (secs % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    const loadAssistants = async () => {
        setFetchingAssistants(true);
        try {
            const response = await base44.functions.invoke('listVapiAssistants', {});
            if (response.data.success) {
                setAssistants(response.data.assistants);
                if (response.data.assistants.length > 0) {
                    setSelectedAssistant(response.data.assistants[0].id);
                }
            }
        } catch (error) {
            toast.error('Failed to load Vapi assistants');
        } finally {
            setFetchingAssistants(false);
        }
    };

    const handleOpenChange = (isOpen) => {
        if (!isOpen && activeCallId) return; // block close during active call
        setOpen(isOpen);
        if (isOpen) {
            setPhoneNumber(entityPhone);
            setActiveCallId(null);
            setCallDuration(0);
            if (assistants.length === 0) loadAssistants();
        }
    };

    const handleMakeCall = async () => {
        if (!selectedAssistant || !phoneNumber) {
            toast.error('Please select an assistant and enter a phone number');
            return;
        }
        setLoading(true);
        try {
            const response = await base44.functions.invoke('makeVapiCall', {
                assistantId: selectedAssistant,
                phoneNumber,
                leadId: lead?.id,
                landlordId: landlord?.id,
                leadName: entityName,
            });
            if (response.data.success) {
                setActiveCallId(response.data.callId);
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
        try {
            await base44.functions.invoke('hangupVapiCall', { callId: activeCallId });
            toast.success('Call ended');
        } catch (error) {
            toast.error('Failed to hang up — please check VAPI dashboard');
        } finally {
            setHangingUp(false);
            setActiveCallId(null);
            setOpen(false);
        }
    };

    const trigger = iconOnly ? (
        <Button variant="ghost" size="icon" title="AI Voice Call (VAPI)">
            <Mic className="w-4 h-4 text-violet-400" />
        </Button>
    ) : (
        <Button variant="outline" className="gap-2">
            <Mic className="w-4 h-4" />
            AI Voice Call
        </Button>
    );

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>{trigger}</DialogTrigger>

            <DialogContent className="sm:max-w-[440px]">
                {/* ── ACTIVE CALL SCREEN ── */}
                {activeCallId ? (
                    <>
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                <Mic className="w-5 h-5 text-violet-400" />
                                AI Call in Progress
                            </DialogTitle>
                        </DialogHeader>

                        <div className="flex flex-col items-center gap-6 py-8">
                            <div className="relative">
                                <div className="w-20 h-20 rounded-full bg-violet-500/20 animate-ping absolute inset-0" />
                                <div className="w-20 h-20 rounded-full bg-violet-500/30 flex items-center justify-center relative">
                                    <Mic className="w-8 h-8 text-violet-400" />
                                </div>
                            </div>

                            <div className="text-center space-y-1">
                                <p className="font-semibold text-lg">{entityName || phoneNumber}</p>
                                <p className="text-sm text-muted-foreground">{phoneNumber}</p>
                                <p className="text-2xl font-mono tabular-nums text-violet-400 mt-2">
                                    {formatDuration(callDuration)}
                                </p>
                            </div>

                            <Button
                                onClick={handleHangUp}
                                disabled={hangingUp}
                                size="lg"
                                className="gap-2 px-8 py-3 text-base rounded-full"
                                style={{ background: 'linear-gradient(135deg,#ef4444,#dc2626)', color: 'white', border: 'none' }}
                            >
                                {hangingUp
                                    ? <Loader2 className="w-5 h-5 animate-spin" />
                                    : <PhoneOff className="w-5 h-5" />}
                                {hangingUp ? 'Ending...' : 'Hang Up'}
                            </Button>
                        </div>
                    </>
                ) : (
                    /* ── SETUP SCREEN ── */
                    <>
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                <Mic className="w-5 h-5" />
                                Make AI Voice Call
                            </DialogTitle>
                            <DialogDescription>
                                Connect with {entityName || 'this contact'} using Vapi AI.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="grid gap-4 py-4">
                            {entity && (
                                <div className="rounded-lg border bg-muted/50 p-3">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Phone className="w-4 h-4 text-muted-foreground" />
                                        <span className="font-medium text-sm">{entityName}</span>
                                    </div>
                                    <div className="text-sm text-muted-foreground">{entityPhone}</div>
                                </div>
                            )}

                            <div className="grid gap-2">
                                <Label htmlFor="assistant">AI Assistant</Label>
                                <Select value={selectedAssistant} onValueChange={setSelectedAssistant}>
                                    <SelectTrigger id="assistant">
                                        <SelectValue placeholder="Select AI assistant" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {fetchingAssistants ? (
                                            <div className="p-2 text-sm text-muted-foreground flex items-center gap-2">
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                Loading assistants...
                                            </div>
                                        ) : assistants.length > 0 ? (
                                            assistants.map((assistant) => (
                                                <SelectItem key={assistant.id} value={assistant.id}>
                                                    <div className="flex items-center gap-2">
                                                        <span>{assistant.name || 'Unnamed Assistant'}</span>
                                                        {assistant.model?.model && (
                                                            <Badge variant="outline" className="text-xs">
                                                                {assistant.model.model.replace('gpt-', '')}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </SelectItem>
                                            ))
                                        ) : (
                                            <div className="p-2 text-sm text-muted-foreground">
                                                No assistants found. Create one in Vapi dashboard.
                                            </div>
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="phone">Phone Number</Label>
                                <Input
                                    id="phone"
                                    value={phoneNumber}
                                    onChange={(e) => setPhoneNumber(e.target.value)}
                                    placeholder="+971 50 123 4567"
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                            <Button
                                onClick={handleMakeCall}
                                disabled={loading || !selectedAssistant || !phoneNumber}
                                className="gap-2"
                            >
                                {loading ? (
                                    <><Loader2 className="w-4 h-4 animate-spin" /> Initiating...</>
                                ) : (
                                    <><Phone className="w-4 h-4" /> Make AI Call</>
                                )}
                            </Button>
                        </div>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}