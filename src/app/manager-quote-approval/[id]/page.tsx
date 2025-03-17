// app/manager-quote-approval/[id]/page.tsx
import { getQuoteData } from '@/lib/firebase-helpers';
import { ManagerQuoteApprovalForm } from '@/components/ManagerQuoteApprovalForm';

export default async function ManagerQuoteApprovalPage({
  params
}: {
  params: { id: string }
}) {
  const quoteData = await getQuoteData(params.id);

  if (!quoteData) {
    return <div>הצעת המחיר לא נמצאה</div>;
  }

  return <ManagerQuoteApprovalForm quoteData={quoteData} />;
}