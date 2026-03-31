import React, { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Sparkles, Copy, Check, Mail, MessageSquare, Phone, Lightbulb, ChevronRight, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

const ActionCard = ({ icon: Icon, iconColor, bgColor, title, children }) => (
  <div className={`rounded-xl p-4 space-y-2.5 ${bgColor} border border-white/60 shadow-sm`}>
    <div className="flex items-center gap-2">
      <Icon className={`w-4 h-4 ${iconColor}`} />
      <h5 className={`font-semibold text-xs ${iconColor}`}>{title}</h5>
    </div>
    {children}
  </div>
);

export default function AIActionsPanel({ selectedContactId }) {
  const [customInput, setCustomInput] = useState('');
  const [result, setResult] = useState(null);
  const [resultType, setResultType] = useState(null);
  const [copied, setCopied] = useState(false);

  const { data: contact } = useQuery({
    queryKey: ['contact', selectedContactId],
    queryFn: async () => {
      const results = await base44.entities.Lead.filter({ id: selectedContactId }, '-created_date', 1);
      return results?.[0] || null;
    },
    enabled: !!selectedContactId,
  });

  const generateMutation = useMutation({
    mutationFn: async ({ type, extraInput }) => {
      // Build rich contact context from new schema
      const primaryPhone = contact?.phones?.find(p => p.is_primary)?.number
        || contact?.phones?.[0]?.number
        || contact?.phone || 'N/A';
      const allPhones = contact?.phones?.map(p => `${p.number} (${p.label})`).join(', ')
        || contact?.phone || 'N/A';
      const primaryEmail = contact?.emails?.find(e => e.is_primary)?.address
        || contact?.emails?.[0]?.address
        || contact?.email || 'N/A';
      const tower = contact?.organization?.tower || contact?.source_metadata?.project || 'N/A';
      const unit = contact?.organization?.unit_number || contact?.source_metadata?.unit || 'N/A';
      const company = contact?.organization?.name || 'N/A';
      const role = contact?.organization?.role || 'N/A';
      const customFields = contact?.custom_fields?.map(f => `${f.key}: ${f.value}`).join(', ') || 'None';

      const contactInfo = contact ? `
Contact Name: ${contact.name}
Unit Number: ${unit}
Tower / Building: ${tower}
`.trim() : extraInput || 'No contact context';

      if (type === 'email_templates') {
        return base44.integrations.Core.InvokeLLM({
          prompt: `You are a Dubai luxury real estate broker. Generate professional outreach for:
${contactInfo}
${extraInput ? `Additional context: ${extraInput}` : ''}

IMPORTANT:
- You are the agent writing TO this contact — do NOT include their contact details (phone/email) in the message
- Always address them by their first name naturally (e.g. "Dear Ahmed," or "Hi Ahmed,")
- Reference their specific unit number and tower/building name naturally in the message body to show you know their property
- Frame it as an agent who knows their building well and has relevant market insights for their specific unit
- Keep it personal, insider, and professional — not generic

Generate a persuasive email, WhatsApp message, and call script from the agent's perspective.`,
          response_json_schema: {
            type: 'object',
            properties: {
              email_subject: { type: 'string' },
              email_body: { type: 'string' },
              whatsapp_message: { type: 'string' },
              call_script: { type: 'string' },
            },
          },
        });
      }

      if (type === 'analysis') {
        return base44.integrations.Core.InvokeLLM({
          prompt: `Analyze this real estate contact and provide actionable CRM insights:
${contactInfo}
${extraInput ? `Additional context: ${extraInput}` : ''}`,
          response_json_schema: {
            type: 'object',
            properties: {
              profile_summary: { type: 'string' },
              business_potential: { type: 'string' },
              pain_points: { type: 'array', items: { type: 'string' } },
              recommended_actions: { type: 'array', items: { type: 'string' } },
              communication_tone: { type: 'string' },
            },
          },
        });
      }
    },
    onSuccess: (data, variables) => {
      setResult(data);
      setResultType(variables.type);
    },
    onError: () => toast.error('AI generation failed'),
  });

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const reset = () => {
    setResult(null);
    setResultType(null);
    setCustomInput('');
  };

  return (
    <div className="flex flex-col h-full bg-[#F9FAFB]">
      {/* Header */}
      <div className="px-5 py-4 border-b border-[#E5E7EB] bg-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-500 flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-[#111827] text-sm">AI Actions</h3>
              <p className="text-[10px] text-[#9CA3AF]">Context-aware intelligence</p>
            </div>
          </div>
          {result && (
            <button onClick={reset} className="flex items-center gap-1 text-xs text-[#6B7280] hover:text-indigo-600 transition-colors">
              <RotateCcw className="w-3 h-3" /> Reset
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        <AnimatePresence mode="wait">
          {!result ? (
            <motion.div key="actions" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
              {/* Context Input */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-[#374151] block">
                  {selectedContactId ? 'Additional context (optional)' : 'Paste contact information'}
                </label>
                <Textarea
                  placeholder={selectedContactId
                    ? 'Add extra details about this contact...'
                    : `Name, phone, property interest\nBudget, notes, language...`}
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  className="min-h-20 text-xs bg-white border-[#E5E7EB] rounded-xl resize-none"
                />
              </div>

              {/* Action Buttons */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-[#374151]">Generate with AI</p>
                <button
                  onClick={() => generateMutation.mutate({ type: 'email_templates', extraInput: customInput })}
                  disabled={generateMutation.isPending || (!selectedContactId && !customInput.trim())}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-white border border-[#E5E7EB] hover:border-indigo-400 hover:shadow-sm text-left transition-all group disabled:opacity-50"
                >
                  <div className="flex items-center gap-3">
                    <Mail className="w-4 h-4 text-indigo-500" />
                    <div>
                      <p className="text-xs font-semibold text-[#111827]">Email + WhatsApp + Call Script</p>
                      <p className="text-[10px] text-[#9CA3AF]">Full outreach package</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[#D1D5DB] group-hover:text-indigo-400 transition-colors" />
                </button>

                <button
                  onClick={() => generateMutation.mutate({ type: 'analysis', extraInput: customInput })}
                  disabled={generateMutation.isPending || (!selectedContactId && !customInput.trim())}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-white border border-[#E5E7EB] hover:border-indigo-400 hover:shadow-sm text-left transition-all group disabled:opacity-50"
                >
                  <div className="flex items-center gap-3">
                    <Lightbulb className="w-4 h-4 text-amber-500" />
                    <div>
                      <p className="text-xs font-semibold text-[#111827]">Deep Contact Analysis</p>
                      <p className="text-[10px] text-[#9CA3AF]">Insights, potential, actions</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[#D1D5DB] group-hover:text-indigo-400 transition-colors" />
                </button>
              </div>

              {generateMutation.isPending && (
                <div className="flex items-center justify-center gap-2 py-6">
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                  <span className="text-xs text-[#6B7280]">AI is working…</span>
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div key="results" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
              {resultType === 'email_templates' && (
                <>
                  {result.email_body && (
                    <ActionCard icon={Mail} iconColor="text-indigo-600" bgColor="bg-indigo-50/60" title="Email">
                      <p className="text-[10px] font-semibold text-indigo-700 bg-white rounded-lg px-2.5 py-1.5">
                        Subject: {result.email_subject}
                      </p>
                      <p className="text-xs text-[#374151] leading-relaxed whitespace-pre-wrap bg-white rounded-lg px-2.5 py-2 max-h-32 overflow-y-auto">
                        {result.email_body}
                      </p>
                      <button
                        onClick={() => handleCopy(result.email_body)}
                        className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-700 font-medium transition-colors"
                      >
                        {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        {copied ? 'Copied!' : 'Copy Email'}
                      </button>
                    </ActionCard>
                  )}
                  {result.whatsapp_message && (
                    <ActionCard icon={MessageSquare} iconColor="text-green-600" bgColor="bg-green-50/60" title="WhatsApp">
                      <p className="text-xs text-[#374151] leading-relaxed whitespace-pre-wrap bg-white rounded-lg px-2.5 py-2 max-h-24 overflow-y-auto">
                        {result.whatsapp_message}
                      </p>
                      <button
                        onClick={() => handleCopy(result.whatsapp_message)}
                        className="flex items-center gap-1.5 text-xs text-green-600 hover:text-green-700 font-medium transition-colors"
                      >
                        {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        {copied ? 'Copied!' : 'Copy Message'}
                      </button>
                    </ActionCard>
                  )}
                  {result.call_script && (
                    <ActionCard icon={Phone} iconColor="text-blue-600" bgColor="bg-blue-50/60" title="Call Script">
                      <p className="text-xs text-[#374151] leading-relaxed whitespace-pre-wrap bg-white rounded-lg px-2.5 py-2 max-h-24 overflow-y-auto">
                        {result.call_script}
                      </p>
                      <button
                        onClick={() => handleCopy(result.call_script)}
                        className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium transition-colors"
                      >
                        {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        {copied ? 'Copied!' : 'Copy Script'}
                      </button>
                    </ActionCard>
                  )}
                </>
              )}

              {resultType === 'analysis' && (
                <>
                  {result.profile_summary && (
                    <ActionCard icon={Sparkles} iconColor="text-indigo-600" bgColor="bg-indigo-50/60" title="Profile Summary">
                      <p className="text-xs text-[#374151] leading-relaxed">{result.profile_summary}</p>
                    </ActionCard>
                  )}
                  {result.business_potential && (
                    <ActionCard icon={Lightbulb} iconColor="text-amber-600" bgColor="bg-amber-50/60" title="Business Potential">
                      <p className="text-xs text-[#374151] leading-relaxed">{result.business_potential}</p>
                    </ActionCard>
                  )}
                  {result.pain_points?.length > 0 && (
                    <ActionCard icon={MessageSquare} iconColor="text-orange-600" bgColor="bg-orange-50/60" title="Pain Points">
                      <ul className="space-y-1">
                        {result.pain_points.map((p, i) => (
                          <li key={i} className="text-xs text-[#374151] flex gap-2"><span>•</span><span>{p}</span></li>
                        ))}
                      </ul>
                    </ActionCard>
                  )}
                  {result.recommended_actions?.length > 0 && (
                    <ActionCard icon={ChevronRight} iconColor="text-green-600" bgColor="bg-green-50/60" title="Recommended Actions">
                      <ol className="space-y-1">
                        {result.recommended_actions.map((a, i) => (
                          <li key={i} className="text-xs text-[#374151] flex gap-2"><span className="font-semibold text-green-600">{i + 1}.</span><span>{a}</span></li>
                        ))}
                      </ol>
                    </ActionCard>
                  )}
                  {result.communication_tone && (
                    <ActionCard icon={Mail} iconColor="text-purple-600" bgColor="bg-purple-50/60" title="Communication Approach">
                      <p className="text-xs text-[#374151] leading-relaxed">{result.communication_tone}</p>
                    </ActionCard>
                  )}
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}