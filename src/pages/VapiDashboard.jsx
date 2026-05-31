import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Mic, Phone, Loader2, RefreshCw, MessageCircle, Calendar, Clock, TrendingUp,
    Play, Square, Settings, BarChart3, Users, Zap
} from 'lucide-react';
import { format } from 'date-fns';
import PageHeader from '@/components/shared/PageHeader';
import VapiCallDialog from '@/components/vapi/VapiCallDialog';

export default function VapiDashboard() {
    const [searchPhone, setSearchPhone] = useState('');
    const [selectedAssistant, setSelectedAssistant] = useState('');

    const { data: assistants = [], isLoading: loadingAssistants, refetch } = useQuery({
        queryKey: ['vapi-assistants'],
        queryFn: async () => {
            const response = await base44.functions.invoke('listVapiAssistants', {});
            return response.data.success ? response.data.assistants : [];
        },
    });

    const { data: calls = [] } = useQuery({
        queryKey: ['vapi-calls'],
        queryFn: async () => {
            const allCalls = await base44.entities.AircallCall.list('-started_at', 100);
            return allCalls.filter(call => call.from_number === 'Vapi AI' || call.aircall_id?.startsWith('vapi_'));
        },
    });

    const stats = {
        totalCalls: calls.length,
        completedCalls: calls.filter(c => c.status === 'completed').length,
        totalDuration: calls.reduce((sum, c) => sum + (c.duration || 0), 0),
        leadsContacted: new Set(calls.map(c => c.lead_id).filter(Boolean)).size
    };

    return (
        <div className="p-6 max-w-[1600px] mx-auto min-h-screen"
            style={{
                background: 'radial-gradient(ellipse at 30% 10%, rgba(20,30,60,0.55) 0%, rgba(8,11,18,0.92) 45%, rgba(6,8,14,0.98) 100%)',
            }}
        >
            <PageHeader title="AI Voice Assistant" subtitle="Manage Vapi AI calling and assistants">
                <Button
                    size="sm"
                    variant="outline"
                    onClick={() => refetch()}
                    className="gap-2"
                >
                    <RefreshCw className="w-4 h-4" />
                    Refresh
                </Button>
            </PageHeader>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-4 mb-6">
                <Card className="liquid-glass">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-white/70">Total Calls</CardTitle>
                        <Phone className="w-4 h-4 text-blue-400" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-white">{stats.totalCalls}</div>
                    </CardContent>
                </Card>
                <Card className="liquid-glass">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-white/70">Completed</CardTitle>
                        <MessageCircle className="w-4 h-4 text-green-400" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-white">{stats.completedCalls}</div>
                    </CardContent>
                </Card>
                <Card className="liquid-glass">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-white/70">Total Duration</CardTitle>
                        <Clock className="w-4 h-4 text-purple-400" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-white">
                            {Math.round(stats.totalDuration / 60)}m {stats.totalDuration % 60}s
                        </div>
                    </CardContent>
                </Card>
                <Card className="liquid-glass">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-white/70">Leads Contacted</CardTitle>
                        <Users className="w-4 h-4 text-amber-400" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-white">{stats.leadsContacted}</div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                {/* Quick Call */}
                <Card className="liquid-glass">
                    <CardHeader>
                        <CardTitle className="text-white flex items-center gap-2">
                            <Phone className="w-5 h-5" />
                            Quick AI Call
                        </CardTitle>
                        <CardDescription className="text-white/60">
                            Make an AI voice call to any phone number
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-2">
                            <Label htmlFor="quick-phone" className="text-white/70">Phone Number</Label>
                            <div className="flex gap-2">
                                <Input
                                    id="quick-phone"
                                    value={searchPhone}
                                    onChange={(e) => setSearchPhone(e.target.value)}
                                    placeholder="+971 50 123 4567"
                                    className="flex-1"
                                />
                                <VapiCallDialog
                                    lead={{ phone: searchPhone, full_name: 'Quick Call' }}
                                />
                            </div>
                        </div>
                        <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                            <div className="flex items-start gap-2">
                                <Zap className="w-4 h-4 text-amber-400 mt-0.5" />
                                <div className="text-xs text-white/70">
                                    <p className="font-semibold text-white/90 mb-1">How it works:</p>
                                    <ol className="list-decimal list-inside space-y-1">
                                        <li>Enter a phone number or select a lead</li>
                                        <li>Choose an AI assistant configuration</li>
                                        <li>The AI will call and handle the conversation</li>
                                        <li>All calls are logged and tracked in your CRM</li>
                                    </ol>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Assistants */}
                <Card className="liquid-glass">
                    <CardHeader>
                        <CardTitle className="text-white flex items-center gap-2">
                            <Mic className="w-5 h-5" />
                            AI Assistants
                        </CardTitle>
                        <CardDescription className="text-white/60">
                            Your configured Vapi assistants ({assistants.length})
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {loadingAssistants ? (
                            <div className="flex items-center justify-center py-8">
                                <Loader2 className="w-6 h-6 animate-spin text-white/50" />
                            </div>
                        ) : assistants.length > 0 ? (
                            <div className="space-y-3 max-h-[300px] overflow-y-auto">
                                {assistants.map((assistant) => (
                                    <div
                                        key={assistant.id}
                                        className="p-3 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                                    >
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <h4 className="text-sm font-semibold text-white">
                                                        {assistant.name || 'Unnamed Assistant'}
                                                    </h4>
                                                    <Badge variant="outline" className="text-xs">
                                                        {assistant.model?.model?.replace('gpt-', '') || 'GPT-4'}
                                                    </Badge>
                                                </div>
                                                <p className="text-xs text-white/50 mb-2">
                                                    {assistant.firstMessage || 'No first message configured'}
                                                </p>
                                                <div className="flex items-center gap-3 text-xs text-white/40">
                                                    <span className="flex items-center gap-1">
                                                        <Settings className="w-3 h-3" />
                                                        {assistant.transportConfigurations?.length || 0} transports
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        <BarChart3 className="w-3 h-3" />
                                                        {assistant.analysisPlan ? 'Analytics enabled' : 'No analytics'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-8 text-white/50">
                                <Mic className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                <p className="text-sm">No assistants found</p>
                                <p className="text-xs mt-1">Create assistants in your Vapi dashboard</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Recent Calls */}
            <Card className="liquid-glass mt-6">
                <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2">
                        <Phone className="w-5 h-5" />
                        Recent AI Calls
                    </CardTitle>
                    <CardDescription className="text-white/60">
                        Call history from Vapi AI assistant
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {calls.length > 0 ? (
                        <div className="space-y-2">
                            {calls.slice(0, 10).map((call) => (
                                <div
                                    key={call.id}
                                    className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`w-2 h-2 rounded-full ${
                                            call.status === 'completed' ? 'bg-green-400' :
                                            call.status === 'failed' ? 'bg-red-400' :
                                            'bg-amber-400'
                                        }`} />
                                        <div>
                                            <p className="text-sm font-medium text-white">
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
                                        <Badge
                                            variant="outline"
                                            className={
                                                call.status === 'completed' ? 'border-green-400 text-green-400' :
                                                call.status === 'failed' ? 'border-red-400 text-red-400' :
                                                'border-amber-400 text-amber-400'
                                            }
                                        >
                                            {call.status}
                                        </Badge>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-8 text-white/50">
                            <Phone className="w-12 h-12 mx-auto mb-3 opacity-20" />
                            <p className="text-sm">No calls yet</p>
                            <p className="text-xs mt-1">Make your first AI voice call to see history</p>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Setup Guide */}
            <Card className="liquid-glass mt-6">
                <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2">
                        <Settings className="w-5 h-5" />
                        Setup Guide
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid md:grid-cols-2 gap-4">
                        <div className="p-4 rounded-lg bg-white/5 border border-white/10">
                            <h4 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
                                <Play className="w-4 h-4 text-green-400" />
                                Getting Started
                            </h4>
                            <ol className="text-xs text-white/60 space-y-2 list-decimal list-inside">
                                <li>Create an account at <a href="https://vapi.ai" target="_blank" rel="noopener noreferrer" className="text-amber-400 hover:underline">vapi.ai</a></li>
                                <li>Configure your first AI assistant with prompts and voice</li>
                                <li>Connect your phone provider (Twilio, etc.)</li>
                                <li>Use the Quick Call feature or call from lead/contact pages</li>
                            </ol>
                        </div>
                        <div className="p-4 rounded-lg bg-white/5 border border-white/10">
                            <h4 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
                                <TrendingUp className="w-4 h-4 text-blue-400" />
                                Best Practices
                            </h4>
                            <ul className="text-xs text-white/60 space-y-2 list-disc list-inside">
                                <li>Use specific assistant configs for different use cases</li>
                                <li>Monitor call quality and adjust prompts as needed</li>
                                <li>Track conversion rates from AI calls</li>
                                <li>Review call recordings for training insights</li>
                            </ul>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}