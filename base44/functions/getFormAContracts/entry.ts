// getFormAContracts - Lightweight function to fetch Form A contracts for dashboard
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Fetch landlords with Form A contracts
    const landlords = await base44.entities.Landlord.list('-created_date', 200);
    const landlordsWithFormA = landlords.filter(ll => ll.form_a_contracts && ll.form_a_contracts.length > 0);
    
    const formAContracts = [];
    landlordsWithFormA.forEach(ll => {
      ll.form_a_contracts.forEach(contract => {
        formAContracts.push({
          id: ll.id + '_' + (contract.contract_number || ''),
          landlord_id: ll.id,
          landlord_name: ll.full_name_en || ll.full_name || 'Unknown',
          contract_number: contract.contract_number || 'N/A',
          unit: contract.unit || 'N/A',
          mandate_type: contract.mandate_type || 'N/A',
          mandate_status: contract.mandate_status || 'N/A',
          mandate_start_date: contract.mandate_start_date,
          mandate_expires_at: contract.mandate_expires_at,
          asking_price_aed: contract.asking_price_aed,
          commission_pct: ll.commission_pct_negotiated,
          pdf_url: contract.pdf_url,
          status: contract.mandate_status === 'form_a_signed' ? 'Active' : 'Draft',
        });
      });
    });
    
    // Sort by most recent and return top 5
    formAContracts.sort((a, b) => {
      const dateA = a.mandate_start_date ? new Date(a.mandate_start_date).getTime() : 0;
      const dateB = b.mandate_start_date ? new Date(b.mandate_start_date).getTime() : 0;
      return dateB - dateA;
    });
    
    return Response.json({
      contracts: formAContracts.slice(0, 5),
      total: formAContracts.length,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});