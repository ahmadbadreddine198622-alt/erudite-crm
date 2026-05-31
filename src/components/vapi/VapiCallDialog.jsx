import React, { useState } from 'react';
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
import { Phone, Loader2, Mic } from 'lucide-react';
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

export default function VapiCallDialog({ lead }) {
    const [open, setOpen] = useState(false);
    const [assistants, setAssistants] = useState([]);
    const [selectedAssistant, setSelectedAssistant] = useState('');
    const [phoneNumber, setPhoneNumber] = useState(lead?.phone || '');
    const [loading, setLoading] = useState(false);
    const [fetchingAssistants, setFetchingAssistants] = useState(false);

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
            console.error(error);
        } finally {
            setFetchingAssistants(false);
        }
    };

    const handleOpenChange = (isOpen) => {
        setOpen(isOpen);
        if (isOpen && assistants.length === 0) {
            loadAssistants();
        }
        if (lead?.phone) {
            setPhoneNumber(lead.phone);
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
                phoneNumber: phoneNumber,
                leadId: lead?.id,
                leadName: lead?.full_name
            });

            if (response.data.success) {
                toast.success('AI voice call initiated!');
                setOpen(false);
            } else {
                toast.error(response.data.error || 'Failed to make call');
            }
        } catch (error) {
            toast.error(error.response?.data?.error || 'Failed to make call');
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                <Button variant="outline" className="gap-2">
                    <Mic className="w-4 h-4" />
                    AI Voice Call
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Mic className="w-5 h-5" />
                        Make AI Voice Call
                    </DialogTitle>
                    <DialogDescription>
                        Connect with {lead?.full_name || 'this contact'} using Vapi AI voice assistant.
                        The AI will handle the conversation based on your configured assistant.
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
                        <Select
                            value={selectedAssistant}
                            onValueChange={setSelectedAssistant}
                        >
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
                        <p className="text-xs text-muted-foreground">
                            Select which AI assistant configuration to use for this call.
                        </p>
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="phone">Phone Number</Label>
                        <Input
                            id="phone"
                            value={phoneNumber}
                            onChange={(e) => setPhoneNumber(e.target.value)}
                            placeholder="+971 50 123 4567"
                        />
                        <p className="text-xs text-muted-foreground">
                            Enter the destination phone number to call (E.164 format recommended).
                        </p>
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