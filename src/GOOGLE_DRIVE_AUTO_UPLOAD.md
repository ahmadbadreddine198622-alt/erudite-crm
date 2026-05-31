# Google Drive Auto-Upload Configuration

## Overview
All PDFs generated in PropCRM are now automatically uploaded to your Google Drive account.

## Connected Account
- **Email:** ahmad@erudite-estate.com
- **Folder:** PropCRM PDFs
- **Folder ID:** 1LP6V2mXUn-kammy_z7XSg4xVij-2cpX1
- **Access:** https://drive.google.com/drive/folders/1LP6V2mXUn-kammy_z7XSg4xVij-2cpX1

## PDFs Automatically Uploaded

### 1. Invoices
- **Function:** `generateInvoicePDF`
- **Trigger:** When invoice PDF is generated
- **Includes:** Tax invoices, payment receipts

### 2. Contracts
- **Function:** `generateAndSendContract`
- **Trigger:** When contract PDF is generated (SPA, Tenancy, MOU, LOI)
- **Includes:** Buyer/tenant agreements, agent contracts

### 3. Lease Agreements
- **Function:** `generateLeaseBrokerageAgreement`
- **Trigger:** When Form A / Lease Brokerage Agreement is generated
- **Includes:** RERA Form A, landlord agreements

## How It Works

1. **PDF Generated** → Function creates PDF using jsPDF
2. **Upload to Base44** → PDF uploaded to Base44 file storage (fallback)
3. **Upload to Drive** → PDF uploaded to "PropCRM PDFs" folder in Google Drive
4. **URL Stored** → Google Drive link stored in entity record (Invoice.pdf_url, etc.)
5. **Accessible** → PDF available in both Base44 and Google Drive

## File Naming

Files are automatically named based on their type:
- **Invoices:** `Invoice-{invoice_number}.pdf`
- **Contracts:** `{contract_type}-{reference}.pdf`
- **Lease Agreements:** `LeaseBrokerageAgreement-{owner_name}-{ref}.pdf`

## Access PDFs

### In CRM
- View PDF links directly in Invoice, Contract, or Landlord records
- Click to open Google Drive link

### In Google Drive
1. Go to https://drive.google.com/drive/folders/1LP6V2mXUn-kammy_z7XSg4xVij-2cpX1
2. Or navigate to: My Drive → PropCRM PDFs
3. All PDFs are organized chronologically

### In Google Drive Page
- Visit `/google-drive` in your CRM
- Search, view, and download all synced PDFs
- Real-time sync with Google Drive

## Fallback Behavior

If Google Drive upload fails:
- PDF still uploads to Base44 storage
- System logs error to console
- CRM continues to function normally
- PDF accessible via Base44 URL

## Integration Status

✅ Google Drive connector authorized
✅ "PropCRM PDFs" folder created
✅ Auto-upload enabled for all PDF functions
✅ Fallback to Base44 storage configured
✅ Google Drive page available at `/google-drive`

## Notes

- Google Drive is **separate** from Vapi (AI calling platform)
- Google Drive is for **document storage only**
- All uploads are **automatic** - no manual action needed
- PDFs are stored in **your personal** Google Drive (ahmad@erudite-estate.com)