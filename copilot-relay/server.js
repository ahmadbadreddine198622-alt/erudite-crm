import http from "node:http";
import crypto from "node:crypto";
import { WebSocketServer } from "ws";
import { config } from "./src/config.js";
import { CallSession } from "./src/session.js";

// ---- Session registry -----------------------------------------------------

/** @type {Map<string, CallSession>} streamSid -> session */
const byStreamSid = new Map();
/** @type {Map<string, CallSession>} call_log_id -> session */
const byCallLogId = new Map();
/** @type {Map<string, Set<import('ws').WebSocket>>} cockpits waiting for a call to start */
const pendingCockpits = new Map();

function registerSession(session) {
  byStreamSid.set(session.streamSid, session);
  byCallLogId.set(session.callLogId, session);
  // Attach any cockpit that connected before Twilio's start event arrived.
  const waiting = pendingCockpits.get(session.callLogId);
  if (waiting) {
    for (const ws of waiting) session.attachCockpit(ws);
    pendingCockpits.delete(session.callLogId);
  }
}

function unregisterSession(session) {
  byStreamSid.delete(session.streamSid);
  // Keep the call_log_id entry for 5 minutes so late cockpit reconnects can
  // still replay the finished call.
  setTimeout(() => {
    if (byCallLogId.get(session.callLogId) === session) {
      byCallLogId.delete(session.callLogId);
    }
  }, 5 * 60 * 1000).unref();
}

// ---- HTTP + WS plumbing -----------------------------------------------------

const server = http.createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(
      JSON.stringify({
        ok: true,
        active_calls: byStreamSid.size,
        uptime_s: Math.round(process.uptime()),
      }),
    );
    return;
  }
  res.writeHead(404);
  res.end("not found");
});

const twilioWss = new WebSocketServer({ noServer: true });
const cockpitWss = new WebSocketServer({ noServer: true });

function timingSafeEqual(a, b) {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

server.on("upgrade", (req, socket, head) => {
  let url;
  try {
    url = new URL(req.url, "http://localhost");
  } catch {
    socket.destroy();
    return;
  }

  if (url.pathname === "/twilio") {
    twilioWss.handleUpgrade(req, socket, head, (ws) => handleTwilio(ws));
  } else if (url.pathname === "/cockpit") {
    const token = url.searchParams.get("token") || "";
    const callLogId = url.searchParams.get("call_log_id") || "";
    if (!timingSafeEqual(token, config.sharedSecret) || !callLogId) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }
    cockpitWss.handleUpgrade(req, socket, head, (ws) => handleCockpit(ws, callLogId));
  } else {
    socket.destroy();
  }
});

// ---- Twilio Media Streams ---------------------------------------------------

function handleTwilio(ws) {
  /** @type {CallSession|null} */
  let session = null;

  ws.on("message", (data) => {
    let msg;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      return;
    }

    try {
      switch (msg.event) {
        case "connected":
          break;

        case "start": {
          const start = msg.start || {};
          session = new CallSession({
            streamSid: start.streamSid || msg.streamSid,
            callSid: start.callSid,
            customParameters: start.customParameters || {},
          });
          registerSession(session);
          console.log(
            `[server] call started stream=${session.streamSid} call_log_id=${session.callLogId} tracks=${JSON.stringify(start.tracks)}`,
          );
          break;
        }

        case "media": {
          if (!session || !msg.media?.payload) break;
          const audio = Buffer.from(msg.media.payload, "base64");
          session.onMedia(msg.media.track, audio);
          break;
        }

        case "stop": {
          if (session) {
            const s = session;
            unregisterSession(s);
            s.end("twilio_stop").catch((err) =>
              console.error(`[${s.callLogId}] end() failed:`, err),
            );
            session = null;
          }
          break;
        }

        default:
          break; // mark, dtmf, etc. — ignore
      }
    } catch (err) {
      // A bad frame must never take the socket (or the process) down.
      console.error("[server] twilio message handling error:", err);
      session?.reportError("twilio", err);
    }
  });

  ws.on("close", () => {
    // Twilio dropped without a stop event (network blip, call teardown race).
    if (session) {
      const s = session;
      unregisterSession(s);
      s.end("twilio_disconnect").catch((err) =>
        console.error(`[${s.callLogId}] end() failed:`, err),
      );
      session = null;
    }
  });

  ws.on("error", (err) => console.error("[server] twilio ws error:", err.message));
}

// ---- Cockpit ---------------------------------------------------------------

function handleCockpit(ws, callLogId) {
  ws.on("error", (err) => console.error("[server] cockpit ws error:", err.message));

  const session = byCallLogId.get(callLogId);
  if (session) {
    session.attachCockpit(ws);
    return;
  }

  // Call hasn't started yet — park the cockpit until Twilio's start arrives.
  let waiting = pendingCockpits.get(callLogId);
  if (!waiting) {
    waiting = new Set();
    pendingCockpits.set(callLogId, waiting);
  }
  waiting.add(ws);
  try {
    ws.send(JSON.stringify({ type: "status", state: "waiting_for_call", call_log_id: callLogId }));
  } catch {
    /* ignore */
  }
  ws.on("close", () => {
    waiting.delete(ws);
    if (waiting.size === 0) pendingCockpits.delete(callLogId);
  });
}

// ---- Process hardening -------------------------------------------------------

// The relay must never crash mid-call. Log and keep serving; Media Streams is
// listen-only so call audio is never at risk, but transcripts are.
process.on("uncaughtException", (err) => {
  console.error("[server] UNCAUGHT EXCEPTION (continuing):", err);
});
process.on("unhandledRejection", (reason) => {
  console.error("[server] UNHANDLED REJECTION (continuing):", reason);
});

async function shutdown(signal) {
  console.log(`[server] ${signal} received — finalizing ${byStreamSid.size} active call(s)`);
  const sessions = [...byStreamSid.values()];
  await Promise.allSettled(sessions.map((s) => s.end(`shutdown:${signal}`)));
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 8000).unref();
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

server.listen(config.port, () => {
  console.log(`[server] Erudite Call Copilot relay listening on :${config.port}`);
  console.log(`[server]   Twilio Media Streams:  ws://0.0.0.0:${config.port}/twilio`);
  console.log(`[server]   Cockpit:               ws://0.0.0.0:${config.port}/cockpit?call_log_id=...&token=...`);
});
