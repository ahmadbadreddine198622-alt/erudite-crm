// buildAgentCtaHtml — builds the email-safe HTML for the signature CTA grid (trophy
// line + call-to-action cards) appended to the bottom of every email an agent sends.
//
// LinkedIn and Instagram are company-wide (Ahmad's) and shared by all agents, so they
// are hardcoded here. PF, Erudite Listings, Meet the Team, and the trophy line default
// to Ahmad's values but can be overridden per-agent in Profile.

const AHMAD_DEFAULTS = {
  pf_profile_url: 'https://www.propertyfinder.ae/en/agent/ahmad-badreddine-206264',
  pf_rating: 4.3,
  pf_deals_count: 56,
  pf_deals_value_label: 'AED 100M+',
  signature_stat_label: 'AED 100M+ closed in Peninsula',
  erudite_listings_url: 'https://www.eruditeproperty.com',
  meet_team_url: 'https://www.eruditeproperty.com',
};

export function buildAgentCtaHtml(u = {}) {
  const fullName = u.full_name || '';
  const firstName = fullName.split(' ').filter(Boolean)[0] || fullName || '';
  const hasOwnPf = !!u.pf_profile_url;
  const pfUrl = u.pf_profile_url || AHMAD_DEFAULTS.pf_profile_url;
  const pfRating = u.pf_rating != null ? u.pf_rating : AHMAD_DEFAULTS.pf_rating;
  const pfDeals = u.pf_deals_count != null ? u.pf_deals_count : AHMAD_DEFAULTS.pf_deals_count;
  const pfValue = u.pf_deals_value_label || AHMAD_DEFAULTS.pf_deals_value_label;
  const statLabel = u.signature_stat_label || AHMAD_DEFAULTS.signature_stat_label;
  const eruditeListingsUrl = u.erudite_listings_url || AHMAD_DEFAULTS.erudite_listings_url;
  const meetTeamUrl = u.meet_team_url || AHMAD_DEFAULTS.meet_team_url;
  const pfTitle = hasOwnPf ? `${firstName} on Property Finder` : 'Ahmad on Property Finder';
  const pfSubtitle = `SuperAgent · ${pfRating}⭐ · ${pfDeals} deals · ${pfValue}`;

  // Agent identity block + optional rich-text signature. The uploaded signature
  // image is inserted into the composer body (visible while composing) so it is
  // NOT duplicated here. These appear above the CTA grid in the sent email.
  const richSig = u.email_signature_html ? `<div style="margin:6px 0 10px;">${u.email_signature_html}</div>` : '';
  const identity = `<p style="margin:0 0 2px;color:#1e293b;font-size:14px;font-family:Arial,Helvetica,sans-serif;">Best regards,</p><p style="margin:0 0 2px;color:#1e293b;font-size:15px;font-weight:700;font-family:Arial,Helvetica,sans-serif;">${fullName || 'Erudite Real Estate'}</p><p style="margin:0 0 10px;color:#C5A059;font-size:13px;font-weight:600;font-family:Arial,Helvetica,sans-serif;">Erudite Real Estate</p>${richSig}`;

  const stat = `<div style="font-family:Arial,Helvetica,sans-serif;color:#C5A059;font-size:13px;font-weight:700;margin:14px 0 10px;">🏆 ${statLabel}</div>`;

  const ctaCard = (bg, title, sub, href, darkText, right) => {
    const titleColor = darkText ? '#1a1205' : '#ffffff';
    const subColor = darkText ? '#5a4a1a' : '#dbe6f5';
    const pad = right ? 'padding:0 0 10px 5px;' : 'padding:0 5px 10px 0;';
    return `<td width="50%" valign="top" style="${pad}"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td bgcolor="${bg}" style="padding:14px 16px;border-radius:12px;"><a href="${href}" target="_blank" style="text-decoration:none;display:block;"><div style="font-family:Arial,Helvetica,sans-serif;color:${titleColor};font-size:14px;font-weight:700;">${title}</div><div style="font-family:Arial,Helvetica,sans-serif;color:${subColor};font-size:11px;margin-top:3px;">${sub}</div></a></td></tr></table></td>`;
  };

  const cta = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;"><tr>${ctaCard('#233552', `⭐ ${pfTitle} →`, pfSubtitle, pfUrl, false, false)}${ctaCard('#C5A059', '🏛 Erudite Listings →', 'All live listings for sale', eruditeListingsUrl, true, true)}</tr><tr>${ctaCard('#10A492', '👥 Meet the Team →', 'eruditeproperty.com', meetTeamUrl, false, false)}${ctaCard('#D7338C', '📷 Instagram →', '@eruditeproperty7', 'https://instagram.com/eruditeproperty7', false, true)}</tr></table>`;

  return `<div data-signature="1" style="margin-top:14px;border-top:1px solid #eee;padding-top:14px;">${identity}${stat}${cta}</div>`;
}