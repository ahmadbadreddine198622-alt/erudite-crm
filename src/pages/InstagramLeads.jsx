import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Instagram, Plus, Copy, Check, UserPlus, MessageCircle, ArrowRight,
  Trash2, Tag, RefreshCw, Send, Eye, Heart, Loader2, ExternalLink, Zap, User
} from 'lucide-react';
import { toast } from 'sonner';
import moment from 'moment';

const REPLY_TEMPLATES = {
  interested: 'Thank you for your interest! Please DM us or WhatsApp us for more details and pricing.',
  price: 'Hi! We would love to share pricing with you. Please DM us or drop your number below.',
  info: 'Thanks for reaching out! For full details, DM us or WhatsApp us directly.',
  details: 'Thanks for your comment! Please DM us for full details.',
  'how much': 'Great question! Please DM us or drop your number and we\'ll share all pricing details.',
  available: 'Yes! Please DM us to check availability and schedule a viewing.',
  whatsapp: 'Please DM us your WhatsApp number and we\'ll reach out right away!',
  contact: 'Please DM us or drop your contact details and we\'ll be in touch shortly.',
  default: 'Thanks for your comment! Please DM us for more information.',
};

const DEFAULT_KEYWORDS = ['interested', 'price', 'info', 'details', 'how much', 'available', 'whatsapp', 'contact'];

export default function InstagramLeads() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ username: '', comment: '', post_url: '' });
  const [keywords, setKeywords] = useState(DEFAULT_KEYWORDS);
  const [newKeyword, setNewKeyword] = useState('');
  const [copied, setCopied] = useState(null);
  const [selectedPost, setSelectedPost] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [activeTab, setActiveTab] = useState('posts'); // posts | manual | leads

  // Fetch account info
  const { data: account, isLoading: accountLoading } = useQuery({
    queryKey: ['ig-account'],
    queryFn: () => base44.functions.invoke('instagramData', { action: 'get_account' }).then(r => r.data),
    retry: 1,
  });

  // Fetch recent posts
  const { data: postsData, isLoading: postsLoading, refetch: refetchPosts } = useQuery({
    queryKey: ['ig-posts'],
    queryFn: () => base44.functions.invoke('instagramData', { action: 'get_posts' }).then(r => r.data),
    retry: 1,
    enabled: !!account?.id,
  });

  // Fetch comments for selected post
  const { data: commentsData, isLoading: commentsLoading, refetch: refetchComments } = useQuery({
    queryKey: ['ig-comments', selectedPost?.id],
    queryFn: () => base44.functions.invoke('instagramData', { action: 'get_comments', post_id: selectedPost.id }).then(r => r.data),
    enabled: !!selectedPost?.id,
  });

  // CRM leads from Instagram
  const { data: crmLeads = [] } = useQuery({
    queryKey: ['instagram-leads'],
    queryFn: () => base44.entities.Lead.filter({ source: 'social_media' }, '-created_date', 100),
  });
  const instagramLeads = crmLeads.filter(l => l.source_metadata?.channel === 'instagram');

  // Sync leads from comments
  const syncLeads = useMutation({
    mutationFn: () => base44.functions.invoke('instagramData', { action: 'sync_leads', keywords }).then(r => r.data),
    onSuccess: (data) => {
      queryClient.invalidateQueries(['instagram-leads']);
      toast.success(`Synced ${data.synced} new leads from Instagram!`);
    },
    onError: (e) => toast.error('Sync failed: ' + e.message),
  });

  // Reply to a comment/post
  const replyComment = useMutation({
    mutationFn: ({ post_id, message }) => base44.functions.invoke('instagramData', { action: 'reply_comment', post_id, message }).then(r => r.data),
    onSuccess: () => {
      refetchComments();
      setReplyText('');
      toast.success('Reply posted on Instagram!');
    },
    onError: () => toast.error('Failed to post reply'),
  });

  // Manual lead creation
  const createLead = useMutation({
    mutationFn: (data) => {
      const detectedKeyword = keywords.find(k => data.comment.toLowerCase().includes(k.toLowerCase()));
      return base44.entities.Lead.create({
        name: '@' + data.username,
        source: 'social_media',
        stage: 'new_lead',
        tags: ['instagram', detectedKeyword].filter(Boolean),
        notes: `Instagram comment: "${data.comment}"` + (data.post_url ? `\nPost: ${data.post_url}` : ''),
        source_metadata: {
          channel: 'instagram',
          username: data.username,
          comment: data.comment,
          post_url: data.post_url,
          keyword_triggered: detectedKeyword || 'manual',
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['instagram-leads']);
      setForm({ username: '', comment: '', post_url: '' });
      toast.success('Lead added to CRM!');
    },
  });

  // Add lead from comment
  const addLeadFromComment = (comment, post) => {
    const detectedKeyword = keywords.find(k => comment.text.toLowerCase().includes(k.toLowerCase()));
    const exists = instagramLeads.find(l => l.source_metadata?.comment_id === comment.id);
    if (exists) { toast.info('Already in CRM'); return; }
    base44.entities.Lead.create({
      name: '@' + comment.username,
      source: 'social_media',
      stage: 'new_lead',
      tags: ['instagram', detectedKeyword].filter(Boolean),
      notes: `Instagram comment: "${comment.text}"\nPost: ${post.permalink}`,
      source_metadata: {
        channel: 'instagram',
        username: comment.username,
        comment: comment.text,
        comment_id: comment.id,
        post_url: post.permalink,
        post_id: post.id,
        keyword_triggered: detectedKeyword || 'manual',
      },
    }).then(() => {
      queryClient.invalidateQueries(['instagram-leads']);
      toast.success(`@${comment.username} added to CRM!`);
    });
  };

  const detectedKeyword = keywords.find(k => form.comment.toLowerCase().includes(k.toLowerCase()));
  const suggestedReply = detectedKeyword ? (REPLY_TEMPLATES[detectedKeyword] || REPLY_TEMPLATES.default) : null;

  const copyText = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    toast.success('Copied!');
    setTimeout(() => setCopied(null), 2000);
  };

  const posts = postsData?.data || [];
  const comments = commentsData?.data || [];

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center shrink-0">
            <Instagram className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Instagram Lead Capture</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              {account ? `Connected as @${account.username}` : 'Loading account...'}
            </p>
          </div>
        </div>
        {account && (
          <div className="flex items-center gap-3">
            <div className="flex gap-4 text-center">
              <div><p className="text-lg font-bold">{account.followers_count?.toLocaleString() || '—'}</p><p className="text-xs text-muted-foreground">Followers</p></div>
              <div><p className="text-lg font-bold">{account.media_count || '—'}</p><p className="text-xs text-muted-foreground">Posts</p></div>
              <div><p className="text-lg font-bold">{instagramLeads.length}</p><p className="text-xs text-muted-foreground">CRM Leads</p></div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => syncLeads.mutate()}
              disabled={syncLeads.isPending}
            >
              {syncLeads.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4 text-amber-500" />}
              Auto-Sync Leads
            </Button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {[
          { key: 'posts', label: 'Your Posts & Comments' },
          { key: 'manual', label: 'Log Manual Lead' },
          { key: 'leads', label: `CRM Leads (${instagramLeads.length})` },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === tab.key
                ? 'border-purple-500 text-purple-600'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* POSTS TAB */}
      {activeTab === 'posts' && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          {/* Post grid */}
          <div className="lg:col-span-2 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">Recent Posts</p>
              <Button size="sm" variant="ghost" onClick={() => refetchPosts()} className="h-7 text-xs gap-1">
                <RefreshCw className="w-3 h-3" /> Refresh
              </Button>
            </div>
            {postsLoading ? (
              <div className="flex items-center justify-center h-40"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
            ) : posts.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <Instagram className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No posts found</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 max-h-[600px] overflow-y-auto pr-1">
                {posts.map(post => (
                  <button
                    key={post.id}
                    onClick={() => setSelectedPost(post)}
                    className={`relative rounded-lg overflow-hidden border-2 transition-all aspect-square ${
                      selectedPost?.id === post.id ? 'border-purple-500 ring-2 ring-purple-500/20' : 'border-transparent hover:border-purple-300'
                    }`}
                  >
                    <img
                      src={post.media_type === 'VIDEO' ? post.thumbnail_url : post.media_url}
                      alt=""
                      className="w-full h-full object-cover"
                      onError={e => { e.target.style.background = '#f3e8ff'; e.target.style.display = 'none'; }}
                    />
                    <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs p-1.5 flex gap-2">
                      <span className="flex items-center gap-0.5"><Heart className="w-2.5 h-2.5" />{post.like_count || 0}</span>
                      <span className="flex items-center gap-0.5"><MessageCircle className="w-2.5 h-2.5" />{post.comments_count || 0}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Comments panel */}
          <div className="lg:col-span-3">
            {!selectedPost ? (
              <div className="flex items-center justify-center h-64 border-2 border-dashed rounded-xl text-muted-foreground">
                <div className="text-center">
                  <Eye className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Select a post to view comments</p>
                </div>
              </div>
            ) : (
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <MessageCircle className="w-4 h-4 text-purple-600" />
                        Comments ({selectedPost.comments_count || 0})
                      </CardTitle>
                      {selectedPost.caption && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{selectedPost.caption}</p>
                      )}
                    </div>
                    <a href={selectedPost.permalink} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline flex items-center gap-1 shrink-0">
                      <ExternalLink className="w-3 h-3" /> View Post
                    </a>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {commentsLoading ? (
                    <div className="flex items-center justify-center h-32">
                      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : comments.length === 0 ? (
                    <p className="text-center py-8 text-sm text-muted-foreground">No comments yet</p>
                  ) : (
                    <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                      {comments.map(comment => {
                        const kw = keywords.find(k => comment.text.toLowerCase().includes(k.toLowerCase()));
                        const inCRM = instagramLeads.find(l => l.source_metadata?.comment_id === comment.id);
                        return (
                          <div key={comment.id} className={`border rounded-lg p-3 ${kw ? 'border-purple-300 bg-purple-50/50' : ''}`}>
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 mb-0.5">
                                  <span className="text-xs font-semibold text-purple-700">@{comment.username}</span>
                                  {kw && <Badge className="bg-purple-500/10 text-purple-700 border-purple-500/20 text-xs px-1.5 py-0">{kw}</Badge>}
                                  {inCRM && <Badge className="bg-green-500/10 text-green-700 border-green-500/20 text-xs px-1.5 py-0">In CRM</Badge>}
                                </div>
                                <p className="text-xs text-foreground">{comment.text}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">{moment(comment.timestamp).fromNow()}</p>
                              </div>
                              <div className="flex flex-col gap-1 shrink-0">
                                {!inCRM && (
                                  <Button size="sm" variant="outline" className="h-6 text-xs px-2 gap-1"
                                    onClick={() => addLeadFromComment(comment, selectedPost)}>
                                    <UserPlus className="w-2.5 h-2.5" /> Add Lead
                                  </Button>
                                )}
                                {kw && (
                                  <Button size="sm" variant="ghost" className="h-6 text-xs px-2 gap-1"
                                    onClick={() => { setReplyText(REPLY_TEMPLATES[kw] || REPLY_TEMPLATES.default); }}>
                                    <Copy className="w-2.5 h-2.5" /> Template
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Reply box */}
                  <div className="border-t pt-3 space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">Reply to this post</p>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Write a reply..."
                        value={replyText}
                        onChange={e => setReplyText(e.target.value)}
                        className="h-8 text-xs"
                        onKeyDown={e => {
                          if (e.key === 'Enter' && replyText.trim()) {
                            replyComment.mutate({ post_id: selectedPost.id, message: replyText.trim() });
                          }
                        }}
                      />
                      <Button
                        size="sm"
                        className="h-8 gap-1 bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:opacity-90"
                        onClick={() => replyComment.mutate({ post_id: selectedPost.id, message: replyText.trim() })}
                        disabled={!replyText.trim() || replyComment.isPending}
                      >
                        {replyComment.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                        Post
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* MANUAL TAB */}
      {activeTab === 'manual' && (
        <div className="max-w-lg space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-purple-600" />
                Log a Comment Lead Manually
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Instagram Username *</label>
                <div className="flex items-center border rounded-md focus-within:ring-1 focus-within:ring-ring">
                  <span className="pl-3 text-muted-foreground text-sm">@</span>
                  <input
                    className="flex-1 h-9 px-2 text-sm bg-transparent outline-none"
                    placeholder="username"
                    value={form.username}
                    onChange={e => setForm({ ...form, username: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Their Comment</label>
                <Input
                  placeholder="Paste their comment here..."
                  value={form.comment}
                  onChange={e => setForm({ ...form, comment: e.target.value })}
                  className="h-9"
                />
                {detectedKeyword && (
                  <p className="text-xs text-purple-600 mt-1">Keyword detected: <strong>{detectedKeyword}</strong></p>
                )}
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Post URL (optional)</label>
                <Input
                  placeholder="https://instagram.com/p/..."
                  value={form.post_url}
                  onChange={e => setForm({ ...form, post_url: e.target.value })}
                  className="h-9"
                />
              </div>
              {suggestedReply && (
                <div className="bg-purple-500/5 border border-purple-500/20 rounded-lg p-3 space-y-2">
                  <p className="text-xs font-medium text-purple-700">Suggested Reply:</p>
                  <p className="text-xs text-muted-foreground italic">{suggestedReply}</p>
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => copyText(suggestedReply, 'reply')}>
                    {copied === 'reply' ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
                    Copy Reply
                  </Button>
                </div>
              )}
              <Button
                className="w-full gap-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:opacity-90"
                onClick={() => createLead.mutate(form)}
                disabled={!form.username || createLead.isPending}
              >
                <Plus className="w-4 h-4" />
                {createLead.isPending ? 'Adding...' : 'Add to CRM'}
                <ArrowRight className="w-4 h-4" />
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Tag className="w-4 h-4 text-amber-600" />
                Trigger Keywords
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">Auto-detect leads from comments containing these keywords.</p>
              <div className="flex flex-wrap gap-1.5">
                {keywords.map(kw => (
                  <span key={kw} className="inline-flex items-center gap-1 bg-muted text-xs px-2 py-1 rounded-full">
                    {kw}
                    <button onClick={() => setKeywords(keywords.filter(k => k !== kw))} className="text-muted-foreground hover:text-red-500">
                      <Trash2 className="w-2.5 h-2.5" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Add keyword..."
                  value={newKeyword}
                  onChange={e => setNewKeyword(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      const kw = newKeyword.trim().toLowerCase();
                      if (kw && !keywords.includes(kw)) { setKeywords([...keywords, kw]); setNewKeyword(''); }
                    }
                  }}
                  className="h-8 text-xs"
                />
                <Button size="sm" variant="outline" className="h-8 shrink-0" onClick={() => {
                  const kw = newKeyword.trim().toLowerCase();
                  if (kw && !keywords.includes(kw)) { setKeywords([...keywords, kw]); setNewKeyword(''); }
                }}>
                  <Plus className="w-3 h-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* LEADS TAB */}
      {activeTab === 'leads' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{instagramLeads.length} leads from Instagram in your CRM</p>
            <Button size="sm" variant="outline" className="gap-1.5 h-8" onClick={() => syncLeads.mutate()} disabled={syncLeads.isPending}>
              {syncLeads.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5 text-amber-500" />}
              Sync Now
            </Button>
          </div>
          {instagramLeads.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Instagram className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm">No Instagram leads yet</p>
              <p className="text-xs mt-1">Use "Auto-Sync Leads" or log manually</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {instagramLeads.map(lead => (
                <div key={lead.id} className="border rounded-xl p-4 hover:bg-muted/30 transition-colors space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center shrink-0">
                        <User className="w-4 h-4 text-purple-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">@{lead.source_metadata?.username || lead.name}</p>
                        <p className="text-xs text-muted-foreground">{moment(lead.created_date).fromNow()}</p>
                      </div>
                    </div>
                    <Badge className="bg-purple-500/10 text-purple-700 border-purple-500/20 text-xs shrink-0">
                      {lead.source_metadata?.keyword_triggered || 'manual'}
                    </Badge>
                  </div>
                  {lead.source_metadata?.comment && (
                    <p className="text-xs text-muted-foreground italic line-clamp-2">"{lead.source_metadata.comment}"</p>
                  )}
                  {lead.source_metadata?.post_url && (
                    <a href={lead.source_metadata.post_url} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                      <ExternalLink className="w-3 h-3" /> View Post
                    </a>
                  )}
                  <div className="flex items-center gap-1.5">
                    <Badge variant="outline" className="text-xs">{lead.stage?.replace('_', ' ') || 'new lead'}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}