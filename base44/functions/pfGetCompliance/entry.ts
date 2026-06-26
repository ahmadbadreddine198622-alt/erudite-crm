import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const PF_BASE = 'https://atlas.propertyfinder.com/v1';
const TOKEN_SAFETY_BUFFER_MS = 60 * 1000;

// DLD listingType → allowed PF property types
const DLD_TYPE_MAP = {
  'unit': ['apartment', 'duplex', 'penthouse', 'studio', 'hotel_apartment'],
  'villa': ['villa', 'townhouse', 'bungalow'],
  'building': ['building', 'bulk_rent'],
  'land': ['land'],
  'office': ['office'],
  'shop': ['retail', 'shop'],
  'warehouse': ['warehouse'],
  'compound': ['compound'],
};

// DLD saleType → PF projectStatus values
const SALE_TYPE_MAP = {
  'primary': ['off_plan_primary', 'completed_primary'],
  'secondary': ['off_plan', 'completed'],
};

function isExemptZone(location, community) {
  const text = ((location || '') + ' ' + (community || '')).toLowerCase();
  return text.includes('difc') || text.includes('jafza') || text.includes('jebel ali free zone');
}

async function getToken(base44) {
  const creds = await base44.asServiceRole.entities.PFCredential.list();
  if (!creds || creds.length === 0) throw new Error('No PF credentials configured');
  const cred = creds[0];
  const now = Date.now();

  if (cred.access_token && cred.token_expires_at) {
    const expiresAtMs = new Date(cred.token_expires_at).getTime();
    if (expiresAtMs - now > TOKEN_SAFETY_BUFFER_MS) return cred.access_token;
  }

  if (!cred.api_key || !cred.api_secret) throw new Error('PF API key or secret missing');

  const authRes = await fetch(`${PF_BASE}/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ apiKey: cred.api_key, apiSecret: cred.api_secret }),
  });
  if (!authRes.ok) {
    const txt = await authRes.text();
    throw new Error(`PF auth failed (${authRes.status}): ${txt.substring(0, 200)}`);
  }
  const tokenData = await authRes.json();
  const accessToken = tokenData.accessToken;
  if (!accessToken) throw new Error('PF auth returned no accessToken');

  const expiresInSec = tokenData.expiresIn || 1800;
  const expiresAt = new Date(now + expiresInSec * 1000 - TOKEN_SAFETY_BUFFER_MS).toISOString();
  const updateData = { access_token: accessToken, token_expires_at: expiresAt, api_environment: 'production' };
  if (tokenData.scopes) updateData.scopes_granted = Array.isArray(tokenData.scopes) ? tokenData.scopes : [tokenData.scopes];
  await base44.asServiceRole.entities.PFCredential.update(cred.id, updateData);
  return accessToken;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    let user = null;
    try { user = await base44.auth.me(); } catch (_) { /* no auth */ }
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { permitNumber, location, community } = body;
    if (!permitNumber) return Response.json({ error: 'permitNumber required' }, { status: 400 });

    // Exemption: DIFC / JAFZA skip DLD validation entirely
    if (isExemptZone(location, community)) {
      return Response.json({
        valid: true,
        exempt: true,
        mappedType: null,
        projectStatus: null,
        regulatedFields: null,
        raw: null,
        error: null,
        message: 'DIFC/JAFZA zone — exempt from DLD compliance validation',
      });
    }

    // Read company license from CompanySettings
    const settings = await base44.asServiceRole.entities.CompanySettings.list();
    const company = (settings && settings[0]) || {};
    const licenseNumber = company.brn || company.ded_license;
    if (!licenseNumber) return Response.json({ error: 'No company BRN/license found in CompanySettings' }, { status: 400 });

    const token = await getToken(base44);

    // Brokers must use unit-level permits (only developers may use project-level).
    const complianceUrl = `${PF_BASE}/compliances/${encodeURIComponent(permitNumber)}/${encodeURIComponent(licenseNumber)}?permitType=unit`;
    const res = await fetch(complianceUrl, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });

    if (res.status === 401) {
      // Force re-issue by clearing cached token and retrying once
      const creds = await base44.asServiceRole.entities.PFCredential.list();
      if (creds[0]) await base44.asServiceRole.entities.PFCredential.update(creds[0].id, { access_token: null, token_expires_at: null });
      const freshToken = await getToken(base44);
      const retryRes = await fetch(complianceUrl, {
        headers: { Authorization: `Bearer ${freshToken}`, Accept: 'application/json' },
      });
      if (!retryRes.ok) {
        const txt = await retryRes.text();
        return Response.json({ valid: false, error: `Compliance check failed (${retryRes.status}): ${txt.substring(0, 300)}`, raw: null });
      }
      const retryData = await retryRes.json();
      return mapCompliance(retryData);
    }

    if (!res.ok) {
      const txt = await res.text();
      return Response.json({
        valid: false,
        error: `Compliance check failed (${res.status}): ${txt.substring(0, 300)}`,
        raw: null,
      });
    }

    const data = await res.json();
    return mapCompliance(data);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

function mapCompliance(data) {
  const prop = data.property || data || {};
  const listingType = prop.listingType || prop.type || null;
  const saleType = prop.saleType || prop.sale_type || null;

  const mappedTypes = listingType ? (DLD_TYPE_MAP[String(listingType).toLowerCase()] || []) : [];
  const projectStatuses = saleType ? (SALE_TYPE_MAP[String(saleType).toLowerCase()] || []) : [];

  return Response.json({
    valid: true,
    exempt: false,
    mappedType: mappedTypes[0] || null,
    mappedTypes,
    projectStatus: projectStatuses[0] || null,
    projectStatuses,
    regulatedFields: {
      listingType,
      saleType,
      ...prop,
    },
    raw: data,
    error: null,
  });
}