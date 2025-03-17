import Airtable from 'airtable';

// Initialize Airtable
const base = new Airtable({
  apiKey: process.env.NEXT_PUBLIC_AIRTABLE_API_KEY
}).base(process.env.NEXT_PUBLIC_AIRTABLE_BASE_ID!);

// Cache objects
let packagesCache: Package[] | null = null;
let productsCache: Product[] | null = null;
let lastFetchTime: number | null = null;
const CACHE_DURATION = 1000 * 60 * 60 * 24 * 7; // שבוע שלם

// =====================
// Types
// =====================

export interface Product {
  id: string;
  name: string;
  details?: string;
  price?: number;
  productType?: string; // שדה לסוג מוצר
  inventory?: string;   // שדה למלאי יתר/חסר
  boxesPerCarton?: number; // שדה חדש שמכיל את כמות המארזים שנכנסים בקרטון
}

export interface Package {
  id: string;
  name: string;
  items: Product[];
  packagingItems: Product[];
  packagePrice: number;
  imageUrl?: string;
  parallelPackages?: string[]; // מארזים מקבילים
}

export interface Catalog {
  id: string;
  name: string;
  packages: string[];
}

export interface QuoteOption {
  name: string;
  price: number;
  // For the approved quote update, we assume that each option has an "items" field.
  items?: Product[];
}

export interface QuoteRecord {
  id: string;
  quoteNumber: string;      // מספר הזמנה
  customerName: string;     // שם לקוח
  companyName?: string;     // שם חברה
  status: QuoteStatus;      // סטטוס
  options: QuoteOption[];   // אופציות המחיר
  createdAt: string;
  updatedAt: string;
  profitUnit?: string;      // יחידת רווח
  additionalNotes?: string; // הערות נוספות
  customerEmail?: string;
  phone?: string;
  deliveryDate?: string;
  budgetBeforeVAT?: number;     // שדה חדש
  budgetWithVAT?: number;       // שדה חדש
}

export type QuoteStatus = 
  | 'מחכה להצעת מחיר'
  | 'נשלחה הצעה ללקוח'
  | 'נצפה'
  | 'מאושר'
  | 'נדחה'
  | 'לאישור בתאל'
  | 'מאושר בתאל'
  | 'בתיקון';

// טיפוס חדש לסוכנים
export interface Agent {
  id: string;
  name: string;
}

// =====================
// Helper Functions
// =====================

const isCacheValid = () => {
  if (!lastFetchTime) return false;
  const timeSinceLastFetch = Date.now() - lastFetchTime;
  console.log(`Time since last fetch: ${Math.round(timeSinceLastFetch / 1000)}s`);
  return timeSinceLastFetch < CACHE_DURATION;
};

// =====================
// New and Updated Functions
// =====================

export const fetchCatalogs = async (): Promise<Catalog[]> => {
  try {
    const records = await base('קטלוגים').select().all();
    return records.map(record => ({
      id: record.id,
      name: record.get('שם הקטלוג') as string,
      packages: (record.get('מארזים') as string[]) || []
    }));
  } catch (error) {
    console.error('Error fetching catalogs:', error);
    throw error;
  }
};

export const fetchProductsByIds = async (productIds: string[]): Promise<Product[]> => {
  try {
    if (!productIds.length) return [];
    console.log('Fetching products for IDs:', productIds);
    const formula = `OR(${productIds.map(id => `RECORD_ID()='${id}'`).join(',')})`;
    const records = await base('קטלוג מוצרים')
      .select({ filterByFormula: formula })
      .all();
    return records.map(record => {
      const fields = record.fields;
      return {
        id: record.id,
        name: fields['מוצר'] || 'מוצר ללא שם',
        details: fields['פירוט'] || fields['גודל'] || '',
        price: Number(fields['מחיר לפני מעמ']) || 0,
        productType: fields['סוג מוצר'] as string,
        inventory: fields['מלאי יתר/חסר'] as string,
        boxesPerCarton: Number(fields['כמות בקרטון']) || 1, // קריאת שדה חדש מאיירטייבל
      };
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    throw error;
  }
};

export const fetchProductsByCatalog = async (catalogId: string): Promise<Product[]> => {
  try {
    console.log('Fetching products from Airtable...');
    const records = await base('קטלוג מוצרים')
      .select()
      .all();
    
    const products = records.map(record => {
      const fields = record.fields;
      return {
        id: record.id,
        name: fields['מוצר'] || 'מוצר ללא שם',
        details: fields['פירוט'] || fields['גודל'] || '',
        price: Number(fields['מחיר לפני מעמ']) || 0,
        productType: fields['סוג מוצר'] as string,
        inventory: fields['מלאי יתר/חסר'] as string,
        boxesPerCarton: Number(fields['כמות בקרטון']) || 1, // קריאת שדה חדש מאיירטייבל
      };
    });
    
    productsCache = products;
    lastFetchTime = Date.now();
    return products;
  } catch (error) {
    console.error('Error fetching products:', error);
    throw error;
  }
};

export const fetchPackagesByCatalog = async (catalogId: string): Promise<Package[]> => {
  try {
    console.log('Fetching packages for catalog:', catalogId);
    // קבלת הקטלוג
    const catalog = await base('קטלוגים').find(catalogId);
    console.log('Found catalog:', catalog.id);
    // קבלת רשימת המארזים המקושרים
    const linkedPackages = catalog.get('מארזים') as string[];
    console.log('Linked packages:', linkedPackages);
    if (!linkedPackages?.length) {
      console.log('No packages found for catalog');
      return [];
    }
    // בניית פילטר
    const filterFormula = `OR(${linkedPackages.map(id => `RECORD_ID()='${id}'`).join(',')})`;
    const records = await base('קטלוג מארזים')
      .select({ filterByFormula: filterFormula })
      .all();
    console.log('Found packages:', records.length);
    const packages = await Promise.all(records.map(async record => {
      const itemIds = record.get('Items') as string[];
      const packagingIds = record.get('חומרי מיתוג ואריזה') as string[];
      const parallelPackages = record.get('מארז מקביל') as string[];
      const [items, packagingItems] = await Promise.all([
        fetchProductsByIds(itemIds || []),
        fetchProductsByIds(packagingIds || [])
      ]);
      
      // הערה: השדה boxesPerCarton כבר יימשך מהפונקציה fetchProductsByIds
      return {
        id: record.id,
        name: record.get('שם המארז') as string,
        packagePrice: Number(record.get('עלות למארז')) || 0,
        items,
        packagingItems,
        imageUrl: record.get('Attachments')?.[0]?.url,
        parallelPackages
      };
    }));
    return packages;
  } catch (error) {
    console.error('Error fetching packages:', error);
    throw error;
  }
};

export const clearCache = () => {
  packagesCache = null;
  productsCache = null;
  lastFetchTime = null;
  console.log('Cache cleared');
};

export const getNextQuoteNumber = async (): Promise<string> => {
  try {
    const records = await base('הצעות מחיר').select({
      maxRecords: 1,
      sort: [{ field: 'מספר הזמנה', direction: 'desc' }],
      fields: ['מספר הזמנה'],
      filterByFormula: "NOT({מספר הזמנה} = '')"
    }).firstPage();
    if (records.length === 0) {
      return '10371';
    }
    const lastNumber = records[0].get('מספר הזמנה') as string;
    console.log('Last quote number:', lastNumber);
    const nextNumber = (parseInt(lastNumber) + 1).toString();
    console.log('Next quote number:', nextNumber);
    return nextNumber;
  } catch (error) {
    console.error('Error getting next quote number:', error);
    throw error;
  }
};

export const createQuoteRecord = async (quoteData: Partial<QuoteRecord>): Promise<string> => {
  try {
    const nextNumber = await getNextQuoteNumber();
    const records = await base('הצעות מחיר').create([
      {
        fields: {
          'מספר הזמנה': nextNumber,
          'שם לקוח': quoteData.customerName,
          'שם חברה': quoteData.companyName,
          'סטטוס': quoteData.status || 'מחכה להצעת מחיר',
          'אופציות': JSON.stringify(quoteData.options),
          'תאריך יצירה': new Date().toISOString(),
          'תאריך עדכון': new Date().toISOString(),
          'תקציב למארז': quoteData.budgetBeforeVAT,
          'תקציב למארז כולל מעמ': quoteData.budgetWithVAT,
          'רשומה ראשית': true // סימון כרשומה ראשית
        }
      }
    ]);
    return records[0].getId();
  } catch (error) {
    console.error('Error creating quote record:', error);
    throw error;
  }
};

export const updateQuoteStatus = async (quoteId: string, status: QuoteStatus): Promise<void> => {
  try {
    await base('הצעות מחיר').update([
      {
        id: quoteId,
        fields: {
          'סטאטוס': status,
          'תאריך עדכון': new Date().toISOString()
        }
      }
    ]);
  } catch (error) {
    console.error('Error updating quote status:', error);
    throw error;
  }
};

export const getQuoteFromLead = async (leadId: string): Promise<Partial<QuoteRecord>> => {
  try {
    const record = await base('לידים').find(leadId);
    return {
      customerName: record.get('שם לקוח') as string,
      companyName: record.get('שם חברה') as string,
    };
  } catch (error) {
    console.error('Error getting lead data:', error);
    throw error;
  }
};

export const saveQuote = async (
  recordId: string, 
  quoteData: { 
    quoteNumber: string;
    data?: {
      customerCard?: string;
      customerLabel?: string;
      shippingOption?: string;
      pickupApproval?: string;
    }
  }
): Promise<void> => {
  try {
    if (!quoteData.quoteNumber) {
      throw new Error('Quote number is required');
    }
    const fields: any = {
      'מספר הזמנה': Number(quoteData.quoteNumber),
      'סטאטוס': 'מחכה לבניית הצעה'
    };
    
    // הוספת שדות נוספים אם קיימים
    if (quoteData.data) {
      if (quoteData.data.customerCard) fields['גלוית לקוח'] = quoteData.data.customerCard;
      if (quoteData.data.customerLabel) fields['מדבקת לקוח'] = quoteData.data.customerLabel;
      if (quoteData.data.shippingOption) fields['משלוח'] = quoteData.data.shippingOption;
      if (quoteData.data.pickupApproval) fields['איסוף/משלוח מאושר'] = quoteData.data.pickupApproval;
    }
    
    await base('הצעות מחיר').update(recordId, fields);
  } catch (error: any) {
    console.error('Error updating quote:', error);
    throw error;
  }
};

export const getQuoteNumberFromRecord = async (recordId: string): Promise<string> => {
  try {
    const record = await base('הצעות מחיר').find(recordId);
    return record.get('מספר הזמנה')?.toString() || '';
  } catch (error) {
    console.error('Error getting quote number:', error);
    throw error;
  }
};

export const initializeQuoteNumber = async (recordId: string): Promise<string> => {
  try {
    const existingNumber = await getQuoteNumberFromRecord(recordId);
    if (existingNumber) {
      return existingNumber;
    }
    const nextNumber = await getNextQuoteNumber();
    await base('הצעות מחיר').update(recordId, {
      'מספר הזמנה': Number(nextNumber),
      'רשומה ראשית': true // סימון כרשומה ראשית
    });
    return nextNumber;
  } catch (error) {
    console.error('Error initializing quote number:', error);
    throw error;
  }
};

export const getAndInitializeQuoteNumber = async (recordId: string): Promise<string> => {
  try {
    const record = await base('הצעות מחיר').find(recordId);
    let quoteNumber = record.get('מספר הזמנה')?.toString();
    if (!quoteNumber) {
      quoteNumber = await getNextQuoteNumber();
      await base('הצעות מחיר').update(recordId, {
        'מספר הזמנה': quoteNumber,
        'רשומה ראשית': true // סימון כרשומה ראשית
      });
    }
    return quoteNumber.toString();
  } catch (error) {
    console.error('Error getting/initializing quote number:', error);
    throw new Error('Failed to get or initialize quote number');
  }
};

export const updateManagerNotes = async (
  quoteNumber: string,
  notes: string
): Promise<void> => {
  try {
    const records = await base('הצעות מחיר')
      .select({
        maxRecords: 1,
        filterByFormula: `{מספר הזמנה} = '${quoteNumber}'`
      })
      .firstPage();
    if (!records.length) {
      throw new Error(`לא נמצאה הצעה עם מספר ${quoteNumber}`);
    }
    await base('הצעות מחיר').update([{
      id: records[0].id,
      fields: {
        'הערות מנהל לתיקון': notes,
        'סטאטוס': 'בתיקון'
      }
    }]);
  } catch (error) {
    console.error('Error updating manager notes:', error);
    throw error;
  }
};

export const updateQuoteApprovalLink = async (
  quoteNumber: string, 
  approvalLink: string, 
  status: QuoteStatus = 'נשלחה הצעה ללקוח'
): Promise<void> => {
  try {
    const records = await base('הצעות מחיר')
      .select({
        maxRecords: 1,
        filterByFormula: `{מספר הזמנה} = '${quoteNumber}'`
      })
      .firstPage();
    if (!records.length) {
      throw new Error(`לא נמצאה הצעה עם מספר ${quoteNumber}`);
    }
    await base('הצעות מחיר').update([{
      id: records[0].id,
      fields: {
        'לינק להצעת מחיר לאישור לקוח': approvalLink,
        'סטאטוס': status
      }
    }]);
  } catch (error) {
    console.error('Error updating quote approval link:', error);
    throw error;
  }
};

export const updateApprovedQuote = async (
  quoteId: string,
  selectedOption: QuoteOption,
  signedPdfUrl: string
): Promise<void> => {
  try {
    await base('הצעות מחיר').update([
      {
        id: quoteId,
        fields: {
          'סטאטוס': 'הזמנה מאושרת',
          'הצעת מחיר חתומה': [{ url: signedPdfUrl }],
          'מוצרים': selectedOption.items || [],
          'תאריך עדכון': new Date().toISOString()
        }
      }
    ]);
  } catch (error) {
    console.error('Error updating approved quote:', error);
    throw error;
  }
};

export const uploadPdfToAirtable = async (recordId: string, pdfBlob: Blob): Promise<string> => {
  try {
    console.log('Starting PDF upload process for record:', recordId);
    const base64String = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = (error) => {
        console.error('Error reading file:', error);
        reject(error);
      };
      reader.readAsDataURL(pdfBlob);
    });
    console.log('File converted to base64');
    const filename = `quote-${recordId}-${Date.now()}.pdf`;
    console.log('Sending request to API endpoint...');
    const response = await fetch('/api/upload-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recordId, pdfBase64: base64String, filename })
    });
    console.log('API Response status:', response.status);
    const data = await response.json();
    if (!response.ok) {
      console.error('API error response:', data);
      throw new Error(data.error || 'Upload failed');
    }
    if (data.error) {
      console.error('Error in response data:', data.error);
      throw new Error(data.error);
    }
    console.log('Upload completed successfully');
    return data.url;
  } catch (error) {
    console.error('Upload error details:', error);
    throw new Error('Failed to upload PDF: ' + (error instanceof Error ? error.message : 'Unknown error'));
  }
};

export const uploadApprovalToAirtable = async (recordId: string, imageDataUrl: string): Promise<void> => {
  try {
    const base64Data = imageDataUrl.split(',')[1];
    await base('הצעות מחיר').update([{
      id: recordId,
      fields: {
        'הצעת מחיר חתומה': [{
          filename: `approval-${recordId}.png`,
          type: 'image/png',
          content: base64Data
        }]
      }
    }]);
  } catch (error) {
    console.error('Error uploading approval:', error);
    throw error;
  }
};

export const approveQuote = async (recordId: string, selectedOption: any): Promise<void> => {
  try {
    console.log('Record ID being used:', recordId);
    console.log('Selected option:', selectedOption);
    const record = await base('הצעות מחיר').find(recordId);
    console.log('Found record:', record.id);
    const productIds = selectedOption.items.map((item: any) => item.id.split('-')[0]);
    console.log('Product IDs to update:', productIds);
    const productNames = selectedOption.items.map((item: any) => item.name);
    console.log('Product names:', productNames);
    await base('הצעות מחיר').update(recordId, {
      'מוצרים': productIds,
      'מוצר (from מוצרים)': productNames,
      'סטאטוס': 'הזמנה מאושרת'
    });
  } catch (error) {
    console.error('Detailed error:', error);
    throw error;
  }
};

export const fetchQuoteById = async (quoteNumber: string) => {
  try {
    console.log('Fetching quote number:', quoteNumber);
    const records = await base('הצעות מחיר')
      .select({
        maxRecords: 1,
        filterByFormula: `{מספר הזמנה} = '${quoteNumber}'`
      })
      .firstPage();
    if (records && records.length > 0) {
      const record = records[0];
      console.log('Found quote:', {
        id: record.id,
        fields: record.fields,
        products: record.fields['מוצרים']
      });
      return record;
    } else {
      console.log('No quote found with number:', quoteNumber);
      return null;
    }
  } catch (error) {
    console.error('Error fetching quote:', error);
    throw error;
  }
};

export const updateQuoteWithApproval = async (
  quoteNumber: string,
  approvedQuoteId: string,
  selectedOption: {
    items: Array<{ id: string }>,
    packagingItems?: Array<{ id: string }>
  }
): Promise<void> => {
  try {
    console.log('Updating quote in Airtable:', quoteNumber);
    console.log('Selected regular items:', selectedOption.items);
    console.log('Selected packaging items:', selectedOption.packagingItems);
    
    const records = await base('הצעות מחיר')
      .select({
        maxRecords: 1,
        filterByFormula: `{מספר הזמנה} = '${quoteNumber}'`
      })
      .firstPage();
    if (!records.length) {
      throw new Error(`לא נמצאה הצעה עם מספר ${quoteNumber}`);
    }
    const record = records[0];
    const approvedQuoteLink = `${window.location.origin}/approved-quote/${approvedQuoteId}`;
    const productIds = selectedOption.items.map(item => {
      const id = item.id.includes('-') ? item.id.split('-')[0] : item.id;
      console.log('Processing product ID:', id);
      return id;
    });
    const packagingIds = selectedOption.packagingItems?.map(item => {
      const id = item.id.includes('-') ? item.id.split('-')[0] : item.id;
      console.log('Processing packaging ID:', id);
      return id;
    }) || [];
    await base('הצעות מחיר').update([{
      id: record.id,
      fields: {
        'סטאטוס': 'הזמנה מאושרת',
        'לינק להצעת מחיר מאושרת': approvedQuoteLink,
        'מוצרים': productIds,
        'מוצרי אריזה ומיתוג': packagingIds
      }
    }]);
    console.log('Successfully updated quote with all products in Airtable');
  } catch (error) {
    console.error('Detailed error in updateQuoteWithApproval:', error);
    throw error;
  }
};

export { base };

export const fetchAgents = async (): Promise<Agent[]> => {
  try {
    const records = await base("סוכנים").select().all();
    return records.map(record => ({
      id: record.id,
      name: record.get("שם") as string,
    }));
  } catch (error) {
    console.error("Error fetching agents:", error);
    throw error;
  }
};