import React from 'react';
import PFListingsGrid from '@/components/properties/PFListingsGrid';

export default function PropertyFinderSync() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Property Finder</h1>
          <p className="text-gray-500 mt-1">My Listings</p>
        </div>
        <PFListingsGrid />
      </div>
    </div>
  );
}