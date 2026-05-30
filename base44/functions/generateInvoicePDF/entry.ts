// generateInvoicePDF — persist the PDF URL for an invoice.
//
// Today: the client renders the PDF with jsPDF and uploads it to Base44 file
// storage via Core.UploadFile, then calls this function with the returned
// file_url. This function validates the call, writes pdf_url back onto the
// Invoice via asServiceRole, and returns the resolved URL.
//
// Tomorrow (Google Drive): once a service-account JSON + Drive folder id land
// in env (e.g. GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON, GOOGLE_DRIVE_INVOICES_FOLDER_ID),
// the Drive upload step lives here — fetch bytes from `file_url`, push to the
// Drive folder (idempotent: replace via files.update when a previous drive file
// id is known), and overwrite `pdf_url` with the Drive link. The client does
// not change.
//
// Idempotency today: regenerating overwrites Invoice.pdf_url with the latest
// upload. Previous storage objects become orphans — acceptable until Drive,
// where files.update gives true in-place replacement.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Auth — match the rest of the function suite. Falls through if SDK already
    // gates by createClientFromRequest, but explicit is safer.
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const invoice_id = body?.invoice_id;
    const file_url = body?.file_url;
    const file_name = body?.file_name || null;

    if (!invoice_id) {
      return Response.json({ error: 'invoice_id is required' }, { status: 400 });
    }
    if (!file_url || typeof file_url !== 'string' || !file_url.trim()) {
      return Response.json({ error: 'file_url is required' }, { status: 400 });
    }

    // Make sure the invoice actually exists before writing — return 404 if not.
    const invoice = await base44.asServiceRole.entities.Invoice.get(invoice_id);
    if (!invoice) {
      return Response.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // ── DRIVE SWAP SEAM ────────────────────────────────────────────────────
    // When Google Drive credentials land, do the upload here:
    //   const driveLink = await uploadToDrive(file_url, file_name, invoice);
    //   pdf_url = driveLink;
    // For now, the Base44 storage URL is the canonical pdf_url.
    const pdf_url = file_url;

    await base44.asServiceRole.entities.Invoice.update(invoice_id, { pdf_url });

    return Response.json({
      success: true,
      invoice_id,
      pdf_url,
      file_name,
    });
  } catch (error) {
    return Response.json(
      { error: (error as Error).message || 'Unknown error' },
      { status: 500 },
    );
  }
});
