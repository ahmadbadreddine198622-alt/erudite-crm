import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * diagnoseWhatsAppChannels - Full diagnostic report for both WhatsApp channels
 * Checks: Meta Cloud API (+971582806000) and Evolution API (+971581806000)
 */

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  
  if (!user || user.role !== 'admin') {
    return Response.json({ error: 'Admin access required' }, { status: 403 });
  }

  const report: any = {
    timestamp: new Date().toISOString(),
    meta_cloud: { status: 'unknown', issues: [], checks: {} },
    evolution: { status: 'unknown', issues: [], checks: {} },
    webhooks: { meta: 'unknown', evolution: 'unknown' },
    entities: {},
    recommendations: []
  };

  // ─────────────────────────────────────────────────────────────
  // META CLOUD API CHECKS (+971582806000)
  // ─────────────────────────────────────────────────────────────
  try {
    const phoneId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');
    const token = Deno.env.get('WHATSAPP_ACCESS_TOKEN');
    const verifyToken = Deno.env.get('WHATSAPP_VERIFY_TOKEN');
    const metaVerifyToken = Deno.env.get('META_VERIFY_TOKEN');
    const webhookSecret = Deno.env.get('META_WEBHOOK_SECRET');

    report.meta_cloud.checks = {
      phone_number_id: phoneId ? `✅ ${phoneId}` : '❌ MISSING',
      access_token: token ? `✅ ${token.slice(0, 20)}...` : '❌ MISSING',
      whatsapp_verify_token: verifyToken ? `✅ ${verifyToken}` : '❌ MISSING',
      meta_verify_token: metaVerifyToken ? `✅ ${metaVerifyToken}` : '❌ MISSING',
      webhook_secret: webhookSecret ? `✅ ${webhookSecret}` : '❌ MISSING',
    };

    // Check webhook URL in Meta dashboard (via API)
    if (phoneId && token) {
      try {
        const res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (res.ok) {
          report.meta_cloud.checks.phone_number_status = `✅ Connected to ${data.name || 'WhatsApp Business'}`;
          report.meta_cloud.checks.quality_rating = data.quality_rating || 'UNKNOWN';
        } else {
          report.meta_cloud.issues.push(`Phone number API error: ${data.error?.message || 'Unknown'}`);
        }
      } catch (err) {
        report.meta_cloud.issues.push(`Phone number lookup failed: ${err.message}`);
      }
    }

    // Test webhook endpoint directly
    try {
      const webhookUrl = 'https://erudite-88407c47.base44.app/functions/metaWhatsAppWebhook';
      const testRes = await fetch(`${webhookUrl}?hub.mode=subscribe&hub.verify_token=${metaVerifyToken || 'test'}&hub.challenge=12345`);
      if (testRes.status === 200) {
        report.webhooks.meta = '✅ GET verification works';
      } else if (testRes.status === 403) {
        report.webhooks.meta = '⚠️ GET returned 403 - verify token mismatch';
        report.meta_cloud.issues.push('META_VERIFY_TOKEN does not match Meta dashboard');
      } else {
        report.webhooks.meta = `❌ GET returned ${testRes.status}`;
      }
    } catch (err) {
      report.webhooks.meta = `❌ Unreachable: ${err.message}`;
    }

    // Check recent messages in database
    try {
      const recent = await base44.asServiceRole.entities.WhatsAppMessage.filter({ channel: 'business' }, '-timestamp', 5);
      report.meta_cloud.checks.recent_messages = recent.length > 0 
        ? `✅ ${recent.length} messages in DB (last: ${recent[0]?.timestamp || 'unknown'})`
        : '⚠️ No messages received yet';
    } catch (err) {
      report.meta_cloud.issues.push(`Entity query failed: ${err.message}`);
    }

    // Check conversations
    try {
      const convs = await base44.asServiceRole.entities.WhatsAppConversation.filter({ channel: 'business' }, '-last_message_at', 5);
      report.meta_cloud.checks.conversations = `✅ ${convs.length} business conversations`;
    } catch {}

    report.meta_cloud.status = report.meta_cloud.issues.length > 0 ? '⚠️ Has issues' : '✅ Healthy';
  } catch (err) {
    report.meta_cloud.status = '❌ Check failed';
    report.meta_cloud.issues.push(`Meta Cloud check error: ${err.message}`);
  }

  // ─────────────────────────────────────────────────────────────
  // EVOLUTION API CHECKS (+971581806000)
  // ─────────────────────────────────────────────────────────────
  try {
    const apiKey = Deno.env.get('EVOLUTION_API_KEY');
    const apiUrl = Deno.env.get('EVOLUTION_API_URL');
    const webhookSecret = Deno.env.get('EVOLUTION_WEBHOOK_SECRET');

    report.evolution.checks = {
      api_key: apiKey ? `✅ ${apiKey.slice(0, 20)}...` : '❌ MISSING',
      api_url: apiUrl ? `✅ ${apiUrl}` : '❌ MISSING',
      webhook_secret: webhookSecret ? `✅ ${webhookSecret}` : '❌ MISSING',
    };

    // Test Evolution API connection
    if (apiKey && apiUrl) {
      try {
        const res = await fetch(`${apiUrl}/instance/fetchInstances`, {
          headers: { 'apikey': apiKey }
        });
        if (res.ok) {
          const data = await res.json();
          report.evolution.checks.instances = `✅ Connected - ${Array.isArray(data) ? data.length : 0} instances`;
          report.evolution.checks.instance_details = Array.isArray(data) ? data.map(i => i.name) : data;
        } else {
          report.evolution.issues.push(`Evolution API error: ${res.status} ${res.statusText}`);
        }
      } catch (err) {
        report.evolution.issues.push(`Evolution API unreachable: ${err.message}`);
      }
    }

    // Test webhook endpoint
    try {
      const webhookUrl = 'https://erudite-88407c47.base44.app/functions/evolutionWebhook';
      const testRes = await fetch(`${webhookUrl}?secret=${webhookSecret || 'test'}`, { method: 'GET' });
      report.webhooks.evolution = testRes.status === 200 
        ? '✅ Webhook reachable' 
        : `⚠️ Returned ${testRes.status}`;
    } catch (err) {
      report.webhooks.evolution = `❌ Unreachable: ${err.message}`;
    }

    // Check recent messages
    try {
      const recent = await base44.asServiceRole.entities.WhatsAppMessage.filter({ channel: 'personal' }, '-timestamp', 5);
      report.evolution.checks.recent_messages = recent.length > 0 
        ? `✅ ${recent.length} messages in DB (last: ${recent[0]?.timestamp || 'unknown'})`
        : '⚠️ No messages received yet';
    } catch (err) {
      report.evolution.issues.push(`Entity query failed: ${err.message}`);
    }

    // Check conversations
    try {
      const convs = await base44.asServiceRole.entities.WhatsAppConversation.filter({ channel: 'personal' }, '-last_message_at', 5);
      report.evolution.checks.conversations = `✅ ${convs.length} personal conversations`;
    } catch {}

    report.evolution.status = report.evolution.issues.length > 0 ? '⚠️ Has issues' : '✅ Healthy';
  } catch (err) {
    report.evolution.status = '❌ Check failed';
    report.evolution.issues.push(`Evolution check error: ${err.message}`);
  }

  // ─────────────────────────────────────────────────────────────
  // ENTITY HEALTH CHECKS
  // ─────────────────────────────────────────────────────────────
  try {
    const waMsgCount = await base44.asServiceRole.entities.WhatsAppMessage.list('-created_date', 1).then(r => r.length);
    const msgCount = await base44.asServiceRole.entities.Message.list('-created_date', 1).then(r => r.length);
    const convCount = await base44.asServiceRole.entities.WhatsAppConversation.list('-created_date', 1).then(r => r.length);

    report.entities = {
      WhatsAppMessage: `✅ ${waMsgCount > 0 ? waMsgCount : '0'} records`,
      Message_legacy: `✅ ${msgCount > 0 ? msgCount : '0'} records`,
      WhatsAppConversation: `✅ ${convCount > 0 ? convCount : '0'} records`,
    };
  } catch (err) {
    report.entities.error = err.message;
  }

  // ─────────────────────────────────────────────────────────────
  // RECOMMENDATIONS
  // ─────────────────────────────────────────────────────────────
  if (report.meta_cloud.issues.includes('META_VERIFY_TOKEN does not match Meta dashboard')) {
    report.recommendations.push({
      priority: 'HIGH',
      channel: 'Meta Cloud API',
      issue: 'Webhook verification failing',
      fix: '1. Go to Meta Developers → WhatsApp → Configuration\n2. Copy the Verify Token exactly\n3. Update META_VERIFY_TOKEN secret in Base44 Dashboard → Settings → Secrets\n4. Retry subscribing to "messages" field'
    });
  }

  if (!report.meta_cloud.checks.access_token?.includes('✅')) {
    report.recommendations.push({
      priority: 'HIGH',
      channel: 'Meta Cloud API',
      issue: 'Access token missing',
      fix: 'Generate a permanent token in Meta Developers → WhatsApp → API Setup → Generate Token'
    });
  }

  if (!report.evolution.checks.api_key?.includes('✅')) {
    report.recommendations.push({
      priority: 'HIGH',
      channel: 'Evolution API',
      issue: 'API key missing',
      fix: 'Add EVOLUTION_API_KEY and EVOLUTION_API_URL secrets'
    });
  }

  if (report.entities.WhatsAppMessage?.includes('0 records')) {
    report.recommendations.push({
      priority: 'MEDIUM',
      channel: 'Both',
      issue: 'No messages in database',
      fix: 'Send a test WhatsApp message to +971582806000 (business) or +971581806000 (personal) after webhooks are configured'
    });
  }

  return Response.json(report);
});