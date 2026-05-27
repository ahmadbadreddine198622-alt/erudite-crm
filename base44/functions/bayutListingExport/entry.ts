import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Public XML feed Bayut crawls to import our listings.
 * URL pattern: /functions/bayutListingExport?token={outbound_feed_token}
 * Bayut's spec: https://www.bayut.com/api/xml-feed/
 *
 * No auth required — gated by the token query param so Bayut can fetch it
 * without an account but random scrapers cannot.
 */

function xmlEscape(s: any) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildListingXML(property: any, brokerage: any) {
  const photos = (property.photos || property.images || [])
    .map((url: string, i: number) => `    <image><url>${xmlEscape(url)}</url><last_updated>${new Date().toISOString()}</last_updated></image>`)
    .join('\n');

  return `  <listing>
    <reference_number>${xmlEscape(property.id)}</reference_number>
    <permit_number>${xmlEscape(property.rera_permit || '')}</permit_number>
    <offering_type>${xmlEscape(property.transaction_type === 'rent' ? 'RR' : 'RS')}</offering_type>
    <property_type>${xmlEscape(property.type || 'AP')}</property_type>
    <city>${xmlEscape(property.city || 'Dubai')}</city>
    <community>${xmlEscape(property.community || property.location || '')}</community>
    <sub_community>${xmlEscape(property.sub_community || '')}</sub_community>
    <tower>${xmlEscape(property.building || '')}</tower>
    <title_en>${xmlEscape(property.title || '')}</title_en>
    <title_ar>${xmlEscape(property.title_ar || '')}</title_ar>
    <description_en><![CDATA[${property.description || ''}]]></description_en>
    <description_ar><![CDATA[${property.description_ar || ''}]]></description_ar>
    <price>${xmlEscape(property.price || 0)}</price>
    <size>${xmlEscape(property.size_sqft || 0)}</size>
    <bedroom>${xmlEscape(property.bedrooms || 0)}</bedroom>
    <bathroom>${xmlEscape(property.bathrooms || 0)}</bathroom>
    <agent>
      <name>${xmlEscape(property.agent_name || '')}</name>
      <email>${xmlEscape(property.agent_email || '')}</email>
      <phone>${xmlEscape(property.agent_phone || brokerage?.phone || '')}</phone>
    </agent>
${photos}
    <last_update>${xmlEscape(property.updated_date || property.created_date || new Date().toISOString())}</last_update>
  </listing>`;
}

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get('token');

    const base44 = createClientFromRequest(req);
    const creds = await base44.asServiceRole.entities.BayutCredential.list();
    const cred = creds?.[0];

    if (!cred || !cred.outbound_feed_token || cred.outbound_feed_token !== token) {
      return new Response('Forbidden', { status: 403 });
    }

    const properties = await base44.asServiceRole.entities.Property.filter({
      status: 'active',
      list_on_bayut: true
    });

    const brokerageList = await base44.asServiceRole.entities.Brokerage?.list?.() ?? [];
    const brokerage = brokerageList?.[0] || {};

    const listings = properties.map((p: any) => buildListingXML(p, brokerage)).join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<list>
${listings}
</list>`;

    return new Response(xml, {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=900'
      }
    });
  } catch (error: any) {
    console.error('bayutListingExport error:', error);
    return new Response(`<error>${error.message}</error>`, { status: 500, headers: { 'Content-Type': 'application/xml' } });
  }
});
