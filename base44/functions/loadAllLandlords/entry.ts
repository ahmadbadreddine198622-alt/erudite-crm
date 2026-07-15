import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// loadAllLandlords — paginated full-table load for the Landlord Pipeline board.
//
// Why this exists: the user-scoped `base44.entities.Landlord.list()` silently caps
// results per call and the platform forbids $lt/$gt cursors on built-in fields, so
// client-side pagination truncated the board (e.g. only ~9 of 556 Peninsula 2
// records showed). `asServiceRole.entities.Landlord.list(sort, limit, skip)` honors
// BOTH limit and skip, so the backend can reliably page the full table.
//
// A single response carrying 6000+ full records exceeds the function-response size
// limit, so this function returns ONE page at a time and the frontend loops:
//   { landlords: [projected page], hasMore: bool }
// Access control is enforced server-side (mirrors the Landlord RLS): admins and
// owner emails see every record; everyone else only records where they are the
// assigned agent, listing manager, or co-agent.

const OWNER_EMAILS = ['ahmad.badreddine198622@gmail.com', 'ahmad@erudite-estate.com'];

// Only the fields the Landlord Pipeline board, LandlordCard, ChannelAvailabilityIcons,
// and ProjectIntelStrip read. The full Landlord schema includes large AI text blobs,
// suggestion arrays, stage history, portfolio scans, file URLs, etc. that the board
// never uses — this allowlist keeps the board fully functional while keeping each
// page response small.
const KEEP_FIELDS = new Set([
  'id', 'created_date', 'updated_date', 'created_by_id',
  'stage', 'stage_entered_at', 'days_in_stage', 'sub_stage',
  'full_name_en', 'full_name', 'first_name', 'last_name',
  'phone', 'whatsapp', 'email', 'additional_phones', 'additional_emails',
  'project_name', 'project_id', 'unit_reference', 'unit_layout',
  'assigned_agent_email', 'listing_manager_email', 'co_agent_email',
  'landlord_archetype', 'source', 'lead_type', 'preferred_language', 'nationality',
  'asking_price_aed', 'asking_price_history', 'estimated_commission_aed',
  'reserve_price', 'commission_pct_negotiated',
  'mandate_status', 'mandate_type', 'mandate_expires_at', 'mandate_start_date',
  'handover_status', 'handover_appointment_at',
  'trust_score', 'urgency_score', 'rapport_level',
  'ai_processed_at', 'last_orchestrator_run_at',
  'ai_rolling_summary', 'ai_estimated_value_aed', 'ai_estimated_price_sqft', 'ai_valuation_confidence',
  'form_a_contracts', 'form_a_contract_number',
  'imessage_status', 'imessage_handle', 'imessage_handles',
  'whatsapp_status', 'whatsapp_handle', 'telegram_chat_id', 'telegram_username',
]);

function project(rec) {
  if (!rec || typeof rec !== 'object') return rec;
  const out = {};
  for (const key of Object.keys(rec)) {
    if (KEEP_FIELDS.has(key)) out[key] = rec[key];
  }
  return out;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const email = String(user.email || '').toLowerCase().trim();
    const isOwnerUser = OWNER_EMAILS.includes(email);
    const seeAll = user.role === 'admin' || isOwnerUser;

    let body = {};
    try { body = await req.json(); } catch (_) { body = {}; }
    const limit = Math.min(1000, Math.max(1, Number(body.limit) || 500));
    const skip = Math.max(0, Number(body.skip) || 0);

    // asServiceRole honors limit + skip, so this pages the full table reliably.
    const batch = await base44.asServiceRole.entities.Landlord.list('-updated_date', limit, skip);
    const rows = Array.isArray(batch) ? batch : [];

    const records = seeAll
      ? rows
      : rows.filter((l) =>
          l.assigned_agent_email === user.email ||
          l.listing_manager_email === user.email ||
          l.co_agent_email === user.email
        );

    // hasMore is based on the RAW page size: if the raw page filled the limit there
    // may be more rows to page through (even if, for a non-admin, this particular
    // page filtered down to zero of theirs).
    const hasMore = rows.length === limit;

    return Response.json({ landlords: records.map(project), hasMore });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});