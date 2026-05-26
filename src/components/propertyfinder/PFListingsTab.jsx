import { useState, useMemo } from 'react';
import PFCreateListingDialog from './PFCreateListingDialog';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Home, BedDouble, Bath, MapPin, ExternalLink, RefreshCw, Download, Building2, FileDown, Plus, Pencil, Trash2 } from 'lucide-react';
import { jsPDF } from 'jspdf';

// ─── helpers ────────────────────────────────────────────────────────────────

const statusColors = {
  published: 'bg-green-100 text-green-700',
  active: 'bg-green-100 text-green-700',
  live: 'bg-green-100 text-green-700',
  draft: 'bg-gray-100 text-gray-600',
  takendown: 'bg-red-100 text-red-700',
  unpublished: 'bg-red-100 text-red-700',
  pending: 'bg-yellow-100 text-yellow-700',
};

function getPFLink(l) {
  const ref = l.reference || l.id;
  return ref ? `https://www.propertyfinder.ae/en/search?q=${encodeURIComponent(ref)}` : null;
}
function getTitle(l) {
  if (l.title && typeof l.title === 'object') return l.title.en || l.title.ar || '';
  return l.title || '';
}
function getDescription(l) {
  if (l.description && typeof l.description === 'object') return l.description.en || l.description.ar || '';
  return l.description || '';
}
function getPrice(l) {
  if (!l.price) return null;
  if (typeof l.price === 'number') return l.price;
  const a = l.price.amounts || {};
  return a.sale || a.rent || a.monthly || null;
}
function getOfferingType(l) {
  if (!l.price) return '';
  if (typeof l.price === 'object') return l.price.type || '';
  return '';
}
function getStatus(l) {
  if (!l.state) return 'unknown';
  if (typeof l.state === 'string') return l.state;
  return l.state.stage || l.state.type || 'unknown';
}
function getEmirate(l) {
  return l.uaeEmirate ? l.uaeEmirate.charAt(0).toUpperCase() + l.uaeEmirate.slice(1) : '';
}
function getDeveloper(l) {
  if (!l.developer) return '';
  if (typeof l.developer === 'string') return l.developer;
  return l.developer.name || '';
}
function getAgentName(l) {
  if (!l.assignedTo) return '';
  if (typeof l.assignedTo === 'string') return l.assignedTo;
  const a = l.assignedTo;
  return a.name || [a.firstName, a.lastName].filter(Boolean).join(' ') || a.email || '';
}
function getImageUrl(l) {
  if (!l.media) return null;
  const imgs = l.media.images || (Array.isArray(l.media) ? l.media : []);
  if (!imgs.length) return null;
  const f = imgs[0];
  return (f.original && f.original.url) || (f.watermarked && f.watermarked.url) || f.url || null;
}
function getAllImages(l) {
  if (!l.media) return [];
  const imgs = l.media.images || (Array.isArray(l.media) ? l.media : []);
  return imgs.map(f => (f.original && f.original.url) || (f.watermarked && f.watermarked.url) || f.url).filter(Boolean);
}

// ─── Image loader helper ─────────────────────────────────────────────────────

async function loadBase64Image(url) {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

// ─── Single-listing branded PDF (Erudite Estate style) ───────────────────────

async function downloadSingleListingPDF(listing) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = 210, H = 297, M = 15;

  const title = getTitle(listing) || 'Property Listing';
  const ref = listing.reference || listing.id || '—';
  const price = getPrice(listing);
  const priceStr = price ? `AED ${Number(price).toLocaleString()}` : '';
  const beds = listing.bedrooms !== undefined ? listing.bedrooms : null;
  const baths = listing.bathrooms !== undefined ? listing.bathrooms : null;
  const area = listing.size || listing.plotSize || null;
  const emirate = getEmirate(listing);
  const developer = getDeveloper(listing);
  const agent = getAgentName(listing);
  const type = listing.type || listing.category || '';
  const category = listing.category || '';
  const offering = getOfferingType(listing);
  const status = getStatus(listing);
  const description = getDescription(listing);
  const floor = listing.floorNumber ? `Floor ${listing.floorNumber}` : '';
  const parking = listing.parkingSlots ? `${listing.parkingSlots} parking` : '';
  const furnishing = listing.furnishingType || '';
  const amenities = listing.amenities || [];

  // ── Load hero image ─────────────────────────────────────────────────────────
  const allImgs = getAllImages(listing);
  let heroBase64 = null;
  if (allImgs[0]) heroBase64 = await loadBase64Image(allImgs[0]);
  let img2Base64 = null;
  if (allImgs[1]) img2Base64 = await loadBase64Image(allImgs[1]);

  // ── PAGE 1: Cover ──────────────────────────────────────────────────────────

  // Full dark background
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, W, H, 'F');

  // Thin gold top bar
  doc.setFillColor(245, 158, 11);
  doc.rect(0, 0, W, 2, 'F');

  // Erudite Estate branding top-left
  doc.setTextColor(245, 158, 11);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setCharSpace(2);
  doc.text('ERUDITE ESTATE', M, 16);
  doc.setCharSpace(0);
  doc.setTextColor(150, 160, 175);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text('DUBAI PROPERTY SPECIALISTS', M, 22);

  // For Sale / For Rent badge top-right
  const badgeLabel = offering === 'rent' ? 'FOR RENT' : 'FOR SALE';
  doc.setFillColor(245, 158, 11);
  doc.roundedRect(W - M - 26, 10, 26, 10, 2, 2, 'F');
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text(badgeLabel, W - M - 23, 17);

  // Divider
  doc.setDrawColor(50, 60, 80);
  doc.setLineWidth(0.3);
  doc.line(M, 27, W - M, 27);

  // Hero image area
  if (heroBase64) {
    doc.addImage(heroBase64, 'JPEG', M, 32, W - 2 * M, 100);
    // Dark gradient overlay at bottom of image
    doc.setFillColor(15, 23, 42);
    doc.setGState && doc.setGState(new doc.GState({ opacity: 0.55 }));
    doc.rect(M, 105, W - 2 * M, 27, 'F');
    doc.setGState && doc.setGState(new doc.GState({ opacity: 1 }));
  } else {
    doc.setFillColor(25, 35, 55);
    doc.roundedRect(M, 32, W - 2 * M, 100, 3, 3, 'F');
    doc.setTextColor(60, 75, 95);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    doc.text('Property Photography', W / 2 - 20, 83);
  }

  // Location tag over image area
  doc.setFillColor(15, 23, 42);
  doc.setFillColor(0, 0, 0, 0.6);
  doc.setFillColor(30, 40, 58);
  doc.roundedRect(M + 3, 118, 80, 8, 1, 1, 'F');
  doc.setTextColor(200, 210, 220);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setCharSpace(1);
  const locationTag = [emirate, developer].filter(Boolean).join('  ·  ');
  if (locationTag) doc.text(locationTag.toUpperCase(), M + 6, 123.5);
  doc.setCharSpace(0);

  // Property Title
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(26);
  doc.setFont('helvetica', 'bold');
  const titleLines = doc.splitTextToSize(title, W - 2 * M);
  doc.text(titleLines.slice(0, 2), M, 146);

  // Subtitle: type/category
  if (type || category) {
    doc.setTextColor(245, 158, 11);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'normal');
    doc.text(([type, category].filter(Boolean).join(' · ')), M, 160);
  }

  // Details row: Floor, Ref, Status
  const detailParts = [floor, ref ? `Ref: ${ref}` : null, status].filter(Boolean);
  doc.setTextColor(150, 160, 175);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(detailParts.join('  ·  '), M, 169);

  // Divider
  doc.setDrawColor(50, 65, 85);
  doc.setLineWidth(0.2);
  doc.line(M, 175, W - M, 175);

  // Asking price label
  doc.setTextColor(150, 165, 185);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setCharSpace(2);
  doc.text('ASKING PRICE', M, 184);
  doc.setCharSpace(0);

  // Price
  if (priceStr) {
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(30);
    doc.setFont('helvetica', 'bold');
    doc.text(priceStr, M, 200);
  }

  // Key stats bottom-right
  const stats = [
    beds !== null ? `${beds} BED` : null,
    baths !== null ? `${baths} BATH` : null,
    area ? `${Number(area).toLocaleString()} SQFT` : null,
    parking || null,
  ].filter(Boolean);

  let sx = W - M;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  for (let s = stats.length - 1; s >= 0; s--) {
    const w = doc.getTextWidth(stats[s]);
    doc.setTextColor(245, 158, 11);
    doc.text(stats[s], sx - w, 200);
    sx -= w + 8;
  }

  // Bottom footer bar
  doc.setFillColor(245, 158, 11);
  doc.rect(0, H - 18, W, 18, 'F');
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  if (agent) doc.text(agent, M, H - 8);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('info@erudite-estate.com', W - M - 50, H - 8);

  // ── PAGE 2: Details ────────────────────────────────────────────────────────
  doc.addPage();

  // Dark header
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, W, 28, 'F');
  doc.setFillColor(245, 158, 11);
  doc.rect(0, 0, W, 2, 'F');

  doc.setTextColor(150, 165, 185);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setCharSpace(2);
  doc.text('THE RESIDENCE', M, 13);
  doc.setCharSpace(0);
  doc.setTextColor(80, 95, 110);
  doc.text('02 / 03', W - M - 12, 13);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  const shortTitle = doc.splitTextToSize(title, W - 2 * M - 20);
  doc.text(shortTitle[0], M, 23);

  let y2 = 40;

  // Second image (if available)
  if (img2Base64) {
    doc.addImage(img2Base64, 'JPEG', M, y2, W - 2 * M, 55);
    y2 += 60;
  }

  // Description
  if (description) {
    doc.setTextColor(40, 50, 70);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const descLines = doc.splitTextToSize(description.replace(/<[^>]*>/g, ''), W - 2 * M);
    const visibleLines = descLines.slice(0, 8);
    doc.text(visibleLines, M, y2);
    y2 += visibleLines.length * 5 + 8;
  }

  // Property details grid (3 columns x 2 rows)
  const details = [
    { label: 'TOTAL AREA', value: area ? `${Number(area).toLocaleString()} sq ft` : '—' },
    { label: 'BEDROOMS', value: beds !== null ? String(beds) : '—' },
    { label: 'BATHROOMS', value: baths !== null ? String(baths) : '—' },
    { label: 'FLOOR', value: floor || '—' },
    { label: 'PARKING', value: parking || (listing.parkingSlots === 0 ? 'None' : '—') },
    { label: 'DEVELOPER', value: developer || '—' },
    { label: 'TYPE', value: type || '—' },
    { label: 'FURNISHING', value: furnishing || '—' },
    { label: 'REFERENCE', value: ref },
  ];

  const colW = (W - 2 * M - 8) / 3;
  let row = 0, col = 0;
  details.forEach((d, i) => {
    col = i % 3;
    row = Math.floor(i / 3);
    const cx = M + col * (colW + 4);
    const cy = y2 + row * 22;
    doc.setFillColor(248, 249, 252);
    doc.roundedRect(cx, cy, colW, 18, 1.5, 1.5, 'F');
    doc.setDrawColor(230, 234, 242);
    doc.roundedRect(cx, cy, colW, 18, 1.5, 1.5, 'S');
    doc.setTextColor(245, 158, 11);
    doc.setFontSize(6);
    doc.setFont('helvetica', 'bold');
    doc.setCharSpace(1);
    doc.text(d.label, cx + 4, cy + 6);
    doc.setCharSpace(0);
    doc.setTextColor(20, 30, 50);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(d.value.substring(0, 22), cx + 4, cy + 13);
  });

  y2 += (Math.ceil(details.length / 3)) * 22 + 10;

  // Amenities
  if (amenities.length > 0) {
    doc.setTextColor(20, 30, 50);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Amenities & Features', M, y2);
    y2 += 6;
    doc.setDrawColor(245, 158, 11);
    doc.setLineWidth(0.5);
    doc.line(M, y2, M + 40, y2);
    y2 += 6;

    doc.setTextColor(60, 75, 95);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    const amenityNames = amenities.map(a => typeof a === 'string' ? a : (a.name || a.label || String(a)));
    const cols3 = [[], [], []];
    amenityNames.forEach((a, i) => cols3[i % 3].push(a));
    const maxRows = Math.max(...cols3.map(c => c.length));
    for (let r = 0; r < Math.min(maxRows, 8); r++) {
      for (let c = 0; c < 3; c++) {
        if (cols3[c][r]) {
          doc.text(`• ${cols3[c][r]}`, M + c * (colW + 4) + 2, y2 + r * 6);
        }
      }
    }
    y2 += Math.min(maxRows, 8) * 6 + 8;
  }

  // ── PAGE 3: Agent / Contact ────────────────────────────────────────────────
  doc.addPage();

  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, W, H, 'F');
  doc.setFillColor(245, 158, 11);
  doc.rect(0, 0, W, 2, 'F');

  // Section label
  doc.setTextColor(80, 95, 110);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setCharSpace(2);
  doc.text('CONTACT', M, 20);
  doc.setCharSpace(0);
  doc.setTextColor(80, 95, 110);
  doc.text('03 / 03', W - M - 12, 20);

  doc.setDrawColor(50, 65, 85);
  doc.setLineWidth(0.2);
  doc.line(M, 24, W - M, 24);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('Speak to Our', M, 42);
  doc.setTextColor(245, 158, 11);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'italic');
  doc.text('Property Consultant', M + doc.getTextWidth('Speak to Our ') + 1, 42);

  doc.setTextColor(150, 165, 185);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const contactDesc = doc.splitTextToSize(
    'Our dedicated team is on hand to assist with viewings, valuations and any questions about this property.',
    W - 2 * M
  );
  doc.text(contactDesc, M, 52);

  // Agent card
  doc.setFillColor(25, 35, 55);
  doc.roundedRect(M, 68, W - 2 * M, 50, 3, 3, 'F');
  doc.setDrawColor(50, 65, 85);
  doc.roundedRect(M, 68, W - 2 * M, 50, 3, 3, 'S');

  doc.setFillColor(245, 158, 11);
  doc.circle(M + 16, 93, 10, 'F');
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  const initials = (agent || 'EA').split(' ').map(w => w[0]).join('').toUpperCase().substring(0, 2);
  doc.text(initials, M + 11, 96.5);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(agent || 'Property Consultant', M + 32, 86);

  doc.setTextColor(150, 165, 185);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('PROPERTY CONSULTANT', M + 32, 93);

  doc.setTextColor(245, 158, 11);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('+971 58 180 6000', M + 32, 102);
  doc.setTextColor(200, 210, 225);
  doc.setFont('helvetica', 'normal');
  doc.text('info@erudite-estate.com', M + 32, 109);

  // Property summary box
  doc.setFillColor(245, 158, 11);
  doc.roundedRect(M, 130, W - 2 * M, 40, 3, 3, 'F');
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setCharSpace(1);
  doc.text('PROPERTY SUMMARY', M + 6, 141);
  doc.setCharSpace(0);
  doc.setFontSize(9);
  const summaryTitle = doc.splitTextToSize(title, W - 2 * M - 12);
  doc.text(summaryTitle[0], M + 6, 150);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  const summaryDetails = [priceStr, emirate, [beds !== null ? `${beds} Bed` : null, baths !== null ? `${baths} Bath` : null, area ? `${Number(area).toLocaleString()} sqft` : null].filter(Boolean).join(' · ')].filter(Boolean).join('   |   ');
  doc.text(summaryDetails, M + 6, 160);
  doc.setFont('helvetica', 'bold');
  doc.text(`Ref: ${ref}`, M + 6, 167);

  // Bottom bar
  doc.setFillColor(245, 158, 11);
  doc.rect(0, H - 22, W, 22, 'F');
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setCharSpace(2);
  doc.text('ERUDITE ESTATE', M, H - 10);
  doc.setCharSpace(0);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text('DUBAI PROPERTY SPECIALISTS', M, H - 5);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('+971 58 180 6000', W - M - 36, H - 10);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text('info@erudite-estate.com', W - M - 38, H - 5);

  const safeTitle = title.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_').substring(0, 30);
  doc.save(`Erudite_${safeTitle}_${ref}.pdf`);
}

// ─── Bulk PDF (all listings report) ─────────────────────────────────────────

function downloadBulkPDF(listings) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = 210, M = 15, colW = W - M * 2;
  let y = M;

  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, W, 22, 'F');
  doc.setTextColor(245, 158, 11);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('ERUDITE ESTATE — LISTINGS REPORT', M, 13);
  doc.setTextColor(150, 160, 170);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`${new Date().toLocaleDateString('en-AE', { day: '2-digit', month: 'long', year: 'numeric' })}  |  ${listings.length} listings`, M, 20);
  y = 30;

  listings.forEach((l, idx) => {
    const title = getTitle(l) || 'Untitled';
    const ref = l.reference || l.id || '—';
    const price = getPrice(l);
    const beds = l.bedrooms !== undefined ? l.bedrooms : null;
    const baths = l.bathrooms !== undefined ? l.bathrooms : null;
    const area = l.size || l.plotSize || null;
    const emirate = getEmirate(l);
    const developer = getDeveloper(l);
    const status = getStatus(l);
    const type = l.type || l.category || '';
    const pfLink = getPFLink(l);
    const H = 34;

    if (y + H > 280) { doc.addPage(); y = M; }

    doc.setFillColor(idx % 2 === 0 ? 249 : 255, idx % 2 === 0 ? 250 : 255, idx % 2 === 0 ? 251 : 255);
    doc.roundedRect(M, y, colW, H - 2, 2, 2, 'F');
    doc.setDrawColor(220, 225, 235);
    doc.roundedRect(M, y, colW, H - 2, 2, 2, 'S');

    doc.setFillColor(245, 158, 11);
    doc.circle(M + 5, y + 6, 4, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text(String(idx + 1), M + 3.2, y + 8);

    doc.setTextColor(15, 23, 42);
    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'bold');
    doc.text(doc.splitTextToSize(title, colW - 50)[0], M + 12, y + 7);

    const isActive = ['published', 'active', 'live'].includes(status);
    doc.setFillColor(isActive ? 220 : 254, isActive ? 252 : 226, isActive ? 231 : 226);
    doc.roundedRect(W - M - 22, y + 2, 21, 6, 1, 1, 'F');
    doc.setTextColor(isActive ? 22 : 120, isActive ? 163 : 100, isActive ? 74 : 0);
    doc.setFontSize(6);
    doc.setFont('helvetica', 'bold');
    doc.text(status.toUpperCase().substring(0, 12), W - M - 21, y + 6.5);

    doc.setTextColor(100, 110, 130);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.text(`Ref: ${ref}`, M + 12, y + 14);
    if (price) {
      doc.setTextColor(245, 158, 11);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text(`AED ${Number(price).toLocaleString()}`, M + 50, y + 14);
    }

    doc.setTextColor(80, 90, 110);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    const dets = [beds !== null ? `${beds} Bed` : null, baths !== null ? `${baths} Bath` : null, area ? `${Number(area).toLocaleString()} sqft` : null, type].filter(Boolean).join('  •  ');
    doc.text(dets, M + 12, y + 21);

    doc.setTextColor(60, 100, 180);
    doc.setFontSize(7.5);
    const loc = [developer, emirate].filter(Boolean).join(' — ');
    if (loc) doc.text(loc.substring(0, 80), M + 12, y + 27);

    if (pfLink) {
      doc.setTextColor(245, 158, 11);
      doc.setFontSize(6.5);
      doc.text('View on PropertyFinder →', M + 12, y + 31.5);
      doc.link(M + 12, y + 28, 60, 5, { url: pfLink });
    }
    y += H;
  });

  doc.setFillColor(15, 23, 42);
  doc.rect(0, 287, W, 10, 'F');
  doc.setTextColor(150, 155, 165);
  doc.setFontSize(7);
  doc.text('Confidential — Erudite Estate CRM', M, 293);
  doc.save(`Erudite_Listings_${new Date().toISOString().slice(0, 10)}.pdf`);
}

// ─── Filter helpers ───────────────────────────────────────────────────────────

function unique(arr) { return [...new Set(arr.filter(Boolean))].sort(); }

// ─── Component ───────────────────────────────────────────────────────────────

export default function PFListingsTab() {
  const [createOpen, setCreateOpen] = useState(false);
  const [editListing, setEditListing] = useState(null);
  const [search, setSearch] = useState('');
  const [filterBeds, setFilterBeds] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterEmirate, setFilterEmirate] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterOffering, setFilterOffering] = useState('');
  const [filterAgent, setFilterAgent] = useState('');
  const [filterDeveloper, setFilterDeveloper] = useState('');

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['pf-listings'],
    queryFn: async () => {
      const res = await base44.functions.invoke('propertyFinderSync', { mode: 'listings' });
      return res.data.listings || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const listings = data || [];

  // Unique values for filter dropdowns
  const allBeds = useMemo(() => unique(listings.map(l => l.bedrooms !== undefined ? String(l.bedrooms) : null)), [listings]);
  const allTypes = useMemo(() => unique(listings.map(l => l.type || l.category || null)), [listings]);
  const allEmirates = useMemo(() => unique(listings.map(l => getEmirate(l) || null)), [listings]);
  const allStatuses = useMemo(() => unique(listings.map(l => getStatus(l))), [listings]);
  const allOfferings = useMemo(() => unique(listings.map(l => getOfferingType(l) || null)), [listings]);
  const allAgents = useMemo(() => unique(listings.map(l => getAgentName(l) || null)), [listings]);
  const allDevelopers = useMemo(() => unique(listings.map(l => getDeveloper(l) || null)), [listings]);

  const filtered = useMemo(() => listings.filter(l => {
    if (search) {
      const q = search.toLowerCase();
      const matches = getTitle(l).toLowerCase().includes(q) ||
        (l.reference || '').toLowerCase().includes(q) ||
        getEmirate(l).toLowerCase().includes(q) ||
        getDeveloper(l).toLowerCase().includes(q) ||
        getAgentName(l).toLowerCase().includes(q);
      if (!matches) return false;
    }
    if (filterBeds && String(l.bedrooms) !== filterBeds) return false;
    if (filterType && (l.type || l.category || '') !== filterType) return false;
    if (filterEmirate && getEmirate(l) !== filterEmirate) return false;
    if (filterStatus && getStatus(l) !== filterStatus) return false;
    if (filterOffering && getOfferingType(l) !== filterOffering) return false;
    if (filterAgent && getAgentName(l) !== filterAgent) return false;
    if (filterDeveloper && getDeveloper(l) !== filterDeveloper) return false;
    return true;
  }), [listings, search, filterBeds, filterType, filterEmirate, filterStatus, filterOffering, filterAgent, filterDeveloper]);

  const selectCls = 'h-8 text-xs border border-input bg-background rounded-md px-2 focus:outline-none focus:ring-1 focus:ring-ring';

  function clearFilters() {
    setSearch(''); setFilterBeds(''); setFilterType(''); setFilterEmirate('');
    setFilterStatus(''); setFilterOffering(''); setFilterAgent(''); setFilterDeveloper('');
  }

  const hasFilters = search || filterBeds || filterType || filterEmirate || filterStatus || filterOffering || filterAgent || filterDeveloper;

  if (isLoading) return <div className="py-12 text-center text-sm text-muted-foreground">Loading listings from PropertyFinder...</div>;
  if (error) return <div className="py-12 text-center text-sm text-red-600">{error.message}</div>;

  return (
    <div className="space-y-4">
      {/* Search + Actions */}
      <div className="flex gap-2 items-center flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search title, reference, location..." className="pl-9 h-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-1.5 shrink-0 bg-accent text-accent-foreground hover:bg-accent/90">
          <Plus className="w-3.5 h-3.5" />
          New Listing
        </Button>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="gap-1.5 shrink-0">
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
        <Button size="sm" onClick={() => downloadBulkPDF(filtered)} disabled={filtered.length === 0} className="gap-1.5 shrink-0 bg-accent text-accent-foreground hover:bg-accent/90">
          <Download className="w-3.5 h-3.5" />
          All ({filtered.length})
        </Button>
      </div>

      {/* Filter bar */}
      <div className="flex gap-2 flex-wrap items-center p-3 bg-muted/40 rounded-lg border">
        <span className="text-xs font-medium text-muted-foreground shrink-0">Filters:</span>

        {allStatuses.length > 0 && (
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className={selectCls}>
            <option value="">All Statuses</option>
            {allStatuses.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        )}
        {allOfferings.length > 0 && (
          <select value={filterOffering} onChange={e => setFilterOffering(e.target.value)} className={selectCls}>
            <option value="">Sale / Rent</option>
            {allOfferings.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        )}
        {allBeds.length > 0 && (
          <select value={filterBeds} onChange={e => setFilterBeds(e.target.value)} className={selectCls}>
            <option value="">Bedrooms</option>
            {allBeds.map(b => <option key={b} value={b}>{b} Bed{b !== '1' ? 's' : ''}</option>)}
          </select>
        )}
        {allTypes.length > 0 && (
          <select value={filterType} onChange={e => setFilterType(e.target.value)} className={selectCls}>
            <option value="">Property Type</option>
            {allTypes.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        )}
        {allEmirates.length > 0 && (
          <select value={filterEmirate} onChange={e => setFilterEmirate(e.target.value)} className={selectCls}>
            <option value="">Location / Emirate</option>
            {allEmirates.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
        )}
        {allDevelopers.length > 0 && (
          <select value={filterDeveloper} onChange={e => setFilterDeveloper(e.target.value)} className={selectCls}>
            <option value="">Developer</option>
            {allDevelopers.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        )}
        {allAgents.length > 0 && (
          <select value={filterAgent} onChange={e => setFilterAgent(e.target.value)} className={selectCls}>
            <option value="">Agent</option>
            {allAgents.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        )}
        {hasFilters && (
          <button onClick={clearFilters} className="text-xs text-muted-foreground hover:text-destructive underline shrink-0">
            Clear all
          </button>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        {listings.length} total · {filtered.length} shown
        {listings.filter(l => ['published', 'active', 'live'].includes(getStatus(l))).length > 0 &&
          ` · ${listings.filter(l => ['published', 'active', 'live'].includes(getStatus(l))).length} live`}
      </p>

      {/* Create / Edit Dialog */}
      <PFCreateListingDialog
        open={createOpen || !!editListing}
        onClose={() => { setCreateOpen(false); setEditListing(null); }}
        onSuccess={() => { refetch(); }}
        editListing={editListing || null}
      />

      {filtered.length === 0 ? (
        <div className="py-12 text-center text-sm text-muted-foreground">No listings match your filters.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((listing, i) => {
            const title = getTitle(listing) || 'Untitled Listing';
            const ref = listing.reference || listing.id || '';
            const status = getStatus(listing);
            const price = getPrice(listing);
            const beds = listing.bedrooms !== undefined ? listing.bedrooms : null;
            const baths = listing.bathrooms !== undefined ? listing.bathrooms : null;
            const areaSqft = listing.size || listing.plotSize || null;
            const emirate = getEmirate(listing);
            const developer = getDeveloper(listing);
            const imgUrl = getImageUrl(listing);
            const type = listing.type || listing.category || '';
            const pfLink = getPFLink(listing);
            const isLive = listing.portals?.propertyfinder?.isLive;

            return (
              <Card key={listing.id || i} className="overflow-hidden hover:shadow-md transition-shadow flex flex-col">
                {imgUrl ? (
                  <img src={imgUrl} alt={title} className="w-full h-40 object-cover" />
                ) : (
                  <div className="w-full h-40 bg-muted flex items-center justify-center">
                    <Home className="w-8 h-8 text-muted-foreground" />
                  </div>
                )}
                <CardContent className="p-4 space-y-2 flex flex-col flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-sm leading-tight line-clamp-2">{title}</h3>
                    <span className={`inline-flex shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[status] || 'bg-gray-100 text-gray-600'}`}>
                      {status}
                    </span>
                  </div>

                  {ref && <p className="text-xs font-mono text-muted-foreground">Ref: {ref}</p>}

                  <div className="space-y-0.5">
                    {developer && (
                      <div className="flex items-center gap-1 text-xs text-foreground font-medium">
                        <Building2 className="w-3 h-3 text-accent shrink-0" />{developer}
                      </div>
                    )}
                    {emirate && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="w-3 h-3 shrink-0" />{emirate}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                    {beds !== null && <span className="flex items-center gap-1"><BedDouble className="w-3.5 h-3.5" />{beds} Bed</span>}
                    {baths !== null && <span className="flex items-center gap-1"><Bath className="w-3.5 h-3.5" />{baths} Bath</span>}
                    {areaSqft && <span>{Number(areaSqft).toLocaleString()} sqft</span>}
                    {type && <span className="capitalize">{type}</span>}
                  </div>

                  <div className="flex items-center justify-between pt-1 mt-auto">
                    {price ? (
                      <p className="font-bold text-sm">AED {Number(price).toLocaleString()}</p>
                    ) : <span />}
                    <div className="flex items-center gap-1.5">
                      {isLive && <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-medium">Live</span>}
                      <button
                        onClick={() => setEditListing(listing)}
                        title="Edit Listing"
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary font-medium transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => downloadSingleListingPDF(listing).catch(console.error)}
                        title="Download Brochure PDF"
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-accent font-medium transition-colors"
                      >
                        <FileDown className="w-3.5 h-3.5" />
                      </button>
                      {pfLink && (
                        <a href={pfLink} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-accent font-medium hover:underline">
                          <ExternalLink className="w-3 h-3" /> PF
                        </a>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}