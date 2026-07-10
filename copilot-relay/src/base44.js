import { config } from "./config.js";

const TIMEOUT_MS = 15000;

async function post(fn, body) {
  const url = `${config.base44BaseUrl}/functions/${fn}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        api_key: config.base44ApiKey,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Base44 ${fn} → HTTP ${res.status}: ${text.slice(0, 300)}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetch the landlord "context pack": trust score, urgency, deal thesis,
 * rolling summary, valuation, founder directive, Cardone stage, and the
 * 14 Brain Qualify questions with field keys.
 */
export function fetchContextPack({ call_log_id, landlord_id, agent_email }) {
  return post("copilotContextPack", { call_log_id, landlord_id, agent_email });
}

/** Ship the finished call back to the CRM. */
export function postCallComplete(payload) {
  return post("copilotCallComplete", payload);
}
