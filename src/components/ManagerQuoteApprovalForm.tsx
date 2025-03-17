// components/ManagerQuoteApprovalForm.tsx
"use client";

import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useRouter } from 'next/navigation';
import { updateQuoteApprovalLink, updateManagerNotes } from '@/lib/airtable';
import { createQuote } from '@/lib/firebase-helpers';

interface ManagerQuoteApprovalFormProps {
  quoteData: {
    id: string;
    quoteNumber: string;
    customerName: string;
    customerPhone?: string;
    options: {
      title: string;
      items: Array<{
        name: string;
        details?: string;
      }>;
      total?: number;
      packagingItems?: Array<{
        name: string;
      }>;
    }[];
    topNotes?: string;
    bottomNotes?: string;
  };
}

export function ManagerQuoteApprovalForm({ quoteData }: ManagerQuoteApprovalFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showNotesField, setShowNotesField] = useState(false);
  const [managerNotes, setManagerNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleApprove = async () => {
    try {
      setIsSubmitting(true);
      setError(null);

      // יצירת ההצעה בפיירסטור
      const quote = await createQuote({
        quoteNumber: quoteData.quoteNumber,
        customerName: quoteData.customerName,
        customerPhone: quoteData.customerPhone || '',
        options: quoteData.options,
        topNotes: quoteData.topNotes || '',
        bottomNotes: quoteData.bottomNotes || '',
      });

      // יצירת לינק לאישור לקוח
      const approvalLink = `${window.location.origin}/quote-approval/${quote.id}`;

      // עדכון הסטטוס באיירטייבל
      await updateQuoteApprovalLink(quoteData.quoteNumber, approvalLink, 'מאושר בתאל');

      router.push(`/quote-approval/${quoteData.id}/success`);
    } catch (error) {
      console.error('Error approving quote:', error);
      setError(error instanceof Error ? error.message : 'אירעה שגיאה באישור ההצעה');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendNotes = async () => {
    try {
      setIsSubmitting(true);
      setError(null);

      if (!managerNotes.trim()) {
        throw new Error('נא להזין הערות לתיקון');
      }

      await updateManagerNotes(quoteData.quoteNumber, managerNotes);
      router.push(`/quote-approval/${quoteData.id}/notes-sent`);
    } catch (error) {
      console.error('Error sending notes:', error);
      setError(error instanceof Error ? error.message : 'אירעה שגיאה בשליחת ההערות');
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
                אישור הצעת מחיר #{quoteData.quoteNumber}
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

          {/* הצגת האופציות */}
          <div className="space-y-8">
            {quoteData.options.map((option, index) => (
              <div key={index} className="border-2 rounded-xl p-6 border-gray-200">
                <h3 className="text-xl font-bold mb-4">{option.title}</h3>
                <div className="space-y-3">
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
              </div>
            ))}
          </div>

          {/* שדה הערות */}
          {showNotesField && (
            <div className="mt-8">
              <Textarea
                value={managerNotes}
                onChange={(e) => setManagerNotes(e.target.value)}
                placeholder="נא להזין הערות לתיקון..."
                className="min-h-[150px]"
              />
            </div>
          )}

          {/* כפתורי פעולה */}
          <div className="flex justify-center gap-4 mt-8">
            {showNotesField ? (
              <Button
                onClick={handleSendNotes}
                disabled={isSubmitting}
                className="bg-orange-600 hover:bg-orange-700 text-white px-8 py-3 rounded-lg"
              >
                שלח הערות
              </Button>
            ) : (
              <>
                <Button
                  onClick={() => setShowNotesField(true)}
                  className="bg-orange-600 hover:bg-orange-700 text-white px-8 py-3 rounded-lg"
                >
                  שלח הערות לתיקון
                </Button>
                <Button
                  onClick={handleApprove}
                  disabled={isSubmitting}
                  className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 rounded-lg"
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
                </Button>
              </>
            )}
          </div>

          {error && <div className="text-red-500 mt-4 text-center">{error}</div>}
        </Card>
      </div>
    </div>
  );
}