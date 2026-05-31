import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Mic, Phone, Loader2, RefreshCw, MessageCircle, Play, Square, Settings,
    MessageSquare, BarChart, Layers, Copy, ExternalLink, Plus, Trash2, Edit,
    Workflow, Bot, Zap, FileAudio, Users, Clock, CheckCircle, AlertCircle
} from 'lucide-react';
import { format } from 'date-fns';
import PageHeader from '@/components/shared/PageHeader';
import { toast } from 'sonner';

export default function VapiWorkflow() {
    const [selectedAssistant, setSelectedAssistant] = useState(null);
    const [testPhoneNumber, setTestPhoneNumber] = useState('');
    const [isCalling, setIsCalling] = useState(false);
    const [activeTab, setActiveTab] = useState('assistants');

    // Fetch assistants
    const { data: assistants = [], isLoading: loadingAssistants, refetch: refetchAssistants } = useQuery({
        queryKey: ['vapi-assistants'],
        queryFn: async () => {
            const response = await base44.functions.invoke('listVapiAssistants', {});
            return response.data.success ? response.data.assistants : [];
        },
    });

    // Fetch recent calls
    const { data: calls = [], refetch: refetchCalls } = useQuery({
        queryKey: ['vapi-calls'],
        queryFn: async () => {
            await base44.functions.invoke('syncVapiCalls', {});
            const allCalls = await base44.entities.AircallCall.list('-started_at', 50);
            return allCalls.filter(call => call.from_number === 'Vapi AI' || call.aircall_id?.startsWith('vapi_'));
        },
    });

    const handleTestCall = async (assistantId) => {
        if (!testPhoneNumber) {
            toast.error('Please enter a phone number');
            return;
        }

        setIsCalling(true);
        try {
            const response = await base44.functions.invoke('makeVapiCall', {
                assistantId: assistantId,
                phoneNumber: testPhoneNumber,
                leadId: '',
                leadName: 'Test Call'
            });

            if (response.data.success) {
                toast.success('Test call initiated! Check the Calls tab for status.');
                setTestPhoneNumber('');
                refetchCalls();
            } else {
                toast.error(response.data.error || 'Failed to make call');
            }
        } catch (error) {
            toast.error(error.response?.data?.error || 'Failed to make call');
        } finally {
            setIsCalling(false);
        }
    };

    const getAssistantStatus = (assistant) => {
        const assistantCalls = calls.filter(c => c.agent_name?.includes(assistant.id));
        const completedCalls = assistantCalls.filter(c => c.status === 'done').length;
        return {
            total: assistantCalls.length,
            completed: completedCalls,
            lastCall: assistantCalls[0]?.started_at
        };
    };

    return (
        <div className="p-6 max-w-[1800px] mx-auto min-h-screen"
            style={{
                background: 'radial-gradient(ellipse at 30% 10%, rgba(20,30,60,0.55) 0%, rgba(8,11,18,0.92) 45%, rgba(6,8,14,0.98) 100%)',
            }}
        >
            <PageHeader title="Vapi AI Workflow" subtitle="Test and manage AI voice assistants directly from CRM">
                <div className="flex gap-2">
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => window.open('https://dashboard.vapi.ai', '_blank')}
                        className="gap-2"
                    >
                        <ExternalLink className="w-4 h-4" />
                        Vapi Dashboard
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => { refetchAssistants(); refetchCalls(); }}
                        className="gap-2"
                    >
                        <RefreshCw className="w-4 h-4" />
                        Refresh
                    </Button>
                </div>
            </PageHeader>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                <TabsList className="grid grid-cols-4 gap-2 liquid-glass p-1">
                    <TabsTrigger value="assistants" className="data-[state=active]:bg-white/15">
                        <Bot className="w-4 h-4 mr-2" />
                        Assistants
                    </TabsTrigger>
                    <TabsTrigger value="test" className="data-[state=active]:bg-white/15">
                        <Play className="w-4 h-4 mr-2" />
                        Test Call
                    </TabsTrigger>
                    <TabsTrigger value="calls" className="data-[state=active]:bg-white/15">
                        <Phone className="w-4 h-4 mr-2" />
                        Call History
                    </TabsTrigger>
                    <TabsTrigger value="setup" className="data-[state=active]:bg-white/15">
                        <Settings className="w-4 h-4 mr-2" />
                        Setup Guide
                    </TabsTrigger>
                </TabsList>

                {/* Assistants Tab */}
                <TabsContent value="assistants" className="space-y-6">
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {loadingAssistants ? (
                            <div className="col-span-full flex items-center justify-center py-12">
                                <Loader2 className="w-8 h-8 animate-spin text-white/50" />
                            </div>
                        ) : assistants.length > 0 ? (
                            assistants.map((assistant) => {
                                const stats = getAssistantStatus(assistant);
                                return (
                                    <Card key={assistant.id} className="liquid-glass">
                                        <CardHeader>
                                            <div className="flex items-start justify-between">
                                                <div className="flex-1">
                                                    <CardTitle className="text-white text-base">
                                                        {assistant.name || 'Unnamed Assistant'}
                                                    </CardTitle>
                                                    <CardDescription className="text-white/60 text-xs mt-1">
                                                        {assistant.id}
                                                    </CardDescription>
                                                </div>
                                                <Badge variant="outline" className="text-xs">
                                                    {assistant.model?.model?.replace('gpt-', '') || 'GPT-4'}
                                                </Badge>
                                            </div>
                                        </CardHeader>
                                        <CardContent className="space-y-4">
                                            <div className="text-xs text-white/50">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <MessageSquare className="w-3 h-3" />
                                                    <span>First Message</span>
                                                </div>
                                                <p className="line-clamp-2">
                                                    {assistant.firstMessage || 'Not configured'}
                                                </p>
                                            </div>

                                            <div className="grid grid-cols-3 gap-2 text-center pt-3 border-t border-white/10">
                                                <div>
                                                    <div className="text-lg font-bold text-white">{stats.total}</div>
                                                    <div className="text-xs text-white/50">Calls</div>
                                                </div>
                                                <div>
                                                    <div className="text-lg font-bold text-green-400">{stats.completed}</div>
                                                    <div className="text-xs text-white/50">Done</div>
                                                </div>
                                                <div>
                                                    <div className="text-xs text-white/50">
                                                        {stats.lastCall ? format(new Date(stats.lastCall), 'MMM d') : '—'}
                                                    </div>
                                                    <div className="text-xs text-white/50">Last Call</div>
                                                </div>
                                            </div>

                                            <div className="flex gap-2 pt-3">
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="flex-1 text-xs"
                                                    onClick={() => {
                                                        setSelectedAssistant(assistant);
                                                        setActiveTab('test');
                                                    }}
                                                >
                                                    <Play className="w-3 h-3 mr-1" />
                                                    Test
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="flex-1 text-xs"
                                                    onClick={() => window.open(`https://dashboard.vapi.ai/assistant/${assistant.id}`, '_blank')}
                                                >
                                                    <Edit className="w-3 h-3 mr-1" />
                                                    Edit
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                );
                            })
                        ) : (
                            <div className="col-span-full">
                                <Card className="liquid-glass">
                                    <CardContent className="text-center py-12 text-white/50">
                                        <Bot className="w-16 h-16 mx-auto mb-4 opacity-20" />
                                        <p className="text-sm">No assistants found</p>
                                        <p className="text-xs mt-1">Create an assistant in Vapi Dashboard first</p>
                                    </CardContent>
                                </Card>
                            </div>
                        )}
                    </div>
                </TabsContent>

                {/* Test Call Tab */}
                <TabsContent value="test" className="space-y-6">
                    <Card className="liquid-glass">
                        <CardHeader>
                            <CardTitle className="text-white flex items-center gap-2">
                                <Play className="w-5 h-5" />
                                Test AI Assistant
                            </CardTitle>
                            <CardDescription className="text-white/60">
                                Make a test call to any phone number using your Vapi assistant
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {!selectedAssistant && (
                                <div className="grid gap-2">
                                    <Label className="text-white/70">Select Assistant</Label>
                                    <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                                        {assistants.map((assistant) => (
                                            <button
                                                key={assistant.id}
                                                onClick={() => setSelectedAssistant(assistant)}
                                                className={`p-4 rounded-lg border text-left transition-all ${
                                                    selectedAssistant?.id === assistant.id
                                                        ? 'bg-white/10 border-white/30'
                                                        : 'bg-white/5 border-white/10 hover:bg-white/8'
                                                }`}
                                            >
                                                <div className="font-semibold text-white text-sm">
                                                    {assistant.name || 'Unnamed'}
                                                </div>
                                                <div className="text-xs text-white/50 mt-1">
                                                    {assistant.model?.model?.replace('gpt-', '') || 'GPT-4'}
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {selectedAssistant && (
                                <div className="space-y-4">
                                    <div className="p-4 rounded-lg bg-white/5 border border-white/10">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <Bot className="w-4 h-4 text-purple-400" />
                                                <span className="font-semibold text-white text-sm">
                                                    {selectedAssistant.name || 'Unnamed Assistant'}
                                                </span>
                                            </div>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => setSelectedAssistant(null)}
                                                className="text-xs"
                                            >
                                                Change
                                            </Button>
                                        </div>
                                        <p className="text-xs text-white/50">
                                            {selectedAssistant.firstMessage || 'No first message configured'}
                                        </p>
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor="test-phone" className="text-white/70">
                                            Test Phone Number
                                        </Label>
                                        <div className="flex gap-2">
                                            <Input
                                                id="test-phone"
                                                value={testPhoneNumber}
                                                onChange={(e) => setTestPhoneNumber(e.target.value)}
                                                placeholder="+971 50 123 4567"
                                                className="flex-1"
                                            />
                                            <Button
                                                onClick={() => handleTestCall(selectedAssistant.id)}
                                                disabled={isCalling || !testPhoneNumber}
                                                className="gap-2"
                                            >
                                                {isCalling ? (
                                                    <>
                                                        <Loader2 className="w-4 h-4 animate-spin" />
                                                        Calling...
                                                    </>
                                                ) : (
                                                    <>
                                                        <Phone className="w-4 h-4" />
                                                        Start Test
                                                    </>
                                                )}
                                            </Button>
                                        </div>
                                        <p className="text-xs text-white/50">
                                            Enter any phone number to test the assistant. Make sure Twilio is configured in Vapi.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Calls Tab */}
                <TabsContent value="calls" className="space-y-6">
                    <Card className="liquid-glass">
                        <CardHeader>
                            <CardTitle className="text-white flex items-center gap-2">
                                <Phone className="w-5 h-5" />
                                Call History
                            </CardTitle>
                            <CardDescription className="text-white/60">
                                {calls.length} calls recorded
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {calls.length > 0 ? (
                                <div className="space-y-2">
                                    {calls.map((call) => (
                                        <div key={call.id} className="flex items-center justify-between p-4 rounded-lg bg-white/5 border border-white/10">
                                            <div className="flex items-center gap-4">
                                                <div className={`w-3 h-3 rounded-full ${
                                                    call.status === 'done' ? 'bg-green-400' :
                                                    call.status === 'failed' ? 'bg-red-400' : 'bg-amber-400'
                                                }`} />
                                                <div>
                                                    <p className="text-sm font-semibold text-white">
                                                        {call.lead_name || call.to_number}
                                                    </p>
                                                    <p className="text-xs text-white/50">
                                                        {call.to_number} • {call.agent_name}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4 text-xs text-white/50">
                                                <span className="flex items-center gap-1">
                                                    <Clock className="w-3 h-3" />
                                                    {call.duration ? `${Math.round(call.duration / 60)}m ${call.duration % 60}s` : '—'}
                                                </span>
                                                <span>
                                                    {call.started_at ? format(new Date(call.started_at), 'MMM d, HH:mm') : '—'}
                                                </span>
                                                <Badge className={
                                                    call.status === 'done' ? 'bg-green-400/20 text-green-400 border-green-400/30' :
                                                    call.status === 'failed' ? 'bg-red-400/20 text-red-400 border-red-400/30' :
                                                    'bg-amber-400/20 text-amber-400 border-amber-400/30'
                                                }>
                                                    {call.status}
                                                </Badge>
                                                {call.recording_url && (
                                                    <Button size="sm" variant="ghost" className="h-6 text-xs">
                                                        <FileAudio className="w-3 h-3 mr-1" />
                                                        Recording
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-12 text-white/50">
                                    <Phone className="w-16 h-16 mx-auto mb-4 opacity-20" />
                                    <p className="text-sm">No calls yet</p>
                                    <p className="text-xs mt-1">Test calls will appear here</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Setup Guide Tab */}
                <TabsContent value="setup" className="space-y-6">
                    <Card className="liquid-glass">
                        <CardHeader>
                            <CardTitle className="text-white flex items-center gap-2">
                                <Settings className="w-5 h-5" />
                                Setup Vapi for CRM Calling
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="p-4 rounded-lg bg-blue-400/10 border border-blue-400/20">
                                <div className="flex items-start gap-3">
                                    <CheckCircle className="w-5 h-5 text-blue-400 mt-0.5" />
                                    <div className="text-xs text-blue-200/80">
                                        <p className="font-semibold mb-1">Step 1: Connect Twilio to Vapi</p>
                                        <ol className="list-decimal list-inside space-y-1 mt-2">
                                            <li>Go to <a href="https://dashboard.vapi.ai/settings/phone-providers" target="_blank" rel="noopener noreferrer" className="text-blue-300 underline">Vapi Dashboard &gt; Settings &gt; Phone Providers</a></li>
                                            <li>Connect your Twilio account with Account SID and Auth Token</li>
                                            <li>Save the configuration</li>
                                        </ol>
                                    </div>
                                </div>
                            </div>

                            <div className="p-4 rounded-lg bg-purple-400/10 border border-purple-400/20">
                                <div className="flex items-start gap-3">
                                    <CheckCircle className="w-5 h-5 text-purple-400 mt-0.5" />
                                    <div className="text-xs text-purple-200/80">
                                        <p className="font-semibold mb-1">Step 2: Add Phone Number</p>
                                        <ol className="list-decimal list-inside space-y-1 mt-2">
                                            <li>Go to <a href="https://dashboard.vapi.ai/phone-numbers" target="_blank" rel="noopener noreferrer" className="text-purple-300 underline">Vapi Dashboard &gt; Phone Numbers</a></li>
                                            <li>Click "Add Number" and select your Twilio number</li>
                                            <li>Copy the Phone Number ID (you'll need this for testing)</li>
                                        </ol>
                                    </div>
                                </div>
                            </div>

                            <div className="p-4 rounded-lg bg-green-400/10 border border-green-400/20">
                                <div className="flex items-start gap-3">
                                    <CheckCircle className="w-5 h-5 text-green-400 mt-0.5" />
                                    <div className="text-xs text-green-200/80">
                                        <p className="font-semibold mb-1">Step 3: Configure Assistant</p>
                                        <ol className="list-decimal list-inside space-y-1 mt-2">
                                            <li>Go to <a href="https://dashboard.vapi.ai/assistants" target="_blank" rel="noopener noreferrer" className="text-green-300 underline">Vapi Dashboard &gt; Assistants</a></li>
                                            <li>Edit your assistant or create a new one</li>
                                            <li>Add a transport and assign your phone number</li>
                                            <li>Configure the AI model and first message</li>
                                        </ol>
                                    </div>
                                </div>
                            </div>

                            <div className="p-4 rounded-lg bg-amber-400/10 border border-amber-400/20">
                                <div className="flex items-start gap-3">
                                    <AlertCircle className="w-5 h-5 text-amber-400 mt-0.5" />
                                    <div className="text-xs text-amber-200/80">
                                        <p className="font-semibold mb-1">Important Notes</p>
                                        <ul className="list-disc list-inside space-y-1 mt-2">
                                            <li>Twilio account must be verified and have credit</li>
                                            <li>Phone number must support voice calls</li>
                                            <li>Test with your own number first</li>
                                            <li>All calls are logged to this CRM automatically</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}