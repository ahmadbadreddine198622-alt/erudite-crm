import React, { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Loader2, Sparkles, Copy, Check, Mail, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function AIInsightsPanel({ selectedContactId = null }) {
  const [input, setInput] = useState('');
  const [insights, setInsights] = useState(null);
  const [emailTemplate, setEmailTemplate] = useState(null);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState('insights');

  // Fetch contact details if selected
  const { data: contact } = useQuery({
    queryKey: ['contact', selectedContactId],
    queryFn: () => selectedContactId ? base44.entities.Lead.read(selectedContactId) : null,
    enabled: !!selectedContactId,
  });

  const generateEmailTemplateMutation = useMutation({
    mutationFn: async (text) => {
      const response = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a Dubai luxury real estate professional positioned as an insider broker living in premium buildings.

Using the ERUDITE MASTER SYSTEM, generate a professional email to approach a landlord:

Contact Information:
${text}

Generate a persuasive, professional email that:
1. Opens with insider positioning ("I live in the building, track daily transactions")
2. Includes realistic market data for Dubai properties
3. Positions 3 clear price strategies (fast sale, market, premium)
4. Adds cultural and language-appropriate tone
5. Creates trust through expertise and selective approach
6. Ends with a clear call to action

Make it professional, not pushy. Feel like insider communication.`,
        response_json_schema: {
          type: 'object',
          properties: {
            email_subject: { type: 'string' },
            email_body: { type: 'string' },
            whatsapp_message: { type: 'string' },
            call_script: { type: 'string' },
            key_positioning: { type: 'array', items: { type: 'string' } },
          },
        },
      });
      return response;
    },
    onSuccess: (data) => {
      setEmailTemplate(data);
      toast.success('Email template generated');
    },
    onError: () => {
      toast.error('Failed to generate template');
    },
  });

  const analyzeInsightsMutation = useMutation({
    mutationFn: async (text) => {
      const response = await base44.integrations.Core.InvokeLLM({
        prompt: `You are an expert CRM analyst. Analyze the following information about a contact/lead and provide detailed, actionable insights:

Information:
${text}

Provide a structured analysis with:
1. **Contact Profile Summary** - Who is this person/business?
2. **Key Information Extracted** - Main details, needs, interests
3. **Business Potential** - Likelihood of conversion, deal size estimate
4. **Pain Points Identified** - What problems might they have?
5. **Recommended Actions** - Next steps to take
6. **Communication Tone** - How to approach them
7. **Red Flags or Opportunities** - Watch out for, or leverage these

Be concise but comprehensive. Use clear formatting.`,
        response_json_schema: {
          type: 'object',
          properties: {
            profile_summary: { type: 'string' },
            key_information: { type: 'array', items: { type: 'string' } },
            business_potential: { type: 'string' },
            pain_points: { type: 'array', items: { type: 'string' } },
            recommended_actions: { type: 'array', items: { type: 'string' } },
            communication_tone: { type: 'string' },
            insights: { type: 'string' },
          },
        },
      });
      return response;
    },
    onSuccess: (data) => {
      setInsights(data);
      toast.success('AI analysis complete');
    },
    onError: () => {
      toast.error('Failed to analyze information');
    },
  });

  const handleAnalyze = () => {
    if (!input.trim()) {
      toast.error('Please enter information to analyze');
      return;
    }
    analyzeInsightsMutation.mutate(input);
  };

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4 border rounded-lg p-4 bg-gradient-to-br from-accent/5 to-accent/10 h-full flex flex-col">
      <div className="flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-accent" />
        <h3 className="font-semibold text-sm">AI Intelligence Center</h3>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="grid w-full grid-cols-2 text-xs">
          <TabsTrigger value="insights">Analysis</TabsTrigger>
          <TabsTrigger value="templates">Email</TabsTrigger>
        </TabsList>

        <TabsContent value="insights" className="flex-1 space-y-3 overflow-y-auto">
          {!insights ? (
            <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-2">
              Paste contact information for AI analysis
            </label>
            <Textarea
              placeholder={`Example:
Ahmed Al Mansouri, 00971501234567
Looking for 3BR villa in Dubai Marina
Budget 2-3M AED
Mentioned interested in payment plan
Previously worked in finance
Has 2 kids, needs proximity to school`}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="min-h-24 text-xs"
            />
          </div>
          <Button
            onClick={handleAnalyze}
            disabled={!input.trim() || analyzeInsightsMutation.isPending}
            className="w-full gap-2 bg-accent hover:bg-accent/90"
          >
            {analyzeInsightsMutation.isPending && (
              <Loader2 className="w-4 h-4 animate-spin" />
            )}
            {analyzeInsightsMutation.isPending ? 'Analyzing...' : 'Analyze with AI'}
          </Button>
            </div>
          ) : (
          <div className="flex items-center justify-between gap-2 pb-2 border-b">
            <h4 className="font-semibold text-xs">AI Analysis Results</h4>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setInsights(null);
                setInput('');
              }}
              className="h-6"
            >
              New Analysis
            </Button>
          </div>

          {/* Profile Summary */}
          {insights.profile_summary && (
            <div className="bg-white/50 rounded p-2.5 space-y-1.5">
              <h5 className="font-semibold text-xs text-foreground">📋 Contact Profile</h5>
              <p className="text-xs text-foreground/80 leading-relaxed">
                {insights.profile_summary}
              </p>
            </div>
          )}

          {/* Key Information */}
          {insights.key_information?.length > 0 && (
            <div className="bg-white/50 rounded p-2.5 space-y-1.5">
              <h5 className="font-semibold text-xs text-foreground">🔍 Key Information</h5>
              <ul className="text-xs space-y-1">
                {insights.key_information.map((item, idx) => (
                  <li key={idx} className="text-foreground/80 flex gap-2">
                    <span>•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Business Potential */}
          {insights.business_potential && (
            <div className="bg-green-50/80 rounded p-2.5 space-y-1.5 border border-green-200/50">
              <h5 className="font-semibold text-xs text-green-900">💼 Business Potential</h5>
              <p className="text-xs text-green-800/90 leading-relaxed">
                {insights.business_potential}
              </p>
            </div>
          )}

          {/* Pain Points */}
          {insights.pain_points?.length > 0 && (
            <div className="bg-orange-50/80 rounded p-2.5 space-y-1.5 border border-orange-200/50">
              <h5 className="font-semibold text-xs text-orange-900">⚠️ Pain Points</h5>
              <ul className="text-xs space-y-1">
                {insights.pain_points.map((point, idx) => (
                  <li key={idx} className="text-orange-800/90 flex gap-2">
                    <span>•</span>
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Recommended Actions */}
          {insights.recommended_actions?.length > 0 && (
            <div className="bg-blue-50/80 rounded p-2.5 space-y-1.5 border border-blue-200/50">
              <h5 className="font-semibold text-xs text-blue-900">✅ Recommended Actions</h5>
              <ol className="text-xs space-y-1">
                {insights.recommended_actions.map((action, idx) => (
                  <li key={idx} className="text-blue-800/90 flex gap-2">
                    <span className="font-semibold">{idx + 1}.</span>
                    <span>{action}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Communication Tone */}
          {insights.communication_tone && (
            <div className="bg-purple-50/80 rounded p-2.5 space-y-1.5 border border-purple-200/50">
              <h5 className="font-semibold text-xs text-purple-900">💬 Communication Approach</h5>
              <p className="text-xs text-purple-800/90 leading-relaxed">
                {insights.communication_tone}
              </p>
            </div>
          )}

          {/* Additional Insights */}
          {insights.insights && (
            <div className="bg-background rounded p-2.5 space-y-1.5 border border-border">
              <h5 className="font-semibold text-xs text-foreground">💡 Additional Insights</h5>
              <p className="text-xs text-foreground/80 leading-relaxed">
                {insights.insights}
              </p>
            </div>
          )}

          {/* Copy All Button */}
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const fullText = `
Profile: ${insights.profile_summary}

Key Information:
${insights.key_information?.join('\n')}

Business Potential: ${insights.business_potential}

Pain Points:
${insights.pain_points?.join('\n')}

Recommended Actions:
${insights.recommended_actions?.join('\n')}

Communication: ${insights.communication_tone}

Insights: ${insights.insights}
              `.trim();
              handleCopy(fullText);
            }}
            className="w-full gap-2 text-xs h-8"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5" /> Copied!
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" /> Copy All Insights
              </>
            )}
            </Button>
          </div>
          )}
        </TabsContent>

        <TabsContent value="templates" className="flex-1 space-y-3 overflow-y-auto">
          {!emailTemplate ? (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-2">
                  Contact & Unit Details
                </label>
                <Textarea
                  placeholder={`Example:
Ahmed Al Mansouri, +971501234567
3BR Villa, Marina, 2500 sqft
Landlord - seeking to sell
Russian background
Budget expectation: 2.5M AED`}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  className="min-h-24 text-xs"
                />
              </div>
              <Button
                onClick={() => generateEmailTemplateMutation.mutate(input)}
                disabled={!input.trim() || generateEmailTemplateMutation.isPending}
                className="w-full gap-2 bg-accent hover:bg-accent/90 text-xs"
              >
                {generateEmailTemplateMutation.isPending && (
                  <Loader2 className="w-3 h-3 animate-spin" />
                )}
                {generateEmailTemplateMutation.isPending ? 'Generating...' : 'Generate Email'}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2 pb-2 border-b">
                <h4 className="font-semibold text-xs">Templates Ready</h4>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setEmailTemplate(null);
                    setInput('');
                  }}
                  className="h-6 text-xs"
                >
                  New
                </Button>
              </div>

              {/* Email Template */}
              {emailTemplate.email_body && (
                <div className="bg-white/50 rounded p-2.5 space-y-1.5">
                  <div className="flex items-center gap-2 mb-2">
                    <Mail className="w-3.5 h-3.5 text-accent" />
                    <h5 className="font-semibold text-xs">Email</h5>
                  </div>
                  <p className="text-xs font-semibold text-foreground/80 p-1.5 bg-accent/10 rounded">
                    Subject: {emailTemplate.email_subject}
                  </p>
                  <p className="text-xs text-foreground/80 leading-relaxed whitespace-pre-wrap p-2 bg-secondary/30 rounded max-h-32 overflow-y-auto">
                    {emailTemplate.email_body}
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleCopy(emailTemplate.email_body)}
                    className="w-full gap-2 text-xs h-7"
                  >
                    {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    Copy Email
                  </Button>
                </div>
              )}

              {/* WhatsApp Template */}
              {emailTemplate.whatsapp_message && (
                <div className="bg-green-50/80 rounded p-2.5 space-y-1.5 border border-green-200/50">
                  <div className="flex items-center gap-2 mb-2">
                    <MessageSquare className="w-3.5 h-3.5 text-green-600" />
                    <h5 className="font-semibold text-xs text-green-900">WhatsApp</h5>
                  </div>
                  <p className="text-xs text-green-800/90 leading-relaxed whitespace-pre-wrap p-2 bg-white/50 rounded max-h-24 overflow-y-auto">
                    {emailTemplate.whatsapp_message}
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleCopy(emailTemplate.whatsapp_message)}
                    className="w-full gap-2 text-xs h-7"
                  >
                    {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    Copy Message
                  </Button>
                </div>
              )}

              {/* Call Script */}
              {emailTemplate.call_script && (
                <div className="bg-blue-50/80 rounded p-2.5 space-y-1.5 border border-blue-200/50">
                  <h5 className="font-semibold text-xs text-blue-900">📞 Call Script</h5>
                  <p className="text-xs text-blue-800/90 leading-relaxed whitespace-pre-wrap p-2 bg-white/50 rounded max-h-24 overflow-y-auto">
                    {emailTemplate.call_script}
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleCopy(emailTemplate.call_script)}
                    className="w-full gap-2 text-xs h-7"
                  >
                    {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    Copy Script
                  </Button>
                </div>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}