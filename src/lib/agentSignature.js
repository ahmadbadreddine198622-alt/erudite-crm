// buildAgentSignatureHtml — builds the email-safe HTML appended to the bottom of
// every email an agent sends.
//
// Composition (matches the branded signature design):
//   1. Signature card — an image the agent uploads in their Profile (signature_card_url).
//      This is the dark branded card with their photo, title, contact details & the
//      Erudite logo. Each user uploads their own.
//   2. Trophy stat line (optional) — gold, from signature_stat_label.
//   3. CTA grid — fixed layout, per-user data (Property Finder / Erudite Listings /
//      Meet the Team / Instagram / LinkedIn).
//
// The whole block is appended ONLY to the sent email — it is never rendered inside
// the email composer / Landlord detail page UI.

export function buildAgentSignatureHtml(u = {}) {
  const fullName = u.full_name || '';
  const firstName = fullName.split(' ').filter(Boolean)[0] || fullName || '';
  const linkedinUrl = u.linkedin_url || '';
  const pfUrl = u.pf_profile_url || '';
  const pfRating = u.pf_rating;
  const pfDeals = u.pf_deals_count;
  const pfValue = u.pf_deals_value_label || '';
  const statLabel = u.signature_stat_label || '';
  const cardImg = u.signature_card_url || '';

  const pfSubtitle = `SuperAgent${pfRating ? ` · ${pfRating}⭐` : ''}${pfDeals ? ` · ${pfDeals} deals` : ''}${pfValue ? ` · ${pfValue}` : ''}`;

  // 1. Signature card image (uploaded per user)
  const card = cardImg
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;"><tr><td style="padding:0;border-radius:14px;overflow:hidden;"><img src="${cardImg}" alt="Signature" style="display:block;width:100%;max-width:560px;height:auto;border-radius:14px;"/></td></tr></table>`
    : '';

  // 2. Trophy stat line
  const stat = statLabel
    ? `<div style="font-family:Arial,Helvetica,sans-serif;color:#C5A059;font-size:13px;font-weight:700;margin:14px 0 10px;">🏆 ${statLabel}</div>`
    : '';

  // 3. CTA grid (fixed layout, per-user data)
  const ctaCard = (bg, title, sub, href, darkText, right) => {
    const titleColor = darkText ? '#1a1205' : '#ffffff';
    const subColor = darkText ? '#5a4a1a' : '#dbe6f5';
    const pad = right ? 'padding:0 0 10px 5px;' : 'padding:0 5px 10px 0;';
    return `<td width="50%" valign="top" style="${pad}"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td bgcolor="${bg}" style="padding:14px 16px;border-radius:12px;"><a href="${href}" target="_blank" style="text-decoration:none;display:block;"><div style="font-family:Arial,Helvetica,sans-serif;color:${titleColor};font-size:14px;font-weight:700;">${title}</div><div style="font-family:Arial,Helvetica,sans-serif;color:${subColor};font-size:11px;margin-top:3px;">${sub}</div></a></td></tr></table></td>`;
  };
  const linkedinCard = `<td colspan="2" valign="top" style="padding:0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td bgcolor="#2D77E8" style="padding:14px 16px;border-radius:12px;"><a href="${linkedinUrl || 'https://www.linkedin.com'}" target="_blank" style="text-decoration:none;display:block;"><div style="font-family:Arial,Helvetica,sans-serif;color:#ffffff;font-size:14px;font-weight:700;">💼 LinkedIn →</div><div style="font-family:Arial,Helvetica,sans-serif;color:#d4e6ff;font-size:11px;margin-top:3px;">${firstName ? firstName + "'s profile" : 'LinkedIn profile'}</div></a></td></tr></table></td>`;

  const cta = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;"><tr>${ctaCard('#233552', `⭐ ${firstName} on Property Finder →`, pfSubtitle, pfUrl || 'https://www.propertyfinder.ae', false, false)}${ctaCard('#C5A059', '🏛 Erudite Listings →', 'All live listings for sale', 'https://www.eruditeproperty.com', true, true)}</tr><tr>${ctaCard('#10A492', '👥 Meet the Team →', 'eruditeproperty.com', 'https://www.eruditeproperty.com', false, false)}${ctaCard('#D7338C', '📷 Instagram →', '@eruditeproperty7', 'https://instagram.com/eruditeproperty7', false, true)}</tr><tr>${linkedinCard}</tr></table>`;

  const parts = [card, stat, cta].filter(Boolean).join('');
  return parts ? `<div data-signature="1" style="margin-top:28px;">${parts}</div>` : '';
}