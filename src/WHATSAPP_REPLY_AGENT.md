# WhatsApp Reply Assistant Agent

## Overview
AI-powered assistant that helps real estate agents craft professional, context-aware WhatsApp messages for landlord and lead conversations.

## Features
- **Context-Aware Drafting** — Reads conversation history, stage, sentiment, and archetype
- **Tone Variations** — Professional, warm, or urgent tones based on situation
- **Stage-Specific Messaging** — Tailors content based on pipeline stage (landlord or lead)
- **Cultural Sensitivity** — Adapts to Dubai market communication norms
- **One-Click Insert** — Copy generated reply or insert directly into composer

## How to Use

### From WhatsApp Conversation:
1. Open any conversation in `/whatsapp`
2. In the message composer, click **"AI Reply"** button (wand icon)
3. Enter your intent (e.g., "Follow up on viewing", "Negotiate commission")
4. Select tone: Professional | Warm | Urgent
5. Click **"Generate Reply"**
6. Review 2-3 draft options with reasoning
7. Click **"Insert in Composer"** or **"Copy"**

### Agent Capabilities:
The agent can access:
- ✅ WhatsAppConversation entity (read)
- ✅ WhatsAppMessage entity (read)
- ✅ Landlord entity (read)
- ✅ Lead entity (read)
- ✅ Property entity (read)
- ✅ ConversationCoach entity (read)
- ✅ `enrichConversation` function (AI analysis)
- ✅ `getSmartReplies` function (context-aware suggestions)
- ✅ `claudeAI` function (custom draft generation)

## Example Use Cases

### 1. **Landlord First Contact**
```
Intent: "Initial outreach after DLD lookup"
Tone: Professional
Context: Stage = SOURCED, Archetype = Professional Investor

Generated:
"Good morning [Name], this is [Agent] from [Company]. I noticed your property at [Address] 
and wanted to share some exciting market insights. We've recently closed 3 similar units 
in your building at 8-12% above asking. Would you be open to a brief 10-min call this 
week to discuss? No obligation — just valuable data. Best regards, [Agent]"
```

### 2. **Lead Viewing Follow-Up**
```
Intent: "Follow up after viewing, check interest level"
Tone: Warm
Context: Stage = VIEWING_SCHEDULED, Sentiment = positive

Generated:
"Hi [Name]! Great meeting you at [Property] yesterday. What did you think of the space 
and the views? 😊 I noticed you spent extra time on the balcony — the sunset vistas 
are truly special! We have 2 other buyers interested, but I'd love to give you first 
right of refusal. Shall we schedule a second viewing or discuss next steps? Warmly, 
[Agent]"
```

### 3. **Mandate Negotiation Nudge**
```
Intent: "Re-engage after 3 days silence in negotiation"
Tone: Urgent
Context: Stage = MANDATE_NEGOTIATION, Days in stage = 7

Generated:
"Hi [Name], hope you're well! Quick update — we just secured an exclusive mandate 
at [Competitor Building] at 5% commission with a 60-day sale guarantee. Given your 
property's strong fundamentals, I'm confident we can achieve similar results. I have 
3 qualified buyers ready to view next week. Can we finalize the agreement today to 
capture this momentum? Let's lock in your premium position. Best, [Agent]"
```

## Best Practices

### ✅ DO:
- Always specify your intent clearly
- Choose tone based on rapport level (professional → warm as trust builds)
- Review generated drafts before sending
- Personalize with specific details (property address, names, dates)
- Use for high-stakes messages (negotiations, objections, escalations)

### ❌ DON'T:
- Use for simple acknowledgments ("OK", "Thanks")
- Send without reviewing for accuracy
- Use for time-sensitive emergencies (call instead)
- Rely on for complex legal/financial advice

## Integration Points

### Agent Config:
- **File:** `agents/whatsapp_reply_assistant.json`
- **Name:** "WhatsApp Reply Assistant"
- **Access:** Via `/whatsapp` composer or agent dashboard

### UI Component:
- **File:** `components/whatsapp/ReplyAssistantPanel.jsx`
- **Usage:** Embedded in WhatsAppComposer
- **Trigger:** "AI Reply" button (wand icon)

### Backend Functions Used:
- `enrichConversation` — Get AI analysis of conversation
- `getSmartReplies` — Context-aware smart reply suggestions
- `claudeAI` — Generate custom drafts with specific requirements

## Performance Metrics

### Target KPIs:
- **Response Time** — Reduce avg response time by 40%
- **Conversion Rate** — Increase stage advancement by 25%
- **Message Quality** — Improve conversation coach scores by 30%
- **Agent Adoption** — 80%+ of agents using weekly

### Tracking:
- Usage count per agent
- Draft acceptance rate (insert vs. discard)
- Post-send conversation outcomes (stage advances, replies received)
- Conversation coach score trends

## Future Enhancements (Phase 2)

1. **Multi-Language Support** — Generate replies in EN/AR/RU/ZH simultaneously
2. **Voice Note Scripts** — Draft scripts for voice messages (30s, 60s, 90s)
3. **A/B Testing** — Generate 2 variants, track which performs better
4. **Objection Library** — Pre-built responses to common objections
5. **Competitor Intel** — Auto-insert competing mandate details
6. **Emotion Detection** — Adjust tone based on real-time sentiment shifts

## Troubleshooting

### Issue: Agent not generating replies
- **Check:** Conversation has valid ID and context
- **Check:** Lead/Landlord entity is accessible
- **Check:** ANTHROPIC_API_KEY secret is set

### Issue: Generic/weak drafts
- **Solution:** Provide more specific intent (e.g., "Address pricing objection" vs. "Follow up")
- **Solution:** Include stage and sentiment context in prompt

### Issue: Tone mismatch
- **Solution:** Explicitly select tone (professional/warm/urgent)
- **Solution:** Add tone guidance in intent (e.g., "Be empathetic but firm")

---

**Status:** ✅ Live in Production  
**Version:** 1.0  
**Last Updated:** 2026-05-26