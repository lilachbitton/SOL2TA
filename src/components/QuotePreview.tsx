// components/QuotePreview.tsx
import React, { forwardRef } from 'react';

interface QuotePreviewProps {
  quoteNumber: string;
  customerName: string;
  options: any[];
  date?: string;
}

export const QuotePreview = forwardRef<HTMLDivElement, QuotePreviewProps>(
  ({ quoteNumber, customerName, options, date = new Date().toLocaleDateString('he-IL') }, ref) => {
    return (
      <div ref={ref} className="bg-white p-8 max-w-4xl mx-auto" dir="rtl">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold mb-2">הצעת מחיר</h1>
          <div className="text-gray-600">מספר: {quoteNumber}</div>
        </div>

        {/* Customer Details */}
        <div className="mb-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="font-semibold">לכבוד:</div>
              <div>{customerName}</div>
            </div>
            <div className="text-left">
              <div className="font-semibold">תאריך:</div>
              <div>{date}</div>
            </div>
          </div>
        </div>

        {/* Options */}
        <div className="space-y-8">
          {options.map((option, index) => (
            <div key={option.id} className="border rounded-lg p-6">
              <h2 className="text-xl font-bold mb-4">
                אופציה {String.fromCharCode(65 + index)} - {option.title}
              </h2>
              
              {/* Items Table */}
              <table className="w-full mb-4">
                <thead>
                  <tr className="border-b">
                    <th className="text-right py-2">פריט</th>
                    <th className="text-right py-2">פירוט</th>
                  </tr>
                </thead>
                <tbody>
                  {option.items.map((item: any) => (
                    <tr key={item.id} className="border-b">
                      <td className="py-2">{item.name}</td>
                      <td className="py-2">{item.details}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Option Total */}
              <div className="text-left font-bold">
                סה"כ: ₪{option.total} + מע"מ
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-8 text-sm text-gray-600">
          <p>* המחירים אינם כוללים מע"מ</p>
          <p>* תוקף ההצעה: 14 ימים</p>
          <p>* זמן אספקה: לפי סיכום</p>
        </div>
      </div>
    );
  }
);

QuotePreview.displayName = 'QuotePreview';