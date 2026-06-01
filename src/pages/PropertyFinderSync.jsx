import React from 'react';
import PFListingsGrid from '@/components/properties/PFListingsGrid';
import EruditePage from '@/components/erudite/EruditePage';

export default function PropertyFinderSync() {
  return (
    <EruditePage
      title="Property Finder"
      subtitle="My Listings"
    >
      <PFListingsGrid />
    </EruditePage>
  );
}