// lib/pdf-generator.ts
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import 'jspdf-autotable';

export const generateQuotePDF = async (element: HTMLElement, withSignature = false) => {
  try {
    // יצירת PDF בעברית
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      putOnlyUsedFonts: true,
      direction: 'rtl'
    });

    // המרת התצוגה ל-canvas
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      windowWidth: element.scrollWidth,
      windowHeight: element.scrollHeight
    });

    const imgData = canvas.toDataURL('image/jpeg', 1.0);
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    // הוספת התוכן
    pdf.addImage(imgData, 'JPEG', 0, 0, pageWidth, pageHeight);

    if (withSignature) {
      // הוספת שדה חתימה
      pdf.setFont("Helvetica");
      pdf.setFontSize(12);
      pdf.text('חתימת לקוח:', pageWidth - 30, pageHeight - 30, { align: 'right' });
      pdf.rect(pageWidth - 130, pageHeight - 40, 100, 20);
      pdf.text('תאריך:', pageWidth - 30, pageHeight - 50, { align: 'right' });
      pdf.rect(pageWidth - 130, pageHeight - 60, 100, 20);
    }

    return pdf;
  } catch (error) {
    console.error('PDF generation error:', error);
    throw error;
  }
};
