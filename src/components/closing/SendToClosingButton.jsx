import { useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import NewClosingDialog from './NewClosingDialog';

/**
 * Drop-in "Send to Closing" button that can be placed on any lead/landlord card or detail panel.
 * Props:
 *   leadId          - if coming from buyer pipeline
 *   landlordId      - if coming from seller pipeline
 *   propertyRef     - optional pre-fill
 *   size            - 'sm' | 'xs' (default 'sm')
 */
export default function SendToClosingButton({ leadId, landlordId, propertyRef, size = 'sm' }) {
  const [open, setOpen] = useState(false);

  const isXs = size === 'xs';

  return (
    <>
      <button
        onClick={e => { e.stopPropagation(); setOpen(true); }}
        className="inline-flex items-center gap-1 font-semibold transition-all active:scale-95 rounded-lg"
        style={{
          padding: isXs ? '4px 8px' : '6px 12px',
          fontSize: isXs ? '10px' : '11px',
          background: 'rgba(34,197,94,0.12)',
          border: '1px solid rgba(34,197,94,0.3)',
          color: '#4ade80',
        }}
        title="Send to Closing Hub"
      >
        <ArrowUpRight className={isXs ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
        {isXs ? 'Closing' : 'Send to Closing'}
      </button>

      <NewClosingDialog
        open={open}
        onClose={() => setOpen(false)}
        prefillLeadId={leadId}
        prefillLandlordId={landlordId}
        prefillPropertyRef={propertyRef}
        onSaved={() => setOpen(false)}
      />
    </>
  );
}