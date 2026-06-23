import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { useCurrentUser } from '@/lib/useCurrentUser';
import FormAUploadDialog from '@/components/landlord/FormAUploadDialog';
import ListingManagerAssignDialog from '@/components/landlord/ListingManagerAssignDialog';
import { Calendar } from 'lucide-react';
import AIIntelligenceCard from '@/components/landlord/AIIntelligenceCard';
import LandlordDetailPanels from '@/components/landlord/LandlordDetailPanels';

function useQ(key, fn, extra = {}) {
  return useQuery({ queryKey: key, queryFn: fn, retry: false, staleTime: 30000, ...extra });
}

const STAGE_KEYS = [
  'initial_contact','price_discovery','listing_commitment','form_a_initiation','form_a_signing',
  'owner_documents','photos_videos','photographer_scheduling','listing_creation','internal_verification',
  'listing_publication','final_confirmation','marketing_agents','marketing_network','open_house',
  'client_blast','deal_closed',
];

const initialsOf = (name) => String(name || '?').trim().split(/\s+/).map(w => w[0]).slice(0,2).join('').toUpperCase();
const safe = async (fn) => { try { return (await fn()) || []; } catch { return []; } };

export default function LandlordDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user: currentUser } = useCurrentUser();
  const [formADialogOpen, setFormADialogOpen] = useState(false);
  const [listingManagerDialogOpen, setListingManagerDialogOpen] = useState(false);
  const [openMediaDrawers, setOpenMediaDrawers] = useState(new Set());
  const [openOwnerDrawers, setOpenOwnerDrawers] = useState(new Set());
  const [mediaInputs, setMediaInputs] = useState({});
  const [openSections, setOpenSections] = useState({ callHistory: false, commission: false });

  const toggleSection = (section) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const { data: L, isLoading, refetch: refetchLandlord } = useQ(['landlord', id], () => base44.entities.Landlord.get(id), { enabled: !!id });

  const handleFormASuccess = () => {
    refetchLandlord();
    setFormADialogOpen(false);
  };

  const handleListingManagerSuccess = () => {
    refetchLandlord();
    setListingManagerDialogOpen(false);
  };

  const toggleMediaDrawer = (key) => {
    setOpenMediaDrawers(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleOwnerDrawer = (key) => {
    setOpenOwnerDrawers(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleMediaUpdate = async (field, value) => {
    try {
      await base44.entities.Landlord.update(id, { [field]: value });
      refetchLandlord();
    } catch (err) {
      console.error('Failed to update media field:', err);
    }
  };

  const handleAddMediaUrl = (field) => {
    const url = mediaInputs[field]?.trim();
    if (url) {
      handleMediaUpdate(field, url);
      setMediaInputs(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleRemoveMediaUrl = (field) => {
    handleMediaUpdate(field, null);
  };
  
  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!L) {
    return <div>Landlord not found.</div>;
  }
  
  const vm = {
      // This is where the viewModel logic will go.
  };

  return (
    <React.Fragment>
      <div style={{display: 'flex', height: '100vh'}}>
          <div style={{flex: 1, overflowY: 'auto'}}>
            {/* This will be the left panel for chat/activity */}
          </div>
          <LandlordDetailPanels 
            L={L} 
            vm={vm} 
            openSections={openSections} 
            toggleSection={toggleSection} 
            onNavigate={navigate}
            openMediaDrawers={openMediaDrawers}
            toggleMediaDrawer={toggleMediaDrawer}
            mediaInputs={mediaInputs}
            setMediaInputs={setMediaInputs}
            handleAddMediaUrl={handleAddMediaUrl}
            handleRemoveMediaUrl={handleRemoveMediaUrl}
            handleMediaUpdate={handleMediaUpdate}
            openOwnerDrawers={openOwnerDrawers}
            toggleOwnerDrawer={toggleOwnerDrawer}
          />
      </div>
      <FormAUploadDialog
        open={formADialogOpen}
        onClose={() => setFormADialogOpen(false)}
        onSuccess={handleFormASuccess}
      />
      <ListingManagerAssignDialog
        open={listingManagerDialogOpen}
        onClose={() => setListingManagerDialogOpen(false)}
        onSuccess={handleListingManagerSuccess}
        landlordId={id}
        currentListingManager={L?.listing_manager_email || null}
      />
    </React.Fragment>
  );
}