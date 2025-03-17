// app/approved-quote/[id]/page.tsx
import { getApprovedQuote } from '@/lib/firebase-helpers';
import { Card } from '@/components/ui/card';
import { Metadata } from 'next';

interface PageProps {
  params: {
    id: string;
  };
  searchParams?: Record<string, string | string[] | undefined>;
}

export default async function ApprovedQuotePage({ params }: PageProps) {
  const quoteData = await getApprovedQuote(params.id);

  if (!quoteData) {
    return <div>הצעת המחיר לא נמצאה</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white py-12" dir="rtl">
      <div className="max-w-4xl mx-auto px-4">
        <Card className="p-8 shadow-xl rounded-xl bg-white">
          {/* כותרת */}
          <div className="flex justify-between items-center border-b pb-6 mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-800">
                הצעת מחיר מאושרת #{quoteData.quoteNumber}
              </h1>
              <p className="text-gray-600 mt-2">
                תאריך אישור: {quoteData.approvedAt?.toLocaleDateString('he-IL')}
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

          {/* הערות עליונות */}
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

          {/* המארז שנבחר */}
          <div className="border-2 rounded-xl p-6 border-gray-200 mb-8">
            <h3 className="text-xl font-bold mb-4">{quoteData.selectedOption.title}</h3>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4 mb-2 font-semibold text-gray-700">
                <div>שם פריט</div>
                <div>משקל/גודל</div>
              </div>
              {quoteData.selectedOption.items.map((item: any, idx: number) => (
                <div key={idx} className="grid grid-cols-2 gap-4 py-2 border-b border-gray-100 last:border-0">
                  <span className="font-medium">{item.name}</span>
                  <span className="text-gray-600">{item.details}</span>
                </div>
              ))}
            </div>
            <div className="mt-6 pt-4 border-t flex justify-between items-center">
              <span className="text-gray-600">מחיר למארז:</span>
              <span className="text-xl font-bold">
                ₪{quoteData.selectedOption.total?.toLocaleString('he-IL')} + מע&quot;מ
              </span>
            </div>
          </div>

          {/* הערות תחתונות */}
          {quoteData.bottomNotes && (
            <div className="mb-8">
              <div className="prose max-w-none">
                <div
                  className="bg-gray-50 p-6 rounded-lg"
                  dangerouslySetInnerHTML={{ __html: quoteData.bottomNotes }}
                />
              </div>
            </div>
          )}

          {/* חתימה */}
          <div className="mt-8">
            <h3 className="text-lg font-semibold mb-2">חתימת לקוח:</h3>
            <div className="border rounded-lg p-4">
              <img src={quoteData.signature} alt="חתימת לקוח" className="max-h-48" />
            </div>
            <p className="text-sm text-gray-500 mt-2">
              אושר בתאריך: {quoteData.approvedAt?.toLocaleDateString('he-IL')}
            </p>
          </div>

          {/* מידע על המקור */}
          <div className="mt-8 pt-8 border-t text-sm text-gray-500">
            <p>מספר הצעה מקורי: {quoteData.quoteNumber}</p>
            <p>מזהה מערכת: {quoteData.id}</p>
          </div>

        </Card>
      </div>
    </div>
  );
}

// Enable dynamic rendering and disable caching
export const dynamic = 'force-dynamic';
export const revalidate = 0;