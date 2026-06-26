import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Social media crawler user-agents that need OG tag access
const CRAWLER_UAS = [
  'facebookexternalhit',
  'Facebot',
  'WhatsApp',
  'Twitterbot',
  'LinkedInBot',
  'TelegramBot',
  'Slackbot',
  'Discordbot',
  'Pinterest',
  'Googlebot',
  'bingbot',
];

const OG_IMAGE_URL = 'https://media.base44.com/images/public/69cabceaeeb8bb5e3a62ead3/3fb7a847f_generated_image.png';

function isCrawler(userAgent) {
  if (!userAgent) return false;
  const ua = userAgent.toLowerCase();
  return CRAWLER_UAS.some(crawler => ua.includes(crawler.toLowerCase()));
}

Deno.serve(async (req) => {
  try {
    const userAgent = req.headers.get('user-agent') || '';
    const isBot = isCrawler(userAgent);
    
    // For crawlers, serve static HTML with OG tags (no auth required)
    if (isBot) {
      const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Erudite Real Estate · Dubai Luxury Properties</title>
    <meta name="description" content="Premium CRM for Dubai real estate agents — manage leads, properties, and client relationships." />
    
    <!-- Open Graph / Facebook -->
    <meta property="og:type" content="website" />
    <meta property="og:url" content="https://app.erudite-estate.com" />
    <meta property="og:title" content="Erudite Real Estate" />
    <meta property="og:description" content="Dubai luxury real estate." />
    <meta property="og:image" content="${OG_IMAGE_URL}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:site_name" content="Erudite Real Estate" />
    
    <!-- Twitter -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="Erudite Real Estate" />
    <meta name="twitter:description" content="Dubai luxury real estate." />
    <meta name="twitter:image" content="${OG_IMAGE_URL}" />
    
    <!-- LinkedIn -->
    <meta property="og:image:alt" content="Erudite Real Estate Logo" />
    
    <!-- Robots -->
    <meta name="robots" content="index, follow" />
  </head>
  <body>
    <div style="display:flex;align-items:center;justify-content:center;min-height:100vh;background:#0A1628;font-family:Inter,sans-serif;color:#fff;">
      <div style="text-align:center;">
        <h1 style="font-size:2.5rem;margin-bottom:1rem;color:#D4AF37;">ERUDITE</h1>
        <p style="font-size:1.2rem;opacity:0.8;">Real Estate</p>
        <p style="margin-top:2rem;opacity:0.6;font-size:0.9rem;">Dubai Luxury Properties</p>
      </div>
    </div>
  </body>
</html>`;

      return new Response(html, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=3600',
        },
      });
    }

    // For regular users, redirect to the app
    return new Response(null, {
      status: 302,
      headers: {
        'Location': '/',
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});