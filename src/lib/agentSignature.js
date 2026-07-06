// buildAgentCtaHtml — builds the email-safe HTML for the signature CTA grid (trophy
// line + call-to-action cards) appended to the bottom of every email an agent sends.
//
// Every link/stat defaults to Ahmad's values (the reference grid) so all agents share
// the same signature until they personalize a link in their Profile. Any field the
// agent fills in overrides the Ahmad default for that card only.

const AHMAD_DEFAULTS = {
  pf_profile_url: 'https://www.propertyfinder.ae/en/agent/ahmad-badreddine-206264',
  pf_rating: 4.3,
  pf_deals_count: 56,
  pf_deals_value_label: 'AED 100M+',
  signature_stat_label: 'AED 100M+ closed in Peninsula',
  linkedin_url: 'https://www.linkedin.com/in/ahmad-badreddine',
  erudite_listings_url: 'https://www.eruditeproperty.com',
  meet_team_url: 'https://www.eruditeproperty.com',
  instagram_url: 'https://instagram.com/eruditeproperty7',
  instagram_handle: '@eruditeproperty7',
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
  const linkedinUrl = u.linkedin_url || AHMAD_DEFAULTS.linkedin_url;
  const eruditeListingsUrl = u.erudite_listings_url || AHMAD_DEFAULTS.erudite_listings_url;
  const meetTeamUrl = u.meet_team_url || AHMAD_DEFAULTS.meet_team_url;
  const instagramUrl = u.instagram_url || (u.instagram_handle ? `https://instagram.com/${u.instagram_handle.replace(/^@/, '')}` : AHMAD_DEFAULTS.instagram_url);
  const instagramHandle = u.instagram_handle || AHMAD_DEFAULTS.instagram_handle;
  const pfTitle = hasOwnPf ? `${firstName} on Property Finder` : 'Ahmad on Property Finder';
  const pfSubtitle = `SuperAgent · ${pfRating}⭐ · ${pfDeals} deals · ${pfValue}`;
  const linkedinSub = u.linkedin_url ? `${firstName}'s profile` : "Ahmad's profile";

  const stat = `<div style="font-family:Arial,Helvetica,sans-serif;color:#C5A059;font-size:13px;font-weight:700;margin:14px 0 10px;">🏆 ${statLabel}</div>`;

  const ctaCard = (bg, title, sub, href, darkText, right) => {
    const titleColor = darkText ? '#1a1205' : '#ffffff';
    const subColor = darkText ? '#5a4a1a' : '#dbe6f5';
    const pad = right ? 'padding:0 0 10px 5px;' : 'padding:0 5px 10px 0;';
    return `<td width="50%" valign="top" style="${pad}"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td bgcolor="${bg}" style="padding:14px 16px;border-radius:12px;"><a href="${href}" target="_blank" style="text-decoration:none;display:block;"><div style="font-family:Arial,Helvetica,sans-serif;color:${titleColor};font-size:14px;font-weight:700;">${title}</div><div style="font-family:Arial,Helvetica,sans-serif;color:${subColor};font-size:11px;margin-top:3px;">${sub}</div></a></td></tr></table></td>`;
  };
  const linkedinCard = `<td colspan="2" valign="top" style="padding:0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td bgcolor="#2D77E8" style="padding:14px 16px;border-radius:12px;"><a href="${linkedinUrl}" target="_blank" style="text-decoration:none;display:block;"><div style="font-family:Arial,Helvetica,sans-serif;color:#ffffff;font-size:14px;font-weight:700;">💼 LinkedIn →</div><div style="font-family:Arial,Helvetica,sans-serif;color:#d4e6ff;font-size:11px;margin-top:3px;">${linkedinSub}</div></a></td></tr></table></td>`;

  const cta = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;"><tr>${ctaCard('#233552', `⭐ ${pfTitle} →`, pfSubtitle, pfUrl, false, false)}${ctaCard('#C5A059', '🏛 Erudite Listings →', 'All live listings for sale', eruditeListingsUrl, true, true)}</tr><tr>${ctaCard('#10A492', '👥 Meet the Team →', 'eruditeproperty.com', meetTeamUrl, false, false)}${ctaCard('#D7338C', '📷 Instagram →', instagramHandle, instagramUrl, false, true)}</tr><tr>${linkedinCard}</tr></table>`;

  return `<div data-signature="1" style="margin-top:14px;">${stat}${cta}</div>`;
}