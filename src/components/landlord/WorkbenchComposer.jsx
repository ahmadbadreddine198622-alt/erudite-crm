// WorkbenchComposer — a single persistent composer bar docked at the bottom
// of the communication panel, present on EVERY tab. Extends UnifiedChatComposer
// as its base for message tabs and morphs minimally per tab:
//   • WhatsApp / iMessage / Telegram / SMS / Activity → message mode (UnifiedChatComposer)
//   • Email → same bar + a subject input line above the textarea
//   • Activity → sends via the landlord's best channel (most recent inbound → iMessage → WhatsApp → Telegram → Email)
//   • Note / Task / Follow-up → AI draft bars + NoteComposerBar
//   • Appointment → AppointmentComposer fields inside the same bar footprint
//
// The control order is identical on all tabs:
//   [channel indicator] [Templates] [Erudite Tone] [translation] [attachment] [voice] [emoji] [Send]

import React from 'react';
import UnifiedChatComposer from './UnifiedChatComposer';
import EruditeToneButton from './EruditeToneButton';
import NoteAiDraftBar from './NoteAiDraftBar';
import NoteComposerBar from './NoteComposerBar';
import FollowupComposerFields from './FollowupComposerFields';
import AppointmentComposer from './AppointmentComposer';
import { Zap } from 'lucide-react';

function css(str) {
  const o = {};
  String(str).split(';').forEach((decl) => {
    const i = decl.indexOf(':');
    if (i < 0) return;
    const k = decl.slice(0, i).trim();
    const v = decl.slice(i + 1).trim();
    if (!k) return;
    o[k.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = v;
  });
  return o;
}

const CHANNEL_META = {
  Chat:       { label: 'WhatsApp',  color: '#25D366', icon: '💬' },
  iMessage:   { label: 'iMessage',  color: '#0A84FF', icon: '✉' },
  Telegram:   { label: 'Telegram',  color: '#29b6f6', icon: '✈' },
  SMS:        { label: 'SMS',       color: '#60a5fa', icon: '📱' },
  Email:      { label: 'Email',     color: 'hsl(38 92% 55%)', icon: '✉' },
  Activity:   { label: 'Auto',      color: '#a78bfa', icon: '⚡' },
  Note:       { label: 'Note',      color: 'rgba(255,255,255,0.6)', icon: '📝' },
  Task:       { label: 'Task',      color: '#34d399', icon: '✓' },
  'Follow-up':{ label: 'Follow-up', color: 'hsl(38 92% 60%)', icon: '↻' },
  Appointment:{ label: 'Appointment',color: '#c4b5fd', icon: '📅' },
  Calls:      { label: 'Call',      color: '#93c5fd', icon: '📞' },
};

export default function WorkbenchComposer({
  composerType, text, onTextChange, onKeyDown, onSend, sending, parsing,
  placeholder, tplChannel, onPickTemplate, onSaveTemplate,
  aiSuggestedMessages, onPickSuggested, attachment, onAttachmentChange,
  chatTemplatesOpen, onToggleChatTemplates, landlordId, phone, streamFilter,
  channelDisabled, disabledHint, targetLanguage,
  // Email
  emailSubject, onSubjectChange,
  // Note/Task/Follow-up
  composerRef, busy, landlord,
  noteAiSource, noteGenerating, onPickNoteDraft, onGenerateNoteDraft, onClearNoteDraft,
  taskAiSource, onPickTaskDraft, onClearTaskDraft, taskDueDate, onTaskDueDate, taskAssignee, onTaskAssignee,
  suggestedFollowupChips, followupAiSource, aiFollowupsCollapsed, onToggleFollowupCollapsed,
  onPickFollowupChip, followupChannel, onFollowupChannel, followupDate, onFollowupDate,
  followupHour, onFollowupHour, followupMinute, onFollowupMinute,
  followupAmPm, onFollowupAmPm, onClearFollowupDraft,
  followupAssignee, onFollowupAssignee, creatorName,
  // Appointment
  propertyId, agentEmail, onBooked,
  // Best channel for Activity
  bestChannel, onBestChannelOverride,
  // Extra children for the toolbar (EruditeToneButton etc.)
  onToneReplace,
}) {
  const meta = CHANNEL_META[composerType] || CHANNEL_META.Chat;
  const isMessageTab = ['Chat', 'iMessage', 'Telegram', 'SMS', 'Email', 'Activity'].includes(composerType);
  const isNoteTab = ['Note', 'Task', 'Follow-up'].includes(composerType);

  // For Activity, the effective channel determines the tplChannel and send target.
  const effChannel = composerType === 'Activity' ? (bestChannel || 'Chat') : composerType;
  const effTplChannel = composerType === 'Email' ? 'email'
    : composerType === 'iMessage' ? 'imessage'
    : composerType === 'Activity' ? (effChannel === 'iMessage' ? 'imessage' : effChannel === 'Telegram' ? 'telegram' : effChannel === 'Email' ? 'email' : 'whatsapp')
    : tplChannel;

  return (
    <div>
      {/* Channel indicator + Activity override chip */}
      <div style={css('display:flex; align-items:center; gap:6px; margin-bottom:6px;')}>
        <span style={css('display:inline-flex; align-items:center; gap:4px; padding:3px 9px; border-radius:99px; font-size:10px; font-weight:700; letter-spacing:0.03em; text-transform:uppercase; font-family:"Inter",sans-serif; background:'+meta.color+'1a; border:1px solid '+meta.color+'44; color:'+meta.color+'; white-space:nowrap;')}>
          {meta.icon} {composerType === 'Activity' ? 'Auto · ' + (CHANNEL_META[effChannel]?.label || 'WhatsApp') : meta.label}
        </span>
        {composerType === 'Activity' && onBestChannelOverride && (
          <button onClick={onBestChannelOverride} title="Cycle send channel" style={css('display:inline-flex; align-items:center; gap:3px; padding:3px 8px; border-radius:99px; font-size:9.5px; font-weight:600; cursor:pointer; font-family:"Inter",sans-serif; background:rgba(167,139,250,0.08); border:1px solid rgba(167,139,250,0.25); color:#c4b5fd;')}>
            <Zap size={10} /> override
          </button>
        )}
      </div>

      {/* Email subject line */}
      {composerType === 'Email' && (
        <input
          type="text"
          value={emailSubject || ''}
          onChange={(e) => onSubjectChange?.(e.target.value)}
          placeholder="Subject line…"
          style={css('width:100%; padding:7px 11px; border-radius:9px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.12); color:rgba(255,255,255,0.9); font-size:12.5px; font-family:"Inter",sans-serif; margin-bottom:6px; outline:none;')}
        />
      )}

      {/* Note AI draft bar */}
      {composerType === 'Note' && (
        <NoteAiDraftBar
          landlord={landlord}
          noteAiSource={noteAiSource}
          noteGenerating={noteGenerating}
          onPick={onPickNoteDraft}
          onGenerate={onGenerateNoteDraft}
          onClear={onClearNoteDraft}
        />
      )}

      {/* Task AI draft + fields */}
      {composerType === 'Task' && (() => {
        const fieldStyle = css('padding:4px 7px; border-radius:7px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.12); color:rgba(255,255,255,0.9); font-size:10.5px; font-family:"Inter",sans-serif;');
        return (
          <div style={css('margin-bottom:7px;')}>
            <div style={css('display:flex; align-items:center; gap:6px; flex-wrap:wrap; margin-bottom:8px;')}>
              <button onClick={onPickTaskDraft} title="Draft from AI next action" style={css('display:inline-flex; align-items:center; gap:5px; padding:5px 10px; border-radius:8px; font-size:11px; font-weight:600; cursor:pointer; font-family:"Inter",sans-serif; background:rgba(139,92,246,0.06); color:#c4b5fd; border:1px solid rgba(139,92,246,0.25);')}>
                ✨ Next Action
              </button>
              {taskAiSource && (
                <button onClick={onClearTaskDraft} style={css('display:inline-flex; align-items:center; gap:4px; padding:5px 9px; border-radius:8px; font-size:10.5px; font-weight:600; cursor:pointer; font-family:"Inter",sans-serif; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.12); color:rgba(255,255,255,0.55);')}>✕ Clear</button>
              )}
            </div>
            <div style={css('display:flex; align-items:center; gap:6px; flex-wrap:wrap;')}>
              <label style={css('display:inline-flex; align-items:center; gap:4px; font-size:9.5px; font-weight:600; color:rgba(255,255,255,0.5);')}>
                Due <input type="date" value={taskDueDate || ''} onChange={(e) => onTaskDueDate?.(e.target.value)} style={fieldStyle} />
              </label>
              <label style={css('display:inline-flex; align-items:center; gap:4px; flex:1; min-width:160px; font-size:9.5px; font-weight:600; color:rgba(255,255,255,0.5);')}>
                Assignee <input type="email" value={taskAssignee || ''} onChange={(e) => onTaskAssignee?.(e.target.value)} placeholder="assignee@email" style={{...fieldStyle, flex:1, minWidth:0}} />
              </label>
            </div>
          </div>
        );
      })()}

      {/* Follow-up fields */}
      {composerType === 'Follow-up' && (
        <FollowupComposerFields
          chips={suggestedFollowupChips || []}
          followupAiSource={followupAiSource}
          collapsed={aiFollowupsCollapsed}
          onToggleCollapsed={onToggleFollowupCollapsed}
          onPickChip={onPickFollowupChip}
          channel={followupChannel}
          date={followupDate}
          hour={followupHour}
          minute={followupMinute}
          ampm={followupAmPm}
          creatorName={creatorName}
          onChannel={onFollowupChannel}
          onDate={onFollowupDate}
          onHour={onFollowupHour}
          onMinute={onFollowupMinute}
          onAmPm={onFollowupAmPm}
          onClearDraft={onClearFollowupDraft}
          assignee={followupAssignee}
          onAssignee={onFollowupAssignee}
        />
      )}

      {/* Message tabs → UnifiedChatComposer (the base) */}
      {isMessageTab && (
        <UnifiedChatComposer
          composerType={composerType === 'Activity' ? 'Chat' : (composerType === 'Email' ? 'Chat' : composerType)}
          text={text}
          onTextChange={onTextChange}
          onKeyDown={onKeyDown}
          onSend={onSend}
          sending={sending}
          parsing={parsing}
          placeholder={placeholder}
          tplChannel={effTplChannel}
          onPickTemplate={onPickTemplate}
          onSaveTemplate={onSaveTemplate}
          aiSuggestedMessages={aiSuggestedMessages}
          onPickSuggested={onPickSuggested}
          attachment={attachment}
          onAttachmentChange={onAttachmentChange}
          chatTemplatesOpen={chatTemplatesOpen}
          onToggleChatTemplates={onToggleChatTemplates}
          landlordId={landlordId}
          phone={phone}
          streamFilter={streamFilter}
          channelDisabled={channelDisabled}
          disabledHint={disabledHint}
          targetLanguage={targetLanguage}
          extraToolbarChildren={
            <EruditeToneButton text={text} onReplace={onToneReplace} />
          }
        />
      )}

      {/* Note/Task/Follow-up → NoteComposerBar */}
      {isNoteTab && (
        <>
          <NoteComposerBar
            composerRef={composerRef}
            value={text}
            onChange={onTextChange}
            onKeyDown={onKeyDown}
            onSend={onSend}
            placeholder={placeholder}
            composerType={composerType}
            landlordId={landlordId}
            busy={busy}
            composerParsing={parsing}
          />
          <div style={css('display:flex; align-items:center; gap:6px; margin-top:4px;')}>
            <EruditeToneButton text={text} onReplace={onToneReplace} />
          </div>
        </>
      )}

      {/* Appointment → AppointmentComposer */}
      {composerType === 'Appointment' && (
        <AppointmentComposer
          landlordId={landlordId}
          propertyId={propertyId}
          agentEmail={agentEmail}
          onBooked={onBooked}
        />
      )}
    </div>
  );
}