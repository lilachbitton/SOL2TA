// src/app/api/approve-quote/route.ts
import { NextResponse } from 'next/server';
import Airtable from 'airtable';

const base = new Airtable({
  apiKey: process.env.NEXT_PUBLIC_AIRTABLE_API_KEY
}).base(process.env.NEXT_PUBLIC_AIRTABLE_BASE_ID!);

export async function POST(request: Request) {
  try {
    console.log('API called');
    
    const body = await request.json();
    console.log('Received data:', body);

    if (!body.recordId || !body.items) {
      console.error('Missing required fields');
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    console.log('Updating Airtable...');

    // עדכון באיירטייבל
    await base('הצעות מחיר').update([{
      id: body.recordId,
      fields: {
        'סטאטוס': 'הזמנה מאושרת',
        'מוצרים': body.items.join(', ')
      }
    }]);

    console.log('Update successful');
    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error in API:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}