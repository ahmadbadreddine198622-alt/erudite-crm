import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Plus, Search, Grid3X3, List } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import PageHeader from '@/components/shared/PageHeader';
import PropertyCard from '@/components/properties/PropertyCard';
import PropertyDetailSheet from '@/components/properties/PropertyDetailSheet';
import AddPropertyDialog from '@/components/properties/AddPropertyDialog';

export default function Properties() {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [listingFilter, setListingFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [showAddProperty, setShowAddProperty] = useState(false);

  const { data: properties = [] } = useQuery({
    queryKey: ['properties'],
    queryFn: () => base44.entities.Property.list('-created_date', 200),
  });

  const filtered = properties.filter(p => {
    const matchSearch = !search || p.title?.toLowerCase().includes(search.toLowerCase()) || p.location?.toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === 'all' || p.property_type === typeFilter;
    const matchListing = listingFilter === 'all' || p.listing_type === listingFilter;
    const matchStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchSearch && matchType && matchListing && matchStatus;
  });

  return (
    <div className="p-4 md:p-8 max-w-[1600px] mx-auto">
      <PageHeader title="Properties" subtitle={`${filtered.length} listings`}>
        <Button size="sm" onClick={() => setShowAddProperty(true)} className="bg-accent text-accent-foreground hover:bg-accent/90">
          <Plus className="w-4 h-4 mr-1" /> Add Property
        </Button>
      </PageHeader>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search properties..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-36 h-9"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {['apartment', 'villa', 'townhouse', 'penthouse', 'studio', 'office'].map(t => (
              <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={listingFilter} onValueChange={setListingFilter}>
          <SelectTrigger className="w-32 h-9"><SelectValue placeholder="Listing" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="sale">For Sale</SelectItem>
            <SelectItem value="rent">For Rent</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36 h-9"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="available">Available</SelectItem>
            <SelectItem value="under_offer">Under Offer</SelectItem>
            <SelectItem value="sold">Sold</SelectItem>
            <SelectItem value="rented">Rented</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {filtered.map(property => (
          <PropertyCard key={property.id} property={property} onClick={setSelectedProperty} />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-20 text-muted-foreground">
          <p className="text-lg font-medium">No properties found</p>
          <p className="text-sm mt-1">Add your first property listing</p>
        </div>
      )}

      {selectedProperty && (
        <PropertyDetailSheet
          property={selectedProperty}
          open={!!selectedProperty}
          onClose={() => setSelectedProperty(null)}
        />
      )}
      <AddPropertyDialog open={showAddProperty} onClose={() => setShowAddProperty(false)} />
    </div>
  );
}