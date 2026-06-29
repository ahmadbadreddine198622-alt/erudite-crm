import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { landlord_id, landlord_name } = await req.json();
    if (!landlord_id || !landlord_name) {
      return Response.json({ error: 'Missing landlord_id or landlord_name' }, { status: 400 });
    }

    const agentName = user.full_name || user.email?.split('@')[0] || 'Unknown Agent';
    const agentEmail = user.email || '';

    // Ahmad's contact info (CEO)
    const ahmadEmail = 'ahmad@erudite-estate.com';
    const ahmadPhone = '+971526330035';

    const subject = `Contact Download Alert — ${landlord_name}`;
    const emailBody = `
      <h2>Contact Data Downloaded</h2>
      <p><strong>Landlord:</strong> ${landlord_name}</p>
      <p><strong>Downloaded by:</strong> ${agentName} (${agentEmail})</p>
      <p><strong>Time:</strong> ${new Date().toLocaleString('en-GB', { timeZone: 'Asia/Dubai' })}</p>
    `;

    const whatsappMessage = `📥 Contact Download Alert\n\nLandlord: ${landlord_name}\nDownloaded by: ${agentName}\nTime: ${new Date().toLocaleString('en-GB', { timeZone: 'Asia/Dubai' })}`;

    // Send email to Ahmad
    await base44.integrations.Core.SendEmail({
      to: ahmadEmail,
      subject,
      body: emailBody,
    });

    // Send WhatsApp to Ahmad
    await base44.functions.invoke('sendWhatsAppMessage', {
      phone: ahmadPhone,
      text: whatsappMessage,
      channel: 'business',
    });

    return Response.json({ success: true, message: 'Notifications sent to Ahmad' });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});