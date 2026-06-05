import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import EruditePage from '@/components/erudite/EruditePage';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ExternalLink, Home, TrendingUp, Building, DollarSign, Star, Archive, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function PropertyFinderDashboard() {
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('created_date');

  const { data: listings = [], isLoading } = useQuery({
    queryKey: ['pf-listings-dashboard'],
    queryFn: () => base44.entities.PFListing.list('-created_date', 1000),
  });

  // Calculate metrics
  const metrics = useMemo(() => {
    const total = listings.length;
    const live = listings.filter(l => l.status === 'active').length;
    const archived = listings.filter(l => l.status === 'inactive').length;
    
    const qualityScores = listings
      .filter(l => l.quality_score !== null && l.quality_score !== undefined)
      .map(l => l.quality_score);
    const avgQuality = qualityScores.length > 0
      ? qualityScores.reduce((a, b) => a + b, 0) / qualityScores.length
      : null;

    const saleCount = listings.filter(l => l.listing_type === 'sale').length;
    const rentCount = listings.filter(l => l.listing_type === 'rent').length;

    return { total, live, archived, avgQuality, saleCount, rentCount };
  }, [listings]);

  // Filter and sort listings
  const filteredListings = useMemo(() => {
    return listings
      .filter(listing => {
        if (statusFilter !== 'all' && listing.status !== statusFilter) return false;
        if (typeFilter !== 'all' && listing.listing_type !== typeFilter) return false;
        if (searchQuery && !listing.title?.toLowerCase().includes(searchQuery.toLowerCase())) return false;
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'price') return (b.price || 0) - (a.price || 0);
        if (sortBy === 'quality_score') return (b.quality_score || 0) - (a.quality_score || 0);
        return new Date(b.created_date).getTime() - new Date(a.created_date).getTime();
      });
  }, [listings, statusFilter, typeFilter, searchQuery, sortBy]);

  const formatPrice = (price) => {
    if (!price) return 'N/A';
    if (price >= 1000000) return `AED ${(price / 1000000).toFixed(2)}M`;
    if (price >= 1000) return `AED ${(price / 1000).toFixed(0)}K`;
    return `AED ${price}`;
  };

  return (
    <EruditePage>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-display font-semibold" style={{ color: 'rgba(255,255,255,0.95)' }}>
              Property Finder Dashboard
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Portal listings performance and status overview
            </p>
          </div>
          <Link to="/property-finder">
            <Button variant="outline" className="gap-2">
              <Home className="w-4 h-4" />
              Full Grid View
            </Button>
          </Link>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <Card className="bg-card/50 border-border" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Building className="w-4 h-4" />
                Total Listings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.total}</div>
            </CardContent>
          </Card>

          <Card className="bg-card/50 border-border" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-emerald-400 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                Live
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-400">{metrics.live}</div>
            </CardContent>
          </Card>

          <Card className="bg-card/50 border-border" style={{ background: 'rgba(148,163,184,0.08)', border: '1px solid rgba(148,163,184,0.2)' }}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-400 flex items-center gap-2">
                <Archive className="w-4 h-4" />
                Archived
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-400">{metrics.archived}</div>
            </CardContent>
          </Card>

          {metrics.avgQuality !== null && (
            <Card className="bg-card/50 border-border" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-amber-400 flex items-center gap-2">
                  <Star className="w-4 h-4" />
                  Avg Quality
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-amber-400">{metrics.avgQuality.toFixed(0)}</div>
              </CardContent>
            </Card>
          )}

          <Card className="bg-card/50 border-border" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Sale / Rent
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                <span className="text-primary">{metrics.saleCount}</span>
                <span className="text-muted-foreground mx-2">/</span>
                <span className="text-accent">{metrics.rentCount}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Status:</span>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="active">Live</SelectItem>
                <SelectItem value="inactive">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Type:</span>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="sale">Sale</SelectItem>
                <SelectItem value="rent">Rent</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Input
            placeholder="Search by title..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-64"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.9)' }}
          />

          <div className="flex items-center gap-2 ml-auto">
            <span className="text-sm text-muted-foreground">Sort by:</span>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="created_date">Newest</SelectItem>
                <SelectItem value="price">Price</SelectItem>
                <SelectItem value="quality_score">Quality Score</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Listings Table */}
        <Card className="bg-card/50 border-border overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-muted-foreground">Title</TableHead>
                <TableHead className="text-muted-foreground">Status</TableHead>
                <TableHead className="text-muted-foreground">Price</TableHead>
                <TableHead className="text-muted-foreground">Type</TableHead>
                <TableHead className="text-muted-foreground">Beds</TableHead>
                <TableHead className="text-muted-foreground">Area</TableHead>
                <TableHead className="text-muted-foreground">Agent</TableHead>
                {listings.some(l => l.quality_score) && (
                  <TableHead className="text-muted-foreground">Quality</TableHead>
                )}
                <TableHead className="text-muted-foreground text-right">Link</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredListings.map((listing) => {
                const isLive = listing.status === 'active' && listing.pf_url;
                
                return (
                  <TableRow 
                    key={listing.id}
                    className={isLive ? 'cursor-pointer hover:bg-white/8' : ''}
                    onClick={() => {
                      if (isLive) {
                        window.open(listing.pf_url, '_blank', 'noopener,noreferrer');
                      }
                    }}
                  >
                    <TableCell className="font-medium max-w-[200px] truncate">
                      <div className="flex items-center gap-2">
                        <span className={isLive ? 'text-accent' : ''}>
                          {listing.title || 'Untitled'}
                        </span>
                        {isLive && <ExternalLink className="w-3 h-3 text-accent/60 flex-shrink-0" />}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          listing.status === 'active'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : 'bg-slate-500/10 text-slate-400 border-slate-500/30'
                        }
                      >
                        {listing.status === 'active' ? 'Live' : 'Archived'}
                      </Badge>
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {formatPrice(listing.price)}
                    </TableCell>
                    <TableCell className="capitalize">
                      {listing.listing_type || 'N/A'}
                    </TableCell>
                    <TableCell>
                      {listing.bedrooms !== undefined && listing.bedrooms !== null
                        ? listing.bedrooms === 0
                          ? 'Studio'
                          : listing.bedrooms
                        : 'N/A'}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {listing.area_sqft ? `${listing.area_sqft.toLocaleString()} sqft` : 'N/A'}
                    </TableCell>
                    <TableCell className="max-w-[150px] truncate">
                      {listing.agent_name || 'N/A'}
                    </TableCell>
                    {listings.some(l => l.quality_score) && (
                      <TableCell>
                        {listing.quality_score ? (
                          <div className="flex items-center gap-1">
                            <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                            {listing.quality_score}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    )}
                    <TableCell className="text-right">
                      {listing.pf_url ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1 h-7 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(listing.pf_url, '_blank', 'noopener,noreferrer');
                          }}
                        >
                          View on PF
                          <ExternalLink className="w-3 h-3" />
                        </Button>
                      ) : (
                        <Badge variant="outline" className="bg-slate-500/10 text-slate-400 border-slate-500/30 text-xs">
                          Not live on PF
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {filteredListings.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No listings found
            </div>
          )}
        </Card>
      </div>
    </EruditePage>
  );
}