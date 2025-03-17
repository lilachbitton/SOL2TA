"use client";

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { useRouter } from 'next/navigation';
import { fetchQuoteById, updateQuoteWithApproval } from '@/lib/airtable';
import { SignatureField } from './SignatureCanvas';
import { createApprovedQuote } from '@/lib/firebase-helpers';

// טיפוסים – ניתן גם להעביר לקובץ טיפוסים נפרד
interface QuoteItem {
  id: string;        // מזהה הפריט
  name: string;      // שם הפריט
  details?: string;  // פרטים נוספים
}

interface QuoteOption {
  title: string;
  items: QuoteItem[];
  total?: number;
  image?: string;
  terms?: string;
  packagingItems?: QuoteItem[];
}

interface QuoteData {
  id: string;
  quoteNumber: string;
  customerName: string;
  customerPhone?: string;
  options: QuoteOption[];
  topNotes?: string;
  bottomNotes?: string;
  status?: string;
}

interface QuoteApprovalFormProps {
  quoteData: QuoteData;
}

export function QuoteApprovalForm({ quoteData }: QuoteApprovalFormProps) {
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // useEffect לבדיקה לדוגמה בעת טעינת הקומפוננטה
  useEffect(() => {
    const fetchSampleQuote = async () => {
      try {
        const result = await fetchQuoteById('10361');
        console.log('Sample quote structure:', result);
      } catch (error) {
        console.error('Error fetching sample quote:', error);
      }
    };
    fetchSampleQuote();
  }, []);

  const handleApprove = async () => {
    try {
      setIsSubmitting(true);
      setError(null);

      if (selectedOption === null) {
        throw new Error('נא לבחור אופציה');
      }
      if (!signature) {
        throw new Error('נא לחתום על ההצעה');
      }

      console.log('Starting approval process...');
      const selectedOptionData = quoteData.options[selectedOption];

      // 1. יצירת הצעה מאושרת בפיירבייס (כולל החתימה)
      const approvedQuote = await createApprovedQuote({
        originalQuoteId: quoteData.id,
        quoteNumber: quoteData.quoteNumber,
        customerName: quoteData.customerName,
        customerPhone: quoteData.customerPhone || '',
        selectedOption: selectedOptionData,
        signature,
        topNotes: quoteData.topNotes,
        bottomNotes: quoteData.bottomNotes,
      });

      console.log('Created approved quote in Firebase:', approvedQuote.id);

      // 2. עדכון הסטטוס, הלינק והמוצרים באיירטייבל
      await updateQuoteWithApproval(
        quoteData.quoteNumber, 
        approvedQuote.id,
        selectedOptionData
      );
      console.log('Updated Airtable successfully');

      // 3. מעבר לדף ההצעה המאושרת
      router.push(`/approved-quote/${approvedQuote.id}`);
    } catch (error) {
      console.error('Error in handleApprove:', error);
      setError(error instanceof Error ? error.message : 'אירעה שגיאה בעת אישור ההצעה');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white py-12" dir="rtl">
      <div className="max-w-4xl mx-auto px-4">
        <Card className="p-8 shadow-xl rounded-xl bg-white">
          {/* כותרת והצגת פרטי ההצעה */}
          <div className="flex justify-between items-center border-b pb-6 mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-800">
                הצעת מחיר #{quoteData.quoteNumber}
              </h1>
              <p className="text-gray-600 mt-2">
                תאריך: {new Date().toLocaleDateString('he-IL')}
              </p>
            </div>
            <img src="/images/logo.png" alt="Logo" className="h-16 w-auto" />
          </div>

          {/* פרטי לקוח */}
          <div className="bg-gray-50 p-6 rounded-lg mb-8">
            <h2 className="text-xl font-semibold mb-4">פרטי לקוח</h2>
            <div className="grid grid-cols-2 gap-4 text-lg">
              <div>
                <p className="font-medium">שם:</p>
                <p>{quoteData.customerName}</p>
              </div>
              <div>
                <p className="font-medium">טלפון:</p>
                <p dir="ltr">{quoteData.customerPhone}</p>
              </div>
            </div>
          </div>

          {/* הערות כלליות למעלה (אם קיימות) */}
          {quoteData.topNotes && (
            <div className="mb-8">
              <div className="prose max-w-none">
                <div
                  className="bg-gray-50 p-6 rounded-lg"
                  dangerouslySetInnerHTML={{ __html: quoteData.topNotes }}
                />
              </div>
            </div>
          )}

          {/* בחירת אופציה להצעה */}
          <div className="space-y-8">
            <h2 className="text-xl font-semibold mb-6">בחירת מארז</h2>
            {quoteData.options.map((option, index) => (
              <div
                key={index}
                className={`border-2 rounded-xl p-6 cursor-pointer transition-all ${
                  selectedOption === index
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-blue-300'
                }`}
                onClick={() => setSelectedOption(index)}
              >
                <h3 className="text-xl font-bold mb-4">{option.title}</h3>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-4 mb-2 font-semibold text-gray-700">
                    <div>שם פריט</div>
                    <div>משקל/גודל</div>
                  </div>
                  {option.items.map((item, idx) => (
                    <div key={idx} className="grid grid-cols-2 gap-4 py-2 border-b border-gray-100 last:border-0">
                      <span className="font-medium">{item.name}</span>
                      <span className="text-gray-600">{item.details}</span>
                    </div>
                  ))}
                </div>
                {option.packagingItems && option.packagingItems.length > 0 && (
                  <div className="mt-6 bg-gray-50 p-4 rounded-lg">
                    <h4 className="font-semibold mb-3">אריזה ומשלוח:</h4>
                    <ul className="space-y-2">
                      {option.packagingItems.map((item, idx) => (
                        <li key={idx} className="text-gray-600">• {item.name}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="mt-6 pt-4 border-t flex justify-between items-center">
                  <span className="text-gray-600">מחיר למארז:</span>
                  <span className="text-xl font-bold">
                    ₪{option.total?.toLocaleString('he-IL')} + מע"מ
                  </span>
                </div>
                {option.image && (
                  <div className="mt-6 rounded-lg overflow-hidden">
                    <img src={option.image} alt={option.title} className="w-auto max-w-full" />
                  </div>
                )}
                {option.terms && (
                  <div className="mt-6 bg-gray-50 p-4 rounded-lg">
                    <h4 className="font-semibold mb-2">הערות:</h4>
                    <p className="text-gray-600">{option.terms}</p>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* הערות כלליות למטה (אם קיימות) */}
          {quoteData.bottomNotes && (
            <div className="mt-8 mb-8">
              <div className="prose max-w-none">
                <div
                  className="bg-gray-50 p-6 rounded-lg"
                  dangerouslySetInnerHTML={{ __html: quoteData.bottomNotes }}
                />
              </div>
            </div>
          )}

          {/* שדה חתימה */}
          <div className="mt-8 mb-8">
            <h2 className="text-xl font-semibold mb-4">חתימת אישור</h2>
            <SignatureField onSave={setSignature} className="border rounded-lg p-4" />
          </div>

          {/* לחצן אישור */}
          <button
            className="w-full bg-blue-600 text-white py-4 rounded-xl text-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:hover:bg-blue-600 mt-8"
            onClick={handleApprove}
            disabled={isSubmitting || !signature}
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                מאשר...
              </span>
            ) : (
              'אשר הצעת מחיר'
            )}
          </button>

          {error && <div className="text-red-500 mt-4 text-center">{error}</div>}
        </Card>
      </div>
    </div>
  );
}
