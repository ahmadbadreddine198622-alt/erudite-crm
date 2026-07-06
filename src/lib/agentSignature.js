// buildAgentSignatureHtml — generates an email-safe HTML signature block (table-based,
// inline styles, bgcolor) that is appended to the bottom of every email an agent sends.
//
// Layout matches the Erudite branded signature:
//   1. Dark signature card: portrait | position + script signature + contact rows | Erudite brand
//   2. Trophy stat line (optional)
//   3. CTA grid: Property Finder | Erudite Listings | Meet the Team | Instagram | LinkedIn
//
// All values come from the logged-in user's profile (User entity). Company-wide CTAs
// (Erudite Listings, Meet the Team, Instagram) use Erudite defaults.

export function buildAgentSignatureHtml(u = {}) {
  const fullName = u.full_name || '';
  const firstName = fullName.split(' ').filter(Boolean)[0] || fullName || '';
  const position = u.position || '';
  const phone = u.phone || '';
  const email = u.email || '';
  const officeLocation = u.office_location || '';
  const instagram = u.instagram_handle || '@eruditeproperty7';
  const linkedinUrl = u.linkedin_url || '';
  const pfUrl = u.pf_profile_url || '';
  const pfRating = u.pf_rating;
  const pfDeals = u.pf_deals_count;
  const pfValue = u.pf_deals_value_label || '';
  const statLabel = u.signature_stat_label || '';
  const profileImg = u.profile_image || '';
  const sigImg = u.signature_url || '';

  const initial = (fullName || email || '?').trim().charAt(0).toUpperCase() || '?';
  const portraitHtml = profileImg
    ? `<img src="${profileImg}" width="96" height="96" alt="" style="display:block;width:96px;height:96px;border-radius:50%;object-fit:cover;border:2px solid #d4af37;"/>`
    : `<table role="presentation" cellpadding="0" cellspacing="0"><tr><td width="96" height="96" bgcolor="#d4af37" align="center" style="width:96px;height:96px;border-radius:50%;font-family:Arial,Helvetica,sans-serif;color:#0a0a0a;font-size:40px;font-weight:700;text-align:center;">${initial}</td></tr></table>`;

  const sigLine = sigImg
    ? `<img src="${sigImg}" height="38" alt="signature" style="display:block;max-height:38px;margin:6px 0 10px;"/>`
    : `<div style="font-family:'Brush Script MT','Lucida Handwriting',cursive;color:#d4af37;font-size:28px;line-height:1;margin:6px 0 10px;">${fullName}</div>`;

  const pfSubtitle = `SuperAgent${pfRating ? ` · ${pfRating}⭐` : ''}${pfDeals ? ` · ${pfDeals} deals` : ''}${pfValue ? ` · ${pfValue}` : ''}`;

  const contactRows = [
    phone ? `📞 ${phone}` : '',
    `✉️ ${email}`,
    officeLocation ? `📍 ${officeLocation}` : '',
    `📷 ${instagram}`,
  ].filter(Boolean).map((r) => `<div style="margin:2px 0;">${r}</div>`).join('');

  const card = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;"><tr><td bgcolor="#0a0a0a" style="padding:24px;border-radius:14px 14px 0 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td width="108" valign="top" style="padding-right:14px;">${portraitHtml}</td>
      <td valign="middle">
        <div style="font-family:Arial,Helvetica,sans-serif;color:#ffffff;font-size:20px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;">${position || 'AGENT'}</div>
        ${sigLine}
        <div style="font-family:Arial,Helvetica,sans-serif;color:#cfcfcf;font-size:13px;line-height:1.7;">${contactRows}</div>
      </td>
      <td width="120" valign="bottom" align="right">
        <div style="font-family:Georgia,'Times New Roman',serif;color:#d4af37;font-size:28px;font-weight:700;letter-spacing:0.02em;">Erudite</div>
        <div style="font-family:Arial,Helvetica,sans-serif;color:#9a9a9a;font-size:9px;margin-top:4px;letter-spacing:0.08em;">A BETTER WAY<br/>FOR YOUR HOME</div>
      </td>
    </tr></table>
  </td></tr></table>`;

  const stat = statLabel
    ? `<div style="font-family:Arial,Helvetica,sans-serif;color:#1e293b;font-size:13px;font-weight:700;margin:14px 0 10px;">🏆 ${statLabel}</div>`
    : '';

  const ctaCard = (bg, title, sub, href, darkText) => {
    const titleColor = darkText ? '#1a1205' : '#ffffff';
    const subColor = darkText ? '#5a4a1a' : '#dbe6f5';
    return `<td width="50%" valign="top" style="padding:0 5px 10px 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td bgcolor="${bg}" style="padding:14px 16px;border-radius:12px;">
        <a href="${href}" target="_blank" style="text-decoration:none;display:block;">
          <div style="font-family:Arial,Helvetica,sans-serif;color:${titleColor};font-size:14px;font-weight:700;">${title}</div>
          <div style="font-family:Arial,Helvetica,sans-serif;color:${subColor};font-size:11px;margin-top:3px;">${sub}</div>
        </a>
      </td></tr></table>
    </td>`;
  };
  const ctaCardRight = (bg, title, sub, href, darkText) => {
    const titleColor = darkText ? '#1a1205' : '#ffffff';
    const subColor = darkText ? '#5a4a1a' : '#dbe6f5';
    return `<td width="50%" valign="top" style="padding:0 0 10px 5px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td bgcolor="${bg}" style="padding:14px 16px;border-radius:12px;">
        <a href="${href}" target="_blank" style="text-decoration:none;display:block;">
          <div style="font-family:Arial,Helvetica,sans-serif;color:${titleColor};font-size:14px;font-weight:700;">${title}</div>
          <div style="font-family:Arial,Helvetica,sans-serif;color:${subColor};font-size:11px;margin-top:3px;">${sub}</div>
        </a>
      </td></tr></table>
    </td>`;
  };
  const linkedinCard = `<td colspan="2" valign="top" style="padding:0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td bgcolor="#1C77E3" style="padding:14px 16px;border-radius:12px;">
      <a href="${linkedinUrl || 'https://www.linkedin.com'}" target="_blank" style="text-decoration:none;display:block;">
        <div style="font-family:Arial,Helvetica,sans-serif;color:#ffffff;font-size:14px;font-weight:700;">in LinkedIn →</div>
        <div style="font-family:Arial,Helvetica,sans-serif;color:#d4e6ff;font-size:11px;margin-top:3px;">${firstName ? firstName + "'s profile" : 'LinkedIn profile'}</div>
      </a>
    </td></tr></table>
  </td>`;

  const cta = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
    <tr>
      ${ctaCard('#2B4A70', `⭐ ${firstName} on Property Finder →`, pfSubtitle, pfUrl || 'https://www.propertyfinder.ae', false)}
      ${ctaCardRight('#D4AF37', '🏢 Erudite Listings →', 'All live listings for sale', 'https://www.eruditeproperty.com', true)}
    </tr>
    <tr>
      ${ctaCard('#10A37F', '👥 Meet the Team →', 'eruditeproperty.com', 'https://www.eruditeproperty.com', false)}
      ${ctaCardRight('#E1306C', '📷 Instagram →', '@eruditeproperty7', 'https://instagram.com/eruditeproperty7', false)}
    </tr>
    <tr>${linkedinCard}</tr>
  </table>`;

  return `<div data-signature="1" style="margin-top:28px;">${card}${stat}${cta}</div>`;
}