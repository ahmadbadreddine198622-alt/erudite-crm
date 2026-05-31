/**
 * TenancyContractPDF.jsx
 * Generates a PDF that replicates the official Dubai Ejari Unified Tenancy Contract.
 * Structure mirrors: https://dubailand.gov.ae/media/nijhtrss/ejari_unified_tenancy_contract.pdf
 */

import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { FileText, Loader2, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import { fmtDate, sanitizeFileSegment } from '@/lib/pdfBrand';

// ─── Helpers ─────────────────────────────────────────────────────────────────
const A4W = 210;
const PAD = 10;
const COL = A4W - PAD * 2; // 190mm usable width

function drawSectionHeader(doc, y, textEn, textAr) {
  doc.setFillColor(220, 220, 220);
  doc.rect(PAD, y, COL, 6, 'F');
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.rect(PAD, y, COL, 6, 'S');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(0, 0, 0);
  doc.text(textEn, PAD + 2, y + 4.2);
  doc.text(textAr, PAD + COL - 2, y + 4.2, { align: 'right' });
  return y + 6;
}

function drawFieldRow(doc, y, h, fields) {
  // fields: [{labelEn, labelAr, value, w}] — w is fraction of COL
  let x = PAD;
  const totalFrac = fields.reduce((s, f) => s + (f.w || 1), 0);
  fields.forEach(f => {
    const fw = (f.w / totalFrac) * COL;
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.2);
    doc.rect(x, y, fw, h, 'S');
    // label bilingual
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(80, 80, 80);
    doc.text(f.labelEn || '', x + 1.5, y + 3.5);
    if (f.labelAr) {
      doc.text(f.labelAr, x + fw - 1.5, y + 3.5, { align: 'right' });
    }
    // value
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);
    const val = f.value != null && f.value !== '' ? String(f.value) : '';
    if (val) {
      const lines = doc.splitTextToSize(val, fw - 3);
      doc.text(lines[0], x + 1.5, y + h - 2);
    }
    x += fw;
  });
  return y + h;
}

// ─── Terms & Conditions ──────────────────────────────────────────────────────
const TERMS = [
  'The tenant has inspected the premises and agreed to lease the unit on its current condition.',
  'Tenant undertakes to use the premises for designated purpose, tenant has no rights to transfer or relinquish the tenancy contract either with or without counterparty to any without landlord written approval. Also, tenant is not allowed to sublease the premises or any part thereof to third party in whole or in part unless it is legally permitted.',
  'The tenant undertakes not to make any amendments, modifications or additions to the premises subject of the contract without obtaining the landlord written approval. Tenant shall be liable for any damages or failure due to that.',
  'The tenant shall be responsible for payment of all electricity, water, cooling and gas charges resulting of occupying leased unit unless other condition agreed in written.',
  'The tenant must pay the rent amount in the manner and dates agreed with the landlord.',
  'The tenant fully undertakes to comply with all the regulations and instructions related to the management of the property and the use of the premises and of common areas such (parking, swimming pools, gymnasium, etc.).',
  'Tenancy contract parties declare all mentioned emails addresses and phone numbers are correct, all formal and legal notifications will be sent to those addresses in case of dispute between parties.',
  'The landlord undertakes to enable the tenant of the full use of the premises including its facilities (swimming pool, gym, parking lot, etc) and do the regular maintenance as intended unless other condition agreed in written, and not to do any act that would detract from the premises benefit.',
  'By signing this agreement from the first party, the "Landlord" hereby confirms and undertakes that he is the current owner of the property or his legal representative under legal power of attorney duly entitled by the competent authorities.',
  'Any disagreement or dispute may arise from execution or interpretation of this contract shall be settled by the Rental Dispute Center.',
  'This contract is subject to all provisions of Law No (26) of 2007 regulation the relation between landlords and tenants in the emirate of Dubai as amended, and as it will be changed or amended from time to time, as long with any related legislations and regulations applied in the emirate of Dubai.',
  'Any additional condition will not be considered in case it conflicts with law.',
  'In case of discrepancy occurs between Arabic and non Arabic texts with regards to the interpretation of this agreement or the scope of its application, the Arabic text shall prevail.',
  'The landlord undertakes to register this tenancy contract on EJARI affiliated to Dubai Land Department and provide with all required documents.',
];

// ─── Main Builder ─────────────────────────────────────────────────────────────
export async function buildTenancyContractPDF(contract) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  let y = PAD;

  // ── PAGE 1 BORDER ──────────────────────────────────────────────────────────
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.5);
  doc.rect(PAD - 3, PAD - 3, A4W - (PAD - 3) * 2, 297 - (PAD - 3) * 2, 'S');

  // ── HEADER ─────────────────────────────────────────────────────────────────
  doc.setFillColor(0, 0, 0);
  doc.rect(PAD, y, COL, 9, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text('TENANCY CONTRACT', A4W / 2, y + 6.2, { align: 'center' });
  y += 9;

  // Date row
  y = drawFieldRow(doc, y, 8, [
    { labelEn: 'Date', labelAr: 'التاريخ', value: contract.contract_date ? fmtDate(contract.contract_date) : '', w: 1 },
  ]);

  y += 2;

  // ── OWNER / LESSOR ─────────────────────────────────────────────────────────
  y = drawSectionHeader(doc, y, 'Owner / Lessor Information', 'المؤجر/معلومات المالك');
  y = drawFieldRow(doc, y, 9, [
    { labelEn: "Owner's Name", labelAr: 'اسم المالك', value: contract.owner_name, w: 1 },
  ]);
  y = drawFieldRow(doc, y, 9, [
    { labelEn: "Lessor's Name", labelAr: 'اسم المؤجر', value: contract.lessor_name, w: 1 },
  ]);
  y = drawFieldRow(doc, y, 9, [
    { labelEn: "Lessor's Emirates ID", labelAr: 'الهوية الإماراتية للمؤجر', value: contract.lessor_emirates_id, w: 1 },
  ]);
  y = drawFieldRow(doc, y, 9, [
    { labelEn: 'License No. (if Company)', labelAr: 'رقم الرخصة', value: contract.lessor_license_no, w: 1 },
    { labelEn: 'Licensing Authority', labelAr: 'سلطة الترخيص', value: contract.lessor_licensing_authority, w: 1 },
  ]);
  y = drawFieldRow(doc, y, 9, [
    { labelEn: 'Lessor Email', labelAr: 'البريد الإلكتروني', value: contract.lessor_email, w: 1 },
    { labelEn: 'Lessor Phone', labelAr: 'الهاتف', value: contract.lessor_phone, w: 1 },
  ]);

  y += 2;

  // ── TENANT ─────────────────────────────────────────────────────────────────
  y = drawSectionHeader(doc, y, 'Tenant Information', 'معلومات المستأجر');
  y = drawFieldRow(doc, y, 9, [
    { labelEn: "Tenant's Name", labelAr: 'اسم المستأجر', value: contract.tenant_name, w: 1 },
  ]);
  y = drawFieldRow(doc, y, 9, [
    { labelEn: "Tenant's Emirates ID", labelAr: 'الهوية الإماراتية للمستأجر', value: contract.tenant_emirates_id, w: 1 },
  ]);
  y = drawFieldRow(doc, y, 9, [
    { labelEn: 'License No. (if Company)', labelAr: 'رقم الرخصة', value: contract.tenant_license_no, w: 1 },
    { labelEn: 'Licensing Authority', labelAr: 'سلطة الترخيص', value: contract.tenant_licensing_authority, w: 1 },
  ]);
  y = drawFieldRow(doc, y, 9, [
    { labelEn: "Tenant's Email", labelAr: 'البريد الإلكتروني', value: contract.tenant_email, w: 1 },
    { labelEn: "Tenant's Phone", labelAr: 'الهاتف', value: contract.tenant_phone, w: 1 },
  ]);

  y += 2;

  // ── PROPERTY ───────────────────────────────────────────────────────────────
  y = drawSectionHeader(doc, y, 'Property Information', 'معلومات العقار');
  y = drawFieldRow(doc, y, 9, [
    { labelEn: 'Plot No.', labelAr: 'رقم القطعة', value: contract.plot_no, w: 1 },
    { labelEn: 'Makani No.', labelAr: 'رقم مكاني', value: contract.makani_no, w: 1 },
    { labelEn: 'Location', labelAr: 'الموقع', value: contract.location, w: 2 },
  ]);
  y = drawFieldRow(doc, y, 9, [
    { labelEn: 'Building Name', labelAr: 'اسم المبنى', value: contract.building_name, w: 2 },
    { labelEn: 'Property Type', labelAr: 'نوع العقار', value: contract.property_type, w: 1 },
    { labelEn: 'Property No.', labelAr: 'رقم الوحدة', value: contract.property_no, w: 1 },
  ]);
  y = drawFieldRow(doc, y, 9, [
    { labelEn: 'Area (sqm)', labelAr: 'المساحة (م²)', value: contract.property_area_sqm, w: 1 },
    { labelEn: 'DEWA Premises No.', labelAr: 'رقم مبنى ديوا', value: contract.dewa_premises_no, w: 1 },
    { labelEn: 'Usage', labelAr: 'الاستخدام', value: contract.property_usage, w: 1 },
  ]);
  y = drawFieldRow(doc, y, 9, [
    { labelEn: 'Contract Period From', labelAr: 'فترة العقد من', value: contract.contract_period_from ? fmtDate(contract.contract_period_from) : '', w: 1 },
    { labelEn: 'Contract Period To', labelAr: 'إلى', value: contract.contract_period_to ? fmtDate(contract.contract_period_to) : '', w: 1 },
    { labelEn: 'Contract Value (AED)', labelAr: 'قيمة العقد', value: contract.contract_value_aed != null ? `AED ${Number(contract.contract_value_aed).toLocaleString('en-AE')}` : '', w: 1 },
  ]);
  y = drawFieldRow(doc, y, 9, [
    { labelEn: 'Annual Rent (AED)', labelAr: 'الإيجار السنوي', value: contract.annual_rent_aed != null ? `AED ${Number(contract.annual_rent_aed).toLocaleString('en-AE')}` : '', w: 1 },
    { labelEn: 'Security Deposit (AED)', labelAr: 'مبلغ التأمين', value: contract.security_deposit_aed != null ? `AED ${Number(contract.security_deposit_aed).toLocaleString('en-AE')}` : '', w: 1 },
    { labelEn: 'Mode of Payment', labelAr: 'طريقة الدفع', value: contract.mode_of_payment, w: 1 },
  ]);

  y += 4;

  // ── SIGNATURES (Page 1 bottom) ─────────────────────────────────────────────
  y = drawSectionHeader(doc, y, 'Signatures', 'التوقيعات');
  y = drawFieldRow(doc, y, 18, [
    { labelEn: 'Lessor Signature', labelAr: 'توقيع المؤجر', value: '', w: 1 },
    { labelEn: 'Tenant Signature', labelAr: 'توقيع المستأجر', value: '', w: 1 },
  ]);

  // ── PAGE 2 ─────────────────────────────────────────────────────────────────
  doc.addPage();
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.5);
  doc.rect(PAD - 3, PAD - 3, A4W - (PAD - 3) * 2, 297 - (PAD - 3) * 2, 'S');

  y = PAD;

  // T&C header
  doc.setFillColor(0, 0, 0);
  doc.rect(PAD, y, COL, 7, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text('Terms and Conditions', A4W / 2, y + 4.8, { align: 'center' });
  y += 7 + 3;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(0, 0, 0);

  TERMS.forEach((term, i) => {
    const num = `${i + 1}. `;
    const lines = doc.splitTextToSize(num + term, COL - 4);
    const blockH = lines.length * 3.8 + 2;
    if (y + blockH > 280) {
      doc.addPage();
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.5);
      doc.rect(PAD - 3, PAD - 3, A4W - (PAD - 3) * 2, 297 - (PAD - 3) * 2, 'S');
      y = PAD;
    }
    doc.text(lines, PAD + 2, y);
    y += blockH;
  });

  y += 4;

  // ── KNOW YOUR RIGHTS ───────────────────────────────────────────────────────
  if (y + 20 > 280) { doc.addPage(); y = PAD; }
  doc.setFillColor(220, 220, 220);
  doc.rect(PAD, y, COL, 6, 'F');
  doc.setDrawColor(0); doc.rect(PAD, y, COL, 6, 'S');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5);
  doc.setTextColor(0);
  doc.text('Know Your Rights', PAD + 2, y + 4.2);
  doc.text('لمعرفة حقوق الأطراف', PAD + COL - 2, y + 4.2, { align: 'right' });
  y += 6 + 2;

  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);
  const rights = [
    'You may visit Rental Dispute Center website through www.dubailand.gov.ae in case of any rental dispute between parties.',
    'Law No 26 of 2007 regulating relationship between landlords and tenants.',
    'Law No 43 of 2013 determining rent increases for properties.',
  ];
  rights.forEach(r => {
    const lines = doc.splitTextToSize(`• ${r}`, COL - 4);
    doc.text(lines, PAD + 2, y);
    y += lines.length * 3.8 + 1.5;
  });

  y += 4;

  // ── ATTACHMENTS ────────────────────────────────────────────────────────────
  if (y + 20 > 280) { doc.addPage(); y = PAD; }
  doc.setFillColor(220, 220, 220);
  doc.rect(PAD, y, COL, 6, 'F');
  doc.setDrawColor(0); doc.rect(PAD, y, COL, 6, 'S');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(0);
  doc.text('Attachments for Ejari Registration', PAD + 2, y + 4.2);
  doc.text('مرفقات التسجيل في إيجاري', PAD + COL - 2, y + 4.2, { align: 'right' });
  y += 6 + 2;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);
  doc.text('1. Original unified tenancy contract', PAD + 2, y); y += 4.5;
  doc.text('2. Original emirates ID of applicant', PAD + 2, y); y += 4.5;

  y += 4;

  // ── ADDITIONAL TERMS ───────────────────────────────────────────────────────
  if (y + 35 > 280) { doc.addPage(); y = PAD; }
  doc.setFillColor(220, 220, 220);
  doc.rect(PAD, y, COL, 6, 'F');
  doc.setDrawColor(0); doc.rect(PAD, y, COL, 6, 'S');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(0);
  doc.text('Additional Terms', PAD + 2, y + 4.2);
  doc.text('شروط إضافية', PAD + COL - 2, y + 4.2, { align: 'right' });
  y += 6;
  for (let i = 1; i <= 5; i++) {
    doc.setDrawColor(0); doc.rect(PAD, y, COL, 7, 'S');
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(100);
    doc.text(`${i}.`, PAD + 2, y + 4.5);
    y += 7;
  }

  y += 4;

  // ── FINAL SIGNATURES ───────────────────────────────────────────────────────
  if (y + 25 > 280) { doc.addPage(); y = PAD; }
  y = drawSectionHeader(doc, y, 'Signatures', 'التوقيعات');
  y = drawFieldRow(doc, y, 8, [
    { labelEn: 'Date', labelAr: 'التاريخ', value: '', w: 1 },
  ]);
  y = drawFieldRow(doc, y, 20, [
    { labelEn: 'Lessor Signature', labelAr: 'توقيع المؤجر', value: '', w: 1 },
    { labelEn: 'Tenant Signature', labelAr: 'توقيع المستأجر', value: '', w: 1 },
  ]);

  // Footer note
  y += 3;
  doc.setFont('helvetica', 'italic'); doc.setFontSize(6.5); doc.setTextColor(100);
  doc.text('Note: An annex may be added to this contract in case of any additional terms, to be signed by contracting parties.', PAD, y);

  return doc;
}

// ─── Button Component ─────────────────────────────────────────────────────────
export function GenerateTenancyPDFButton({ contract }) {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    try {
      const doc = await buildTenancyContractPDF(contract);
      const fileName = `TenancyContract_${sanitizeFileSegment(contract.tenant_name || 'contract')}_${contract.contract_date || 'undated'}.pdf`;

      let finalUrl;
      let uploadedToDrive = false;

      try {
        const base64Data = doc.output('datauristring').split(',')[1];
        const driveUpload = await base44.functions.invoke('uploadToGoogleDrive', {
          base64Content: base64Data,
          fileName,
          folderPath: 'Tenancy Contracts',
          mimeType: 'application/pdf',
        });
        if (driveUpload?.data?.file_url) {
          finalUrl = driveUpload.data.file_url;
          uploadedToDrive = true;
        }
      } catch { /* fallback below */ }

      if (!finalUrl) {
        const blob = doc.output('blob');
        const file = new File([blob], fileName, { type: 'application/pdf' });
        const uploadRes = await base44.integrations.Core.UploadFile({ file });
        finalUrl = uploadRes?.file_url;
      }

      if (finalUrl && contract.id) {
        await base44.entities.TenancyContract.update(contract.id, {
          pdf_url: finalUrl,
          status: 'generated',
          generated_at: new Date().toISOString(),
        });
      }

      doc.save(fileName);
      toast.success(uploadedToDrive ? 'Saved to Google Drive & downloaded' : 'PDF downloaded');
      queryClient.invalidateQueries({ queryKey: ['tenancy-contracts'] });
    } catch (err) {
      toast.error('PDF generation failed', { description: err?.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button size="sm" variant="outline" onClick={handleClick} disabled={loading} className="gap-1 h-8">
      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
      {contract.pdf_url ? 'Regenerate PDF' : 'Generate PDF'}
    </Button>
  );
}

export function ViewTenancyPDFLink({ contract }) {
  if (!contract.pdf_url) return null;
  return (
    <a href={contract.pdf_url} target="_blank" rel="noopener noreferrer">
      <Button size="sm" variant="ghost" className="gap-1 h-8 text-accent hover:text-accent">
        <ExternalLink className="w-3.5 h-3.5" /> View PDF
      </Button>
    </a>
  );
}