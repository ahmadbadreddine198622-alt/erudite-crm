import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * scribeBrain — Smart Appointment Intent Parser (v2 with slot suggestions + address composition)
 * 
 * Parses natural language appointment requests and returns:
 * 1. Parsed intent (type, date, time, duration)
 * 2. 3 suggested slots in Asia/Dubai timezone (keyed as viewing_date/viewing_time)
 * 3. Composed property address: {building_name} · Unit {unit_no}, {location}
 * 
 * Examples:
 * - "Book viewing Thursday 4pm" → { viewing_date: '2026-06-25', viewing_time: '16:00', ... }
 * - "Owner meeting next Monday 2pm for 30 min" → { viewing_date: '2026-06-29', viewing_time: '14:00', ... }
 */

const UAE_TZ = 'Asia/Dubai';
const DUBAI_OFFSET_MS = 4 * 60 * 60 * 1000; // UTC+4, no DST

// Day name → offset from today
const DAY_OFFSETS = {
  'sunday': 0, 'monday': 1, 'tuesday': 2, 'wednesday': 3,
  'thursday': 4, 'friday': 5, 'saturday': 6,
};

const TYPE_KEYWORDS = {
  'viewing': ['viewing', 'view', 'showing', 'property visit', 'site visit'],
  'owner_meeting': ['owner meeting', 'landlord meeting', 'owner', 'landlord'],
  'followup': ['follow-up', 'follow up', 'callback', 'check-in', 'check in'],
};

const DURATION_DEFAULTS = {
  'viewing': 45,
  'owner_meeting': 30,
  'followup': 20,
};

function parseNaturalLanguage(text) {
  const lower = text.toLowerCase();
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  // Detect appointment type
  let type = 'viewing';
  for (const [t, keywords] of Object.entries(TYPE_KEYWORDS)) {
    if (keywords.some(k => lower.includes(k))) {
      type = t;
      break;
    }
  }

  // Detect date
  let targetDate = new Date(now);

  // Check for day names (e.g., "Thursday", "next Monday")
  for (const [dayName, offset] of Object.entries(DAY_OFFSETS)) {
    if (lower.includes(dayName)) {
      const isNext = lower.includes('next ' + dayName);
      const daysUntil = (offset - now.getDay() + 7) % 7;
      targetDate.setDate(targetDate.getDate() + (isNext && daysUntil === 0 ? 7 : daysUntil));
      break;
    }
  }

  // Check for "tomorrow"
  if (lower.includes('tomorrow')) {
    targetDate.setDate(targetDate.getDate() + 1);
  }

  // Check for "today"
  if (lower.includes('today')) {
    targetDate = new Date(now);
  }

  // Detect time (e.g., "4pm", "2:30pm", "14:00", "11am")
  let hours = 14; // default 2pm
  let minutes = 0;
  const timeMatch = lower.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
  if (timeMatch) {
    hours = parseInt(timeMatch[1], 10);
    minutes = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
    const meridiem = timeMatch[3];
    if (meridiem === 'pm' && hours < 12) hours += 12;
    if (meridiem === 'am' && hours === 12) hours = 0;
  }

  targetDate.setHours(hours, minutes, 0, 0);

  // Detect duration (e.g., "for 30 min", "45 minutes")
  let duration = DURATION_DEFAULTS[type];
  const durationMatch = lower.match(/(\d+)\s*(min|minute|minutes|m)/);
  if (durationMatch) {
    duration = parseInt(durationMatch[1], 10);
  }

  // Return Asia/Dubai wall-clock fields (keyed as viewing_date/viewing_time for schedulePropertyViewing)
  return {
    type,
    viewing_date: targetDate.toISOString().split('T')[0],
    viewing_time: targetDate.toTimeString().slice(0, 5),
    duration,
    raw_text: text,
  };
}

/**
 * Generate 3 suggested viewing slots in Asia/Dubai timezone.
 * Skips weekends (Fri/Sat in UAE) and busy calendar events.
 * Returns slots keyed as viewing_date/viewing_time (Dubai wall-clock).
 */
async function generateSuggestedSlots(agentEmail, calendarEvents) {
  const now = new Date();
  const slots = [];
  const workHours = [10, 11, 14, 15, 16]; // 10am, 11am, 2pm, 3pm, 4pm (Dubai time)

  for (let i = 1; i <= 7 && slots.length < 3; i++) {
    // Create date in Dubai timezone: start with UTC date, then subtract offset to get Dubai wall-clock
    const slotDateUTC = new Date(now.getTime() + (i * 24 * 60 * 60 * 1000));
    
    // Skip weekends (Friday=5, Saturday=6 in JS getDay() — but we need Dubai day)
    const dubaiDay = new Date(slotDateUTC.getTime() + DUBAI_OFFSET_MS).getDay();
    if (dubaiDay === 5 || dubaiDay === 6) continue;

    for (const hour of workHours) {
      if (slots.length >= 3) break;

      // Create slot time as Dubai wall-clock, then convert to UTC instant for comparison
      const dubaiHour = hour;
      const slotDateTimeDubai = new Date(slotDateUTC);
      slotDateTimeDubai.setHours(dubaiHour, 0, 0, 0);
      
      // Convert Dubai wall-clock to UTC instant (subtract offset)
      const slotInstantUTC = new Date(slotDateTimeDubai.getTime() - DUBAI_OFFSET_MS);

      // Check if busy (calendar events are stored as UTC instants)
      const isBusy = calendarEvents.some((event) => {
        const eventStart = new Date(event.start);
        const eventEnd = new Date(event.end);
        return slotInstantUTC >= eventStart && slotInstantUTC < eventEnd;
      });

      if (!isBusy) {
        // Return as Dubai wall-clock fields
        const viewing_date = slotDateTimeDubai.toISOString().split('T')[0];
        const viewing_time = slotDateTimeDubai.toTimeString().slice(0, 5);
        const label = slotDateTimeDubai.toLocaleString('en-GB', {
          weekday: 'short',
          day: '2-digit',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        });

        slots.push({ viewing_date, viewing_time, label });
      }
    }
  }

  return slots;
}

/**
 * Compose property address from Property fields.
 * Property.address is empty across all 459 records, so we use:
 * {building_name} · Unit {unit_no}, {location}
 */
function composePropertyAddress(property) {
  if (!property) return 'Property';
  
  const building = property.building_name || 'Property';
  const unit = property.unit_no ? `Unit ${property.unit_no}` : '';
  const location = property.location || '';
  
  const parts = [building, unit, location].filter(Boolean);
  return parts.join(' · ');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { text, lead_id, property_id } = await req.json();

    if (!text || typeof text !== 'string') {
      return Response.json({ error: 'Missing or invalid "text" parameter' }, { status: 400 });
    }

    // Parse natural language intent
    const parsed = parseNaturalLanguage(text);

    // Fetch lead details if lead_id provided
    let lead = null;
    if (lead_id) {
      try {
        lead = await base44.entities.Lead.get(lead_id);
      } catch (err) {
        // Lead not found — continue without it
      }
    }

    // Fetch property details if property_id provided
    let property = null;
    if (property_id) {
      try {
        property = await base44.entities.Property.get(property_id);
      } catch (err) {
        // Property not found — continue without it
      }
    }

    // Fetch agent's calendar events for slot suggestions
    let calendarEvents = [];
    try {
      const startDate = new Date();
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 7);
      
      const result = await base44.asServiceRole.functions.invoke('getCalendarEvents', {
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
      });
      calendarEvents = result.data || [];
    } catch (err) {
      // Calendar not accessible — skip slot suggestions
    }

    // Generate 3 suggested slots in Asia/Dubai timezone
    const suggested_slots = await generateSuggestedSlots(lead?.assigned_agent_email || user.email, calendarEvents);

    // Compose property address
    const property_address = composePropertyAddress(property);

    return Response.json({
      success: true,
      parsed,
      suggested_slots,
      property_address,
      lead: lead ? {
        id: lead.id,
        full_name: lead.full_name || lead.name,
        phone: lead.phone,
        assigned_agent_email: lead.assigned_agent_email,
      } : null,
      property: property ? {
        id: property.id,
        building_name: property.building_name,
        unit_no: property.unit_no,
        location: property.location,
        title: property.title,
        virtual_tour_url: property.virtual_tour_url,
      } : null,
      message: 'Intent parsed with slot suggestions and address composition',
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});