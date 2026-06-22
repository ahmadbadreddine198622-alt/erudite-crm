# Smart Appointment — Build Spec (v1)

**Context:** PropCRM on Base44  
**Function:** `scribeBrain` (backend function)  
**Status:** Confirmed-gated — all ⚠ fields verified against live schema

---

## The Flow

Agent on a card taps **Appointment** (or dictates "book viewing Thursday 4pm") → brain proposes a structured event → editable confirm chip → on confirm, writes to calendar + CRM.

---

## Auto-options at Open

1. **3 suggested slots** — read agent's Google Calendar, offer next open viewing-friendly windows (skip clashes).
   - **Depends on:** `googlecalendar` connector (authorized ✅ with `calendar.readonly` + `calendar.events`)
   - **Function:** `getCalendarEvents` exists — use to fetch agent's busy slots

2. **Type default** — "Viewing" = 45 min, "Owner meeting" = 30 min. Editable.

3. **Auto-attached unit** — pulls building + unit from `LandlordProperty` → `Property`:
   - `Property.building_name` ✅ (458/459 populated)
   - `Property.unit_no` ✅ (453/459 populated)
   - Format: `{building_name} · Unit {unit_no}, {location}`

4. **Resolved date** — "Thursday 4pm" → real Asia/Dubai ISO timestamp.

---

## Confirm Chip (UI)

Shows before commit:
- **Type** · **Resolved date/time** (human: "Thu 26 Jun, 4:00 PM") · **Duration** · **Linked unit** · **Attendee**

Agent edits any field, taps **Confirm**.

---

## On Confirm (Commit)

### 1. Call `schedulePropertyViewing` ✅
**Parameters:**
```js
{
  lead_id: string,
  lead_name: string,
  lead_phone: string,
  property_title: string,      // from Property.title or formatted building_name + unit_no
  property_address: string,    // {building_name} · Unit {unit_no}, {location}
  virtual_tour_link: string?,  // from Property or LandlordProperty
  viewing_date: string,        // YYYY-MM-DD
  viewing_time: string,        // HH:MM
  duration_minutes: number,    // default 45
  agent_email: string
}
```

**What it does:**
- Creates Google Calendar event via `googlecalendar` connector
- Updates `Lead.next_appointment_at` ✅ (field exists on Lead entity)
- Updates `Lead.stage` → 'viewing'
- Sends WhatsApp confirmation to lead
- Logs `Activity` record (type: 'viewing')

### 2. `syncLeadToCalendar` ⚠️
**Note:** This is an **entity automation handler**, not a direct function call.
- Triggers on `Lead` status change → 'Call Scheduled' or 'Viewing Booked'
- **Do NOT call directly** — `schedulePropertyViewing` handles everything.

---

## Verified Schema Fields ⚠️ → ✅

| Spec Field | Actual Schema | Status |
|------------|---------------|--------|
| `next_appointment_at` | `Lead.next_appointment_at` (line 124) | ✅ EXISTS |
| Auto-attached unit | `LandlordProperty.property_id` → `Property.building_name` + `Property.unit_no` | ✅ EXISTS |
| `schedulePropertyViewing` | Function exists with all required params | ✅ EXISTS |
| Google Calendar read | `googlecalendar` connector authorized | ✅ READY |

---

## Data Link Integrity

- **Project → Property:** No direct FK. Match via fuzzy `Property.building_name` ↔ `Project.name`
  - Example: "Peninsula 2" ↔ "Peninsula Two" ✅
- **Landlord → Property:** `LandlordProperty.property_id` links to `Property.id` ✅
- **Property address format:** Use `{building_name} · Unit {unit_no}, {location}` (since `Property.address` is empty)

---

## Implementation Notes

1. **ScribeBrain scope:** Start with appointment intents only (viewing, owner meeting, follow-up).
2. **Composer UI:** Use existing dark/gold tokens from PropCRM design system.
3. **Slot logic:** Call `getCalendarEvents` to fetch agent's busy times, then suggest 3 next available 45-min windows.
4. **Error handling:** If `schedulePropertyViewing` fails, show inline error on confirm chip — don't silently fail.

---

## Next Steps

1. ✅ Spec saved — ready to build Step 1 (scribeBrain appointment intent parser).
2. Build composer + confirm-chip UI component.
3. Wire to `schedulePropertyViewing` backend function.
4. Test with live Google Calendar connector.