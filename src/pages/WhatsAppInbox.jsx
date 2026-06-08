import React, { useState, useEffect, useRef } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { MessageCircle, Search, Loader2, ExternalLink, RefreshCw, CheckCheck, Clock, TrendingUp, AlertCircle, MessageSquare, Settings, Zap, FileText, Bot, Phone, Wifi, CheckCircle2, Copy, Check } from 'lucide-react';
import ConversationItem from '@/components/whatsapp/ConversationItem';
import NotificationSettings from '@/components/whatsapp/NotificationSettings';
import useDesktopNotifications from '@/components/whatsapp/useDesktopNotifications';
import WhatsAppHeader from '@/components/whatsapp/WhatsAppHeader';
import ChatThread from '@/components/whatsapp/ChatThread';
import AIInsightsPanel from '@/components/whatsapp/AIInsightsPanel';
import TagsEditor from '@/components/whatsapp/TagsEditor';
import LeadScoreCard from '@/components/shared/LeadScoreCard';
import AutomationDashboard from '@/components/whatsapp/AutomationDashboard';
import WhatsAppComposer from '@/components/whatsapp/WhatsAppComposer';
import MobileInbox from '@/components/mobile/MobileInbox';
import NewConversationDialog from '@/components/whatsapp/NewConversationDialog';
import WorkflowBuilder from '@/components/whatsapp/WorkflowBuilder';
import TemplateManager from '@/components/whatsapp/TemplateManager';
import WhatsAppSetupGuide from '@/components/whatsapp/WhatsAppSetupGuide';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { toast } from 'sonner';
import { normalizePhoneNumber } from '@/lib/phoneUtils';

export default function WhatsAppInbox() {
  const isMobile = useIsMobile();
  const { user: currentUser, permissions } = useCurrentUser();
  const [selectedConvId, setSelectedConvId] = useState(null);
  const phoneParam = new URLSearchParams(window.location.search).get('phone');
  const [search, setSearch] = useState('');
  const [showNewConv, setShowNewConv] = useState(false);
  const [activeTab, setActiveTab] = useState('inbox'); // inbox | settings | workflows | templates | automation

  const [showInsights, setShowInsights] = useState(true);
  const [filter, setFilter] = useState('all');
  const [filterAssignedAgent, setFilterAssignedAgent] = useState('');
  const [filterChannel, setFilterChannel] = useState('business');
  const [setupStatus, setSetupStatus] = useState('idle');
  const [phoneInfo, setPhoneInfo] = useState(null);
  const [currentPhoneNumberId, setCurrentPhoneNumberId] = useState(null);
  const [copied, setCopied] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [optimisticMessages, setOptimisticMessages] = useState({});
  const [selectedChannel, setSelectedChannel] = useState('business');
  const [showInternalNote, setShowInternalNote] = useState(false);
  const queryClient = useQueryClient();
  const conversationListRef = useRef(null);
  const prevScrollPosition = useRef(0);

  // Internal numbers - our own lines that should never appear as leads
  const INTERNAL_NUMBERS = ['+971582806000', '+971581806000', '971582806000', '971581806000'];
  const isInternalNumber = (phone) => INTERNAL_NUMBERS.includes(phone) || INTERNAL_NUMBERS.includes(normalizePhoneNumber(phone));

  // Conversations list polling — 15s interval (reduced load, acceptable latency for list)
  const { data: conversations = [], isLoading, refetch } = useQuery({
    queryKey: ['wa_conversations'],
    queryFn: () => base44.entities.WhatsAppConversation.list('-last_message_at', 200),
    refetchInterval: 15000,
  });

  // Keep conversations separate per channel — no cross-channel deduplication
  const normalizedConversations = [...conversations].sort((a, b) => {
    const ta = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
    const tb = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
    return tb - ta;
  });

  // Desktop notifications
  const notificationHook = useDesktopNotifications({
    conversations: normalizedConversations,
    selectedConvId,
    onNotificationClick: (convId) => {
      setSelectedConvId(convId);
      window.focus();
    },
  });

  const webhookUrl = `https://dubai-estate-pro.base44.app/functions/whatsappWebhook`;

  // Fetch connection status
  React.useEffect(() => {
    const fetchConnection = async () => {
      try {
        const res = await base44.functions.invoke('whatsappEmbeddedSignup', { action: 'verify_config' });
        if (res.data?.configured) {
          setSetupStatus('connected');
          setPhoneInfo(res.data);
          setCurrentPhoneNumberId(res.data.phone_number);
        }
      } catch (err) {
        // Silent
      }
    };
    fetchConnection();
  }, []);

  const verifyConnection = async () => {
    setSetupStatus('checking');
    try {
      const res = await base44.functions.invoke('whatsappEmbeddedSignup', { action: 'verify_config' });
      const data = res.data;
      if (data.configured) {
        setSetupStatus('connected');
        setPhoneInfo(data);
        setCurrentPhoneNumberId(data.phone_number);
        toast.success('WhatsApp connected successfully!');
      } else {
        setSetupStatus('failed');
        toast.error(data.message || 'Connection failed. Check your secrets.');
      }
    } catch {
      setSetupStatus('failed');
      toast.error('Verification failed. Make sure your secrets are set.');
    }
  };

  const copyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    toast.success('Copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  // Auto-select conversation from ?phone= URL param
  useEffect(() => {
    if (!phoneParam || !conversations.length) return;
    const match = conversations.find(
      c => c.wa_phone_e164 === phoneParam || c.phone_number === phoneParam
    );
    if (match) setSelectedConvId(match.id);
  }, [phoneParam, conversations]);

  // Realtime is unavailable on this plan (no live socket), so these two .subscribe()
  // effects never fired and only added request churn. Removed — re-add if the plan
  // gains realtime. Sidebar freshness comes from the 15s poll (paused when hidden);
  // the open thread polls every 2s.
  // const unsubConv = base44.entities.WhatsAppConversation.subscribe((event) => {
  //   queryClient.invalidateQueries({ queryKey: ['wa_conversations'] });
  // });
  // const unsubMsg = base44.entities.WhatsAppMessage.subscribe((event) => {
  //   refetch();
  //   queryClient.invalidateQueries({ queryKey: ['wa_conversations'] });
  // });
  // return () => { unsubConv(); unsubMsg(); };

  const { data: leads = [] } = useQuery({
    queryKey: ['leads'],
    queryFn: () => base44.entities.Lead.list('-created_date', 500),
  });

  const { data: landlords = [] } = useQuery({
    queryKey: ['landlords'],
    queryFn: () => base44.entities.Landlord.list('-created_date', 500),
  });

  const { data: teamMembers = [] } = useQuery({
    queryKey: ['team_members'],
    queryFn: async () => {
      const users = await base44.entities.User.list();
      return Array.isArray(users) ? users : [];
    },
  });

  const { data: leadScores = [] } = useQuery({
    queryKey: ['lead_scores'],
    queryFn: () => base44.entities.LeadScore.list('-calculated_at', 200),
  });

  // Find lead by normalized phone match
  const findLeadByPhone = (conv) => {
    const normalizedConvPhone = normalizePhoneNumber(conv.wa_phone_e164 || conv.phone_number);
    return leads.find(l => {
      if (!l.phone && !l.whatsapp) return false;
      const normalizedLeadPhone = l.phone ? normalizePhoneNumber(l.phone) : null;
      const normalizedLeadWhatsApp = l.whatsapp ? normalizePhoneNumber(l.whatsapp) : null;
      return normalizedConvPhone === normalizedLeadPhone || normalizedConvPhone === normalizedLeadWhatsApp;
    });
  };

  // Find landlord by normalized phone match
  const findLandlordByPhone = (conv) => {
    const normalizedConvPhone = normalizePhoneNumber(conv.wa_phone_e164 || conv.phone_number);
    return landlords.find(ll => {
      if (!ll.phone) return false;
      const normalizedLandlordPhone = normalizePhoneNumber(ll.phone);
      if (normalizedConvPhone === normalizedLandlordPhone) return true;
      if (ll.additional_phones) {
        return ll.additional_phones.some(ap => normalizePhoneNumber(ap) === normalizedConvPhone);
      }
      return false;
    });
  };

  const selectedConv = normalizedConversations.find(c => c.id === selectedConvId) || null;
  const selectedLead = selectedConv ? (leads.find(l => l.id === selectedConv?.lead_id) || findLeadByPhone(selectedConv)) : null;

  const handleAction = (action, payload) => {
    if (!selectedConvId) return;
    if (action === 'toggle_vip') {
      base44.entities.WhatsAppConversation.update(selectedConvId, { is_vip: !selectedConv.is_vip });
      queryClient.invalidateQueries({ queryKey: ['wa_conversations'] });
    } else if (action === 'toggle_star') {
      base44.entities.WhatsAppConversation.update(selectedConvId, { is_starred: !selectedConv.is_starred });
      queryClient.invalidateQueries({ queryKey: ['wa_conversations'] });
    } else if (action === 'block') {
      base44.entities.WhatsAppConversation.update(selectedConvId, { status: 'blocked' });
      queryClient.invalidateQueries({ queryKey: ['wa_conversations'] });
    } else if (action === 'set_stage' && selectedLead) {
      base44.entities.Lead.update(selectedLead.id, { stage: payload });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    } else if (action === 'assign_agent' && payload) {
      base44.entities.WhatsAppConversation.update(selectedConvId, { assigned_agent_email: payload.email });
      queryClient.invalidateQueries({ queryKey: ['wa_conversations'] });
      // Send email notification to assigned agent
      base44.functions.invoke('sendAgentNotificationEmail', {
        agent_email: payload.email,
        notification_type: 'conversation_assigned',
        conversation_id: selectedConvId,
        conversation_phone: selectedConv?.wa_phone_e164,
        lead_full_name: selectedLead?.full_name || selectedConv?.wa_display_name,
        assigned_by: currentUser?.email
      });
      toast.success(`Assigned to ${payload.full_name || payload.email}`);
      // Send email notification to assigned agent
      if (payload.email !== currentUser.email) {
        base44.functions.invoke('sendAgentNotificationEmail', {
          agent_email: payload.email,
          notification_type: 'conversation_assigned',
          conversation_id: selectedConvId,
          conversation_phone: selectedConv?.wa_phone_e164 || selectedConv?.phone_number,
          lead_name: selectedLead?.full_name || selectedConv?.wa_display_name || 'Unknown',
          assigned_by: currentUser.email
        });
      }
    } else if (action === 'schedule_viewing') {
      // handled by existing schedule viewing dialog
    }
  };
  const selectedScore = leadScores.find(s => s.conversation_id === selectedConvId) || null;

  // Filter + search - Strict agent isolation
  const filtered = normalizedConversations.filter(c => {
    // Exclude internal test conversations (our own numbers)
    const phone = c.wa_phone_e164 || c.phone_number || '';
    if (isInternalNumber(phone)) return false;
    
    // Check if current user has admin/manager permissions
    const isAdmin = currentUser?.role === 'admin' || permissions.view_all_whatsapp || permissions.manage_team;
    
    if (!isAdmin && currentUser) {
      // Regular agents: ONLY see conversations explicitly assigned to them
      if (!c.assigned_agent_email) return false; // Hide unassigned
      if (c.assigned_agent_email !== currentUser.email) return false; // Hide others'
    }
    
    // Admin/manager can filter by agent, but regular agents can only see their own
    const matchesAgent = isAdmin ? (!filterAssignedAgent || c.assigned_agent_email === filterAssignedAgent) : true;
    
    // Strict channel isolation — only show conversations for the active channel
    const matchesChannel = filterChannel === 'business' ? c.channel === 'business' : c.channel !== 'business';
    
    const lead = leads.find(l => l.id === c.lead_id);
    const name = lead?.full_name || c.wa_display_name || phone;
    const matchesSearch = name.toLowerCase().includes(search.toLowerCase()) || phone.includes(search);
    const matchesFilter =
      filter === 'all' ? true :
      filter === 'unread' ? (c.unread_count || 0) > 0 :
      filter === 'open' ? ['open', 'new', 'pending_agent', 'pending_customer'].includes(c.status) :
      filter === 'resolved' ? c.status === 'resolved' : true;
    return matchesSearch && matchesFilter && matchesAgent && matchesChannel;
  });

  // Preserve scroll position when conversations refresh
  useEffect(() => {
    if (conversationListRef.current) {
      conversationListRef.current.scrollTop = prevScrollPosition.current;
    }
  }, [filtered.length]);
  
  useEffect(() => {
    const handleScroll = () => {
      if (conversationListRef.current) {
        prevScrollPosition.current = conversationListRef.current.scrollTop;
      }
    };
    const ref = conversationListRef.current;
    if (ref) {
      ref.addEventListener('scroll', handleScroll);
      return () => ref.removeEventListener('scroll', handleScroll);
    }
  }, []);

  // Exclude internal conversations from metrics
  const externalConversations = normalizedConversations.filter(c => !isInternalNumber(c.wa_phone_e164 || c.phone_number || ''));
  
  const unreadTotal = externalConversations.reduce((sum, c) => sum + (c.unread_count || 0), 0);
  const now = new Date();
  const conversationsToday = externalConversations.filter(c => {
    if (!c.first_message_at) return false;
    const msgDate = new Date(c.first_message_at);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return msgDate >= today;
  }).length;
  const avgResponseTime = (() => {
    const withResponse = externalConversations.filter(c => c.first_response_seconds && c.first_response_seconds > 0);
    if (withResponse.length === 0) return 0;
    const totalSeconds = withResponse.reduce((sum, c) => sum + c.first_response_seconds, 0);
    return Math.round(totalSeconds / withResponse.length / 60); // minutes
  })();
  const slaBreaches = externalConversations.filter(c => c.sla_breached === true).length;
  const unresolvedCount = externalConversations.filter(c => ['new', 'open', 'pending_agent', 'pending_customer'].includes(c.status)).length;

  const sendMutation = useMutation({
    mutationFn: ({ message, channel }) =>
      base44.functions.invoke('sendMultiChannelWhatsApp', { 
        conversation_id: selectedConvId,
        landlord_id: selectedLead?.id,
        text: message,
        channel: channel || 'business'
      }),
    onSuccess: (res) => {
      setOptimisticMessages(prev => {
        const next = { ...prev };
        delete next[selectedConvId];
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ['wa_messages', selectedConvId] });
      queryClient.invalidateQueries({ queryKey: ['wa_conversations'] });
    },
    onError: (err) => {
      setOptimisticMessages(prev => {
        const next = { ...prev };
        delete next[selectedConvId];
        return next;
      });
      toast.error(err?.response?.data?.error || 'Failed to send message');
    },
  });

  const analyzeMutation = useMutation({
    mutationFn: (conversation_id) =>
      base44.functions.invoke('analyzeConversation', { conversation_id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wa_conversations'] });
    },
  });

  const handleSend = (text) => {
    if (!text?.trim() || !selectedConvId) return;
    const trimmed = text.trim();
    // Optimistic update — add pending message
    const now = new Date().toISOString();
    setOptimisticMessages(prev => ({
      ...prev,
      [selectedConvId]: {
        id: `pending-${Date.now()}`,
        direction: 'outbound',
        body: trimmed,
        timestamp: now,
        status: 'pending',
        conversation_id: selectedConvId,
        channel: selectedChannel,
      }
    }));
    sendMutation.mutate({ message: trimmed, channel: selectedChannel });
  };

  const handleScheduleSend = (text, _minutes) => {
    // TODO: schedule support — for now send immediately
    handleSend(text);
  };

  const buildPitch = (rec) => {
    if (rec.suggested_pitch) return rec.suggested_pitch;
    return `I have a great property that matches your requirements:\n${rec.reasoning || ''}\n\nMatch score: ${rec.match_score}%`;
  };

  const handleSelectConv = (convId) => {
    setSelectedConvId(convId);
    const conv = conversations.find(c => c.id === convId);
    if (conv?.unread_count > 0) {
      base44.entities.WhatsAppConversation.update(convId, { unread_count: 0 });
      queryClient.invalidateQueries({ queryKey: ['wa_conversations'] });
    }
    // Auto-detect channel from last message
    if (selectedConv) {
      const lastMsgChannel = selectedConv.last_message_channel || 'business';
      setSelectedChannel(lastMsgChannel);
    }
  };

  const handleMarkResolved = () => {
    if (!selectedConvId) return;
    base44.entities.WhatsAppConversation.update(selectedConvId, { status: 'resolved', unread_count: 0 });
    queryClient.invalidateQueries({ queryKey: ['wa_conversations'] });
  };

  const handleNewConvCreated = (convId) => {
    queryClient.invalidateQueries({ queryKey: ['wa_conversations'] });
    setSelectedConvId(convId);
  };

  // Keyboard navigation - must be after all function definitions
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Only if not typing in input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      
      const currentIndex = filtered.findIndex(c => c.id === selectedConvId);
      
      if (e.key === 'ArrowDown' && currentIndex < filtered.length - 1) {
        e.preventDefault();
        handleSelectConv(filtered[currentIndex + 1].id);
      } else if (e.key === 'ArrowUp' && currentIndex > 0) {
        e.preventDefault();
        handleSelectConv(filtered[currentIndex - 1].id);
      } else if (e.key === 'Enter' && selectedConvId) {
        e.preventDefault();
        // Focus message input
        const input = document.querySelector('textarea[placeholder*="Type a message"]');
        input?.focus();
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        // Focus search
        const searchInput = document.querySelector('input[placeholder*="Search conversations"]');
        searchInput?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filtered, selectedConvId, handleSelectConv]);

  if (isMobile) {
    return <MobileInbox />;
  }

  if (activeTab !== 'inbox') {
    return (
      <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-green-500/10 flex items-center justify-center shrink-0">
              <MessageCircle className="w-7 h-7 text-green-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">
                {activeTab === 'settings' ? 'WhatsApp Settings' :
                 activeTab === 'workflows' ? 'WhatsApp Workflows' :
                 activeTab === 'templates' ? 'Message Templates' : 'Automation'}
              </h1>
              <p className="text-muted-foreground text-sm mt-0.5">
                {activeTab === 'settings' ? 'Configure your WhatsApp Business connection' :
                 activeTab === 'workflows' ? 'Build automated WhatsApp workflows' :
                 activeTab === 'templates' ? 'Manage reusable message templates' : 'Configure automation rules'}
              </p>
            </div>
          </div>
          <Button variant="outline" onClick={() => setActiveTab('inbox')} className="gap-2">
            <MessageCircle className="w-4 h-4" /> Back to Inbox
          </Button>
        </div>

        {activeTab === 'settings' && (
          <div className="space-y-6">
            {/* Connection Status */}
            {setupStatus === 'connected' && phoneInfo ? (
              <Card className="border-2 border-green-500/40 bg-green-500/5">
                <CardContent className="p-5">
                  <div className="flex items-center gap-3 mb-4">
                    <CheckCircle2 className="w-6 h-6 text-green-600" />
                    <div>
                      <p className="font-semibold text-green-700">WhatsApp Connected ✅</p>
                      <p className="text-xs text-green-600">Your number is live and ready to receive messages</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="bg-white border rounded-lg p-3 text-center">
                      <Phone className="w-4 h-4 mx-auto mb-1 text-green-600" />
                      <p className="text-xs text-muted-foreground">Phone</p>
                      <p className="text-sm font-semibold">{phoneInfo.phone_number}</p>
                    </div>
                    <div className="bg-white border rounded-lg p-3 text-center">
                      <Wifi className="w-4 h-4 mx-auto mb-1 text-blue-600" />
                      <p className="text-xs text-muted-foreground">Display Name</p>
                      <p className="text-sm font-semibold truncate">{phoneInfo.display_name}</p>
                    </div>
                    <div className="bg-white border rounded-lg p-3 text-center">
                      <CheckCircle2 className="w-4 h-4 mx-auto mb-1 text-emerald-600" />
                      <p className="text-xs text-muted-foreground">Quality</p>
                      <p className="text-sm font-semibold">{phoneInfo.quality_rating || 'N/A'}</p>
                    </div>
                  </div>
                  <Button className="w-full bg-green-600 hover:bg-green-700 text-white gap-2 h-11" onClick={() => setActiveTab('inbox')}>
                    <MessageCircle className="w-4 h-4" />
                    Open WhatsApp Inbox — View Your Chats
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card className={`border-2 ${setupStatus === 'failed' ? 'border-red-400/40 bg-red-500/3' : 'border-border'}`}>
                <CardContent className="p-5">
                  <div className="flex items-center gap-3">
                    {setupStatus === 'checking'
                      ? <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                      : setupStatus === 'failed'
                      ? <AlertCircle className="w-5 h-5 text-red-500" />
                      : <div className="w-5 h-5 rounded-full border-2 border-muted-foreground/30" />
                    }
                    <div>
                      <p className="font-medium text-sm">
                        {setupStatus === 'checking' ? 'Checking connection...'
                          : setupStatus === 'failed' ? 'Connection failed — check secrets below'
                          : 'Not verified yet'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {setupStatus === 'failed'
                          ? 'Make sure WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID are set in Base44 secrets'
                          : 'Complete the steps below then click Verify'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Phone Number ID */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Badge className="bg-green-500/10 text-green-700 border-green-500/20 text-xs">Already Set</Badge>
                  Your Phone Number ID
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 bg-muted rounded-lg px-3 py-2.5">
                  <Phone className="w-4 h-4 text-muted-foreground shrink-0" />
                  <code className="text-sm font-mono font-semibold flex-1">
                    {currentPhoneNumberId || 'Loading...'}
                  </code>
                  <Badge variant="outline" className="text-xs shrink-0">WHATSAPP_PHONE_NUMBER_ID</Badge>
                </div>
              </CardContent>
            </Card>

            {/* Setup Steps */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Setup Steps</CardTitle>
                <CardDescription className="text-xs">Follow these steps to get your access token</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { number: 1, title: 'Go to Meta for Developers', description: 'Open your app at developers.facebook.com', link: 'https://developers.facebook.com', linkLabel: 'Open Meta Developers →' },
                  { number: 2, title: 'Find Your Access Token', description: 'Left menu → WhatsApp → API Setup → scroll to "Step 2" → copy the Temporary access token. For permanent: Business Settings → System Users → create → Generate Token → enable whatsapp_business_messaging.' },
                  { number: 3, title: 'Set a Verify Token', description: 'This is any custom string you choose. Example: erudite_verify_2024' },
                  { number: 4, title: 'Save Secrets in Base44', description: 'Go to Base44 Dashboard → Settings → Secrets and add WHATSAPP_ACCESS_TOKEN and WHATSAPP_VERIFY_TOKEN.' },
                  { number: 5, title: 'Configure Webhook in Meta', description: 'Meta Developers → Your App → WhatsApp → Configuration → Webhook. Paste Callback URL and verify token. Subscribe to "messages".' },
                ].map((step) => (
                  <div key={step.number} className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-accent text-accent-foreground text-xs flex items-center justify-center font-bold shrink-0 mt-0.5">
                      {step.number}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{step.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{step.description}</p>
                      {step.link && (
                        <a href={step.link} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline mt-1">
                          <ExternalLink className="w-3 h-3" /> {step.linkLabel}
                        </a>
                      )}
                    </div>
                  </div>
                ))}

                {/* Webhook URL */}
                <div className="mt-2 border rounded-lg p-3 bg-muted/30 space-y-2">
                  <p className="text-xs font-medium">Your Webhook Callback URL (for Step 5):</p>
                  <div className="flex items-center gap-2 bg-background border rounded-md px-3 py-2">
                    <code className="text-xs flex-1 break-all text-green-700">{webhookUrl}</code>
                    <Button size="icon" variant="ghost" className="shrink-0 h-7 w-7" onClick={copyWebhook}>
                      {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">Subscribe to webhook field: <code className="bg-muted px-1 rounded">messages</code></p>
                </div>
              </CardContent>
            </Card>

            {/* Verify Button */}
            <Button
              className="w-full h-11 bg-accent text-accent-foreground hover:bg-accent/90 text-base gap-2"
              onClick={verifyConnection}
              disabled={setupStatus === 'checking'}
            >
              {setupStatus === 'checking'
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Verifying...</>
                : <><CheckCircle2 className="w-4 h-4" /> Verify Connection</>
              }
            </Button>
          </div>
        )}

        {activeTab === 'workflows' && <WorkflowBuilder />}
        {activeTab === 'templates' && <TemplateManager />}
        {activeTab === 'automation' && <AutomationDashboard />}
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-background">
      <NewConversationDialog
        open={showNewConv}
        onClose={() => setShowNewConv(false)}
        onConversationCreated={handleNewConvCreated}
      />
      {/* Sidebar — conversation list */}
      <div className={`${sidebarOpen ? 'w-80' : 'w-0'} border-r flex flex-col shrink-0 transition-all duration-300 overflow-hidden`}>
        {/* Live indicator */}
        <div className="flex items-center justify-between px-3 py-1.5" style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.45)' }}>Live</span>
          </div>
          <NotificationSettings notificationHook={notificationHook} />
        </div>

        {/* Management Intelligence Strip */}
        <div className="grid grid-cols-4 gap-2 p-3" style={{ background: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-0.5">
              <MessageSquare className="w-3 h-3" style={{ color: 'hsl(38 92% 50%)' }} />
              <span className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.55)' }}>Today</span>
            </div>
            <p className="text-lg font-bold" style={{ color: 'hsl(38 92% 50%)' }}>{conversationsToday}</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-0.5">
              <Clock className="w-3 h-3 text-purple-400" />
              <span className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.55)' }}>Avg Response</span>
            </div>
            <p className="text-lg font-bold" style={{ color: 'rgba(255,255,255,0.95)' }}>{avgResponseTime}m</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-0.5">
              <AlertCircle className="w-3 h-3 text-amber-500" />
              <span className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.55)' }}>SLA Breaches</span>
            </div>
            <p className="text-lg font-bold" style={{ color: 'rgba(255,255,255,0.95)' }}>{slaBreaches}</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-0.5">
              <TrendingUp className="w-3 h-3 text-emerald-500" />
              <span className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.55)' }}>Unresolved</span>
            </div>
            <p className="text-lg font-bold" style={{ color: 'rgba(255,255,255,0.95)' }}>{unresolvedCount}</p>
          </div>
        </div>

        {/* Header */}
        <div className="p-4 space-y-3" style={{ background: 'rgba(255,255,255,0.07)', backdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {unreadTotal > 0 && (
                <Badge className="text-xs px-1.5 py-0" style={{ background: 'hsl(38 92% 50%)', color: 'hsl(222 47% 11%)' }}>{unreadTotal}</Badge>
              )}
            </div>
            <div className="flex gap-1">
              <Button
                size="sm"
                className="h-8 text-xs px-2.5"
                style={{ background: 'hsl(38 92% 50%)', color: 'hsl(222 47% 11%)' }}
                onClick={() => setShowNewConv(true)}
              >
                + New
              </Button>
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => refetch()}>
                <RefreshCw className="w-3.5 h-3.5" />
              </Button>
              <Button 
                size="sm" 
                variant="ghost" 
                className="h-8 px-2.5 text-xs gap-1"
                onClick={async () => {
                  try {
                    const res = await base44.functions.invoke('bulkFetchWhatsAppProfiles', {});
                    toast.success(res.data?.summary || 'Profile refresh complete');
                    refetch();
                  } catch (err) {
                    toast.error('Failed to fetch profiles');
                  }
                }}
              >
                <Bot className="w-3.5 h-3.5" /> Fetch Names
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 px-2.5"
                onClick={() => setActiveTab('settings')}
              >
                <Settings className="w-3.5 h-3.5" />
              </Button>
              <a
                href="https://web.whatsapp.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg transition-colors"
                style={{ color: 'hsl(38 92% 50%)', border: '1px solid rgba(245,159,10,0.3)' }}
              >
                <ExternalLink className="w-3 h-3" /> WA Web
              </a>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search conversations..."
              className="pl-9 h-9 text-sm"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)' }}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          {/* Filter pills */}
          <div className="space-y-2">
            <div className="flex gap-1 flex-wrap">
              {['all', 'unread', 'open', 'resolved'].map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className="px-2.5 py-0.5 rounded-lg text-xs font-medium transition-colors"
                  style={{
                    background: filter === f ? 'hsl(38 92% 50%)' : 'rgba(255,255,255,0.05)',
                    color: filter === f ? 'hsl(222 47% 11%)' : 'rgba(255,255,255,0.7)',
                    border: filter === f ? '1px solid hsl(38 92% 50%)' : '1px solid rgba(255,255,255,0.1)',
                  }}
                >
                  {f === 'all' ? 'All' : f === 'unread' ? `Unread${unreadTotal > 0 ? ` (${unreadTotal})` : ''}` : f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
            {/* Channel profile switcher */}
            <div className="grid grid-cols-2 gap-1 p-1 rounded-xl" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
              {[
                { key: 'business', label: 'Business', emoji: '🏢', number: '+971 58 280 6000', color: 'hsl(152 69% 40%)' },
                { key: 'personal', label: 'Personal', emoji: '👤', number: '+971 58 180 6000', color: 'hsl(217 91% 60%)' },
              ].map(ch => {
                const chCount = normalizedConversations.filter(c => {
                  const phone = c.wa_phone_e164 || c.phone_number || '';
                  if (isInternalNumber(phone)) return false;
                  return ch.key === 'business' ? c.channel === 'business' : c.channel !== 'business';
                });
                const chUnread = chCount.reduce((s, c) => s + (c.unread_count || 0), 0);
                const isActive = filterChannel === ch.key;
                return (
                  <button
                    key={ch.key}
                    onClick={() => { setFilterChannel(ch.key); setSelectedConvId(null); }}
                    className="flex flex-col items-center py-2 px-1 rounded-lg transition-all"
                    style={{
                      background: isActive ? ch.color : 'transparent',
                      border: isActive ? `1px solid ${ch.color}` : '1px solid transparent',
                    }}
                  >
                    <span className="text-base leading-none mb-0.5">{ch.emoji}</span>
                    <span className="text-[11px] font-bold" style={{ color: isActive ? 'white' : 'rgba(255,255,255,0.7)' }}>{ch.label}</span>
                    <span className="text-[9px]" style={{ color: isActive ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.35)' }}>{ch.number}</span>
                    {chUnread > 0 && (
                      <span className="mt-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: isActive ? 'rgba(255,255,255,0.25)' : ch.color, color: 'white' }}>
                        {chUnread}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Team member filter - Admin/Managers only */}
          {(currentUser?.role === 'admin' || permissions.view_all_whatsapp || permissions.manage_team) && (
            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.5)' }}>Filter by Agent</label>
              <select
                value={filterAssignedAgent}
                onChange={(e) => setFilterAssignedAgent(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-lg"
                style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.18)', color: 'rgba(255,255,255,0.9)' }}
              >
                <option value="">All Team Members</option>
                {teamMembers.map(tm => (
                  <option key={tm.email} value={tm.email}>{tm.full_name || tm.email}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Conversation list - preserve scroll position */}
        <div className="flex-1 overflow-y-auto" ref={conversationListRef}>
          {isLoading ? (
            <div className="flex items-center justify-center h-20">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm px-4">
              <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-30" />
              {search || filter !== 'all' ? 'No matching conversations' : 'No conversations yet'}
              <p className="text-xs mt-1 opacity-60">Messages will appear here when leads contact you on WhatsApp</p>
            </div>
          ) : (
            filtered.map(conv => {
               const lead = leads.find(l => l.id === conv.lead_id) || findLeadByPhone(conv);
               const landlord = findLandlordByPhone(conv);
               const phone = conv.wa_phone_e164 || conv.phone_number || '';
               const isInternal = isInternalNumber(phone);
               return (
                <ConversationItem
                  key={conv.id}
                  conv={conv}
                  lead={lead}
                  landlord={landlord}
                  selected={conv.id === selectedConvId}
                  onClick={() => handleSelectConv(conv.id)}
                  isInternal={isInternal}
                />
              );
            })
          )}
        </div>
      </div>

      {/* Main chat area */}
      {selectedConv ? (
        <div className="flex flex-1 min-w-0">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="w-10 flex items-center justify-center border-l opacity-0 hover:opacity-100 transition-opacity shrink-0"
            style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.1)' }}
            title={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
          >
            <span className="text-xs font-bold">{sidebarOpen ? '‹' : '›'}</span>
          </button>
          <div className="flex flex-col flex-1 min-w-0">
            <WhatsAppHeader
              conversation={selectedConv}
              lead={selectedLead}
              agent={null}
              teamMembers={teamMembers}
              onAction={handleAction}
            />

            {/* Resolved banner */}
            {selectedConv.status === 'resolved' && (
              <div className="px-4 py-2 bg-muted/50 border-b text-xs text-muted-foreground flex items-center gap-2">
                <CheckCheck className="w-3.5 h-3.5 text-green-600" />
                This conversation is resolved.
                <button
                  onClick={() => {
                    base44.entities.WhatsAppConversation.update(selectedConvId, { status: 'open' });
                    queryClient.invalidateQueries({ queryKey: ['wa_conversations'] });
                  }}
                  className="text-green-600 hover:underline"
                >
                  Reopen
                </button>
              </div>
            )}

            {/* Messages — include all merged conversation IDs for full history */}
            <ChatThread
              key={selectedConvId}
              conversationId={selectedConvId}
              allConversationIds={[selectedConvId, ...(Array.isArray(selectedConv?.merged_conv_ids) ? selectedConv.merged_conv_ids.filter(id => id && id !== selectedConvId) : [])]}
              contactName={selectedLead?.full_name || selectedConv?.wa_display_name || selectedConv?.wa_phone_e164}
              optimisticMessage={optimisticMessages[selectedConvId]}
            />

            {/* Tags row */}
            <div className="px-4 py-2 border-t bg-muted/20">
              <TagsEditor conv={selectedConv} />
            </div>

            <WhatsAppComposer
              conversation={selectedConv}
              lead={selectedLead}
              landlord={null}
              suggestions={selectedConv.ai_next_message_suggestions}
              onSend={handleSend}
              onSendProperty={() => setShowInsights(true)}
              onScheduleSend={handleScheduleSend}
              selectedChannel={selectedChannel}
              onChannelChange={setSelectedChannel}
            />
          </div>

          {/* AI Insights sidebar — collapsible */}
          {showInsights && (
            <div className="w-72 border-l shrink-0 overflow-y-auto p-3 space-y-4 relative">
              <button
                onClick={() => setShowInsights(false)}
                className="absolute top-2 right-2 text-xs opacity-50 hover:opacity-100 transition-opacity"
                title="Close panel"
              >
                ✕
              </button>
              <LeadScoreCard score={selectedScore} conversation={selectedConv} />
              <AIInsightsPanel
                conversation={selectedConv}
                lead={selectedLead}
                recommendations={selectedConv.ai_recommendations || []}
                onSendProperty={rec => handleSend(buildPitch(rec))}
              />
              <AutomationDashboard />
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-muted-foreground flex-col gap-3">
          <div className="w-16 h-16 rounded-2xl bg-green-500/10 flex items-center justify-center">
            <MessageCircle className="w-8 h-8 text-green-500 opacity-60" />
          </div>
          <p className="text-sm font-medium">Select a conversation to start</p>
          <p className="text-xs opacity-50">
            {conversations.length === 0
              ? 'Waiting for inbound WhatsApp messages…'
              : `${conversations.length} conversation${conversations.length > 1 ? 's' : ''} available`}
          </p>
        </div>
      )}
    </div>
  );
}