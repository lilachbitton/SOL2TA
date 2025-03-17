// components/ui/quote-creator-button.tsx
import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { useRouter } from 'next/navigation';
import { getNextQuoteNumber } from '@/lib/airtable';

interface QuoteCreatorButtonProps {
  record: {
    id: string;
    customerName: string;
    deliveryDate: string;
    customerNotes: string;
    packageBudget: number;
    profitUnit: string;
    phone: string;
    email: string;
  };
}

export function QuoteCreatorButton({ record }: QuoteCreatorButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleCreateQuote = async () => {
    try {
      setIsLoading(true);
      const nextQuoteNumber = await getNextQuoteNumber();
      
      // Navigate to quote builder with parameters
      router.push(`/quote-builder?` + new URLSearchParams({
        quoteNumber: nextQuoteNumber,
        customerName: record.customerName,
        deliveryDate: record.deliveryDate,
        customerNotes: record.customerNotes,
        packageBudget: record.packageBudget.toString(),
        profitUnit: record.profitUnit,
        phone: record.phone,
        email: record.email
      }));
    } catch (error) {
      console.error('Error creating quote:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button 
      onClick={handleCreateQuote} 
      disabled={isLoading}
      variant="default" 
      size="sm"
    >
      {isLoading ? 'טוען...' : 'הכן הצעה'}
    </Button>
  );
}