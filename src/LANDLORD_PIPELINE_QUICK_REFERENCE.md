# LANDLORD PIPELINE — Quick Reference Guide

## 🎯 THE 14 STAGES AT A GLANCE

| # | Stage | Entry Criteria | Exit Criteria | SLA | Key Actions |
|---|-------|---------------|---------------|-----|-----------|
| 1 | **SOURCED** | Lead created | First contact | 24h | Pre-call briefing, DLD lookup, contact attempt |
| 2 | **FIRST_CONTACT** | Phone/WhatsApp connected | Property permission given | 24h | Qualify urgency, build rapport, find pain point |
| 3 | **PROPERTY_DISCOVERY** | Permission granted | All property data captured (22 fields) | 7d | Capture ownership, mortgage, tenancy, occupancy |
| 4 | **PRICING_ALIGNMENT** | Asking price stated | Price within 5% of CMA | 5d | Present CMA, suggest listing price, negotiate |
| 5 | **MANDATE_NEGOTIATION** | Pricing aligned | Verbal mandate commitment | 5d | Battle card, close on commission/exclusivity |
| 6 | **FORM_A_DRAFTING** | Verbal commit | Form A drafted & emailed | 24h | Populate all fields, send for e-signature |
| 7 | **FORM_A_SIGNATURE** | Form A sent | Fully signed by landlord | 5d | DocuSign tracking, nudges at 24/48/72h |
| 8 | **DOCUMENTS_COLLECTION** | Form A signed | All required docs verified | 7d | Auto-checklist, WhatsApp reminders, OCR verify |
| 9 | **MARKETING_LIVE** | Trakheesi + photos done | Live on portals | 3d | Listing copy (EN/AR/RU/ZH), pricing alerts |
| 10 | **VIEWINGS_FLOW** | First viewing scheduled | 1+ offer received | 14d | Manage logistics, collect feedback, score buyers |
| 11 | **OFFER_NEGOTIATION** | 1st offer in | Landlord accepts offer | TBD | Offer sheet, counter-offer advice, close deal |
| 12 | **FORM_F_AND_DEPOSIT** | Offer accepted | Form F signed + 10% cheque | 5d | MOU generation, tri-party DocuSign, deposit tracking |
| 13 | **CLOSING** | Form F signed | Title at DLD + keys | 30d | NOC, bank, manager's cheque, utilities, service charge |
| 14 | **POST_COMPLETION** | Title transferred | Commission paid + testimonial | TBD | Invoicing, testimonial request, check-ins at 14/30/60/90d |

---

## 🏗️ LANDLORD ARCHETYPES (10 Types)

| Archetype | Pain Point | Motivation | Approach |
|-----------|-----------|-----------|---------|
| **Professional Investor** | Yield optimization, portfolio management | Cash flow, appreciation | Data-driven, market trends |
| **Individual Relocating** | Time-sensitive sale, emotional | Speed to close, fair price | Reassurance, timeline clarity |
| **Distressed Seller** | Cash needed fast, bad timing | Urgency, flexibility | Quick close, creative terms |
| **Inherited Owner** | Zero market knowledge, reluctant | Simplicity, hands-off | Guidance, education |
| **Developer Resale** | Bulk inventory, competitive pressure | Volume, reputation | Portfolio deals |
| **Overseas Owner** | Never visits, trust issues | Hands-off management | Transparency, updates |
| **First Time Seller** | Emotional, slow, handholding needed | Safety, trust, education | White-glove service |
| **Portfolio Optimizer** | Sophisticated, comparing brokers | Best terms, flexibility | Competitive pitch |
| **Accidental Landlord** | Unexpected rental, uncertain | Exit strategy, simplicity | Clear options |
| **Speculator Flipping** | Quick profit, transfer timing | Timing, quick close | Market data, speed |

---

## 🤖 AI FEATURES EXPLAINED

### 1. **Enrichment (enrichLandlord)**
- Runs auto on landlord creation
- Generates: briefing, opening line, best contact time, key questions, pain points
- Estimates: trust_score, responsiveness_score, mandate_win_probability

### 2. **Battle Card (generateBattleCard)**
- Called during stage MANDATE_NEGOTIATION
- Outputs: pain point, top 3 motivators, competitor intel, winning pitch, 3 closing techniques
- Archetype-specific strategies

### 3. **Conversation Coach (landlordConversationCoach)**
- Scores every call/WhatsApp thread
- Quality score 0-100
- Identifies: things done well, missed opportunities, objections, next move

---

## 📊 KEY DASHBOARDS & METRICS

### Pipeline View
- **Total Active Landlords** — Count of all non-post-completion
- **Pipeline Value (AED)** — Sum of estimated_commission_aed
- **Mandates Signed** — Count where mandate_status = "form_a_signed"
- **SLA Breaches** — Count of overdue stages

### Per-Landlord Metrics
- **Trust Score** (0-100) — Document delivery, follow-through, price flexibility
- **Responsiveness Score** (0-100) — Avg response time, read rates
- **Mandate Win Probability** (0-1) — Predicted likelihood of getting mandate signed
- **Urgency Score** (0-100) — Signals from conversation, behavior

---

## ⚡ QUICK ACTIONS (Per Card)

### On Landlord Card:
- 📞 **Call** — Dial phone
- 💬 **WhatsApp** — Open in-app chat
- Click card → Open detail panel

### In Detail Panel:
- Tabs: Overview | Negotiation | Documents | AI
- Quick access to battle card, next best action, coaching notes
- Document upload & verification
- Stakeholder map

---

## 🔔 AUTOMATION RULES (Implemented & Planned)

### ✅ IMPLEMENTED
- R1: `Auto-Enrich New Landlord` — On landlord create

### 🔄 PLANNED (Next Phase)
- R2: Escalate if no contact attempt in 24h
- R3: Update summary on WhatsApp inbound
- R4: Auto-generate document checklist on stage advance
- R5: Re-engagement WhatsApp + alert after 4d silent in negotiation
- R6: Trigger DocuSign on Form A signed
- R7: Auto Trakheesi + photoshoot on docs collected
- R8: Price review if 14d no offers
- R9: Daily NOC/bank checks during closing
- R10: Schedule check-ins after completion

---

## 📝 MESSAGE TEMPLATES (Coming Phase 2)

**Per Stage (3 per × 14 = 42 templates):**
1. Initial reach-out
2. Follow-up after 48h silence
3. Re-engagement after 7d silence

**Languages:** EN + AR

**Example Variables:**
- {landlord_first_name}
- {property_address}
- {agent_name}
- {asking_price}
- {commission_pct}
- {viewing_time}
- {form_a_link}

---

## 🎓 GETTING STARTED

### For Agents:
1. Go to `/landlords` in the app
2. Click **+ New Landlord**
3. Enter: name, phone, agent, source
4. Claude auto-enriches → briefing generated
5. Click card → detail panel → read battle card
6. Pick first action from "Next Best Action"
7. Log activity in WhatsApp/call
8. Conversation Coach scores it auto

### For Managers:
1. View **Pipeline Dashboard** for funnel metrics
2. Sort by **SLA Breaches** → escalate overdue
3. Filter by **Trust Score** → focus on trustworthy leads
4. Check **Momentum Alerts** for "STRIKE NOW" opportunities

---

## 🔗 API ENDPOINTS (Backend Functions)

### Core Functions
- **POST /functions/enrichLandlord** — Enrich landlord profile
- **POST /functions/generateBattleCard** — Generate negotiation battle card
- **POST /functions/landlordConversationCoach** — Score conversation

### Coming Soon
- `generatePricingCard` — CMA + pricing strategy
- `autoGenerateDocumentChecklist` — Create docs for stage
- `sendDocumentChaseWhatsApp` — Auto-remind for missing docs
- `portfolioRadar` — Find other landlord properties
- `momentumScoring` — Predict stage advance probability

---

## 💡 PRO TIPS

1. **Before First Call:** Read the enriched briefing in Overview tab
2. **During Negotiation:** Refer to Battle Card for closing lines
3. **After Calls:** Let Conversation Coach score you — check "single_best_line_to_use"
4. **Trust Score < 60:** Escalate to manager or use "white-glove" approach
5. **Urgency > 80:** Red dot animates — prioritize today
6. **Red Flags Present:** Read & address each one explicitly

---

## 📞 SUPPORT

For Phase 2 features (automations, Whisper Mode, etc.), refer to the build summary doc.

Next session: **Automation Rules + Whisper Mode** (highest impact)