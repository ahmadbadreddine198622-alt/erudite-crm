# Universal WhatsApp Action Implementation Plan

## Overview
This document outlines the implementation of a universal WhatsApp action component that makes every phone number in the CRM a one-tap WhatsApp action, with AI-powered conversation management.

## Architecture

### Core Component: `UniversalWhatsAppAction`
**Location**: `components/shared/UniversalWhatsAppAction.jsx`

**Features**:
- Validates phone numbers against WhatsApp Business API
- Finds or creates WhatsAppConversation records
- Links conversations to Lead/Landlord/Contact entities
- Routes to unified WhatsApp composer
- Real-time status indicators (valid/invalid/loading)

**Usage Example**:
```jsx
<UniversalWhatsAppAction
  phone={lead.phone}
  name={lead.full_name}
  leadId={lead.id}
  size="sm"
/>
```

### Entity Relationships

#### WhatsAppConversation Entity (existing fields used):
- `wa_phone_e164` — normalized phone number
- `wa_display_name` — contact name from WhatsApp
- `lead_id` — link to Lead entity
- `deal_id` — link to Deal entity (for landlord workflows)
- `assigned_agent_email` — agent ownership
- `status` — new/open/pending_customer/pending_agent/snoozed/resolved/spam/blocked
- `unread_count` — unread message counter
- `last_message` — preview text
- `last_message_at` — last activity timestamp
- `ai_rolling_summary` — AI conversation summary
- `ai_next_message_suggestions[]` — smart reply suggestions
- `ai_priority` — low/medium/high/urgent
- `ai_sentiment` — positive/neutral/negative
- `sla_due_at` — SLA deadline
- `sla_breached` — boolean flag

### Integration Points

#### 1. Lead Detail Sheet (`components/leads/LeadDetailSheet.jsx`)
**Current**: Uses `WhatsAppPhone` component
**Update**: Replace with `UniversalWhatsAppAction` in:
- Contact section (phone row)
- Activity timeline
- Quick actions panel

#### 2. Leads Table (`pages/Leads.jsx`)
**Current**: Shows `WhatsAppPhone` in table cells
**Update**: Replace with `UniversalWhatsAppAction` for consistency

#### 3. Landlords Pages
**Files**: `pages/Landlords.jsx`, `components/landlord/LandlordCard.jsx`, `components/landlord/LandlordDetailPanel.jsx`
**Update**: Add `UniversalWhatsAppAction` next to all phone/whatsapp fields

#### 4. Contacts Pages
**Files**: `pages/Contacts.jsx`, `components/contacts/ContactDetailPanel.jsx`
**Update**: Replace existing WhatsApp buttons with universal action

#### 5. Pipeline Boards
**Files**: `pages/Pipeline.jsx`, `components/pipeline/PipelineLeadCard.jsx`
**Update**: Add compact WhatsApp action icon to lead cards

#### 6. Aurora Pipeline
**Files**: `pages/AuroraPipeline.jsx`, `components/aurora/*.jsx`
**Update**: Add WhatsApp action to constellation view cards

#### 7. WhatsApp Inbox Redesign (`pages/WhatsAppInbox.jsx`)
**Current**: Already has conversation list and composer
**Updates Needed**:
- Redesign with dark/gold design system
- Add AI insights panel (ai_rolling_summary, ai_next_message_suggestions)
- Show ai_priority badges on conversation items
- Display sla_breached indicator
- Enhanced filtering by status, priority, agent

### Backend Functions (existing, no changes needed):

1. **`checkWhatsAppNumber`** — Validates if phone is on WhatsApp
2. **`sendWhatsAppMessageFromCRM`** — Sends messages with CRM context
3. **`whatsappWebhook`** — Receives inbound messages
4. **`enrichConversation`** — AI analysis automation
5. **`getSmartReplies`** — Generates next-message suggestions
6. **`processVoiceMessage`** — Transcribes voice notes

### Data Flow

#### Opening a Conversation:
```
User clicks WhatsApp action
  ↓
UniversalWhatsAppAction checks validity
  ↓
Query WhatsAppConversation by wa_phone_e164
  ↓
If exists: navigate to /whatsapp?conv={id}
If not: create new conversation with lead_id linkage
  ↓
Navigate to unified composer
```

#### Sending a Message:
```
User types in composer
  ↓
Click Send (or tap smart reply)
  ↓
Call sendWhatsAppMessageFromCRM({
  phone_number: conv.wa_phone_e164,
  message_text: text,
  media_url: optional
})
  ↓
Backend creates WhatsAppMessage record
  ↓
Updates WhatsAppConversation.last_message, last_message_at
  ↓
Creates LeadActivity record (activity_type='whatsapp')
  ↓
Real-time subscription updates UI
```

#### AI Enrichment (automated):
```
New message received (webhook)
  ↓
enrichConversation automation triggers
  ↓
Updates:
  - ai_rolling_summary
  - ai_next_message_suggestions[]
  - ai_priority
  - ai_sentiment
  - ai_topics[]
  ↓
Frontend displays in AI Insights Panel
```

## Design System Compliance

All components use:
- **Colors**: `hsl(38 92% 50%)` for gold accent, dark navy backgrounds
- **Fonts**: Inter for body, Playfair Display for headings
- **Components**: shadcn/ui primitives (Button, Badge, Tooltip, etc.)
- **Styling**: Glass morphism, liquid-glass effects matching dashboard

## Rollout Strategy

### Phase 1: Core Component ✅
- [x] Create `UniversalWhatsAppAction` component
- [x] Implement WhatsApp validation
- [x] Add conversation find/create logic
- [x] Route to /whatsapp with proper URL params

### Phase 2: Lead Detail Integration
- [ ] Update `LeadDetailSheet` to use universal action
- [ ] Add to contact info section
- [ ] Add to activity timeline
- [ ] Test conversation linking

### Phase 3: Table/List Views
- [ ] Update `pages/Leads.jsx` table cells
- [ ] Update `pages/Contacts.jsx`
- [ ] Update `pages/Landlords.jsx` cards
- [ ] Add to pipeline lead cards

### Phase 4: WhatsApp Inbox Redesign
- [ ] Apply dark/gold design system
- [ ] Add AI Insights Panel to conversation view
- [ ] Display ai_priority badges
- [ ] Add sla_breached visual indicators
- [ ] Enhanced filtering UI

### Phase 5: Aurora Pipeline & Advanced
- [ ] Add to Aurora constellation cards
- [ ] Implement smart reply integration
- [ ] Add voice note transcription display
- [ ] Test end-to-end workflows

## Testing Checklist

- [ ] Phone number validation works for UAE/international formats
- [ ] Conversation linking preserves lead_id/deal_id relationships
- [ ] Real-time message updates appear instantly
- [ ] AI suggestions display and are tappable
- [ ] SLA timers show correct urgency
- [ ] Disabled state works for do_not_contact leads
- [ ] Mobile responsive on all pages
- [ ] No console errors or failed API calls

## Notes

- **No new entities or fields** — uses existing WhatsAppConversation schema
- **No backend function changes** — all existing functions remain unchanged
- **Progressive rollout** — can be deployed incrementally per page
- **Backwards compatible** — existing WhatsAppPhone continues working during transition

## Next Steps

1. Review and test `UniversalWhatsAppAction` component
2. Begin Phase 2: integrate into LeadDetailSheet
3. Progress through table views (Phase 3)
4. Redesign WhatsApp inbox (Phase 4)
5. Complete Aurora integration (Phase 5)