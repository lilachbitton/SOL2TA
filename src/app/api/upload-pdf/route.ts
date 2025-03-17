// src/app/api/upload-pdf/route.ts
import { NextResponse } from 'next/server';
import Airtable from 'airtable';

// אתחול Airtable
const base = new Airtable({
  apiKey: process.env.NEXT_PUBLIC_AIRTABLE_API_KEY
}).base(process.env.NEXT_PUBLIC_AIRTABLE_BASE_ID!);

export async function POST(request: Request) {
  try {
    const { recordId, pdfBase64, filename } = await request.json();

    if (!recordId || !pdfBase64 || !filename) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // שימוש בפורמט הנכון לעדכון באיירטייבל
    const table = base('הצעות מחיר');
    const records = await table.update([
      {
        id: recordId,
        fields: {
          'הצעת מחיר חתומה': [
            {
              filename: filename,
              type: 'application/pdf',
              content: pdfBase64
            }
          ]
        }
      }
    ]);

    if (!records || !Array.isArray(records) || records.length === 0) {
      throw new Error('Failed to update record');
    }

    const attachmentField = records[0].get('הצעת מחיר חתומה');
    if (!attachmentField || !Array.isArray(attachmentField) || attachmentField.length === 0) {
      throw new Error('No attachment found in response');
    }

    return NextResponse.json({ 
      url: attachmentField[0].url,
      success: true 
    });

  } catch (error) {
    console.error('Error in upload process:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false
      },
      { status: 500 }
    );
  }
}