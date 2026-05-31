import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { jsPDF } from 'npm:jspdf@4.0.0';

/**
 * Generates a property contract PDF and sends it via DocuSign.
 *
 * Body: {
 *   lead_id: string,
 *   property_id: string,
 *   contract_type: "SPA" | "Tenancy Agreement" | "MOU" | "LOI",
 *   signer_name: string,
 *   signer_email: string,
 *   agent_name: string,
 *   agent_email: string,
 *   agreed_price_aed?: number,
 *   notes?: string,
 * }
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const {
      lead_id, property_id, contract_type = 'MOU',
      signer_name, signer_email,
      agent_name, agent_email,
      agreed_price_aed, notes,
    } = body;

    if (!lead_id || !signer_name || !signer_email) {
      return Response.json({ error: 'lead_id, signer_name, signer_email required' }, { status: 400 });
    }

    // Fetch lead and property
    const leads = await base44.asServiceRole.entities.Lead.filter({ id: lead_id });
    const lead = leads[0] || {};

    let property = null;
    if (property_id) {
      const props = await base44.asServiceRole.entities.Property.filter({ id: property_id });
      property = props[0] || null;
    }

    const today = new Date().toLocaleDateString('en-AE', { day: '2-digit', month: 'long', year: 'numeric' });
    const refNo = `PROP-${Date.now().toString(36).toUpperCase()}`;
    const price = agreed_price_aed || lead.deal_value_aed || (property?.price_aed) || 0;
    const priceFormatted = price ? `AED ${Number(price).toLocaleString()}` : 'As agreed';

    // ─── Build PDF ───
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const W = 210;
    const marginL = 20;
    const marginR = W - 20;
    let y = 20;

    const ln = (height = 6) => { y += height; };
    const text = (str, x, size = 10, style = 'normal', align = 'left') => {
      doc.setFontSize(size);
      doc.setFont('helvetica', style);
      doc.text(str, x, y, { align });
    };
    const line = () => { doc.setDrawColor(200, 200, 200); doc.line(marginL, y, marginR, y); ln(4); };

    // Header
    doc.setFillColor(15, 20, 40);
    doc.rect(0, 0, W, 35, 'F');
    doc.setTextColor(245, 158, 11);
    doc.setFontSize(18); doc.setFont('helvetica', 'bold');
    doc.text(contract_type.toUpperCase(), W / 2, 16, { align: 'center' });
    doc.setFontSize(9); doc.setFont('helvetica', 'normal');
    doc.setTextColor(200, 200, 200);
    doc.text('DUBAI REAL ESTATE — CONFIDENTIAL', W / 2, 24, { align: 'center' });
    doc.setTextColor(150, 150, 150);
    doc.text(`Ref: ${refNo}   |   Date: ${today}`, W / 2, 30, { align: 'center' });

    y = 45;
    doc.setTextColor(30, 30, 30);

    // Section helper
    const section = (title) => {
      ln(4);
      doc.setFillColor(245, 158, 11);
      doc.rect(marginL, y - 4, 4, 6, 'F');
      doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 30, 30);
      doc.text(title, marginL + 7, y);
      ln(3);
      doc.setDrawColor(245, 158, 11, 0.3);
      doc.line(marginL, y, marginR, y);
      ln(5);
    };

    const row = (label, value) => {
      doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(100, 100, 100);
      doc.text(label, marginL, y);
      doc.setFont('helvetica', 'normal'); doc.setTextColor(30, 30, 30);
      doc.text(value || '—', marginL + 55, y);
      ln(6);
    };

    // PARTIES
    section('PARTIES');
    row('Buyer / Tenant Name:', signer_name);
    row('Buyer / Tenant Email:', signer_email);
    row('Buyer Phone:', lead.phone || '—');
    row('Buyer Nationality:', lead.nationality || '—');
    row('Agent Name:', agent_name || user.full_name || '—');
    row('Agent Email:', agent_email || user.email || '—');

    // PROPERTY DETAILS
    section('PROPERTY DETAILS');
    if (property) {
      row('Property Title:', property.title || '—');
      row('Location / Community:', property.location || '—');
      row('Building:', property.building_name || '—');
      row('Property Type:', property.property_type || '—');
      row('Bedrooms:', property.bedrooms !== undefined ? String(property.bedrooms) : '—');
      row('Area (sqft):', property.area_sqft ? property.area_sqft.toLocaleString() : '—');
      row('Furnishing:', property.furnishing || '—');
      row('Permit No.:', property.permit_number || '—');
    } else {
      row('Property:', 'As per verbal / written agreement');
      row('Location:', (lead.preferred_locations || []).join(', ') || '—');
    }

    // FINANCIAL TERMS
    section('FINANCIAL TERMS');
    row('Agreed Price / Rent:', priceFormatted);
    row('Financing Method:', lead.financing_method || '—');
    row('Move-in Timeline:', lead.move_in_timeline || '—');

    // TERMS
    section('TERMS & CONDITIONS');
    doc.setFontSize(8.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(70, 70, 70);
    const terms = [
      '1. This document constitutes a preliminary agreement and is subject to final contract execution.',
      '2. All transactions are subject to Dubai Land Department regulations and applicable UAE law.',
      '3. Commission and fees are as per the agency agreement and Dubai Real Estate Regulatory Agency (RERA) guidelines.',
      '4. The buyer/tenant confirms they have the authority to enter into this agreement.',
      '5. This agreement is valid for 30 days from the date of signing.',
    ];
    terms.forEach(t => {
      const lines = doc.splitTextToSize(t, marginR - marginL);
      doc.text(lines, marginL, y);
      ln(lines.length * 5 + 2);
    });

    if (notes) {
      ln(2);
      doc.setFont('helvetica', 'bolditalic');
      doc.text('Additional Notes:', marginL, y); ln(5);
      doc.setFont('helvetica', 'normal');
      const noteLines = doc.splitTextToSize(notes, marginR - marginL);
      doc.text(noteLines, marginL, y);
      ln(noteLines.length * 5 + 4);
    }

    // SIGNATURE BLOCKS
    ln(8);
    doc.setDrawColor(200); doc.line(marginL, y, marginL + 60, y);
    doc.line(W / 2 + 10, y, W / 2 + 70, y);
    ln(5);
    doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(100);
    doc.text(`${signer_name}`, marginL, y);
    doc.text(agent_name || 'Agent', W / 2 + 10, y);
    ln(4);
    doc.text('Buyer / Tenant  /sn1/', marginL, y);
    doc.text('Agent  /sn2/', W / 2 + 10, y);
    ln(4);
    doc.text('Date: /dt1/', marginL, y);
    doc.text('Date: /dt2/', W / 2 + 10, y);

    // Footer
    doc.setFontSize(7); doc.setTextColor(180);
    doc.text(`Generated by PropCRM · ${today} · Ref: ${refNo}`, W / 2, 287, { align: 'center' });

    // Export PDF as base64 data URL
    const pdfBase64 = doc.output('datauristring'); // data:application/pdf;base64,...
    const base64Data = pdfBase64.split(',')[1];
    const pdfBlob = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));

    // Upload PDF
    const formData = new FormData();
    formData.append('file', new Blob([pdfBlob], { type: 'application/pdf' }), `${contract_type.replace(/ /g, '_')}_${refNo}.pdf`);

    const uploadRes = await base44.integrations.Core.UploadFile({ file: new Blob([pdfBlob], { type: 'application/pdf' }) });
    const pdf_url = uploadRes.file_url;
    if (!pdf_url) throw new Error('Failed to upload contract PDF');

    // Send via DocuSign
    const signers = [
      { role: 'buyer', name: signer_name, email: signer_email },
      { role: 'agent',  name: agent_name || user.full_name, email: agent_email || user.email },
    ];

    const dsRes = await base44.functions.invoke('docusignSendForSignature', {
      form_type: contract_type,
      pdf_url,
      subject: `${contract_type} – ${property?.title || 'Property Agreement'} – Please Sign`,
      message: `Dear ${signer_name}, please review and sign the attached ${contract_type}. Ref: ${refNo}`,
      signers,
      lead_id,
      property_id: property_id || null,
    });

    return Response.json({
      ok: true,
      ref: refNo,
      pdf_url,
      docusign: dsRes,
      contract_type,
      price: priceFormatted,
    });
  } catch (error) {
    console.error('generateAndSendContract:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});