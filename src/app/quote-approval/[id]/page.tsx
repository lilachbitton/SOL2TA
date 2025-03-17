// app/quote-approval/[id]/page.tsx
import { QuoteApprovalForm } from '@/components/QuoteApprovalForm';
import { getQuoteFromFirebase } from '@/lib/firebase-helpers';

async function serializeQuoteData(quote: any) {
  const safeDate = (timestamp: any) => {
    if (!timestamp) return null;
    if (timestamp.seconds) {
      return new Date(timestamp.seconds * 1000).toISOString();
    }
    return timestamp;
  };

  return {
    id: quote.id || '',
    quoteNumber: quote.quoteNumber || '',
    customerName: quote.customerName || '',
    customerPhone: quote.customerPhone || '',
    options: quote.options?.map((opt: any) => ({
      id: opt.id || '',
      title: opt.title || '',
      items: (opt.items || []).map((item: any) => ({
        id: item.id || '',
        name: item.name || '',
        details: item.details || '',
      })),
      total: opt.total || 0,
      image: opt.image || null,
    })) || [],
    topNotes: quote.topNotes || '',
    bottomNotes: quote.bottomNotes || '',
    status: quote.status || '',
    createdAt: safeDate(quote.createdAt),
    updatedAt: safeDate(quote.updatedAt),
    approvedAt: safeDate(quote.approvedAt),
  };
}

export default async function QuoteApprovalPage({ params }: { params: { id: string } }) {
  const quote = await getQuoteFromFirebase(params.id);
  const serializedQuote = await serializeQuoteData(quote);
  
  return <QuoteApprovalForm quoteData={serializedQuote} />;
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;
