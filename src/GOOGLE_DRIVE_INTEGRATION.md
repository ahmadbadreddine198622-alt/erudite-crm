# Google Drive Integration Setup

## ✅ What's Been Configured

### 1. Google Drive Connector
- **Status**: Connected ✓
- **Account**: ahmad@erudite-estate.com
- **Folder Created**: "PropCRM PDFs"
- **Folder ID**: 1LP6V2mXUn-kammy_z7XSg4xVij-2cpX1
- **Folder Link**: https://drive.google.com/drive/folders/1LP6V2mXUn-kammy_z7XSg4xVij-2cpX1

### 2. Backend Functions Created

#### `getGoogleDriveFolder`
- Finds or creates the "PropCRM PDFs" folder in your Google Drive
- Returns folder ID and link
- Used by the UI to display connection status

#### `uploadToGoogleDrive`
- Uploads PDF files to your Google Drive folder
- Parameters:
  - `fileName`: Name of the file
  - `base64Content`: Base64 encoded file content
  - `mimeType`: File type (default: application/pdf)
  - `folderName`: Target folder (default: "PropCRM PDFs")
- Returns file ID, links, and folder information

### 3. UI Component

#### `GoogleDriveSettings` Component
Located in: `components/settings/GoogleDriveSettings.jsx`

Features:
- Shows connection status
- Displays folder information
- Test upload button to verify integration
- Direct link to open folder in Google Drive

### 4. Integration Location
The Google Drive settings panel is now available in:
- **Vapi Dashboard** → Settings tab
- Shows real-time connection status
- Allows testing the upload functionality

## 📋 How to Use

### For Users:
1. Go to **Vapi Dashboard** → Settings tab
2. You'll see the "Google Drive Integration" card
3. Click "Open Folder in Google Drive" to view your PDFs
4. Use "Test Upload" to verify the integration works

### For Developers:
To upload any PDF to Google Drive from your code:

```javascript
import { base44 } from '@/api/base44Client';

// Convert your PDF to base64
const base64Pdf = btoa(String.fromCharCode(...pdfBytes));

// Upload to Google Drive
const result = await base44.functions.invoke('uploadToGoogleDrive', {
    fileName: 'invoice-123.pdf',
    base64Content: base64Pdf,
    mimeType: 'application/pdf'
});

console.log('File uploaded:', result.data.webViewLink);
```

## 🔄 Next Steps (Optional)

To automatically save ALL generated PDFs to Google Drive:

1. **Invoice PDFs**: Update `generateInvoicePDF` function to call `uploadToGoogleDrive` after generation
2. **Contract PDFs**: Update `generateAndSendContract` to save copies to Drive
3. **Reports**: Any report generation functions can upload to Drive

Example integration pattern:
```javascript
// After generating a PDF
const pdfBytes = await generatePDF(...);
const base64Pdf = btoa(String.fromCharCode(...pdfBytes));

// Upload to Google Drive
await base44.functions.invoke('uploadToGoogleDrive', {
    fileName: `invoice-${invoiceNumber}.pdf`,
    base64Content: base64Pdf
});
```

## 🔐 Security Notes

- Uses OAuth 2.0 authentication via Google Drive connector
- Full drive access scope (can create, read, update files)
- All uploads are tied to ahmad@erudite-estate.com account
- Files are stored in a dedicated "PropCRM PDFs" folder
- No API keys exposed - uses secure connector authentication

## 📊 Monitoring

Check your Google Drive folder anytime:
- Direct link: https://drive.google.com/drive/folders/1LP6V2mXUn-kammy_z7XSg4xVij-2cpX1
- All PDFs will be organized in the "PropCRM PDFs" folder
- Files are accessible from any device with Google account access