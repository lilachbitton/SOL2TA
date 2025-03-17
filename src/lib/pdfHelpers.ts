// src/lib/pdfHelpers.ts
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export const generateQuotePDF = async (
  element: HTMLElement,
  withSignature: boolean = false
): Promise<jsPDF> => {
  try {
    // Wait a moment for the element to be fully rendered
    await new Promise(resolve => setTimeout(resolve, 100));

    // Create canvas with high quality settings
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      logging: false,
      allowTaint: true,
      foreignObjectRendering: false,
      removeContainer: true,
      backgroundColor: '#ffffff',
    });

    // Calculate dimensions
    const imgWidth = 210; // A4 width in mm
    const pageHeight = 297; // A4 height in mm
    const imgHeight = canvas.height * imgWidth / canvas.width;
    
    // Create PDF
    const pdf = new jsPDF('p', 'mm', 'a4');
    
    // Add image to PDF
    let position = 0;
    
    // If the content is longer than one page
    while (position < imgHeight) {
      // Add new page if needed
      if (position > 0) {
        pdf.addPage();
      }
      
      // Add part of the image
      pdf.addImage({
        imageData: canvas.toDataURL('image/jpeg', 1.0),
        format: 'JPEG',
        x: 0,
        y: -position, // Negative position to show correct part of image
        width: imgWidth,
        height: imgHeight
      });
      
      position += pageHeight;
    }

    return pdf;
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw new Error('Failed to generate PDF: ' + (error instanceof Error ? error.message : 'Unknown error'));
  }
};
