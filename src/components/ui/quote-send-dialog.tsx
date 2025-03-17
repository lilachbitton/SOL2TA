"use client";

import React, { useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Heading from '@tiptap/extension-heading';
import BulletList from '@tiptap/extension-bullet-list';
import ListItem from '@tiptap/extension-list-item';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './dialog';
import { Label } from './label';
import { Input } from './input';
import { Button } from './button';
import {
  Phone,
  Send,
  Bold,
  Italic,
  Underline as UnderlineIcon,
  List,
} from 'lucide-react';
import { createQuote } from '@/lib/firebase-helpers';
import { updateQuoteApprovalLink } from '@/lib/airtable';

const DEFAULT_TOP_NOTES = `<h2>מצורפת הצעה ל-XX מארזים קולינריים ממיטב התוצרת הישראלית.</h2>

<p>המארז מרכז בתוכו מוצרים מיוחדים מחומרי גלם הכי טובים שיש, אשר מיוצרים על ידי עסקים קטנים, בעיקר מקווי העימות בצפון ובדרום הארץ. המארז מביא אל השולחן שלכם את הלב והנשמה של אנשים מיוחדים המשקיעים בייצור מקומי, בחומרי גלם, בטעמים מיוחדים ובתהליכים מסורתיים ועבודת יד.</p>

<p>במיוחד בימים אלו, בהם יצרנים המשתתפים במארז מפונים מבתיהם, משרתים במילואים, וכולם כאחד מתמודדים עם מציאות חדשה ומאתגרת, אני שמחה לעזור להם במעט ולהביא את המוצרים שלהם עד אליכם ולשותפים שלכם. אני מקווה שתיהנו ותתרגשו מהמוצרים ומהנשמה שמאחוריהם, בדיוק כמוני.</p>

<ul>
  <li><strong>כל המוצרים בעלי תעודת כשרות.</strong></li>
  <li><strong>המארזים נארזים על ידי מתמודדי נפש בעמותת אנוש – העמותה הישראלית לבריאות הנפש.</strong></li>
</ul>`;

const DEFAULT_BOTTOM_NOTES = `<h3><strong>שונות:</strong></h3>
<ul>
  <li><strong>זמן אספקה: 14 ימי עסקים</strong></li>
  <li>אישור למפרט המוצרים יינתן לאחר אישור ההצעה ע"י הלקוח ווידוא מלאי מול היצרנים</li>
  <li>מפרט המארז עשוי להשתנות בהתאמה למלאים הקיימים, מוצר שיהיה חסר במלאי או שתהיה בעיה לספק אותו עקב המצב הבטחוני, יוחלף במוצר שווה ערך</li>
  <li>עלות משלוח תתומחר בנפרד</li>
  <li><strong>במקרה של אי עמידה בתנאי התשלום "סול טו טייבל" רשאי לעצור עבודה באופן מידי וכל ההתחייבות של "סול טו טייבל" כלפי החברה מבוטלת.</strong></li>
</ul>

<p><strong>תנאי תשלום: 30% מקדמה ביום אישור ההצעה והיתרה ביום קבלת המארזים.</strong></p>`;

interface QuoteSendDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quoteData: {
    customerPhone?: string;
    customerName: string;
    options: any[];
    id?: string;
    quoteNumber: string; // הוספת מספר הצעה לפרופס
  };
}

const MenuBar = ({ editor }: { editor: any }) => {
  if (!editor) return null;
  return (
    <div className="border-b p-2 mb-2 flex gap-1 bg-gray-50 rounded-t-lg" dir="rtl">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={editor.isActive('bold') ? 'bg-gray-200' : ''}
      >
        <Bold className="w-4 h-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={editor.isActive('italic') ? 'bg-gray-200' : ''}
      >
        <Italic className="w-4 h-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        className={editor.isActive('underline') ? 'bg-gray-200' : ''}
      >
        <UnderlineIcon className="w-4 h-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={editor.isActive('bulletList') ? 'bg-gray-200' : ''}
      >
        <List className="w-4 h-4" />
      </Button>
    </div>
  );
};

const RichTextEditor = ({
  content,
  onChange,
}: {
  content: string;
  onChange: (value: string) => void;
}) => {
  const editor = useEditor({
    extensions: [StarterKit, Underline, Heading, BulletList, ListItem],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  return (
    <div className="border rounded-lg overflow-hidden bg-white" dir="rtl">
      <MenuBar editor={editor} />
      <EditorContent editor={editor} className="p-3 min-h-[200px]" />
    </div>
  );
};

const formatPhoneNumber = (input: string) => {
  const numbers = input.replace(/\D/g, '');
  if (numbers.startsWith('0')) {
    return '972' + numbers.slice(1);
  }
  return numbers;
};

export const QuoteSendDialog = ({
  open,
  onOpenChange,
  quoteData,
}: QuoteSendDialogProps) => {
  const [phone, setPhone] = useState(quoteData.customerPhone || '');
  const [topNotes, setTopNotes] = useState(DEFAULT_TOP_NOTES);
  const [bottomNotes, setBottomNotes] = useState(DEFAULT_BOTTOM_NOTES);
  const [loading, setLoading] = useState(false);

  const MANAGER_PHONE = '0509404565';

  const handleSend = async () => {
    try {
      setLoading(true);

      // וידוא שמספר הטלפון תקין
      const phoneRegex = /^972[0-9]{9}$/;
      const formattedPhone = formatPhoneNumber(phone);
      if (!phoneRegex.test(formattedPhone)) {
        throw new Error('מספר הטלפון אינו תקין');
      }

      // שימוש במספר ההצעה הקיים במקום יצירת חדש
      const quoteNumber = quoteData.quoteNumber;
      if (!quoteNumber) {
        throw new Error('מספר הצעה חסר');
      }

      // יצירת ההצעה בפיירסטור
      const quote = await createQuote({
        quoteNumber,
        customerName: quoteData.customerName,
        customerPhone: formattedPhone,
        options: quoteData.options,
        topNotes,
        bottomNotes,
      });

      // יצירת לינק לאישור
      const approvalLink = `${window.location.origin}/quote-approval/${quote.id}`;

      // עדכון הלינק באיירטייבל
      await updateQuoteApprovalLink(quoteNumber, approvalLink);

      // יצירת הודעת וואטסאפ
      const message = `שלום ${quoteData.customerName},
קיבלת הצעת מחיר מס' ${quoteNumber} מ-Soul to Table!

לצפייה בהצעת המחיר ואישורה, אנא לחץ על הקישור הבא:
${approvalLink}

בברכה,
Soul to Table`;

      const encodedMessage = encodeURIComponent(message);
      window.open(`https://wa.me/${formattedPhone}?text=${encodedMessage}`, '_blank');

      onOpenChange(false);
    } catch (error) {
      console.error('Error:', error);
      alert(error instanceof Error ? error.message : 'אירעה שגיאה');
    } finally {
      setLoading(false);
    }
  };

  const handleSendToManager = async () => {
    try {
      setLoading(true);

      // קבלת מספר ההצעה הקיים
      const quoteNumber = quoteData.quoteNumber;
      if (!quoteNumber) {
        throw new Error('מספר הצעה חסר');
      }

      // יצירת ההצעה בפיירסטור עם מספר טלפון קבוע למנהל
      const quote = await createQuote({
        quoteNumber,
        customerName: quoteData.customerName,
        customerPhone: MANAGER_PHONE,
        options: quoteData.options,
        topNotes,
        bottomNotes,
      });

      // יצירת לינק לאישור מנהל
      const approvalLink = `${window.location.origin}/manager-quote-approval/${quote.id}`;

      // עדכון הלינק והסטטוס באיירטייבל עם סטטוס "לאישור בתאל"
      await updateQuoteApprovalLink(quoteNumber, approvalLink, 'לאישור בתאל');

      // יצירת הודעת וואטסאפ למנהל
      const message = `היי בתאל המהממת!
ישנה הצעה שממתינה לאישורך לפני שליחה ללקוח:
${approvalLink}`;

      const encodedMessage = encodeURIComponent(message);
      window.open(`https://wa.me/${MANAGER_PHONE}?text=${encodedMessage}`, '_blank');

      onOpenChange(false);
    } catch (error) {
      console.error('Error:', error);
      alert(error instanceof Error ? error.message : 'אירעה שגיאה');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right">שליחת הצעת מחיר</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 mt-4 text-right">
          <div className="space-y-2">
            <Label className="block">מספר טלפון</Label>
            <div className="flex gap-2">
              <Input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="050-0000000"
                className="flex-1 text-left"
                dir="ltr"
              />
              <Button
                variant="outline"
                onClick={() => setPhone(quoteData.customerPhone || '')}
                disabled={!quoteData.customerPhone}
              >
                <Phone className="w-4 h-4 ml-2" />
                שחזר טלפון מקור
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="block">הערות בראש העמוד</Label>
            <RichTextEditor content={topNotes} onChange={setTopNotes} />
          </div>

          <div className="space-y-2">
            <Label className="block">הערות בסוף המסמך</Label>
            <RichTextEditor content={bottomNotes} onChange={setBottomNotes} />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            ביטול
          </Button>
          <Button
            onClick={handleSendToManager}
            disabled={loading || !phone}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Send className="w-4 h-4 ml-2" />
            שלח לאישור מנהל
          </Button>
          <Button
            onClick={handleSend}
            disabled={loading || !phone}
            className="bg-green-600 hover:bg-green-700"
          >
            {loading ? (
              <span className="flex items-center justify-center">
                <svg
                  className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                שולח...
              </span>
            ) : (
              <>
                <Send className="w-4 h-4 ml-2" />
                שלח הצעת מחיר
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
