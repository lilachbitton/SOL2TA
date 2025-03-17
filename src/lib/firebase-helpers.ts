// lib/firebase-helpers.ts
import { 
  collection, 
  getDocs, 
  query, 
  writeBatch,
  doc,
  getDoc,
  updateDoc,
  setDoc,
  serverTimestamp
} from 'firebase/firestore';
import { db } from './firebase';
import { Product, Package } from '@/lib/airtable';

// =====================
// Types
// =====================

export interface QuoteOption {
  name: string;
  description: string;
  price: number;
  items?: string[];
  packagingItems?: string[];
}

export interface QuoteData {
  id: string;
  quoteNumber: string;
  customerName: string;
  customerPhone: string;
  options: QuoteOption[];
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Date | null;
  approvedAt?: Date | null;
  selectedOption?: number;
  selectedOptionData?: QuoteOption;
  signature?: string;
  signerName?: string;
  topNotes?: string;
  bottomNotes?: string;
  // שדות חדשים
  budgetBeforeVAT?: number;
  budgetWithVAT?: number;
  profitTarget?: number;      // נשמר כערך דצימלי (למשל 0.36)
  agentCommission?: number;   // נשמר כערך דצימלי
  packageQuantity?: number;
  selectedAgent?: string;
}

// =====================
// Existing functions
// =====================

export const getProductsFromFirestore = async () => {
  try {
    const productsRef = collection(db, 'products');
    const snapshot = await getDocs(productsRef);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error fetching products:', error);
    throw error;
  }
};

export const getPackagesFromFirestore = async () => {
  try {
    const packagesRef = collection(db, 'packages');
    const snapshot = await getDocs(packagesRef);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error fetching packages:', error);
    throw error;
  }
};

export const syncFromAirtable = async (products: Product[], packages: Package[]) => {
  try {
    const batch = writeBatch(db);
    products.forEach(product => {
      const docRef = doc(collection(db, 'products'));
      const productData = {
        name: product.name || '',
        details: product.details || '',
        price: product.price || 0,
        productType: product.productType || '',
        inventory: product.inventory || ''
      };
      batch.set(docRef, productData);
    });
    packages.forEach(pkg => {
      const docRef = doc(collection(db, 'packages'));
      const packageData = {
        name: pkg.name || '',
        items: pkg.items || [],
        packagingItems: pkg.packagingItems || [],
        packagePrice: pkg.packagePrice || 0,
        imageUrl: pkg.imageUrl || '',
        parallelPackages: pkg.parallelPackages || []
      };
      batch.set(docRef, packageData);
    });
    await batch.commit();
    console.log('Sync completed successfully');
  } catch (error) {
    console.error('Error during sync:', error);
    throw error;
  }
};

export const createQuote = async ({
  quoteNumber,
  customerName,
  customerPhone,
  options,
  topNotes,
  bottomNotes,
}: {
  quoteNumber: string;
  customerName: string;
  customerPhone: string;
  options: QuoteOption[];
  topNotes: string;
  bottomNotes: string;
}) => {
  const quoteRef = doc(collection(db, 'quotes'));
  const quoteData = {
    id: quoteRef.id,
    quoteNumber,
    customerName,
    customerPhone,
    options,
    topNotes,
    bottomNotes,
    status: 'pending' as const,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await setDoc(quoteRef, quoteData);
  return { id: quoteRef.id, ...quoteData };
};

export async function getQuoteData(quoteId: string) {
  try {
    const quoteRef = doc(db, 'quotes', quoteId);
    const quoteSnap = await getDoc(quoteRef);
    if (!quoteSnap.exists()) {
      return null;
    }
    const data = quoteSnap.data();
    return {
      id: quoteSnap.id,
      ...data,
      createdAt: data.createdAt?.toDate() || null,
      approvedAt: data.approvedAt?.toDate() || null
    } as QuoteData;
  } catch (error) {
    console.error('Error fetching quote:', error);
    return null;
  }
}

export async function updateQuoteStatus(
  quoteId: string,
  data: {
    status: 'approved' | 'rejected';
    selectedOption?: number;
    selectedOptionData?: QuoteOption;
    signature?: string;
    signerName?: string;
  }
) {
  try {
    const quoteRef = doc(db, 'quotes', quoteId);
    await updateDoc(quoteRef, {
      ...data,
      approvedAt: serverTimestamp()
    });
    return true;
  } catch (error) {
    console.error('Error updating quote:', error);
    throw error;
  }
}

export async function generateQuoteNumber() {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('he-IL', { timeZone: 'Asia/Jerusalem' });
  const parts = formatter.formatToParts(now);
  const year = parts.find(p => p.type === 'year')?.value.slice(-2) || '';
  const month = parts.find(p => p.type === 'month')?.value.padStart(2, '0') || '';
  const quotesRef = collection(db, 'quotes');
  const snapshot = await getDocs(quotesRef);
  const currentMonthQuotes = snapshot.docs
    .map(doc => doc.data())
    .filter(quote => quote.quoteNumber?.startsWith(`${year}${month}`));
  const nextNum = (currentMonthQuotes.length + 1).toString().padStart(3, '0');
  return `${year}${month}-${nextNum}`;
}

// Updated saveQuoteToFirebase with new fields and filtering out undefined createdAt
export const saveQuoteToFirebase = async (quoteData: any) => {
  try {
    const quoteRef = doc(db, 'quotes', quoteData.recordId);
    // נבדוק ונסיר את השדה createdAt אם קיים
    const { createdAt, ...quoteDataWithoutCreatedAt } = quoteData || {};
    const dataToSave = {
      ...quoteDataWithoutCreatedAt,
      budgetBeforeVAT: quoteData.budgetBeforeVAT !== undefined ? Number(quoteData.budgetBeforeVAT) : null,
      budgetWithVAT: quoteData.budgetWithVAT !== undefined ? Number(quoteData.budgetWithVAT) : null,
      profitTarget: quoteData.profitTarget ? Number(quoteData.profitTarget) / 100 : null,
      agentCommission: quoteData.agentCommission ? Number(quoteData.agentCommission) / 100 : null,
      packageQuantity: quoteData.packageQuantity !== undefined ? quoteData.packageQuantity : null,
      selectedAgent: quoteData.selectedAgent || null,
      updatedAt: serverTimestamp(),
    };
    const existingDoc = await getDoc(quoteRef);
    if (existingDoc.exists()) {
      await updateDoc(quoteRef, dataToSave);
    } else {
      await setDoc(quoteRef, {
        ...dataToSave,
        createdAt: serverTimestamp(),
      });
    }
    return quoteData.recordId;
  } catch (error) {
    console.error('Error saving quote to Firebase:', error);
    throw error;
  }
};

export const getQuoteFromFirebase = async (recordId: string) => {
  try {
    const quoteRef = doc(db, 'quotes', recordId);
    const quoteDoc = await getDoc(quoteRef);
    if (quoteDoc.exists()) {
      const data = quoteDoc.data();
      return {
        ...data,
        createdAt: data.createdAt?.toDate?.().toISOString(),
        updatedAt: data.updatedAt?.toDate?.().toISOString(),
      };
    }
    return null;
  } catch (error) {
    console.error('Error getting quote from Firebase:', error);
    throw error;
  }
};

// New functions for approved quotes

export const createApprovedQuote = async ({
  originalQuoteId,
  quoteNumber,
  customerName,
  customerPhone,
  selectedOption,
  signature,
  topNotes,
  bottomNotes,
}: {
  originalQuoteId: string;
  quoteNumber: string;
  customerName: string;
  customerPhone: string;
  selectedOption: QuoteOption;
  signature: string;
  topNotes?: string;
  bottomNotes?: string;
}) => {
  const approvedQuoteRef = doc(collection(db, 'approved_quotes'));
  const approvedQuoteData = {
    id: approvedQuoteRef.id,
    originalQuoteId,
    quoteNumber,
    customerName,
    customerPhone,
    selectedOption,
    signature,
    topNotes,
    bottomNotes,
    approvedAt: serverTimestamp(),
  };
  await setDoc(approvedQuoteRef, approvedQuoteData);
  const originalQuoteRef = doc(db, 'quotes', originalQuoteId);
  await updateDoc(originalQuoteRef, {
    status: 'approved',
    approvedAt: serverTimestamp(),
    approvedQuoteId: approvedQuoteRef.id
  });
  return { id: approvedQuoteRef.id, ...approvedQuoteData };
};

export const getApprovedQuote = async (approvedQuoteId: string) => {
  try {
    const quoteRef = doc(db, 'approved_quotes', approvedQuoteId);
    const quoteSnap = await getDoc(quoteRef);
    if (!quoteSnap.exists()) {
      return null;
    }
    const data = quoteSnap.data();
    return {
      ...data,
      approvedAt: data.approvedAt?.toDate() || null
    };
  } catch (error) {
    console.error('Error fetching approved quote:', error);
    return null;
  }
};