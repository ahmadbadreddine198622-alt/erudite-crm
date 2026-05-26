import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageSquare, Sparkles, Copy, Check, Loader2, Wand2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { cn } from '@/lib/utils';

export default function ReplyAssistantPanel({ conversation, lead, landlord, onInsertMessage }) {
  const [isOpen, setIsOpen] = useState(false);
  const [draftPrompt, setDraftPrompt] = useState('');
  const [generatedReply, setGeneratedReply] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [tone, setTone] = useState('professional'); // professional | warm | urgent

  const handleGenerateReply = async () => {
    if (!conversation?.id) return;
    
    setIsGenerating(true);
    try {
      // Start a conversation with the agent
      const agentConversation = await base44.agents.createConversation({
        agent_name: 'whatsapp_reply_assistant',
        metadata: {
          name: `Reply Draft - ${lead?.full_name || conversation.wa_display_name || conversation.wa_phone_e164}`,
          description: 'Drafting WhatsApp reply',
          context: {
            conversation_id: conversation.id,
            lead_id: lead?.id,
            landlord_id: landlord?.id,
          }
        }
      });

      // Add context message
      const contextMessage = `
Please help me draft a WhatsApp reply for this conversation.

**Context:**
- Conversation ID: ${conversation.id}
- Contact: ${lead?.full_name || conversation.wa_display_name || conversation.wa_phone_e164}
- Current Stage: ${lead?.stage || landlord?.stage || 'unknown'}
- Sentiment: ${conversation.ai_sentiment || 'unknown'}
- Last Message: "${conversation.last_message || 'N/A'}"

**My intent:** ${draftPrompt || 'Craft a professional follow-up message'}

**Preferred tone:** ${tone}

Please provide 2-3 draft options with brief reasoning for each.
      `.trim();

      await base44.agents.addMessage(agentConversation, {
        role: 'user',
        content: contextMessage
      });

      // Get the agent's response
      const updatedConversation = await base44.agents.getConversation(agentConversation.id);
      const lastMessage = updatedConversation.messages[updatedConversation.messages.length - 1];
      
      if (lastMessage && lastMessage.role === 'assistant') {
        setGeneratedReply(lastMessage.content);
      }
    } catch (error) {
      console.error('Error generating reply:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = async () => {
    if (!generatedReply) return;
    await navigator.clipboard.writeText(generatedReply);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleInsert = () => {
    if (generatedReply && onInsertMessage) {
      onInsertMessage(generatedReply);
      setIsOpen(false);
      setGeneratedReply(null);
      setDraftPrompt('');
    }
  };

  if (!isOpen) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(true)}
        className="gap-2 text-xs"
      >
        <Wand2 className="w-3.5 h-3.5" />
        AI Reply Assistant
      </Button>
    );
  }

  return (
    <Card className="border-t rounded-t-none bg-muted/30">
      <CardHeader className="pb-3 pt-4 px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-accent" />
            <CardTitle className="text-sm font-semibold">Reply Assistant</CardTitle>
            <Badge variant="outline" className="text-xs">
              <MessageSquare className="w-3 h-3 mr-1" />
              AI-Powered
            </Badge>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsOpen(false)}
            className="h-6 w-6 p-0"
          >
            ×
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 px-4 pb-4">
        {/* Context Summary */}
        <div className="text-xs text-muted-foreground space-y-1 bg-card p-2 rounded-lg border">
          <div><strong>Contact:</strong> {lead?.full_name || landlord?.full_name_en || conversation.wa_display_name || 'Unknown'}</div>
          <div><strong>Stage:</strong> {lead?.stage || landlord?.stage || 'N/A'}</div>
          {lead?.ai_persona?.archetype && (
            <div><strong>Archetype:</strong> {lead.ai_persona.archetype}</div>
          )}
          {conversation.ai_sentiment && (
            <div><strong>Sentiment:</strong> {conversation.ai_sentiment}</div>
          )}
        </div>

        {/* Intent Input */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium">What do you want to say?</label>
          <Textarea
            placeholder="E.g., 'Follow up on viewing scheduled for tomorrow', 'Negotiate commission', 'Send property details'..."
            value={draftPrompt}
            onChange={(e) => setDraftPrompt(e.target.value)}
            className="h-20 text-sm"
          />
        </div>

        {/* Tone Selection */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium">Tone</label>
          <div className="flex gap-2">
            {['professional', 'warm', 'urgent'].map((t) => (
              <button
                key={t}
                onClick={() => setTone(t)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border",
                  tone === t
                    ? "bg-accent text-accent-foreground border-accent"
                    : "bg-background text-muted-foreground border-border hover:bg-muted"
                )}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Generate Button */}
        <Button
          onClick={handleGenerateReply}
          disabled={isGenerating}
          className="w-full gap-2 text-xs"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5" />
              Generate Reply
            </>
          )}
        </Button>

        {/* Generated Reply */}
        {generatedReply && (
          <div className="space-y-2 pt-2 border-t">
            <label className="text-xs font-medium">Generated Reply:</label>
            <div className="bg-card p-3 rounded-lg border text-sm whitespace-pre-wrap">
              {generatedReply}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopy}
                className="flex-1 gap-2 text-xs"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied!' : 'Copy'}
              </Button>
              <Button
                size="sm"
                onClick={handleInsert}
                className="flex-1 gap-2 text-xs bg-green-600 hover:bg-green-700"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                Insert in Composer
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}