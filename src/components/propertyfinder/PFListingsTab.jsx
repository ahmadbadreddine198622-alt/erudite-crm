import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Home, BedDouble, Bath, MapPin, ExternalLink, RefreshCw, Download, Building2 } from 'lucide-react';
import { jsPDF } from 'jspdf';

const statusColors = {
  published: 'bg-green-100 text-green-700',
  active: 'bg-green-100 text-green-700',
  draft: 'bg-gray-100 text-gray-600',
  unpublished: 'bg-red-100 text-red-700',
  pending: 'bg-yellow-100 text-yellow-700',
};

function getPFLink(listing) {
  const ref = listing.reference || listing.id;
  if (!ref) return null;
  return `https://www.propertyfinder.ae/en/search?q=${encodeURIComponent(ref)}`;
}

function getTitle(listing) {
  if (listing.title && typeof listing.title === 'object') return listing.title.en || listing.title.ar || '';
  return listing.title || '';
}

function getPrice(listing) {
  if (!listing.price) return null;
  if (typeof listing.price === 'number') return listing.price;
  const amounts = listing.price.amounts || {};
  return amounts.sale || amounts.rent || amounts.monthly || null;
}

function getStatus(listing) {
  if (!listing.state) return 'unknown';
  if (typeof listing.state === 'string') return listing.state;
  return listing.state.stage || listing.state.type || 'unknown';
}

function getLocation(listing) {
  const parts = [];
  if (listing.uaeEmirate) parts.push(listing.uaeEmirate.charAt(0).toUpperCase() + listing.uaeEmirate.slice(1));
  return parts.join(', ');
}

function getProjectName(listing) {
  if (listing.developer && typeof listing.developer === 'string') return listing.developer;
  if (listing.developer && listing.developer.name) return listing.developer.name;
  return listing.project || listing.projectName || listing.development || '';
}

function getImageUrl(listing) {
  if (!listing.media) return null;
  const images = listing.media.images || listing.media;
  if (!images || !Array.isArray(images) || images.length === 0) return null;
  const first = images[0];
  return (first.original && first.original.url) || (first.watermarked && first.watermarked.url) || first.url || null;
}

function downloadPDF(listings) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = 210;
  const margin = 15;
  const colW = pageW - margin * 2;
  let y = margin;

  // Header
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageW, 22, 'F');
  doc.setTextColor(245, 158, 11);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('PROPERTY FINDER — ACTIVE LISTINGS REPORT', margin, 14);
  doc.setTextColor(180, 180, 180);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generated: ${new Date().toLocaleDateString('en-AE', { day: '2-digit', month: 'long', year: 'numeric' })}  |  Total Listings: ${listings.length}`, margin, 20);

  y = 30;

  listings.forEach((listing, idx) => {
    const title = getTitle(listing) || 'Untitled Listing';
    const ref = listing.reference || listing.id || '—';
    const price = getPrice(listing);
    const beds = listing.bedrooms !== undefined ? listing.bedrooms : null;
    const baths = listing.bathrooms !== undefined ? listing.bathrooms : null;
    const area = listing.size || listing.plotSize || null;
    const location = getLocation(listing);
    const project = getProjectName(listing);
    const status = getStatus(listing);
    const type = listing.type || listing.category || '';
    const category = '';
    const pfLink = getPFLink(listing);

    const blockH = 34;
    if (y + blockH > 280) {
      doc.addPage();
      y = margin;
    }

    // Card background
    doc.setFillColor(idx % 2 === 0 ? 249 : 255, idx % 2 === 0 ? 250 : 255, idx % 2 === 0 ? 251 : 255);
    doc.roundedRect(margin, y, colW, blockH - 2, 2, 2, 'F');
    doc.setDrawColor(220, 220, 230);
    doc.roundedRect(margin, y, colW, blockH - 2, 2, 2, 'S');

    // Index badge
    doc.setFillColor(245, 158, 11);
    doc.circle(margin + 5, y + 6, 4, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text(String(idx + 1), margin + 3.5, y + 8);

    // Title
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    const titleLines = doc.splitTextToSize(title, colW - 55);
    doc.text(titleLines[0], margin + 12, y + 7);

    // Status badge
    const isActive = status === 'published' || status === 'active' || status === 'live';
    doc.setFillColor(isActive ? 220 : 254, isActive ? 252 : 226, isActive ? 231 : 226);
    doc.roundedRect(pageW - margin - 22, y + 2, 20, 6, 1, 1, 'F');
    doc.setTextColor(isActive ? 22 : 120, isActive ? 163 : 100, isActive ? 74 : 0);
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    doc.text(status.toUpperCase(), pageW - margin - 21, y + 6.5);

    // Row 2: Ref + Price
    doc.setTextColor(100, 100, 120);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(`Ref: ${ref}`, margin + 12, y + 14);
    if (price) {
      doc.setTextColor(245, 158, 11);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      const priceNum = typeof price === 'number' ? price : Number(price);
      doc.text(`AED ${isNaN(priceNum) ? price : priceNum.toLocaleString()}`, margin + 50, y + 14);
    }

    // Row 3: Details
    doc.setTextColor(80, 80, 100);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    const details = [
      beds !== null ? `${beds} Bed` : null,
      baths !== null ? `${baths} Bath` : null,
      area ? `${Number(area).toLocaleString()} sqft` : null,
      type || null,
      category || null,
    ].filter(Boolean).join('  •  ');
    doc.text(details, margin + 12, y + 21);

    // Row 4: Location & Project
    doc.setTextColor(60, 100, 180);
    doc.setFontSize(7.5);
    const locText = [project, location].filter(Boolean).join(' — ');
    if (locText) doc.text(locText.substring(0, 80), margin + 12, y + 27);

    // PF Link
    if (pfLink) {
      doc.setTextColor(245, 158, 11);
      doc.setFontSize(7);
      doc.text('View on PropertyFinder →', margin + 12, y + 31.5);
      doc.link(margin + 12, y + 28, 60, 5, { url: pfLink });
    }

    y += blockH;
  });

  // Footer on last page
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 287, pageW, 10, 'F');
  doc.setTextColor(150, 150, 150);
  doc.setFontSize(7);
  doc.text('Confidential — Erudite Property CRM', margin, 293);
  doc.text(`Page ${doc.getCurrentPageInfo().pageNumber}`, pageW - 25, 293);

  doc.save(`PF_Listings_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
}

export default function PFListingsTab() {
  const [search, setSearch] = useState('');

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['pf-listings'],
    queryFn: async () => {
      const res = await base44.functions.invoke('propertyFinderSync', { mode: 'listings' });
      return res.data.listings || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const listings = data || [];
  const activeListings = listings.filter(l => {
    const s = getStatus(l);
    return s === 'published' || s === 'active' || s === 'live';
  });

  const filtered = listings.filter(l => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      getTitle(l).toLowerCase().includes(q) ||
      (l.reference || '').toLowerCase().includes(q) ||
      getLocation(l).toLowerCase().includes(q) ||
      getProjectName(l).toLowerCase().includes(q)
    );
  });

  if (isLoading) return <div className="py-12 text-center text-sm text-muted-foreground">Loading listings from PropertyFinder...</div>;
  if (error) return <div className="py-12 text-center text-sm text-red-600">{error.message}</div>;

  return (
    <div className="space-y-4">
      <div className="flex gap-3 items-center flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search title, reference, location, project..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="gap-2 shrink-0">
          <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
        <Button size="sm" onClick={() => downloadPDF(filtered)} disabled={filtered.length === 0} className="gap-2 shrink-0 bg-accent text-accent-foreground hover:bg-accent/90">
          <Download className="w-4 h-4" />
          Download PDF ({filtered.length})
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">{listings.length} total listings · {activeListings.length} active</p>

      {filtered.length === 0 ? (
        <div className="py-12 text-center text-sm text-muted-foreground">No listings found.</div>
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
            const location = getLocation(listing);
            const project = getProjectName(listing);
            const imgUrl = getImageUrl(listing);
            const type = listing.type || listing.category || '';
            const pfLink = getPFLink(listing);
            const isLive = listing.portals && listing.portals.propertyfinder && listing.portals.propertyfinder.isLive;

            return (
              <Card key={listing.id || i} className="overflow-hidden hover:shadow-md transition-shadow">
                {imgUrl ? (
                  <img src={imgUrl} alt={title} className="w-full h-40 object-cover" />
                ) : (
                  <div className="w-full h-40 bg-muted flex items-center justify-center">
                    <Home className="w-8 h-8 text-muted-foreground" />
                  </div>
                )}
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-sm leading-tight line-clamp-2">{title}</h3>
                    {status && (
                      <span className={`inline-flex shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[status] || 'bg-gray-100 text-gray-600'}`}>
                        {status}
                      </span>
                    )}
                  </div>

                  {ref && <p className="text-xs font-mono text-muted-foreground">Ref: {ref}</p>}

                  {/* Location & Project */}
                  {(location || project) && (
                    <div className="space-y-0.5">
                      {project && (
                        <div className="flex items-center gap-1 text-xs text-foreground font-medium">
                          <Building2 className="w-3 h-3 text-accent shrink-0" />{project}
                        </div>
                      )}
                      {location && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="w-3 h-3 shrink-0" />{location}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                    {beds !== null && <span className="flex items-center gap-1"><BedDouble className="w-3.5 h-3.5" />{beds} Bed</span>}
                    {baths !== null && <span className="flex items-center gap-1"><Bath className="w-3.5 h-3.5" />{baths} Bath</span>}
                    {areaSqft && <span>{Number(areaSqft).toLocaleString()} sqft</span>}
                    {type && <span className="capitalize">{type}</span>}
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    {price ? (
                      <p className="font-bold text-sm">AED {Number(price).toLocaleString()}</p>
                    ) : <span />}
                    <div className="flex items-center gap-2">
                      {isLive && <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-medium">Live</span>}
                      {pfLink && (
                        <a href={pfLink} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-accent font-medium hover:underline">
                          <ExternalLink className="w-3 h-3" /> View on PF
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