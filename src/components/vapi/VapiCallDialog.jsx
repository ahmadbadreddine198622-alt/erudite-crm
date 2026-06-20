import React, { useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
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

export default function VapiCallDialog({ lead, iconOnly = false }) {
    const [open, setOpen] = useState(false);
    const [assistants, setAssistants] = useState([]);
    const [selectedAssistant, setSelectedAssistant] = useState('');
    const [phoneNumber, setPhoneNumber] = useState(lead?.phone || '');
    const [loading, setLoading] = useState(false);
    const [fetchingAssistants, setFetchingAssistants] = useState(false);
    const [activeCallId, setActiveCallId] = useState(null);
    const [callDuration, setCallDuration] = useState(0);
    const [hangingUp, setHangingUp] = useState(false);
    const timerRef = useRef(null);

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
        // Don't allow closing while a call is active
        if (!isOpen && activeCallId) return;
        setOpen(isOpen);
        if (isOpen) {
            setPhoneNumber(lead?.phone || '');
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
                leadName: lead?.full_name
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

    // Active call screen
    if (activeCallId) {
        return (
            <Dialog open={open} onOpenChange={handleOpenChange}>
                <DialogTrigger asChild>
                    {iconOnly ? (
                        <Button variant="ghost" size="icon" title="AI Voice Call (VAPI)">
                            <Mic className="w-4 h-4 text-violet-400" />
                        </Button>
                    ) : (
                        <Button variant="outline" className="gap-2">
                            <Mic className="w-4 h-4" />
                            AI Voice Call
                        </Button>
                    )}
                </DialogTrigger>
                <DialogContent className="sm:max-w-[400px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Mic className="w-5 h-5 text-violet-400" />
                            AI Call in Progress
                        </DialogTitle>
                    </DialogHeader>

                    <div className="flex flex-col items-center gap-6 py-8">
                        {/* Pulsing animation */}
                        <div className="relative">
                            <div className="w-20 h-20 rounded-full bg-violet-500/20 animate-ping absolute inset-0" />
                            <div className="w-20 h-20 rounded-full bg-violet-500/30 flex items-center justify-center relative">
                                <Mic className="w-8 h-8 text-violet-400" />
                            </div>
                        </div>

                        <div className="text-center space-y-1">
                            <p className="font-semibold text-lg">{lead?.full_name || phoneNumber}</p>
                            <p className="text-sm text-muted-foreground">{phoneNumber}</p>
                            <p className="text-2xl font-mono tabular-nums text-violet-400 mt-2">
                                {formatDuration(callDuration)}
                            </p>
                        </div>

                        <Button
                            onClick={handleHangUp}
                            disabled={hangingUp}
                            className="gap-2 bg-red-600 hover:bg-red-700 text-white px-8 py-3 text-base rounded-full"
                            size="lg"
                        >
                            {hangingUp ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <PhoneOff className="w-5 h-5" />
                            )}
                            {hangingUp ? 'Ending...' : 'Hang Up'}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        );
    }

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                {iconOnly ? (
                    <Button variant="ghost" size="icon" title="AI Voice Call (VAPI)">
                        <Mic className="w-4 h-4 text-violet-400" />
                    </Button>
                ) : (
                    <Button variant="outline" className="gap-2">
                        <Mic className="w-4 h-4" />
                        AI Voice Call
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Mic className="w-5 h-5" />
                        Make AI Voice Call
                    </DialogTitle>
                    <DialogDescription>
                        Connect with {lead?.full_name || 'this contact'} using Vapi AI voice assistant.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    {lead && (
                        <div className="rounded-lg border bg-muted/50 p-3">
                            <div className="flex items-center gap-2 mb-2">
                                <Phone className="w-4 h-4 text-muted-foreground" />
                                <span className="font-medium">Contact</span>
                            </div>
                            <div className="text-sm">{lead.full_name}</div>
                            <div className="text-sm text-muted-foreground">{lead.phone}</div>
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

                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleMakeCall}
                        disabled={loading || !selectedAssistant || !phoneNumber}
                        className="gap-2"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Initiating Call...
                            </>
                        ) : (
                            <>
                                <Phone className="w-4 h-4" />
                                Make AI Call
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}