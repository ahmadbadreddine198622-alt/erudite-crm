import { useState, useMemo } from 'react';
import PFCreateListingDialog from './PFCreateListingDialog';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Home, BedDouble, Bath, MapPin, ExternalLink, RefreshCw, Download, Building2, FileDown, Plus, Pencil, Trash2 } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { placeLogo } from '@/lib/pdfBrand';

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
  const ref = l.reference;
  if (!ref) return null;
  return `https://www.propertyfinder.ae/property-detail/${ref}`;
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

// ─── Image loader helpers ─────────────────────────────────────────────────────────────────

async function loadBase64Image(url) {
  try {
    const res = await base44.functions.invoke('proxyImage', { url });
    return res.data && res.data.base64 ? res.data.base64 : null;
  } catch {
    return null;
  }
}

function getImgFormat(base64) {
  if (!base64) return 'JPEG';
  if (base64.includes('image/png')) return 'PNG';
  if (base64.includes('image/webp')) return 'WEBP';
  return 'JPEG';
}

function getImageNaturalDimensions(base64) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => resolve({ w: 16, h: 9 });
    img.src = base64;
  });
}

async function addImageFitted(doc, base64, x, y, maxW, maxH) {
  if (!base64) return 0;
  const fmt = getImgFormat(base64);
  const { w, h } = await getImageNaturalDimensions(base64);
  const ratio = w / h;
  let imgW = maxW;
  let imgH = imgW / ratio;
  if (imgH > maxH) { imgH = maxH; imgW = imgH * ratio; }
  const offsetX = x + (maxW - imgW) / 2;
  doc.addImage(base64, fmt, offsetX, y, imgW, imgH);
  return imgH;
}

// ─── Page header helper (used on interior pages) ──────────────────────────────
function addInteriorHeader(doc, sectionLabel, pageNum, totalPages, W, M) {
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, W, 20, 'F');
  doc.setDrawColor(220, 215, 205);
  doc.setLineWidth(0.3);
  doc.line(M, 20, W - M, 20);

  doc.setTextColor(160, 150, 130);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setCharSpace(2);
  doc.text(sectionLabel.toUpperCase(), M, 13);
  doc.setCharSpace(0);
  doc.setTextColor(180, 175, 165);
  doc.setFontSize(7);
  doc.text(`${String(pageNum).padStart(2, '0')} / ${String(totalPages).padStart(2, '0')}`, W - M - 12, 13);
}

// ─── Single-listing branded PDF — Erudite Estate brochure style ───────────────

async function downloadSingleListingPDF(listing) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = 210, H = 297, M = 16;
  const TOTAL_PAGES = 5;

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
  const offering = getOfferingType(listing);
  const description = getDescription(listing);
  const floor = listing.floorNumber ? `${listing.floorNumber}th Floor` : '';
  const parking = listing.parkingSlots ? 'Included' : '';
  const furnishing = listing.furnishingType || '';
  const amenities = listing.amenities || [];

  // ── Load images ──────────────────────────────────────────────────────────────
  const allImgs = getAllImages(listing);
  const loadedImgs = await Promise.all(allImgs.slice(0, 10).map(url => loadBase64Image(url)));
  const heroBase64 = loadedImgs[0] || null;

  // ══════════════════════════════════════════════════════════════════════════════
  // PAGE 1: Cover — full-bleed hero with dark overlay + branding
  // ══════════════════════════════════════════════════════════════════════════════

  // Dark background
  doc.setFillColor(18, 24, 38);
  doc.rect(0, 0, W, H, 'F');

  // Full-bleed hero image
  if (heroBase64) {
    const fmt = getImgFormat(heroBase64);
    doc.addImage(heroBase64, fmt, 0, 0, W, H);
    // Gradient overlay — bottom 55% darkened
    doc.setFillColor(10, 15, 28);
    doc.setGState && doc.setGState(new doc.GState({ opacity: 0.55 }));
    doc.rect(0, H * 0.45, W, H * 0.55, 'F');
    doc.setGState && doc.setGState(new doc.GState({ opacity: 1 }));
    // Top header band
    doc.setFillColor(10, 15, 28);
    doc.setGState && doc.setGState(new doc.GState({ opacity: 0.7 }));
    doc.rect(0, 0, W, 32, 'F');
    doc.setGState && doc.setGState(new doc.GState({ opacity: 1 }));
  } else {
    doc.setFillColor(25, 35, 55);
    doc.rect(0, 0, W, H, 'F');
  }

  // ERUDITE ESTATE — top-left
  doc.setTextColor(245, 158, 11);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setCharSpace(2.5);
  doc.text('ERUDITE ESTATE', M, 14);
  doc.setCharSpace(0);
  doc.setTextColor(180, 185, 200);
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  doc.setCharSpace(1.5);
  doc.text('DUBAI PROPERTY SPECIALISTS', M, 21);
  doc.setCharSpace(0);

  // For Sale badge — top right
  const badgeLabel = offering === 'rent' ? 'For Rent' : 'For Sale';
  doc.setFillColor(245, 158, 11);
  doc.roundedRect(W - M - 30, 8, 30, 11, 2, 2, 'F');
  doc.setTextColor(15, 20, 35);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text(badgeLabel, W - M - 25, 15.5);

  // Location line above title
  const locationParts = [emirate, developer].filter(Boolean);
  if (locationParts.length > 0) {
    doc.setTextColor(200, 205, 215);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setCharSpace(1.5);
    const locStr = locationParts.join('   ·   ').toUpperCase();
    doc.text('|  ' + locStr, M, H - 108);
    doc.setCharSpace(0);
  }

  // Property title — large serif-style
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(30);
  doc.setFont('helvetica', 'bold');
  const titleParts = title.split(' ');
  // Split title into two lines for visual style (first 3 words / remainder)
  const line1 = titleParts.slice(0, Math.ceil(titleParts.length / 2)).join(' ');
  const line2 = titleParts.slice(Math.ceil(titleParts.length / 2)).join(' ');
  doc.text(line1, M, H - 88);
  if (line2) {
    doc.setFont('helvetica', 'bolditalic');
    doc.setTextColor(220, 215, 210);
    doc.text(line2, M, H - 72);
  }

  // Subtitle — floor + developer
  const subtitleParts = [floor, developer ? `Branded Residence by ${developer}` : null].filter(Boolean);
  if (subtitleParts.length > 0) {
    doc.setTextColor(210, 205, 200);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(subtitleParts.join('  ·  '), M, H - 58);
  }

  // Horizontal rule
  doc.setDrawColor(180, 175, 165);
  doc.setLineWidth(0.3);
  doc.line(M, H - 50, W - M, H - 50);

  // ASKING PRICE label
  doc.setTextColor(170, 175, 185);
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  doc.setCharSpace(2);
  doc.text('ASKING PRICE', M, H - 40);
  doc.setCharSpace(0);

  // Price
  if (priceStr) {
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(28);
    doc.setFont('helvetica', 'bold');
    doc.text(priceStr, M, H - 25);
  }

  // Key facts — right side
  const keyFacts = [
    floor ? `High Floor · ${floor}` : null,
    type ? type : null,
    developer ? `${developer} Residence` : null,
  ].filter(Boolean);
  doc.setTextColor(210, 210, 210);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  keyFacts.forEach((fact, i) => {
    doc.text(fact, W - M - doc.getTextWidth(fact), H - 40 + i * 8);
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // PAGE 2: The Residence — description + key stats grid
  // ══════════════════════════════════════════════════════════════════════════════
  doc.addPage();
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, W, H, 'F');
  addInteriorHeader(doc, 'The Residence', 2, TOTAL_PAGES, W, M);

  let y = 30;

  // Main interior image
  const mainImg = loadedImgs[1] || loadedImgs[0];
  if (mainImg) {
    const h = await addImageFitted(doc, mainImg, M, y, W - 2 * M, 68);
    y += h + 10;
  } else {
    y += 10;
  }

  // Section heading — "An Address Above Downtown" style
  const descHeadingParts = title.split(' ');
  const descH1 = descHeadingParts.slice(0, Math.ceil(descHeadingParts.length / 2)).join(' ') + ' ';
  const descH2 = descHeadingParts.slice(Math.ceil(descHeadingParts.length / 2)).join(' ');
  doc.setTextColor(30, 35, 45);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  const h1w = doc.getTextWidth(descH1);
  doc.text(descH1, M, y);
  doc.setTextColor(180, 145, 90);
  doc.setFont('helvetica', 'bolditalic');
  doc.text(descH2, M + h1w, y);
  y += 10;

  // Description paragraph
  if (description) {
    const cleanDesc = description.replace(/<[^>]*>/g, '').trim();
    doc.setTextColor(80, 85, 95);
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    const descLines = doc.splitTextToSize(cleanDesc, W - 2 * M);
    doc.text(descLines.slice(0, 5), M, y);
    y += descLines.slice(0, 5).length * 5 + 8;
  }

  // Key stats grid — 3 columns x 2 rows (like the sample)
  const statsGrid = [
    { label: 'TOTAL AREA',  value: area ? `${Number(area).toLocaleString()} sq ft` : '—',  sub: area ? `${(area * 0.0929).toFixed(2)} sq m` : '' },
    { label: 'BEDROOMS',    value: beds !== null ? `${beds} Bed${beds !== 1 ? 's' : ''}` : '—', sub: '' },
    { label: 'BATHROOMS',   value: baths !== null ? `${baths} Bath${baths !== 1 ? 's' : ''}` : '—', sub: '' },
    { label: 'FLOOR',       value: floor || '—',         sub: 'High floor' },
    { label: 'PARKING',     value: parking || '—',       sub: parking ? 'Dedicated bay' : '' },
    { label: 'DEVELOPER',   value: developer || '—',     sub: type ? `${type} residence` : '' },
  ];

  const colW2 = (W - 2 * M - 8) / 3;
  statsGrid.forEach((stat, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const cx = M + col * (colW2 + 4);
    const cy = y + row * 22;
    doc.setFillColor(250, 248, 244);
    doc.roundedRect(cx, cy, colW2, 19, 1.5, 1.5, 'F');
    doc.setDrawColor(230, 225, 215);
    doc.roundedRect(cx, cy, colW2, 19, 1.5, 1.5, 'S');
    doc.setTextColor(180, 145, 90);
    doc.setFontSize(5.5);
    doc.setFont('helvetica', 'bold');
    doc.setCharSpace(1.5);
    doc.text(stat.label, cx + 4, cy + 6);
    doc.setCharSpace(0);
    doc.setTextColor(30, 35, 50);
    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'bold');
    doc.text(stat.value.substring(0, 20), cx + 4, cy + 13);
    if (stat.sub) {
      doc.setTextColor(140, 145, 155);
      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'normal');
      doc.text(stat.sub, cx + 4, cy + 18);
    }
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // PAGE 3: Photo Gallery (2-column grid, labelled)
  // ══════════════════════════════════════════════════════════════════════════════
  doc.addPage();
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, W, H, 'F');
  addInteriorHeader(doc, 'Gallery', 3, TOTAL_PAGES, W, M);

  let yg = 28;

  // Section heading
  doc.setTextColor(30, 35, 45);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('The Full ', M, yg);
  doc.setTextColor(180, 145, 90);
  doc.setFont('helvetica', 'bolditalic');
  doc.text('Gallery', M + doc.getTextWidth('The Full '), yg);
  doc.setTextColor(30, 35, 45);
  doc.setFont('helvetica', 'normal');
  yg += 6;

  doc.setTextColor(120, 125, 135);
  doc.setFontSize(8);
  doc.text('A complete walkthrough of the property.', M, yg);
  yg += 8;

  const galleryAll = loadedImgs.slice(1).filter(Boolean);
  const IMG_W = (W - 2 * M - 5) / 2;
  const IMG_H = 42;
  const LABELS = ['LIVING ROOM', 'LIVING & DINING', 'KITCHEN', 'OPEN-PLAN VIEW', 'BEDROOM', 'BEDROOM OUTLOOK', 'WORKSPACE', 'BATHROOM', 'BALCONY · DAY', 'BALCONY · DUSK'];

  for (let i = 0; i < Math.min(galleryAll.length, 8); i++) {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const gx = M + col * (IMG_W + 5);
    const gy = yg + row * (IMG_H + 10);
    if (gy + IMG_H > H - 20) break;
    await addImageFitted(doc, galleryAll[i], gx, gy, IMG_W, IMG_H);
    // Label overlay
    doc.setFillColor(15, 20, 35);
    doc.setGState && doc.setGState(new doc.GState({ opacity: 0.65 }));
    doc.rect(gx, gy + IMG_H - 8, IMG_W, 8, 'F');
    doc.setGState && doc.setGState(new doc.GState({ opacity: 1 }));
    doc.setTextColor(220, 220, 225);
    doc.setFontSize(5.5);
    doc.setFont('helvetica', 'bold');
    doc.setCharSpace(1);
    doc.text(LABELS[i] || `PHOTO ${i + 1}`, gx + 3, gy + IMG_H - 3);
    doc.setCharSpace(0);
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // PAGE 4: Features & Community
  // ══════════════════════════════════════════════════════════════════════════════
  doc.addPage();
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, W, H, 'F');
  addInteriorHeader(doc, 'The View & The Address', 4, TOTAL_PAGES, W, M);

  let yf = 28;

  // Wider image (full-width single)
  const viewImg = loadedImgs.find((img, i) => i > 0 && img) || heroBase64;
  if (viewImg) {
    const h = await addImageFitted(doc, viewImg, M, yf, W - 2 * M, 68);
    yf += h + 10;
  }

  // Two-column feature lists
  const aptFeatures = [
    furnishing && furnishing !== 'unfurnished' ? `${furnishing.replace('_', ' ')} apartment` : null,
    developer ? `Branded residence by ${developer}` : null,
    'Floor-to-ceiling glazing',
    beds !== null ? `${beds} bedroom${beds !== 1 ? 's' : ''}` : null,
    baths !== null ? `${baths} bathroom${baths !== 1 ? 's' : ''}` : null,
    parking ? 'Dedicated parking bay included' : null,
    area ? `${Number(area).toLocaleString()} sq ft total area` : null,
    floor ? `${floor}` : null,
  ].filter(Boolean);

  const communityFeatures = [
    emirate ? `Prime location — ${emirate}` : null,
    'Close proximity to key landmarks',
    'Metro & major roads accessible',
    'World-class shopping & dining nearby',
    'Five-star hospitality services',
    'Strong rental yield — investor friendly',
  ].filter(Boolean);

  const halfW = (W - 2 * M - 10) / 2;

  // Apartment Features
  doc.setTextColor(30, 35, 45);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Apartment Features', M, yf);
  doc.setDrawColor(180, 145, 90);
  doc.setLineWidth(0.4);
  doc.line(M, yf + 2, M + halfW, yf + 2);
  yf += 8;

  doc.setTextColor(65, 70, 85);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  aptFeatures.slice(0, 8).forEach((feat, i) => {
    doc.setTextColor(180, 145, 90);
    doc.text('•', M, yf + i * 7);
    doc.setTextColor(65, 70, 85);
    doc.text(feat, M + 5, yf + i * 7);
  });

  // Community Features (right column)
  const colRx = M + halfW + 10;
  let yfR = yf - 8;
  doc.setTextColor(30, 35, 45);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('The Community', colRx, yfR);
  doc.setDrawColor(180, 145, 90);
  doc.setLineWidth(0.4);
  doc.line(colRx, yfR + 2, colRx + halfW, yfR + 2);
  yfR += 8;

  communityFeatures.forEach((feat, i) => {
    doc.setTextColor(180, 145, 90);
    doc.text('•', colRx, yfR + i * 7);
    doc.setTextColor(65, 70, 85);
    doc.text(feat, colRx + 5, yfR + i * 7);
  });

  // Amenities section
  if (amenities.length > 0) {
    const yAm = Math.max(yf + aptFeatures.length * 7 + 12, yfR + communityFeatures.length * 7 + 12);
    doc.setTextColor(30, 35, 45);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Amenities', M, yAm);
    doc.setDrawColor(180, 145, 90);
    doc.setLineWidth(0.4);
    doc.line(M, yAm + 2, M + 40, yAm + 2);

    const amenityNames = amenities.map(a => typeof a === 'string' ? a : (a.name || a.label || String(a)));
    doc.setTextColor(65, 70, 85);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    amenityNames.slice(0, 18).forEach((a, i) => {
      const col = Math.floor(i / 6);
      const row = i % 6;
      const ax = M + col * ((W - 2 * M) / 3);
      doc.setTextColor(180, 145, 90);
      doc.text('•', ax, yAm + 8 + row * 6.5);
      doc.setTextColor(65, 70, 85);
      doc.text(a.substring(0, 26), ax + 5, yAm + 8 + row * 6.5);
    });
  }

  // Footer agent bar
  doc.setFillColor(18, 22, 38);
  doc.rect(0, H - 28, W, 28, 'F');
  doc.setTextColor(245, 158, 11);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setCharSpace(2);
  doc.text('ERUDITE ESTATE', M, H - 17);
  doc.setCharSpace(0);
  doc.setTextColor(190, 185, 175);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.text(agent || 'Property Consultant', M, H - 9);
  doc.setTextColor(150, 155, 165);
  doc.setFontSize(6.5);
  doc.text('PROPERTY CONSULTANT', M, H - 4);
  doc.setTextColor(245, 158, 11);
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.text('+971 58 180 6000', W - M - 46, H - 17);
  doc.setTextColor(150, 155, 165);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text('MOBILE', W - M - 46, H - 22);
  doc.setTextColor(190, 185, 175);
  doc.setFontSize(8);
  doc.text('info@erudite-estate.com', W - M - 52, H - 9);
  doc.setTextColor(150, 155, 165);
  doc.setFontSize(7);
  doc.text('EMAIL', W - M - 26, H - 22);

  // ══════════════════════════════════════════════════════════════════════════════
  // PAGE 5: Contact page (dark, branded)
  // ══════════════════════════════════════════════════════════════════════════════
  doc.addPage();
  doc.setFillColor(18, 22, 38);
  doc.rect(0, 0, W, H, 'F');

  // Top thin gold bar
  doc.setFillColor(245, 158, 11);
  doc.rect(0, 0, W, 2, 'F');

  // Section label
  doc.setTextColor(80, 90, 110);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setCharSpace(2);
  doc.text('CONTACT', M, 18);
  doc.setCharSpace(0);
  doc.setTextColor(80, 90, 110);
  doc.text(`05 / ${TOTAL_PAGES.toString().padStart(2, '0')}`, W - M - 14, 18);
  doc.setDrawColor(40, 50, 70);
  doc.setLineWidth(0.25);
  doc.line(M, 22, W - M, 22);

  // Headline
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('Speak to Our', M, 42);
  doc.setTextColor(245, 158, 11);
  doc.setFont('helvetica', 'bolditalic');
  doc.text(' Property Consultant', M + doc.getTextWidth('Speak to Our'), 42);

  doc.setTextColor(140, 150, 170);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  const ctaLines = doc.splitTextToSize('Our dedicated team is on hand to assist with viewings, valuations and any questions about this property.', W - 2 * M);
  doc.text(ctaLines, M, 53);

  // Agent card
  doc.setFillColor(28, 36, 56);
  doc.roundedRect(M, 68, W - 2 * M, 52, 3, 3, 'F');
  doc.setDrawColor(50, 65, 88);
  doc.roundedRect(M, 68, W - 2 * M, 52, 3, 3, 'S');

  // Agent avatar circle
  doc.setFillColor(245, 158, 11);
  doc.circle(M + 18, 94, 11, 'F');
  doc.setTextColor(15, 20, 35);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  const initials = (agent || 'EA').split(' ').map(w => w[0]).join('').toUpperCase().substring(0, 2);
  doc.text(initials, M + 13.5, 97.5);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text(agent || 'Ahmad Badreddine', M + 36, 84);
  doc.setTextColor(140, 150, 170);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.text('PROPERTY CONSULTANT', M + 36, 91);

  // Contact details
  doc.setTextColor(150, 160, 175);
  doc.setFontSize(6.5);
  doc.text('MOBILE', M + 36, 100);
  doc.setTextColor(245, 158, 11);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('+971 58 180 6000', M + 36, 108);

  doc.setTextColor(150, 160, 175);
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  doc.text('EMAIL', M + 36, 116);
  doc.setTextColor(200, 205, 215);
  doc.setFontSize(9);
  doc.text('info@erudite-estate.com', M + 36, 114);

  // Property summary box
  doc.setFillColor(245, 158, 11);
  doc.roundedRect(M, 132, W - 2 * M, 42, 3, 3, 'F');
  doc.setTextColor(15, 20, 35);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setCharSpace(1.5);
  doc.text('PROPERTY SUMMARY', M + 6, 142);
  doc.setCharSpace(0);
  doc.setFontSize(10);
  const summTitle = doc.splitTextToSize(title, W - 2 * M - 14);
  doc.text(summTitle[0], M + 6, 151);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  const summDetails = [priceStr, emirate, [beds !== null ? `${beds} Bed` : null, baths !== null ? `${baths} Bath` : null, area ? `${Number(area).toLocaleString()} sqft` : null].filter(Boolean).join(' · ')].filter(Boolean).join('   |   ');
  doc.text(summDetails, M + 6, 160);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text(`Ref: ${ref}`, M + 6, 169);

  // Bottom footer
  doc.setFillColor(245, 158, 11);
  doc.rect(0, H - 24, W, 24, 'F');
  doc.setTextColor(15, 20, 35);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setCharSpace(2);
  doc.text('ERUDITE ESTATE', M, H - 11);
  doc.setCharSpace(0);
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  doc.text(`${agent || 'Property Consultant'}  ·  Property Consultant`, M, H - 5);
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.text('+971 58 180 6000', W - M - 40, H - 11);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text('info@erudite-estate.com', W - M - 46, H - 5);

  // ── Save / Upload ────────────────────────────────────────────────────────────
  const safeTitle = title.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_').substring(0, 30);
  const fileName = `${safeTitle}_${ref}_Brochure.pdf`;

  try {
    const pdfBase64 = doc.output('datauristring');
    await base44.functions.invoke('uploadToGoogleDrive', {
      base64Content: pdfBase64.split(',')[1],
      fileName,
      folderPath: 'Property Brochures',
      mimeType: 'application/pdf'
    });
  } catch {
    doc.save(fileName);
  }
}

// ─── Bulk PDF (all listings report) ─────────────────────────────────────────

async function downloadBulkPDF(listings) {
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

  // Erudite logo — top-right of the navy header band.
  await placeLogo(doc, { x: W - M - 28, y: 3, maxW: 28, maxH: 16 });
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
  const [filterStatus, setFilterStatus] = useState('published');
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
                          className="inline-flex items-center gap-1 px-2 py-1 bg-accent/10 text-accent hover:bg-accent hover:text-accent-foreground rounded text-xs font-medium transition-all">
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