// ============================================================================
//  checkChequeDeadlines — PropCRM (Erudite) Base44 scheduled function
//  Scans Cheque rows daily; computes stale_at; creates in-app Reminder rows for
//  (1) post-dated cheques coming due, (2) cheques approaching 6-month staleness,
//  (3) cheques that have gone stale. Idempotent via per-cheque flags.
//
//  Supports ?dry_run=1 (or body {"dry_run":true}) — reports actions, writes nothing.
// ============================================================================

import { createClientFromRequest } from "npm:@base44/sdk@0.8.31";

function ent(base44, name) {
  const root = base44.asServiceRole?.entities ?? base44.entities;
  return root[name];
}

const TERMINAL = new Set(["cleared", "bounced", "returned", "cancelled"]);
const ACTIVE = new Set(["received", "deposited"]);

// ── Date helpers (date-only, UTC, to avoid TZ off-by-one) ────────────────────
function parseDate(v) {
  if (!v) return null;
  const d = new Date(v);
  if (isNaN(d.getTime())) return null;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}
function todayUTC() {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}
function addMonthsClamped(date, months) {
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(date.getUTCDate(), lastDay));
  return target;
}
const daysBetween = (a, b) => Math.round((b.getTime() - a.getTime()) / 86400000);
const toDateStr = (d) => d.toISOString().slice(0, 10);
const toIso = (d) => d.toISOString();

// ── Formatting ───────────────────────────────────────────────────────────────
function fmtAED(a) {
  const n = Number(a) || 0;
  const frac = Math.round(n * 100) % 100 !== 0;
  return "AED " + new Intl.NumberFormat("en-US", {
    minimumFractionDigits: frac ? 2 : 0, maximumFractionDigits: 2,
  }).format(n);
}
const ref = (c) =>
  `Cheque #${c.cheque_number ?? "?"} · ${c.payer_name ?? "Unknown payer"} · ${fmtAED(c.amount_aed)} · ${c.bank_name ?? "bank n/a"}`;
const dueBody = (c, cd) =>
  `${ref(c)}\nPost-dated cheque reaches its face date on ${toDateStr(cd)}. Deposit / process it. Purpose: ${c.purpose ?? "n/a"}.`;
const warnBody = (c, cd, sa) =>
  `${ref(c)}\nApproaching 6-month staleness. Cheque date ${toDateStr(cd)} → stale on ${toDateStr(sa)}. Deposit or act before then.`;
const flagBody = (c, cd, sa) =>
  `${ref(c)}\nPassed its 6-month validity on ${toDateStr(sa)} (cheque date ${toDateStr(cd)}). Confirm cancellation/return. NOTE: status was NOT changed automatically.`;

// ── Reminder write (no-op under dry run) ─────────────────────────────────────
async function createReminder(Reminder, dryRun, { title, body, due_at, assigned_to }) {
  if (dryRun) return;
  await Reminder.create({
    title,
    body,
    due_at,
    status: "pending",
    assigned_to: assigned_to || "",
    lead_id: "",
  });
}

// ── Entry point ──────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  const headers = { "Content-Type": "application/json" };
  try {
    let dryRun = false;
    try {
      const u = new URL(req.url);
      const q = u.searchParams.get("dry_run");
      if (q === "1" || q === "true") dryRun = true;
      if (req.method === "POST") {
        const b = await req.json().catch(() => null);
        if (b && b.dry_run === true) dryRun = true;
      }
    } catch (_) { /* ignore */ }

    const base44 = createClientFromRequest(req);
    const Cheque = ent(base44, "Cheque");
    const Reminder = ent(base44, "Reminder");
    const now = todayUTC();

    let cheques;
    try { cheques = await Cheque.list("-cheque_date", 5000); }
    catch (_) { cheques = await Cheque.list(); }
    if (!Array.isArray(cheques)) cheques = [];

    const s = {
      dry_run: dryRun, scanned: 0, processed: 0,
      stale_at_computed: 0, due_reminders: 0, stale_warnings: 0, stale_flagged: 0,
      reminders_created: 0, skipped_terminal: 0, errors: [],
    };

    for (const c of cheques) {
      s.scanned++;
      try {
        if (TERMINAL.has(c.status)) { s.skipped_terminal++; continue; }
        if (!ACTIVE.has(c.status)) continue;

        const cd = parseDate(c.cheque_date);
        if (!cd) { s.errors.push(`${c.cheque_number ?? c.id}: missing/invalid cheque_date`); continue; }
        s.processed++;

        const patch = {};

        // (0) Compute and persist stale_at = cheque_date + 6 calendar months
        let staleAt = parseDate(c.stale_at);
        if (!staleAt) {
          staleAt = addMonthsClamped(cd, 6);
          patch.stale_at = toDateStr(staleAt);
          s.stale_at_computed++;
        }

        // (1) Due reminder — post-dated, cheque_date within 3 days [0..3]
        if (c.cheque_type === "post_dated" && !c.due_reminder_sent) {
          const d = daysBetween(now, cd);
          if (d >= 0 && d <= 3) {
            await createReminder(Reminder, dryRun, {
              title: `Cheque #${c.cheque_number ?? "?"} due in ${d} day(s)`,
              body: dueBody(c, cd),
              due_at: toIso(cd),
              assigned_to: c.received_by_email,
            });
            patch.due_reminder_sent = true;
            s.due_reminders++; s.reminders_created++;
          }
        }

        const dStale = daysBetween(now, staleAt);

        // (2) Stale warning — within 14 days of stale_at [1..14]
        if (!c.is_stale && !c.stale_reminder_sent && dStale >= 1 && dStale <= 14) {
          await createReminder(Reminder, dryRun, {
            title: `Cheque #${c.cheque_number ?? "?"} goes stale in ${dStale} day(s)`,
            body: warnBody(c, cd, staleAt),
            due_at: toIso(staleAt),
            assigned_to: c.received_by_email,
          });
          patch.stale_reminder_sent = true;
          s.stale_warnings++; s.reminders_created++;
        }

        // (3) Stale flag — today >= stale_at. Set is_stale. Never touches status.
        if (!c.is_stale && dStale <= 0) {
          await createReminder(Reminder, dryRun, {
            title: `Cheque #${c.cheque_number ?? "?"} is STALE — confirm cancellation`,
            body: flagBody(c, cd, staleAt),
            due_at: toIso(now),
            assigned_to: c.received_by_email,
          });
          patch.is_stale = true;
          s.stale_flagged++; s.reminders_created++;
        }

        if (!dryRun && Object.keys(patch).length) {
          await Cheque.update(c.id, patch);
        }
      } catch (e) {
        s.errors.push(`${c.cheque_number ?? c.id}: ${e?.message ?? String(e)}`);
      }
    }

    return new Response(JSON.stringify({ ok: true, ran_at: new Date().toISOString(), ...s }), { status: 200, headers });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: e?.message ?? String(e) }), { status: 500, headers });
  }
});