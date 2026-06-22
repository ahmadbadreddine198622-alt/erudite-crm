import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * scribeBrain — Smart Appointment Intent Parser
 * 
 * Parses natural language appointment requests and returns structured data
 * for the AppointmentComposer UI to confirm before scheduling.
 * 
 * Examples:
 * - "Book viewing Thursday 4pm" → { type: 'viewing', date: '2026-06-25', time: '16:00', duration: 45 }
 * - "Owner meeting next Monday 2pm for 30 min" → { type: 'owner_meeting', date: '2026-06-23', time: '14:00', duration: 30 }
 * - "Follow-up call tomorrow 11am" → { type: 'followup', date: '2026-06-23', time: '11:00', duration: 20 }
 */

const UAE_TZ = 'Asia/Dubai';

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
  let dateFound = false;

  // Check for day names (e.g., "Thursday", "next Monday")
  for (const [dayName, offset] of Object.entries(DAY_OFFSETS)) {
    if (lower.includes(dayName)) {
      const isNext = lower.includes('next ' + dayName);
      const daysUntil = (offset - now.getDay() + 7) % 7;
      targetDate.setDate(targetDate.getDate() + (isNext && daysUntil === 0 ? 7 : daysUntil));
      dateFound = true;
      break;
    }
  }

  // Check for "tomorrow"
  if (lower.includes('tomorrow')) {
    targetDate.setDate(targetDate.getDate() + 1);
    dateFound = true;
  }

  // Check for "today"
  if (lower.includes('today')) {
    targetDate = new Date(now);
    dateFound = true;
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

  return {
    type,
    date: targetDate.toISOString().split('T')[0],
    time: targetDate.toTimeString().slice(0, 5),
    duration,
    raw_text: text,
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { text, lead_id } = await req.json();

    if (!text || typeof text !== 'string') {
      return Response.json({ error: 'Missing or invalid "text" parameter' }, { status: 400 });
    }

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

    return Response.json({
      success: true,
      parsed,
      lead: lead ? {
        id: lead.id,
        full_name: lead.full_name || lead.name,
        phone: lead.phone,
        assigned_agent_email: lead.assigned_agent_email,
      } : null,
      message: 'Intent parsed successfully',
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});