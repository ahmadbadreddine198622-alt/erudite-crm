import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { FileText, Loader2, Download, Sparkles, Eye } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatAED } from '@/lib/constants';
import jsPDF from 'jspdf';
import { placeLogo } from '@/lib/pdfBrand';

const BRAND = {
  name: 'PropCRM Real Estate',
  tagline: 'Premium Dubai Properties',
  phone: '+971 4 000 0000',
  email: 'info@propcrm.ae',
  website: 'www.propcrm.ae',
  primaryColor: [30, 41, 59],      // navy
  accentColor: [217, 119, 6],      // amber/gold
  lightColor: [248, 250, 252],
  textColor: [30, 41, 59],
  mutedColor: [100, 116, 139],
};

function toDataUrl(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

async function buildPDF(property, aiContent) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210, H = 297;
  const pad = 15;

  // ── PAGE 1 ────────────────────────────────────────────────────────────────

  // Hero image (full width top half)
  const heroUrl = property.images?.[0] || 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1200&h=700&fit=crop';
  const heroData = await toDataUrl(heroUrl);
  if (heroData) {
    doc.addImage(heroData, 'JPEG', 0, 0, W, 110);
  } else {
    doc.setFillColor(...BRAND.primaryColor);
    doc.rect(0, 0, W, 110, 'F');
  }

  // Dark gradient overlay on hero
  for (let i = 0; i < 60; i++) {
    doc.setFillColor(30, 41, 59);
    doc.setGState(new doc.GState({ opacity: (i / 60) * 0.75 }));
    doc.rect(0, 50 + i, W, 1.5, 'F');
  }
  doc.setGState(new doc.GState({ opacity: 1 }));

  // Brand banner top
  doc.setFillColor(...BRAND.primaryColor);
  doc.setGState(new doc.GState({ opacity: 0.85 }));
  doc.rect(0, 0, W, 12, 'F');
  doc.setGState(new doc.GState({ opacity: 1 }));
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text(BRAND.name.toUpperCase(), pad, 7.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.text(BRAND.website, W - pad, 7.5, { align: 'right' });

  // Erudite logo — small, top-left in the brand banner. Aspect-fitted, skipped
  // gracefully if src/assets/logo.png is missing.
  await placeLogo(doc, { x: pad + 32, y: 2, maxW: 24, maxH: 9 });

  // Price tag
  doc.setFillColor(...BRAND.accentColor);
  doc.roundedRect(pad, 75, 75, 16, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(formatAED(property.price_aed) + (property.listing_type === 'rent' ? ' /yr' : ''), pad + 5, 85);

  // Status badge
  const statusColors = { available: [16, 185, 129], under_offer: [245, 158, 11], sold: [239, 68, 68], rented: [59, 130, 246] };
  const sc = statusColors[property.status] || BRAND.accentColor;
  doc.setFillColor(...sc);
  doc.roundedRect(pad + 78, 75, 35, 16, 2, 2, 'F');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text((property.status || '').replace(/_/g, ' ').toUpperCase(), pad + 80, 85);

  // Title + location on hero
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  const title = property.title || 'Luxury Property';
  doc.text(title, pad, 65, { maxWidth: W - 2 * pad });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(200, 210, 230);
  if (property.location) doc.text('📍 ' + property.location + (property.building_name ? ', ' + property.building_name : ''), pad, 72);

  // ── CONTENT AREA ──────────────────────────────────────────────────────────

  // White background below hero
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 110, W, H - 110, 'F');

  let y = 122;

  // Key stats row
  const stats = [
    { label: 'BEDROOMS', value: property.bedrooms != null ? `${property.bedrooms} BR` : 'N/A' },
    { label: 'BATHROOMS', value: property.bathrooms != null ? `${property.bathrooms}` : 'N/A' },
    { label: 'AREA', value: property.area_sqft ? `${property.area_sqft.toLocaleString()} sqft` : 'N/A' },
    { label: 'TYPE', value: (property.property_type || '').toUpperCase() },
    { label: 'LISTING', value: (property.listing_type || '').toUpperCase() },
    { label: 'FURNISHING', value: property.furnishing ? property.furnishing.replace(/_/g, ' ').toUpperCase() : 'N/A' },
  ];
  const statW = (W - 2 * pad) / stats.length;
  stats.forEach((s, i) => {
    const x = pad + i * statW;
    doc.setFillColor(...BRAND.lightColor);
    doc.roundedRect(x, y, statW - 2, 18, 1, 1, 'F');
    doc.setTextColor(...BRAND.mutedColor);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.text(s.label, x + (statW - 2) / 2, y + 6, { align: 'center' });
    doc.setTextColor(...BRAND.primaryColor);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(String(s.value), x + (statW - 2) / 2, y + 13, { align: 'center' });
  });
  y += 25;

  // Gold accent line
  doc.setDrawColor(...BRAND.accentColor);
  doc.setLineWidth(0.8);
  doc.line(pad, y, pad + 30, y);
  y += 6;

  // AI-generated headline
  if (aiContent?.headline) {
    doc.setTextColor(...BRAND.accentColor);
    doc.setFont('helvetica', 'bolditalic');
    doc.setFontSize(13);
    doc.text(aiContent.headline, pad, y, { maxWidth: W - 2 * pad });
    y += 10;
  }

  // AI description
  if (aiContent?.description) {
    doc.setTextColor(...BRAND.textColor);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    const lines = doc.splitTextToSize(aiContent.description, W - 2 * pad);
    doc.text(lines, pad, y);
    y += lines.length * 5 + 6;
  }

  // Key highlights
  if (aiContent?.highlights?.length) {
    doc.setTextColor(...BRAND.primaryColor);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('KEY HIGHLIGHTS', pad, y);
    doc.setDrawColor(...BRAND.accentColor);
    doc.setLineWidth(0.5);
    doc.line(pad, y + 1.5, pad + 28, y + 1.5);
    y += 8;

    const colW = (W - 2 * pad - 6) / 2;
    aiContent.highlights.forEach((h, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const hx = pad + col * (colW + 6);
      const hy = y + row * 12;
      doc.setFillColor(...BRAND.accentColor);
      doc.circle(hx + 2, hy - 1, 1.2, 'F');
      doc.setTextColor(...BRAND.textColor);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.text(h, hx + 6, hy, { maxWidth: colW - 8 });
    });
    y += Math.ceil(aiContent.highlights.length / 2) * 12 + 4;
  }

  // Amenities
  if (property.amenities?.length) {
    if (y > 240) { doc.addPage(); y = 20; }
    doc.setTextColor(...BRAND.primaryColor);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('AMENITIES', pad, y);
    y += 7;
    let ax = pad;
    property.amenities.forEach(a => {
      const tw = doc.getTextWidth(a) + 8;
      if (ax + tw > W - pad) { ax = pad; y += 9; }
      doc.setFillColor(...BRAND.lightColor);
      doc.roundedRect(ax, y - 5, tw, 7, 1, 1, 'F');
      doc.setTextColor(...BRAND.mutedColor);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.text(a, ax + 4, y);
      ax += tw + 3;
    });
    y += 12;
  }

  // ── PAGE FOOTER ───────────────────────────────────────────────────────────
  doc.setFillColor(...BRAND.primaryColor);
  doc.rect(0, H - 20, W, 20, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text(BRAND.name, pad, H - 12);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text(`${BRAND.phone}  |  ${BRAND.email}  |  ${BRAND.website}`, W / 2, H - 12, { align: 'center' });
  doc.setTextColor(...BRAND.accentColor);
  doc.setFont('helvetica', 'bolditalic');
  doc.setFontSize(7);
  doc.text(BRAND.tagline, W - pad, H - 12, { align: 'right' });

  // ── PAGE 2: Image gallery (if multiple images) ────────────────────────────
  if (property.images?.length > 1) {
    doc.addPage();
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, W, H, 'F');

    // Header
    doc.setFillColor(...BRAND.primaryColor);
    doc.rect(0, 0, W, 14, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('PHOTO GALLERY  —  ' + title.toUpperCase(), pad, 9);

    const galleryImages = property.images.slice(1, 7); // max 6 more
    const cols = 2, rows = Math.ceil(galleryImages.length / cols);
    const gw = (W - 2 * pad - 5) / cols;
    const gh = gw * 0.65;

    for (let i = 0; i < galleryImages.length; i++) {
      const col = i % cols, row = Math.floor(i / cols);
      const gx = pad + col * (gw + 5);
      const gy = 20 + row * (gh + 5);
      const data = await toDataUrl(galleryImages[i]);
      if (data) doc.addImage(data, 'JPEG', gx, gy, gw, gh);
    }

    // Footer
    doc.setFillColor(...BRAND.primaryColor);
    doc.rect(0, H - 20, W, 20, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text(BRAND.name, pad, H - 12);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text(`${BRAND.phone}  |  ${BRAND.email}  |  ${BRAND.website}`, W / 2, H - 12, { align: 'center' });
  }

  // ── PAGE 3: Investment / details (AI) ─────────────────────────────────────
  if (aiContent?.investment_summary || aiContent?.location_insights) {
    doc.addPage();
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, W, H, 'F');
    doc.setFillColor(...BRAND.primaryColor);
    doc.rect(0, 0, W, 14, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('INVESTMENT & LOCATION OVERVIEW', pad, 9);

    let py = 26;

    if (aiContent.investment_summary) {
      doc.setTextColor(...BRAND.accentColor);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text('Why Invest?', pad, py);
      doc.setDrawColor(...BRAND.accentColor);
      doc.line(pad, py + 2, pad + 22, py + 2);
      py += 9;
      doc.setTextColor(...BRAND.textColor);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      const inv = doc.splitTextToSize(aiContent.investment_summary, W - 2 * pad);
      doc.text(inv, pad, py);
      py += inv.length * 5 + 10;
    }

    if (aiContent.location_insights) {
      doc.setTextColor(...BRAND.primaryColor);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text('Location Insights', pad, py);
      doc.setDrawColor(...BRAND.accentColor);
      doc.line(pad, py + 2, pad + 35, py + 2);
      py += 9;
      doc.setTextColor(...BRAND.textColor);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      const loc = doc.splitTextToSize(aiContent.location_insights, W - 2 * pad);
      doc.text(loc, pad, py);
      py += loc.length * 5 + 10;
    }

    // CTA box
    doc.setFillColor(...BRAND.primaryColor);
    doc.roundedRect(pad, py, W - 2 * pad, 30, 3, 3, 'F');
    doc.setFillColor(...BRAND.accentColor);
    doc.roundedRect(pad, py, W - 2 * pad, 30, 3, 3, 'F');
    doc.setFillColor(...BRAND.primaryColor);
    doc.roundedRect(pad + 1, py + 1, W - 2 * pad - 2, 28, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('Schedule a Viewing Today', W / 2, py + 12, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(200, 210, 230);
    doc.text(`Call: ${BRAND.phone}  |  Email: ${BRAND.email}`, W / 2, py + 22, { align: 'center' });

    // Footer
    doc.setFillColor(...BRAND.primaryColor);
    doc.rect(0, H - 20, W, 20, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text(BRAND.name, pad, H - 12);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text(`${BRAND.phone}  |  ${BRAND.email}  |  ${BRAND.website}`, W / 2, H - 12, { align: 'center' });
  }

  return doc;
}

export default function PropertyBrochurePDF({ property }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [aiContent, setAiContent] = useState(null);
  const [stage, setStage] = useState('');

  const generate = async () => {
    setLoading(true);
    setAiContent(null);
    setStage('Generating AI content...');

    const prompt = `You are a top Dubai real estate copywriter. Create a professional property brochure for the following listing:

Title: ${property.title}
Location: ${property.location || 'Dubai'}${property.building_name ? ', ' + property.building_name : ''}
Type: ${property.property_type} | ${property.listing_type}
Price: ${formatAED(property.price_aed)}${property.listing_type === 'rent' ? '/year' : ''}
Bedrooms: ${property.bedrooms ?? 'N/A'} | Bathrooms: ${property.bathrooms ?? 'N/A'}
Area: ${property.area_sqft ? property.area_sqft + ' sqft' : 'N/A'}
Furnishing: ${property.furnishing || 'N/A'}
Developer: ${property.developer || 'N/A'}
Permit: ${property.permit_number || 'N/A'}
Description: ${property.description || 'Luxury property in Dubai'}
Amenities: ${property.amenities?.join(', ') || 'N/A'}

Return a JSON with:
- headline: a short powerful tagline (max 12 words)
- description: 3-4 sentence compelling description for clients (120-160 words)
- highlights: array of 6 concise key selling points (10 words each max)
- investment_summary: 2 paragraphs on why this is a great investment (100 words)
- location_insights: 2 paragraphs about the location benefits and nearby amenities (100 words)`;

    const schema = {
      type: 'object',
      properties: {
        headline: { type: 'string' },
        description: { type: 'string' },
        highlights: { type: 'array', items: { type: 'string' } },
        investment_summary: { type: 'string' },
        location_insights: { type: 'string' },
      },
    };

    const content = await base44.integrations.Core.InvokeLLM({ prompt, response_json_schema: schema });
    setAiContent(content);
    setStage('Building PDF...');

    const doc = await buildPDF(property, content);
    const fileName = `${(property.title || 'property').replace(/\s+/g, '_')}_brochure.pdf`;
    doc.save(fileName);

    setStage('');
    setLoading(false);
    setOpen(false);
  };

  const preview = async () => {
    setLoading(true);
    setStage('Generating AI content...');

    const prompt = `You are a top Dubai real estate copywriter. Create a professional property brochure for:
Title: ${property.title}, Location: ${property.location || 'Dubai'}, Price: ${formatAED(property.price_aed)}, Type: ${property.property_type}, Beds: ${property.bedrooms ?? 'N/A'}, Description: ${property.description || 'Luxury property'}

Return JSON: headline (tagline, 12 words max), description (3-4 sentences, 140 words), highlights (array of 6 key selling points), investment_summary (100 words), location_insights (100 words)`;

    const schema = {
      type: 'object',
      properties: {
        headline: { type: 'string' },
        description: { type: 'string' },
        highlights: { type: 'array', items: { type: 'string' } },
        investment_summary: { type: 'string' },
        location_insights: { type: 'string' },
      },
    };

    const content = await base44.integrations.Core.InvokeLLM({ prompt, response_json_schema: schema });
    setAiContent(content);
    setLoading(false);
    setStage('');
  };

  const downloadFromPreview = async () => {
    setLoading(true);
    setStage('Building PDF...');
    const doc = await buildPDF(property, aiContent);
    const fileName = `${(property.title || 'property').replace(/\s+/g, '_')}_brochure.pdf`;
    doc.save(fileName);
    setLoading(false);
    setStage('');
    setOpen(false);
  };

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => { setOpen(true); setAiContent(null); }}
        className="border-accent/40 text-accent hover:bg-accent/10"
      >
        <FileText className="w-3.5 h-3.5 mr-1.5" />
        Generate Brochure PDF
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-accent" />
              AI Property Brochure
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Property summary */}
            <div className="p-4 bg-muted/40 rounded-xl border space-y-1">
              <p className="font-semibold text-sm">{property.title}</p>
              <p className="text-xs text-muted-foreground">{property.location}{property.building_name ? ` · ${property.building_name}` : ''}</p>
              <p className="text-base font-bold text-accent">{formatAED(property.price_aed)}</p>
              <p className="text-xs text-muted-foreground capitalize">{property.bedrooms ?? '-'} BR · {property.bathrooms ?? '-'} Bath · {property.area_sqft?.toLocaleString() ?? '-'} sqft · {property.property_type}</p>
            </div>

            {/* AI content preview */}
            {aiContent && (
              <div className="p-4 bg-primary/5 border border-primary/10 rounded-xl space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">AI Content Preview</p>
                <p className="text-sm font-bold text-accent italic">{aiContent.headline}</p>
                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-4">{aiContent.description}</p>
                {aiContent.highlights?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {aiContent.highlights.map((h, i) => (
                      <span key={i} className="text-[10px] px-2 py-0.5 bg-accent/10 text-accent rounded-full font-medium">{h}</span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {loading && (
              <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                <Loader2 className="w-4 h-4 animate-spin text-accent" />
                <span className="text-sm text-muted-foreground">{stage}</span>
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              This generates a professional multi-page PDF brochure with AI-written copy, property details, photo gallery, and investment insights — ready to share with clients.
            </p>

            <div className="flex gap-2 pt-1">
              {!aiContent ? (
                <>
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={preview}
                    disabled={loading}
                  >
                    <Eye className="w-3.5 h-3.5 mr-1.5" />
                    Preview AI Content
                  </Button>
                  <Button
                    className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90"
                    onClick={generate}
                    disabled={loading}
                  >
                    {loading ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Download className="w-3.5 h-3.5 mr-1.5" />}
                    Generate & Download
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="outline" className="flex-1" onClick={preview} disabled={loading}>
                    <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                    Regenerate
                  </Button>
                  <Button
                    className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90"
                    onClick={downloadFromPreview}
                    disabled={loading}
                  >
                    {loading ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Download className="w-3.5 h-3.5 mr-1.5" />}
                    Download PDF
                  </Button>
                </>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}