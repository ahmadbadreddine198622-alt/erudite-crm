// getDocumentsDashboardSummary — Returns document checklist stats
// Shows: document completion by type, pending vs received, recent uploads

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Fetch all document checklist items
    const allDocs = await base44.entities.DocumentChecklistItem.list('-created_date', 500);
    
    // Count by status
    const statusCounts = {
      received: 0,
      requested: 0,
      verified: 0,
      missing: 0,
    };
    allDocs.forEach(doc => {
      const status = doc.status || 'missing';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });

    // Count by document type
    const typeCounts = {};
    allDocs.forEach(doc => {
      const type = doc.document_type || 'unknown';
      typeCounts[type] = (typeCounts[type] || 0) + 1;
    });

    // Recent documents with landlord info
    const recentDocs = allDocs.slice(0, 10);
    const landlordIds = recentDocs.map(d => d.landlord_id).filter(Boolean);
    const landlords = await base44.entities.Landlord.filter({ id: { $in: landlordIds } });
    const landlordMap = {};
    landlords.forEach(ll => landlordMap[ll.id] = ll);

    const docsWithLandlords = recentDocs.map(doc => ({
      ...doc,
      landlord_name: landlordMap[doc.landlord_id]?.full_name_en || landlordMap[doc.landlord_id]?.full_name || 'Unknown',
      type_label: (doc.document_type || '').replace(/_/g, ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
    }));

    // Calculate completion rate (received + verified) / total
    const completed = statusCounts.received + statusCounts.verified;
    const total = allDocs.length;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    return Response.json({
      statusCounts,
      typeCounts,
      totalDocs: total,
      completionRate,
      recentDocs: docsWithLandlords,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});