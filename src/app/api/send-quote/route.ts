// app/api/send-quote/route.ts
import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export const maxDuration = 30; // הגדלת הזמן המקסימלי ל-30 שניות
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    
    // Log received form data
    console.log('Received form data fields:', Array.from(formData.keys()));
    
    const to = formData.get('to') as string;
    const quoteNumber = formData.get('quoteNumber') as string;
    const pdfBlob = formData.get('pdf') as Blob;
    const filloutFormUrl = formData.get('filloutUrl') as string;

    console.log('Processing request with:', {
      to,
      quoteNumber,
      hasPDF: !!pdfBlob,
      pdfSize: pdfBlob?.size,
      filloutFormUrl
    });

    // Validate required fields
    if (!to || !quoteNumber || !pdfBlob) {
      console.error('Missing required fields:', {
        hasTo: !!to,
        hasQuoteNumber: !!quoteNumber,
        hasPDF: !!pdfBlob
      });
      return NextResponse.json(
        { message: 'חסרים שדות חובה' },
        { status: 400 }
      );
    }

    // וידוא שכתובת המייל תקינה
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      return NextResponse.json(
        { message: 'כתובת המייל אינה תקינה' },
        { status: 400 }
      );
    }

    // Convert Blob to Buffer
    const pdfBuffer = await pdfBlob.arrayBuffer();
    console.log('PDF converted to buffer, size:', pdfBuffer.byteLength);

    // Create transporter with GoDaddy settings
    const transporterConfig = {
      host: 'smtpout.secureserver.net',
      port: 465,
      secure: true,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      },
      tls: {
        rejectUnauthorized: false
      },
      debug: true,
      logger: true  // הוספת לוגים מפורטים
    };

    console.log('Creating transporter with config:', {
      ...transporterConfig,
      auth: { user: process.env.SMTP_USER, pass: '****' }
    });

    const transporter = nodemailer.createTransport(transporterConfig);

    // Verify SMTP connection
    try {
      await transporter.verify();
      console.log('SMTP connection verified successfully');
    } catch (verifyError) {
      console.error('SMTP Verification Error:', verifyError);
      return NextResponse.json(
        { 
          message: 'בעיית התחברות לשרת המייל', 
          error: verifyError instanceof Error ? verifyError.message : 'Unknown error'
        },
        { status: 500 }
      );
    }

    // Email options
    const mailOptions = {
      from: {
        name: 'Soul to Table',
        address: process.env.SMTP_FROM
      },
      to,
      subject: `הצעת מחיר ${quoteNumber}`,
      html: `
        <div dir="rtl" style="font-family: Arial, sans-serif;">
          <h2 style="color: #333;">הצעת מחיר ${quoteNumber}</h2>
          <p>שלום,</p>
          <p>מצורפת הצעת המחיר שביקשת.</p>
          ${filloutFormUrl ? `
            <p>לבחירת האופציה המועדפת ואישור ההצעה, אנא לחץ על הקישור הבא:</p>
            <p><a href="${filloutFormUrl}" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">לחץ כאן לאישור ההצעה</a></p>
          ` : ''}
          <p style="margin-top: 20px;">בברכה,<br>Soul to Table</p>
        </div>
      `,
      attachments: [
        {
          filename: `quote-${quoteNumber}.pdf`,
          content: Buffer.from(pdfBuffer),
          contentType: 'application/pdf'
        }
      ]
    };

    // Log email attempt
    console.log('Attempting to send email with options:', {
      to: mailOptions.to,
      subject: mailOptions.subject,
      from: mailOptions.from,
      attachmentsLength: mailOptions.attachments.length
    });

    // Send email
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully:', info);

    return NextResponse.json({ 
      success: true,
      message: 'המייל נשלח בהצלחה',
      messageId: info.messageId 
    });

  } catch (error) {
    console.error('Detailed error in send-quote:', error);
    
    let errorMessage = 'שגיאה בשליחת המייל';
    if (error instanceof Error) {
      if (error.message.includes('ECONNREFUSED')) {
        errorMessage = 'לא ניתן להתחבר לשרת המייל';
      } else if (error.message.includes('authentication')) {
        errorMessage = 'שגיאת אימות מול שרת המייל';
      } else if (error.message.includes('timeout')) {
        errorMessage = 'תם הזמן המוקצב לשליחת המייל';
      }
    }
    
    return NextResponse.json(
      { 
        success: false,
        message: errorMessage,
        error: error instanceof Error ? {
          message: error.message,
          name: error.name,
          stack: error.stack
        } : 'Unknown error'
      },
      { status: 500 }
    );
  }
}