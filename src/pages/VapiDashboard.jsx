import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Mic, Phone, Loader2, RefreshCw, MessageCircle, Calendar, Clock, TrendingUp,
    Play, Square, Settings, BarChart3, Users, Zap, Activity, FileAudio,
    Database, GitBranch, Webhook, CreditCard, Shield, Globe, Headphones,
    MessageSquare, BarChart, Layers, Copy, ExternalLink, Plus, Trash2, Edit
} from 'lucide-react';
import { format } from 'date-fns';
import PageHeader from '@/components/shared/PageHeader';
import VapiCallDialog from '@/components/vapi/VapiCallDialog';

export default function VapiDashboard() {
    const [searchPhone, setSearchPhone] = useState('');
    const [selectedAssistant, setSelectedAssistant] = useState(null);
    const [activeTab, setActiveTab] = useState('overview');

    const { data: assistants = [], isLoading: loadingAssistants, refetch: refetchAssistants } = useQuery({
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
        completedCalls: calls.filter(c => c.status === 'completed' || c.status === 'done').length,
        totalDuration: calls.reduce((sum, c) => sum + (c.duration || 0), 0),
        leadsContacted: new Set(calls.map(c => c.lead_id).filter(Boolean)).size,
        avgDuration: calls.length > 0 ? Math.round(calls.reduce((sum, c) => sum + (c.duration || 0), 0) / calls.length) : 0,
        successRate: calls.length > 0 ? Math.round((calls.filter(c => c.status === 'completed' || c.status === 'done').length / calls.length) * 100) : 0
    };

    const getAssistantStats = (assistantId) => {
        const assistantCalls = calls.filter(c => c.agent_name?.includes(assistantId) || c.aircall_id?.includes(assistantId));
        return {
            total: assistantCalls.length,
            completed: assistantCalls.filter(c => c.status === 'completed' || c.status === 'done').length,
            duration: assistantCalls.reduce((sum, c) => sum + (c.duration || 0), 0)
        };
    };

    return (
        <div className="p-6 max-w-[1800px] mx-auto min-h-screen"
            style={{
                background: 'radial-gradient(ellipse at 30% 10%, rgba(20,30,60,0.55) 0%, rgba(8,11,18,0.92) 45%, rgba(6,8,14,0.98) 100%)',
            }}
        >
            <PageHeader title="Vapi AI Voice Platform" subtitle="Complete voice AI management and analytics">
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
                        onClick={() => { refetchAssistants(); }}
                        className="gap-2"
                    >
                        <RefreshCw className="w-4 h-4" />
                        Refresh
                    </Button>
                </div>
            </PageHeader>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                <TabsList className="grid grid-cols-6 gap-2 liquid-glass p-1">
                    <TabsTrigger value="overview" className="data-[state=active]:bg-white/15">
                        <BarChart className="w-4 h-4 mr-2" />
                        Overview
                    </TabsTrigger>
                    <TabsTrigger value="assistants" className="data-[state=active]:bg-white/15">
                        <Mic className="w-4 h-4 mr-2" />
                        Assistants
                    </TabsTrigger>
                    <TabsTrigger value="calls" className="data-[state=active]:bg-white/15">
                        <Phone className="w-4 h-4 mr-2" />
                        Calls
                    </TabsTrigger>
                    <TabsTrigger value="analytics" className="data-[state=active]:bg-white/15">
                        <BarChart3 className="w-4 h-4 mr-2" />
                        Analytics
                    </TabsTrigger>
                    <TabsTrigger value="recordings" className="data-[state=active]:bg-white/15">
                        <FileAudio className="w-4 h-4 mr-2" />
                        Recordings
                    </TabsTrigger>
                    <TabsTrigger value="settings" className="data-[state=active]:bg-white/15">
                        <Settings className="w-4 h-4 mr-2" />
                        Settings
                    </TabsTrigger>
                </TabsList>

                {/* Overview Tab */}
                <TabsContent value="overview" className="space-y-6">
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                        <Card className="liquid-glass">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-xs font-medium text-white/70">Total Calls</CardTitle>
                                <Phone className="w-4 h-4 text-blue-400" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-xl font-bold text-white">{stats.totalCalls}</div>
                            </CardContent>
                        </Card>
                        <Card className="liquid-glass">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-xs font-medium text-white/70">Completed</CardTitle>
                                <MessageCircle className="w-4 h-4 text-green-400" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-xl font-bold text-white">{stats.completedCalls}</div>
                            </CardContent>
                        </Card>
                        <Card className="liquid-glass">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-xs font-medium text-white/70">Success Rate</CardTitle>
                                <Activity className="w-4 h-4 text-emerald-400" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-xl font-bold text-white">{stats.successRate}%</div>
                            </CardContent>
                        </Card>
                        <Card className="liquid-glass">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-xs font-medium text-white/70">Total Duration</CardTitle>
                                <Clock className="w-4 h-4 text-purple-400" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-xl font-bold text-white">
                                    {Math.round(stats.totalDuration / 60)}m {stats.totalDuration % 60}s
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="liquid-glass">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-xs font-medium text-white/70">Avg Duration</CardTitle>
                                <Clock className="w-4 h-4 text-cyan-400" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-xl font-bold text-white">
                                    {Math.round(stats.avgDuration / 60)}m {stats.avgDuration % 60}s
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="liquid-glass">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-xs font-medium text-white/70">Leads</CardTitle>
                                <Users className="w-4 h-4 text-amber-400" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-xl font-bold text-white">{stats.leadsContacted}</div>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="grid gap-6 md:grid-cols-2">
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
                            </CardContent>
                        </Card>

                        <Card className="liquid-glass">
                            <CardHeader>
                                <CardTitle className="text-white flex items-center gap-2">
                                    <Mic className="w-5 h-5" />
                                    Assistants Overview
                                </CardTitle>
                                <CardDescription className="text-white/60">
                                    {assistants.length} configured assistants
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                {loadingAssistants ? (
                                    <div className="flex items-center justify-center py-8">
                                        <Loader2 className="w-6 h-6 animate-spin text-white/50" />
                                    </div>
                                ) : assistants.length > 0 ? (
                                    <div className="space-y-2 max-h-[200px] overflow-y-auto">
                                        {assistants.slice(0, 5).map((assistant) => {
                                            const asstStats = getAssistantStats(assistant.id);
                                            return (
                                                <div
                                                    key={assistant.id}
                                                    className="p-3 rounded-lg bg-white/5 border border-white/10"
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <div>
                                                            <h4 className="text-sm font-semibold text-white">
                                                                {assistant.name || 'Unnamed'}
                                                            </h4>
                                                            <p className="text-xs text-white/50">
                                                                {asstStats.total} calls - {Math.round(asstStats.duration / 60)}m total
                                                            </p>
                                                        </div>
                                                        <Badge variant="outline" className="text-xs">
                                                            {assistant.model?.model?.replace('gpt-', '') || 'GPT-4'}
                                                        </Badge>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="text-center py-8 text-white/50">
                                        <Mic className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                        <p className="text-sm">No assistants configured</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    <Card className="liquid-glass">
                        <CardHeader>
                            <CardTitle className="text-white flex items-center gap-2">
                                <Activity className="w-5 h-5" />
                                Recent Calls
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {calls.length > 0 ? (
                                <div className="space-y-2">
                                    {calls.slice(0, 5).map((call) => (
                                        <div key={call.id} className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-2 h-2 rounded-full ${
                                                    call.status === 'completed' || call.status === 'done' ? 'bg-green-400' :
                                                    call.status === 'failed' ? 'bg-red-400' : 'bg-amber-400'
                                                }`} />
                                                <div>
                                                    <p className="text-sm font-medium text-white">{call.lead_name || call.to_number}</p>
                                                    <p className="text-xs text-white/50">{call.to_number}</p>
                                                </div>
                                            </div>
                                            <div className="text-xs text-white/50">
                                                {call.duration ? `${Math.round(call.duration / 60)}m ${call.duration % 60}s` : '—'}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-8 text-white/50">
                                    <Phone className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                    <p className="text-sm">No calls yet</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Assistants Tab */}
                <TabsContent value="assistants" className="space-y-6">
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {assistants.map((assistant) => (
                            <Card key={assistant.id} className="liquid-glass">
                                <CardHeader>
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <CardTitle className="text-white text-base">{assistant.name || 'Unnamed Assistant'}</CardTitle>
                                            <CardDescription className="text-white/60 text-xs mt-1">
                                                ID: {assistant.id}
                                            </CardDescription>
                                        </div>
                                        <Badge variant="outline" className="text-xs">
                                            {assistant.model?.model?.replace('gpt-', '') || 'GPT-4'}
                                        </Badge>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <div>
                                        <Label className="text-xs text-white/70">First Message</Label>
                                        <p className="text-xs text-white/50 mt-1 line-clamp-2">
                                            {assistant.firstMessage || 'Not configured'}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-4 text-xs text-white/50">
                                        <span className="flex items-center gap-1">
                                            <GitBranch className="w-3 h-3" />
                                            {assistant.transportConfigurations?.length || 0} transports
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <BarChart className="w-3 h-3" />
                                            {assistant.analysisPlan ? 'Analytics' : 'No analytics'}
                                        </span>
                                    </div>
                                    <div className="pt-3 border-t border-white/10">
                                        <div className="grid grid-cols-3 gap-2 text-center">
                                            <div>
                                                <div className="text-lg font-bold text-white">{getAssistantStats(assistant.id).total}</div>
                                                <div className="text-xs text-white/50">Calls</div>
                                            </div>
                                            <div>
                                                <div className="text-lg font-bold text-white">{getAssistantStats(assistant.id).completed}</div>
                                                <div className="text-xs text-white/50">Completed</div>
                                            </div>
                                            <div>
                                                <div className="text-lg font-bold text-white">
                                                    {Math.round(getAssistantStats(assistant.id).duration / 60)}m
                                                </div>
                                                <div className="text-xs text-white/50">Duration</div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex gap-2 pt-3">
                                        <Button size="sm" variant="outline" className="flex-1 text-xs">
                                            <Edit className="w-3 h-3 mr-1" />
                                            Edit
                                        </Button>
                                        <VapiCallDialog lead={{ phone: '', full_name: 'Test Call' }} assistantId={assistant.id}>
                                            <Button size="sm" variant="outline" className="flex-1 text-xs">
                                                <Phone className="w-3 h-3 mr-1" />
                                                Test
                                            </Button>
                                        </VapiCallDialog>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </TabsContent>

                {/* Calls Tab */}
                <TabsContent value="calls" className="space-y-6">
                    <Card className="liquid-glass">
                        <CardHeader>
                            <CardTitle className="text-white">Call History</CardTitle>
                            <CardDescription className="text-white/60">
                                All AI voice calls with detailed information
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                {calls.map((call) => (
                                    <div key={call.id} className="flex items-center justify-between p-4 rounded-lg bg-white/5 border border-white/10">
                                        <div className="flex items-center gap-4">
                                            <div className={`w-3 h-3 rounded-full ${
                                                call.status === 'completed' || call.status === 'done' ? 'bg-green-400' :
                                                call.status === 'failed' ? 'bg-red-400' : 'bg-amber-400'
                                            }`} />
                                            <div>
                                                <p className="text-sm font-semibold text-white">{call.lead_name || call.to_number}</p>
                                                <p className="text-xs text-white/50">{call.to_number} - {call.agent_name}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-6 text-xs text-white/50">
                                            <span className="flex items-center gap-1">
                                                <Clock className="w-3 h-3" />
                                                {call.duration ? `${Math.round(call.duration / 60)}m ${call.duration % 60}s` : '—'}
                                            </span>
                                            <span>
                                                {call.started_at ? format(new Date(call.started_at), 'MMM d, HH:mm') : '—'}
                                            </span>
                                            <Badge className={
                                                call.status === 'completed' || call.status === 'done' ? 'bg-green-400/20 text-green-400 border-green-400/30' :
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
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Analytics Tab */}
                <TabsContent value="analytics" className="space-y-6">
                    <div className="grid gap-4 md:grid-cols-2">
                        <Card className="liquid-glass">
                            <CardHeader>
                                <CardTitle className="text-white flex items-center gap-2">
                                    <TrendingUp className="w-5 h-5" />
                                    Performance Metrics
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-4 rounded-lg bg-white/5 border border-white/10">
                                        <div className="text-3xl font-bold text-white">{stats.successRate}%</div>
                                        <div className="text-xs text-white/60 mt-1">Success Rate</div>
                                    </div>
                                    <div className="p-4 rounded-lg bg-white/5 border border-white/10">
                                        <div className="text-3xl font-bold text-white">{Math.round(stats.avgDuration / 60)}m</div>
                                        <div className="text-xs text-white/60 mt-1">Avg Call Duration</div>
                                    </div>
                                    <div className="p-4 rounded-lg bg-white/5 border border-white/10">
                                        <div className="text-3xl font-bold text-white">{stats.totalCalls}</div>
                                        <div className="text-xs text-white/60 mt-1">Total Calls</div>
                                    </div>
                                    <div className="p-4 rounded-lg bg-white/5 border border-white/10">
                                        <div className="text-3xl font-bold text-white">{stats.leadsContacted}</div>
                                        <div className="text-xs text-white/60 mt-1">Unique Leads</div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="liquid-glass">
                            <CardHeader>
                                <CardTitle className="text-white flex items-center gap-2">
                                    <Mic className="w-5 h-5" />
                                    Assistant Performance
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3">
                                    {assistants.map((assistant) => {
                                        const asstStats = getAssistantStats(assistant.id);
                                        return (
                                            <div key={assistant.id} className="p-3 rounded-lg bg-white/5 border border-white/10">
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="text-sm font-medium text-white">{assistant.name || 'Unnamed'}</span>
                                                    <span className="text-xs text-white/50">{asstStats.total} calls</span>
                                                </div>
                                                <div className="flex items-center gap-2 text-xs text-white/50">
                                                    <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full bg-gradient-to-r from-blue-500 to-purple-500"
                                                            style={{ width: `${calls.length > 0 ? (asstStats.total / calls.length) * 100 : 0}%` }}
                                                        />
                                                    </div>
                                                    <span>{calls.length > 0 ? Math.round((asstStats.total / calls.length) * 100) : 0}%</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* Recordings Tab */}
                <TabsContent value="recordings" className="space-y-6">
                    <Card className="liquid-glass">
                        <CardHeader>
                            <CardTitle className="text-white flex items-center gap-2">
                                <FileAudio className="w-5 h-5" />
                                Call Recordings
                            </CardTitle>
                            <CardDescription className="text-white/60">
                                Access and download call recordings
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {calls.filter(c => c.recording_url).length > 0 ? (
                                <div className="space-y-2">
                                    {calls.filter(c => c.recording_url).map((call) => (
                                        <div key={call.id} className="flex items-center justify-between p-4 rounded-lg bg-white/5 border border-white/10">
                                            <div className="flex items-center gap-4">
                                                <FileAudio className="w-8 h-8 text-purple-400" />
                                                <div>
                                                    <p className="text-sm font-semibold text-white">{call.lead_name || call.to_number}</p>
                                                    <p className="text-xs text-white/50">
                                                        {format(new Date(call.started_at), 'MMM d, HH:mm')} - {call.duration ? `${Math.round(call.duration / 60)}m ${call.duration % 60}s` : '—'}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <Button size="sm" variant="outline" onClick={() => window.open(call.recording_url, '_blank')}>
                                                    <Play className="w-3 h-3 mr-1" />
                                                    Play
                                                </Button>
                                                <Button size="sm" variant="outline" onClick={() => window.open(call.recording_url, '_blank')}>
                                                    <ExternalLink className="w-3 h-3" />
                                                    Download
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-12 text-white/50">
                                    <FileAudio className="w-16 h-16 mx-auto mb-4 opacity-20" />
                                    <p className="text-sm">No recordings available</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Settings Tab */}
                <TabsContent value="settings" className="space-y-6">
                    <div className="grid gap-6">
                        <Card className="liquid-glass">
                            <CardHeader>
                                <CardTitle className="text-white flex items-center gap-2">
                                    <Settings className="w-5 h-5" />
                                    Integration Status
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="p-4 rounded-lg bg-white/5 border border-white/10">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h4 className="text-sm font-semibold text-white">Vapi API Key</h4>
                                            <p className="text-xs text-white/50 mt-1">Configured and active</p>
                                        </div>
                                        <Badge className="bg-green-400/20 text-green-400 border-green-400/30">Active</Badge>
                                    </div>
                                </div>
                                <div className="p-4 rounded-lg bg-white/5 border border-white/10">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h4 className="text-sm font-semibold text-white">Backend Functions</h4>
                                            <p className="text-xs text-white/50 mt-1">listVapiAssistants, makeVapiCall</p>
                                        </div>
                                        <Badge className="bg-green-400/20 text-green-400 border-green-400/30">Ready</Badge>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="liquid-glass">
                            <CardHeader>
                                <CardTitle className="text-white flex items-center gap-2">
                                    <Globe className="w-5 h-5" />
                                    External Links
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                <Button variant="outline" className="w-full justify-start" onClick={() => window.open('https://dashboard.vapi.ai', '_blank')}>
                                    <ExternalLink className="w-4 h-4 mr-2" />
                                    Vapi Dashboard
                                </Button>
                                <Button variant="outline" className="w-full justify-start" onClick={() => window.open('https://docs.vapi.ai', '_blank')}>
                                    <ExternalLink className="w-4 h-4 mr-2" />
                                    Documentation
                                </Button>
                                <Button variant="outline" className="w-full justify-start" onClick={() => window.open('https://vapi.ai/pricing', '_blank')}>
                                    <CreditCard className="w-4 h-4 mr-2" />
                                    Pricing
                                </Button>
                            </CardContent>
                        </Card>

                        <Card className="liquid-glass">
                            <CardHeader>
                                <CardTitle className="text-white flex items-center gap-2">
                                    <Shield className="w-5 h-5" />
                                    Configuration Notes
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="p-4 rounded-lg bg-amber-400/10 border border-amber-400/20">
                                    <div className="flex items-start gap-3">
                                        <Shield className="w-5 h-5 text-amber-400 mt-0.5" />
                                        <div className="text-xs text-amber-200/80">
                                            <p className="font-semibold mb-1">Important Notes</p>
                                            <ul className="list-disc list-inside space-y-1">
                                                <li>Assistants must be configured in Vapi Dashboard</li>
                                                <li>Phone provider (Twilio) must be connected in Vapi</li>
                                                <li>API key is stored securely in environment variables</li>
                                                <li>All calls are logged to AircallCall entity</li>
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}