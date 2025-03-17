import { initializeQuoteNumber } from '@/lib/airtable';

export default async function QuoteBuilderPage({
  searchParams
}: {
  searchParams?: {
    recordId?: string;
    quoteNumber?: string;
    customerName?: string;
    deliveryDate?: string;
    customerNotes?: string;
    packageBudget?: string;
    profitUnit?: string;
    phone?: string;
    email?: string;
  };
}) {
  const PriceQuoteBuilder = (await import('@/components/PriceQuoteBuilder')).default;
  
  let quoteNumber = searchParams?.quoteNumber;
  if (searchParams?.recordId && !quoteNumber) {
    quoteNumber = await initializeQuoteNumber(searchParams.recordId);
  }
  
  const decodedParams = {
    recordId: searchParams?.recordId || '',
    quoteNumber: quoteNumber || '',
    customerName: searchParams?.customerName ? decodeURIComponent(searchParams.customerName) : '',
    deliveryDate: searchParams?.deliveryDate ? decodeURIComponent(searchParams.deliveryDate) : '',
    customerNotes: searchParams?.customerNotes ? decodeURIComponent(searchParams.customerNotes) : '',
    packageBudget: searchParams?.packageBudget ? decodeURIComponent(searchParams.packageBudget) : '',
    profitUnit: searchParams?.profitUnit ? decodeURIComponent(searchParams.profitUnit) : '',
    phone: searchParams?.phone ? decodeURIComponent(searchParams.phone) : '',
    email: searchParams?.email ? decodeURIComponent(searchParams.email) : ''
  };

  return <PriceQuoteBuilder searchParams={decodedParams} />;
}
