// generatePFListingPDF — generate a professional PDF for a Property Finder listing
// Uploads PDFs to Google Drive "Finance/Listings" folder

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { jsPDF } from 'npm:jspdf@4.0.0';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const listing_id = body?.listing_id;

    if (!listing_id) {
      return Response.json({ error: 'listing_id is required' }, { status: 400 });
    }

    // Fetch listing data
    const listing = await base44.entities.PFListing.get(listing_id);
    if (!listing) {
      return Response.json({ error: 'Listing not found' }, { status: 404 });
    }

    // Create PDF
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // Header with brand colors
    doc.setFillColor(245, 158, 11); // Amber-500
    doc.rect(0, 0, pageWidth, 20, 'F');

    // Title
    doc.setFontSize(18);
    doc.setTextColor(255, 255, 255);
    doc.text('Property Listing', pageWidth / 2, 13, { align: 'center' });

    // Property Image (if available)
    let yPos = 30;
    if (listing.images && listing.images.length > 0) {
      try {
        const imgResponse = await fetch(listing.images[0]);
        const imgBuffer = await imgResponse.arrayBuffer();
        const imgData = new Uint8Array(imgBuffer);
        const imgProps = doc.getImageProperties(imgData);
        const imgWidth = 170;
        const imgHeight = (imgProps.height * imgWidth) / imgProps.width;
        
        doc.addImage(imgData, 'JPEG', 20, yPos, imgWidth, Math.min(imgHeight, 120));
        yPos += Math.min(imgHeight, 120) + 10;
      } catch (error) {
        console.error('Failed to load image:', error);
        yPos += 10;
      }
    }

    // Property Details
    doc.setFontSize(16);
    doc.setTextColor(0, 0, 0);
    doc.text(listing.title || 'Property', 20, yPos);
    yPos += 10;

    // Reference & Status
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Reference: ${listing.reference_number || listing.pf_listing_id}`, 20, yPos);
    yPos += 6;
    doc.text(`Status: ${listing.status || 'active'}`, 20, yPos);
    yPos += 10;

    // Key Features Box
    doc.setFillColor(245, 245, 245);
    doc.rect(20, yPos - 5, pageWidth - 40, 25, 'F');
    
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.text(`Bedrooms: ${listing.bedrooms || 0}`, 25, yPos + 5);
    doc.text(`Bathrooms: ${listing.bathrooms || 0}`, 70, yPos + 5);
    doc.text(`Area: ${Math.round(listing.area_sqft || 0)} sqft`, 120, yPos + 5);
    doc.text(`Type: ${(listing.property_type || 'apartment').replace('_', ' ').toUpperCase()}`, 25, yPos + 15);
    doc.text(`Price: AED ${listing.price?.toLocaleString() || 'N/A'}`, 70, yPos + 15);
    
    yPos += 35;

    // Location
    doc.setFontSize(12);
    doc.setTextColor(245, 158, 11);
    doc.text('Location', 20, yPos);
    yPos += 6;
    doc.setFontSize(10);
    doc.setTextColor(50, 50, 50);
    doc.text(listing.location || listing.community || 'N/A', 20, yPos);
    doc.text(listing.address || '', 20, yPos + 5);
    yPos += 20;

    // Description
    if (listing.description) {
      doc.setFontSize(12);
      doc.setTextColor(245, 158, 11);
      doc.text('Description', 20, yPos);
      yPos += 6;
      doc.setFontSize(10);
      doc.setTextColor(50, 50, 50);
      
      const splitDesc = doc.splitTextToSize(listing.description, 170);
      doc.text(splitDesc, 20, yPos);
      yPos += splitDesc.length * 5 + 10;
    }

    // Amenities
    if (listing.amenities && listing.amenities.length > 0) {
      doc.setFontSize(12);
      doc.setTextColor(245, 158, 11);
      doc.text('Amenities', 20, yPos);
      yPos += 6;
      doc.setFontSize(10);
      doc.setTextColor(50, 50, 50);
      
      const amenitiesText = listing.amenities.slice(0, 10).join(', ');
      const splitAmenities = doc.splitTextToSize(amenitiesText, 170);
      doc.text(splitAmenities, 20, yPos);
      yPos += splitAmenities.length * 5 + 10;
    }

    // Agent Info
    if (listing.agent_name || listing.agent_email) {
      doc.setFontSize(12);
      doc.setTextColor(245, 158, 11);
      doc.text('Contact Agent', 20, yPos);
      yPos += 6;
      doc.setFontSize(10);
      doc.setTextColor(50, 50, 50);
      
      if (listing.agent_name) {
        doc.text(`Name: ${listing.agent_name}`, 20, yPos);
        yPos += 5;
      }
      if (listing.agent_email) {
        doc.text(`Email: ${listing.agent_email}`, 20, yPos);
        yPos += 5;
      }
      if (listing.agency_name) {
        doc.text(`Agency: ${listing.agency_name}`, 20, yPos);
        yPos += 5;
      }
    }

    // Footer
    const footerY = pageHeight - 15;
    doc.setFontSize(9);
    doc.setTextColor(150, 150, 150);
    doc.text(`Generated on ${new Date().toLocaleDateString()}`, 20, footerY);
    
    if (listing.pf_url) {
      doc.setTextColor(245, 158, 11);
      doc.textWithLink('View on Property Finder', pageWidth - 60, footerY, { url: listing.pf_url });
    }

    // Convert PDF to blob and upload to Google Drive
    const pdfBytes = doc.output('arraybuffer');
    const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });
    
    // Convert blob to base64 for upload
    const base64Pdf = btoa(String.fromCharCode(...new Uint8Array(pdfBytes)));
    
    // Upload to Google Drive
    try {
      const driveResult = await base44.functions.invoke('uploadToGoogleDrive', {
        file_name: `Listing_${listing.reference_number || listing.pf_listing_id}.pdf`,
        file_content: base64Pdf,
        folder_path: 'Finance/Listings'
      });

      if (driveResult.data.file_url) {
        return Response.json({ 
          success: true, 
          pdf_url: driveResult.data.file_url,
          message: 'PDF generated and uploaded to Google Drive'
        });
      }
    } catch (uploadError) {
      console.error('Failed to upload to Google Drive:', uploadError);
      // Return PDF as data URL as fallback
      const dataUrl = `data:application/pdf;base64,${base64Pdf}`;
      return Response.json({ 
        success: true, 
        pdf_url: dataUrl,
        message: 'PDF generated (Google Drive upload failed)'
      });
    }

    return Response.json({ 
      success: false, 
      message: 'Failed to upload PDF to Google Drive'
    });

  } catch (error) {
    console.error('Error generating PDF:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});