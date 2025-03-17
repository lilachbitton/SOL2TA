"use client";

import React, { useState, useEffect } from "react";
import {
  base,
  fetchCatalogs,
  fetchPackagesByCatalog,
  fetchProductsByCatalog,
  getNextQuoteNumber,
  getAndInitializeQuoteNumber,
  saveQuote,
  fetchProductsByIds,
} from "@/lib/airtable";
import {
  getProductsFromFirestore,
  getPackagesFromFirestore,
  syncFromAirtable,
  saveQuoteToFirebase,
  getQuoteFromFirebase,
} from "@/lib/firebase-helpers";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { QuoteSendDialog } from "@/components/ui/quote-send-dialog";
import {
  Plus,
  Trash,
  Copy,
  GripVertical,
  Search,
  Filter,
  FileText,
  ChevronDown,
  MoreVertical,
  Send,
  Camera,
} from "lucide-react";

import { useToast } from "@/components/ui/use-toast";
import { Toaster } from "@/components/ui/toaster";

/* =====================
   Types
===================== */

interface Item {
  id: string;
  name: string;
  details: string;
  price?: number;
  type?: string;
  isCustom?: boolean;
  isNote?: boolean;
  comment?: string;
  showComment?: boolean;
  isPackage?: boolean;
  packageItems?: any[];
  packagingItems?: any[];
  isEditable?: boolean;
  inventory?: string;
  boxesPerCarton?: number;
  productType?: string;
}

interface AdditionalCost {
  id: string;
  name: string;
  amount: number;
  type: "fixed" | "percentage";
}
export interface QuoteOption {
  id: string;
  title: string;
  items: Item[];
  total: number;
  image: string | null;
  additionalCosts?: AdditionalCost[];
  terms?: string;
  templateId?: string;
  // שדות חישוביים
  additionalExpenses?: number;
  additionalExpensesMultiplier?: number;
  packagingWorkCost?: number;
  productsCost?: number;
  packagingItemsCost?: number;
  actualProfit?: number;
  actualProfitPercentage?: number;
  totalProfit?: number;
  itemCount?: number;
  remainingBudgetForProducts?: number;
  availableBudgetForProducts?: number;
  packagingType?: string;
  // שדות משלוחים
  shippingCostBeforeVAT?: number;
  shippingCostWithVAT?: number;
  shippingCostPerPackageBeforeVAT?: number;
  shippingCostPerPackageWithVAT?: number;
  customerShippingCostBeforeVAT?: number;
  customerShippingCostWithVAT?: number;
  customerShippingCostPerPackageBeforeVAT?: number;
  customerShippingCostPerPackageWithVAT?: number;
  totalPaymentBeforeVAT?: number;
  totalPaymentWithVAT?: number;
  calculatedDeliveryBoxesCount?: number;
  // שדות חדשים לכיווץ/סימון כלא רלוונטי
  isCollapsed?: boolean;
  isIrrelevant?: boolean;
  // שדות משלוח אינדיבידואליים
  deliveryCompany?: string;
  deliveryBoxesCount?: number | null;
  deliveryAddress?: string;
  shippingCost?: number;
  includeShipping?: boolean;
}
interface QuoteRecord {
  id: string;
  quoteNumber: string;
  customerName: string;
  companyName?: string;
  status?: string;
  options: QuoteOption[];
  createdAt: string;
  updatedAt: string;
  customerPhone?: string;
  customerEmail?: string;
  budgetBeforeVAT: number | null;
  budgetWithVAT: number | null;
  packageQuantity?: number | null;
  profitTarget?: number;
  agentCommission?: number;
  selectedAgent?: string | null;
  // שדות משלוחים
  deliveryCompany?: string;
  deliveryBoxesCount?: number | null;
  deliveryAddress?: string;
  customerNotes?: string;
// שדות חדשים
customerCard?: string;
customerLabel?: string;
shippingOption?: string;
pickupApproval?: string;
}

interface Agent {
  id: string;
  name: string;
}

interface Product {
  id: string;
  name: string;
  details?: string;
  price?: number;
  productType?: string;
}

interface Props {
  quoteId?: string;
  searchParams?: {
    customerName?: string;
    deliveryDate?: string;
    customerNotes?: string;
    packageBudget?: string;
    profitUnit?: string;
    phone?: string;
    email?: string;
    recordId?: string;
  };
}

/* =====================
   Sorting Options
===================== */
const SORT_OPTIONS = {
  all: "הכל",
  priceHighToLow: "מחיר - מהיקר לזול",
  priceLowToHigh: "מחיר - מהזול ליקר",
} as const;

type SortOption = keyof typeof SORT_OPTIONS;

/* =====================
   Helper: categorizeProducts
===================== */
const categorizeProducts = (products: Product[]) => {
  const brandingTypes = ["אריזה", "מיתוג", "קיטלוג"];
  return products.reduce(
    (acc, product) => {
      const type = product.productType?.toLowerCase() || "";
      if (brandingTypes.some((brandingType) => type.includes(brandingType.toLowerCase()))) {
        acc.brandingProducts.push(product);
      } else {
        acc.regularProducts.push(product);
      }
      return acc;
    },
    { regularProducts: [] as Product[], brandingProducts: [] as Product[] }
  );
};

/* =====================
   Helper: getPackagingType
===================== */
const getPackagingType = (items: Item[]): string => {
  const packagingItem = items.find(
    (item) =>
      item.type === "packaging" &&
      item.productType?.toLowerCase() === "אריזה"
  );
  return packagingItem?.name || "";
};

/* =====================
   Helper: getPrimaryPackagingItem
===================== */
const getPrimaryPackagingItem = (items: Item[]): Item | undefined => {
  const byProductType = items.find(
    (item) =>
      item.type === "packaging" &&
      item.productType?.toLowerCase() === "אריזה"
  );
  if (byProductType) return byProductType;
  return items.find(
    (item) =>
      item.type === "packaging" &&
      item.name &&
      (
        item.name.toLowerCase().includes("סלסל") ||
        item.name.toLowerCase().includes("קופס") ||
        item.name.toLowerCase().includes("מארז") ||
        item.name.toLowerCase().includes("ארגז")
      )
  );
};

/* =====================
   Helper: calculateDeliveryBoxesCount
===================== */
const calculateDeliveryBoxesCount = (items: Item[], quantity: number | null): number => {
  if (!quantity || quantity <= 0) return 0;
  const packagingItem = getPrimaryPackagingItem(items);
  if (!packagingItem) return quantity;
  const boxesPerCarton = packagingItem.boxesPerCarton || 1;
  return Math.ceil(quantity / boxesPerCarton);
};
const PriceQuoteBuilder: React.FC<Props> = ({ quoteId, searchParams }) => {
  console.log("Search Params:", searchParams);
  console.log("Quote ID:", quoteId);

  const [selectedCatalog, setSelectedCatalog] = useState<string | null>(null);
  const [catalogs, setCatalogs] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [packages, setPackages] = useState<any[]>([]);
  const [quoteOptions, setQuoteOptions] = useState<QuoteOption[]>([
    {
      id: "A",
      title: "אופציה 1 - הכנה חם או חדר למשפ׳",
      items: [],
      total: 0,
      image: null,
      additionalCosts: [],
      terms: "",
      templateId: "",
      isCollapsed: false,
      isIrrelevant: false,
    },
  ]);
  // ניהול גרירת שורה – נשמור את המיקום האמיתי בתוך option.items
  const [draggedRow, setDraggedRow] = useState<{ optionId: string; index: number } | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<SortOption>("all");
  const [showPreview, setShowPreview] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState("template1");
  const [expandedPackage, setExpandedPackage] = useState<string | null>(null);
  const [quoteData, setQuoteData] = useState<QuoteRecord | null>(null);
  const [showSendDialog, setShowSendDialog] = useState(false);
  const [showRowActions, setShowRowActions] = useState<string | null>(null);

  // Budget
  const [budgetBeforeVAT, setBudgetBeforeVAT] = useState<number | null>(
    searchParams?.packageBudget ? Number(searchParams.packageBudget) : null
  );
  const [budgetWithVAT, setBudgetWithVAT] = useState<number | null>(
    searchParams?.packageBudget ? Number(searchParams.packageBudget) * 1.18 : null
  );

  // Package and Agent
  const [packageQuantity, setPackageQuantity] = useState<number | null>(null);
  const [profitTarget, setProfitTarget] = useState<number>(36);
  const [agentCommission, setAgentCommission] = useState<number>(0);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);

  // Shipping
  const [includeShipping, setIncludeShipping] = useState<boolean>(false);
  const [shippingCost, setShippingCost] = useState<number>(0);
  const [shippingPerPackage, setShippingPerPackage] = useState<number>(0);

  // Delivery
  const [deliveryCompany, setDeliveryCompany] = useState<string>("");
  const [deliveryBoxesCount, setDeliveryBoxesCount] = useState<number | null>(null);
  const [deliveryAddress, setDeliveryAddress] = useState<string>("");
  const [customerNotes, setCustomerNotes] = useState<string>("");
  const [deliveryCompanies, setDeliveryCompanies] = useState<string[]>([]);

  const { toast } = useToast();

  // Additional Dropdown Fields
  const [customerCards, setCustomerCards] = useState<{ id: string; name: string }[]>([]);
  const [customerLabels, setCustomerLabels] = useState<{ id: string; name: string }[]>([]);
  const [shippingOptions, setShippingOptions] = useState<{ id: string; name: string }[]>([]);
  const [pickupApprovalOptions, setPickupApprovalOptions] = useState<{ id: string; name: string }[]>([]);

  const [selectedCustomerCard, setSelectedCustomerCard] = useState<string>("");
  const [selectedCustomerLabel, setSelectedCustomerLabel] = useState<string>("");
  const [selectedShippingOption, setSelectedShippingOption] = useState<string>("");
  const [selectedPickupApproval, setSelectedPickupApproval] = useState<string>("");

  /* =====================
     useEffects for loading dropdown fields from Airtable
  ===================== */
  useEffect(() => {
    async function loadCustomerCards() {
      try {
        const records = await base("הצעות מחיר").select({ fields: ["גלוית לקוח"] }).all();
        const cards = records.map((record) => record.get("גלוית לקוח")).filter((x) => typeof x === "string");
        const uniqueCards = Array.from(new Set(cards));
        setCustomerCards(uniqueCards.map((card) => ({ id: card, name: card })));
      } catch (error) {
        console.error("Error loading customer cards:", error);
      }
    }
    loadCustomerCards();
  }, []);

  useEffect(() => {
    async function loadCustomerLabels() {
      try {
        const records = await base("הצעות מחיר").select({ fields: ["מדבקת לקוח"] }).all();
        const labels = records.map((record) => record.get("מדבקת לקוח")).filter((x) => typeof x === "string");
        const uniqueLabels = Array.from(new Set(labels));
        setCustomerLabels(uniqueLabels.map((label) => ({ id: label, name: label })));
      } catch (error) {
        console.error("Error loading customer labels:", error);
      }
    }
    loadCustomerLabels();
  }, []);

  useEffect(() => {
    async function loadShippingOptions() {
      try {
        const records = await base("הצעות מחיר").select({ fields: ["משלוח"] }).all();
        const options = records.map((record) => record.get("משלוח")).filter((x) => typeof x === "string");
        const uniqueOptions = Array.from(new Set(options));
        setShippingOptions(uniqueOptions.map((option) => ({ id: option, name: option })));
      } catch (error) {
        console.error("Error loading shipping options:", error);
      }
    }
    loadShippingOptions();
  }, []);

  useEffect(() => {
    async function loadPickupApprovalOptions() {
      try {
        const records = await base("הצעות מחיר").select({ fields: ["איסוף/משלוח מאושר"] }).all();
        const options = records.map((record) => record.get("איסוף/משלוח מאושר")).filter((x) => typeof x === "string");
        const uniqueOptions = Array.from(new Set(options));
        setPickupApprovalOptions(uniqueOptions.map((option) => ({ id: option, name: option })));
      } catch (error) {
        console.error("Error loading pickup approval options:", error);
      }
    }
    loadPickupApprovalOptions();
  }, []);

  /* =====================
     Additional Expenses Calculations
  ===================== */
  const calculateAdditionalExpensesByBudget = (budget: number): number => {
    if (!budget) return 0;
    if (budget >= 45 && budget < 90) return 8;
    if (budget >= 90 && budget < 150) return 16;
    if (budget >= 150 && budget < 200) return 21;
    if (budget >= 200 && budget < 250) return 25;
    if (budget >= 250 && budget < 300) return 29;
    if (budget >= 300) return 33;
    return 0;
  };

  const calculateAdditionalExpensesMultiplier = (budget: number): number => {
    if (!budget) return 0;
    if (budget >= 45 && budget < 90) return 0.5;
    if (budget >= 90 && budget < 150) return 1;
    if (budget >= 150 && budget < 200) return 1.25;
    if (budget >= 200 && budget < 250) return 1.5;
    if (budget >= 250 && budget < 300) return 1.75;
    if (budget >= 300) return 2;
    return 0;
  };

  /* =====================
     calculateOptionFinancials
  ===================== */
  const calculateOptionFinancials = (option: QuoteOption): QuoteOption => {
    const itemCount = option.items.filter(item => item.type !== 'packaging').length;
    const hasBoxPackaging = option.items.some(
      item => item.type === 'packaging' && item.name.toLowerCase().includes('קופסת')
    );
    const packagingWorkCost = itemCount * 0.5 + (hasBoxPackaging ? 2 : 1);
const optionShippingCost = option.shippingCost !== undefined ? option.shippingCost : shippingCost;     const optionIncludeShipping = option.includeShipping !== undefined ? option.includeShipping : includeShipping;
    const productsCost = option.items
      .filter(item => item.type !== 'packaging' && item.price)
      .reduce((sum, item) => sum + (item.price || 0), 0);
    const packagingItemsCost = option.items
      .filter(item => item.type === 'packaging' && item.price)
      .reduce((sum, item) => sum + (item.price || 0), 0);
    const calculatedAdditionalExpenses = calculateAdditionalExpensesByBudget(budgetBeforeVAT || 0);
    const additionalExpensesMultiplier = calculateAdditionalExpensesMultiplier(budgetBeforeVAT || 0);
    const packagingType = getPackagingType(option.items);
    const targetProfitAmount = (budgetBeforeVAT || 0) * (profitTarget / 100);
    const agentCommissionAmount = (agentCommission / 100) * (budgetBeforeVAT || 0);
    const availableBudget = (budgetBeforeVAT || 0) - targetProfitAmount - agentCommissionAmount;
    const shippingCostBeforeVAT = shippingCost;
    const shippingCostWithVAT = shippingCost * 1.18;
    const shippingCostPerPackageBeforeVAT = packageQuantity ? shippingCost / packageQuantity : 0;
    const shippingCostPerPackageWithVAT = shippingCostPerPackageBeforeVAT * 1.18;
    const customerShippingCostBeforeVAT = shippingCost >= 600 ? shippingCost : shippingCost * 1.1;
    const customerShippingCostWithVAT = customerShippingCostBeforeVAT * 1.18;
    const customerShippingCostPerPackageBeforeVAT = packageQuantity ? customerShippingCostBeforeVAT / packageQuantity : 0;
    const customerShippingCostPerPackageWithVAT = customerShippingCostPerPackageBeforeVAT * 1.18;
    const shippingCostForBudgetCalculation = includeShipping ? customerShippingCostPerPackageBeforeVAT : 0;
    const remainingBudgetForProducts = availableBudget - packagingItemsCost - packagingWorkCost - calculatedAdditionalExpenses - shippingCostForBudgetCalculation;
    const actualProfit = (budgetBeforeVAT || 0)
      - (includeShipping ? customerShippingCostPerPackageBeforeVAT : 0)
      - productsCost
      - calculatedAdditionalExpenses
      - packagingItemsCost
      - packagingWorkCost
      - agentCommissionAmount;
    const actualProfitPercentage = budgetBeforeVAT ? (actualProfit / budgetBeforeVAT) * 100 : 0;
    const totalProfit = actualProfit * (packageQuantity || 0);
    const availableBudgetForProducts = remainingBudgetForProducts - productsCost;
    const totalPaymentBeforeVAT = (option.total || 0) * (packageQuantity || 0);
    const totalPaymentWithVAT = (option.total || 0) * 1.18 * (packageQuantity || 0);
    const calculatedDeliveryBoxesCount = calculateDeliveryBoxesCount(option.items, packageQuantity);

    return {
      ...option,
      itemCount,
      packagingWorkCost,
      productsCost,
      packagingItemsCost,
      additionalExpenses: calculatedAdditionalExpenses,
      additionalExpensesMultiplier,
      packagingType,
      actualProfit,
      actualProfitPercentage,
      totalProfit,
      remainingBudgetForProducts,
      availableBudgetForProducts,
      shippingCostBeforeVAT,
      shippingCostWithVAT,
      shippingCostPerPackageBeforeVAT,
      shippingCostPerPackageWithVAT,
      customerShippingCostBeforeVAT,
      customerShippingCostWithVAT,
      customerShippingCostPerPackageBeforeVAT,
      customerShippingCostPerPackageWithVAT,
      totalPaymentBeforeVAT,
      totalPaymentWithVAT,
      calculatedDeliveryBoxesCount,
    };
  };

  /* =====================
     useEffect: עדכון shippingPerPackage
  ===================== */
  useEffect(() => {
    if (includeShipping && packageQuantity && packageQuantity > 0) {
      setShippingPerPackage(parseFloat((shippingCost / packageQuantity).toFixed(2)));
    } else {
      setShippingPerPackage(0);
    }
  }, [includeShipping, shippingCost, packageQuantity]);

  /* =====================
     useEffect: חישוב מחדש של האופציות
  ===================== */
  useEffect(() => {
    setQuoteOptions((prevOptions) =>
      prevOptions.map((option) => calculateOptionFinancials(option))
    );
  }, [budgetBeforeVAT, packageQuantity, agentCommission, profitTarget, includeShipping, shippingPerPackage]);

  /* =====================
     useEffect: עדכון כמות קרטונים להובלה
  ===================== */
  useEffect(() => {
    if (quoteOptions.length > 0 && packageQuantity && packageQuantity > 0) {
      const currentOption = quoteOptions[0];
      const boxesCount = calculateDeliveryBoxesCount(currentOption.items, packageQuantity);
      setDeliveryBoxesCount(boxesCount);
    }
  }, [quoteOptions, packageQuantity]);

  /* =====================
     handleDrop: טיפול בהוספת פריטים (גרירת מוצר בודד או מארז)
     כולל טיפול במארזים מקבילים
  ===================== */
  const handleDrop = (e: React.DragEvent, optionId: string) => {
    e.preventDefault();
    const itemData = JSON.parse(e.dataTransfer.getData("application/json"));
    console.log("נגרר פריט:", itemData);

    setQuoteOptions((prev) => {
      let updatedOptions = [...prev];
      const currentOptionIndex = updatedOptions.findIndex((opt) => opt.id === optionId);
      if (currentOptionIndex === -1) return prev;

      if (itemData.items) {
        const regularItems = itemData.items.map((item: any) => ({
          id: `${item.id}-${Date.now()}`,
          name: item.name,
          details: item.details || "",
          price: item.price || 0,
          type: "product",
          productType: item.productType || "",
          isEditable: true,
          inventory: item.inventory || "",
          boxesPerCarton: item.boxesPerCarton ? Number(item.boxesPerCarton) : 1,
        }));
        const packagingItems = itemData.packagingItems
          ? itemData.packagingItems.map((item: any) => ({
              id: `${item.id}-${Date.now()}`,
              name: item.name,
              details: item.details || "",
              price: item.price || 0,
              type: "packaging",
              productType: item.productType || "",
              isEditable: true,
              inventory: item.inventory || "",
              boxesPerCarton: item.boxesPerCarton ? Number(item.boxesPerCarton) : 1,
            }))
          : [];

        updatedOptions[currentOptionIndex] = {
          ...updatedOptions[currentOptionIndex],
          title: itemData.name,
          items: [...regularItems, ...packagingItems],
          total: itemData.packagePrice || 0,
          image: itemData.imageUrl || null,
        };

        // טיפול במארזים מקבילים
        if (itemData.parallelPackages && itemData.parallelPackages.length > 0) {
          itemData.parallelPackages.forEach((parallelPackageId: string) => {
            const parallelPackage = packages.find((pkg) => pkg.id === parallelPackageId);
            if (!parallelPackage) return;

            const parallelRegularItems = parallelPackage.items.map((item: any) => ({
              id: `${item.id}-${Date.now()}`,
              name: item.name,
              details: item.details || "",
              price: item.price || 0,
              type: "product",
              productType: item.productType || "",
              isEditable: true,
              inventory: item.inventory || "",
              boxesPerCarton: item.boxesPerCarton ? Number(item.boxesPerCarton) : 1,
            }));

            const parallelPackagingItems = parallelPackage.packagingItems
              ? parallelPackage.packagingItems.map((item: any) => ({
                  id: `${item.id}-${Date.now()}`,
                  name: item.name,
                  details: item.details || "",
                  price: item.price || 0,
                  type: "packaging",
                  productType: item.productType || "",
                  isEditable: true,
                  inventory: item.inventory || "",
                  boxesPerCarton: item.boxesPerCarton ? Number(item.boxesPerCarton) : 1,
                }))
              : [];

            const nextLetter = String.fromCharCode(65 + updatedOptions.length);
            updatedOptions.push({
              id: nextLetter,
              title: `אופציה ${nextLetter} - ${parallelPackage.name}`,
              items: [...parallelRegularItems, ...parallelPackagingItems],
              total: parallelPackage.packagePrice || 0,
              image: parallelPackage.imageUrl || null,
              additionalCosts: [],
              terms: "",
              templateId: "",
              isCollapsed: false,
              isIrrelevant: false,
            });
          });
        }
      } else {
        updatedOptions[currentOptionIndex] = {
          ...updatedOptions[currentOptionIndex],
          items: [
            ...updatedOptions[currentOptionIndex].items,
            {
              id: itemData.id,
              name: itemData.name,
              details: itemData.details || "",
              price: itemData.price || 0,
              type: itemData.type || "product",
              productType: itemData.productType || "",
              isEditable: true,
              inventory: itemData.inventory || "",
              boxesPerCarton: itemData.boxesPerCarton ? Number(itemData.boxesPerCarton) : 1,
            },
          ],
        };
      }

      return updatedOptions.map((option) => calculateOptionFinancials(option));
    });
  };

  /* =====================
     Drag & Drop / Row Reordering
  ===================== */
  const handleReorderStart = (e: React.DragEvent, optionId: string, actualIndex: number) => {
    e.stopPropagation();
    setDraggedRow({ optionId, index: actualIndex });
    e.currentTarget.classList.add("opacity-50", "scale-105");
  };

  const handleReorderOver = (e: React.DragEvent, optionId: string, actualIndex: number) => {
    e.preventDefault();
    if (!draggedRow || draggedRow.optionId !== optionId) return;
    if (draggedRow.index === actualIndex) return;
    setQuoteOptions((prev) =>
      prev.map((opt) => {
        if (opt.id === optionId) {
          const items = [...opt.items];
          const [removed] = items.splice(draggedRow.index, 1);
          items.splice(actualIndex, 0, removed);
          return { ...opt, items };
        }
        return opt;
      })
    );
    setDraggedRow({ optionId, index: actualIndex });
  };

  const handleDragEnd = (e: React.DragEvent) => {
    e.currentTarget.classList.remove("opacity-50", "scale-105");
    setDraggedRow(null);
  };

  const handleDragStart = (e: React.DragEvent, item: Item | any) => {
    e.dataTransfer.setData("application/json", JSON.stringify(item));
  };

  /* =====================
     Row Actions (Duplicate, Remove)
  ===================== */
  const renderRowActions = (option: QuoteOption, itemId: string) => (
    <div
      className="absolute left-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50"
      onMouseLeave={() => setShowRowActions(null)}
    >
      <button
        onClick={() => {
          duplicateItem(option.id, itemId);
          setShowRowActions(null);
        }}
        className="w-full text-right px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
      >
        <Copy size={14} className="inline ml-2" /> שכפל שורה
      </button>
      <button
        onClick={() => {
          removeRow(option.id, itemId);
          setShowRowActions(null);
        }}
        className="w-full text-right px-4 py-2 text-sm text-red-600 hover:bg-gray-100"
      >
        <Trash size={14} className="inline ml-2" /> מחק שורה
      </button>
    </div>
  );

  const removeRow = (optionId: string, itemId: string) => {
    setQuoteOptions((prev) =>
      prev.map((opt) =>
        opt.id === optionId ? { ...opt, items: opt.items.filter((item) => item.id !== itemId) } : opt
      )
    );
  };

  const duplicateItem = (optionId: string, itemId: string) => {
    setQuoteOptions((prev) =>
      prev.map((opt) => {
        if (opt.id === optionId) {
          const itemIndex = opt.items.findIndex((item) => item.id === itemId);
          if (itemIndex === -1) return opt;
          const itemToDuplicate = opt.items[itemIndex];
          const newItem = {
            ...itemToDuplicate,
            id: `${itemToDuplicate.id}-copy-${Date.now()}`,
          };
          const newItems = [...opt.items];
          newItems.splice(itemIndex + 1, 0, newItem);
          return { ...opt, items: newItems };
        }
        return opt;
      })
    );
  };
/* =====================
   handleSaveQuote - פתרון מקיף עם תיקונים
===================== */
const handleSaveQuote = async () => {
  try {
    if (!searchParams?.recordId) {
      toast({
        variant: "destructive",
        title: "שגיאה בשמירת ההצעה",
        description: "מזהה הרשומה חסר"
      });
      return;
    }
    
    // כעת אנחנו שומרים את כל האופציות, לא רק את הרלוונטיות
    if (quoteOptions.length === 0) {
      toast({
        variant: "destructive",
        title: "שגיאה בשמירת ההצעה",
        description: "אין אופציות להצעת המחיר"
      });
      return;
    }

    // שמור את הנתונים לפיירבייס - כולל כל האופציות באובייקט אחד
const firebaseData = {
  ...quoteData,
  recordId: searchParams.recordId,
  budgetBeforeVAT,
  budgetWithVAT,
  profitTarget,
  agentCommission,
  options: quoteOptions,  // האופציות כבר מכילות את נתוני המשלוח שלהן
  customerCard: selectedCustomerCard,
  customerLabel: selectedCustomerLabel,
  shippingOption: selectedShippingOption,
  pickupApproval: selectedPickupApproval,
  packageQuantity
};    
    // הוסף הוצאות נוספות אם יש
    if (typeof calculateAdditionalExpensesByBudget === 'function' && budgetBeforeVAT !== null) {
      const additionalExpenses = calculateAdditionalExpensesByBudget(budgetBeforeVAT);
      if (!isNaN(additionalExpenses)) {
        firebaseData.additionalExpenses = additionalExpenses;
      }
    }
    
    await saveQuoteToFirebase(firebaseData);
    console.log("Firebase update complete");

    // שלב 1: קבל את כל הרשומות הקיימות עבור הצעת מחיר זו
    const existingRecords = await base("הצעות מחיר")
      .select({
        filterByFormula: `{מספר הזמנה} = ${parseInt(quoteData?.quoteNumber) || 0}`
      })
      .all();
    
    console.log(`נמצאו ${existingRecords.length} רשומות קיימות להצעת מחיר ${quoteData?.quoteNumber}`);
    
    // המר את מספר ההצעה למספר
    const quoteNumber = parseInt(quoteData?.quoteNumber) || 0;
    console.log(`מספר הזמנה לשמירה: ${quoteNumber} (${typeof quoteNumber})`);
    
    // שלב 2: בנה את האופציות לשמירה - הראשונה כעדכון, היתר כחדשות אם צריך
    
    // אם יש רשומה ראשונה, נשתמש בה לאופציה הראשונה
    const firstRecordId = existingRecords.length > 0 ? existingRecords[0].id : null;
    
    // תחילה עדכן את הרשומה הראשונה אם קיימת
    if (firstRecordId && quoteOptions.length > 0) {
      // עדכן את הרשומה הראשונה עם נתוני האופציה הראשונה
      const firstOption = quoteOptions[0];
      
      // בנה אובייקט עם כל השדות לשמירה
      const optionFields = {
        // שדות מספריים ואחוזים
        "תקציב למארז": budgetBeforeVAT !== null ? Number(budgetBeforeVAT) : null,
        "מחיר למארז כולל מעמ": budgetWithVAT !== null ? Number(budgetWithVAT) : null,
        "יעד רווחיות": profitTarget ? profitTarget / 100 : null,
        "עמלת סוכן": agentCommission ? agentCommission / 100 : null,
        
// שדות בחירה - שולחים רק אם יש להם ערך ולא פלייסהולדר
...(selectedCustomerCard && !selectedCustomerCard.startsWith("בחר") ? {"גלוית לקוח": selectedCustomerCard} : {}),
...(selectedCustomerLabel && !selectedCustomerLabel.startsWith("בחר") ? {"מדבקת לקוח": selectedCustomerLabel} : {}),
...(selectedShippingOption && !selectedShippingOption.startsWith("בחר") ? {"משלוח": selectedShippingOption} : {}),
...(selectedPickupApproval && !selectedPickupApproval.startsWith("בחר") ? {"איסוף/משלוח מאושר": selectedPickupApproval} : {}),
...(firstOption.deliveryCompany && !firstOption.deliveryCompany.startsWith("בחר") ? {"חברת משלוחים": firstOption.deliveryCompany} : {}),

// שדות נוספים
"כמות מארזים": packageQuantity !== null ? Number(packageQuantity) : null,
"כתובת אספקה": firstOption.deliveryAddress || "",

// שדות משלוח - מספריים
"עלות חברת משלוחים": firstOption.shippingCost !== undefined ? Number(firstOption.shippingCost) : null,

// שדות טקסט
"כמות קרטונים להובלה": firstOption.deliveryBoxesCount !== null ? String(firstOption.deliveryBoxesCount) : "",

// שדה צ'ק בוקס
"תקציב כולל עלות משלוח": firstOption.includeShipping === true,        // שדות ייחודיים לאופציה
        "מחיר אופציה": firstOption.total !== undefined ? Number(firstOption.total) : null,
        "כותרת אופציה": firstOption.title ? String(firstOption.title) : "",
        
        // סטטוס האופציה
        "סטאטוס": firstOption.isIrrelevant ? "לא רלוונטי" : "מחכה לבניית הצעה"
      };
      
      // הוספת מידע כללי
      if (searchParams?.customerName) optionFields["שם לקוח"] = searchParams.customerName;
      if (searchParams?.email) optionFields["אימייל לקוח"] = searchParams.email;
      if (searchParams?.phone) optionFields["טלפון"] = searchParams.phone;
      if (searchParams?.customerNotes) optionFields["דגשים"] = searchParams.customerNotes;
      if (searchParams?.deliveryDate) optionFields["תאריך אספקה"] = searchParams.deliveryDate;
      
      // הוסף הוצאות נוספות אם יש
      if (typeof calculateAdditionalExpensesByBudget === 'function' && budgetBeforeVAT !== null) {
        const additionalExpenses = calculateAdditionalExpensesByBudget(budgetBeforeVAT);
        if (!isNaN(additionalExpenses)) {
          optionFields["הוצאות נוספות"] = Number(additionalExpenses);
        }
      }
      
      // הוסף את שדות התמחור
      if (shippingCost !== undefined && shippingCost !== null) {
        optionFields["תמחור משלוח ללקוח"] = Number(shippingCost);
      }
      
      if (shippingPerPackage !== undefined && shippingPerPackage !== null) {
        optionFields["הובלה במארז"] = Number(shippingPerPackage);
      }
      
      if (firstOption.customerShippingCostBeforeVAT !== undefined) {
        optionFields["תמחור משלוח ללקוח"] = Number(firstOption.customerShippingCostBeforeVAT);
      }
      
      if (firstOption.customerShippingCostPerPackageBeforeVAT !== undefined) {
        optionFields["הובלה במארז"] = Number(firstOption.customerShippingCostPerPackageBeforeVAT);
      }
      
      try {
        console.log(`מעדכן את הרשומה הראשונה (${firstRecordId}) עם אופציה "${firstOption.title}"`);
        await base("הצעות מחיר").update(firstRecordId, optionFields);
        console.log(`עודכנה רשומה ראשונה עם נתוני אופציה "${firstOption.title}"`);
      } catch (error) {
        console.error(`שגיאה בעדכון הרשומה הראשונה עם אופציה "${firstOption.title}":`, error);
        console.log("שדות שניסינו לשמור:", JSON.stringify(optionFields, null, 2));
      }
    }
    
    // לאחר מכן, טפל באופציות הנוספות (2 ואילך)
    // מחק קודם את הרשומות הנוספות הקיימות (מלבד הראשונה)
    for (let i = 1; i < existingRecords.length; i++) {
      try {
        await base("הצעות מחיר").destroy(existingRecords[i].id);
        console.log(`נמחקה רשומה נוספת ${existingRecords[i].id}`);
      } catch (error) {
        console.error(`שגיאה במחיקת רשומה נוספת ${existingRecords[i].id}:`, error);
      }
    }
    
    // עכשיו צור רשומות חדשות עבור האופציות הנוספות
    for (let i = 1; i < quoteOptions.length; i++) {
      const option = quoteOptions[i];
      
      // בנה אובייקט עם כל השדות לשמירה
      const optionFields = {
        // מספר הזמנה - הכרחי לרשומות חדשות
        "מספר הזמנה": quoteNumber,
        
        // שדות מספריים ואחוזים
        "תקציב למארז": budgetBeforeVAT !== null ? Number(budgetBeforeVAT) : null,
        "מחיר למארז כולל מעמ": budgetWithVAT !== null ? Number(budgetWithVAT) : null,
        "יעד רווחיות": profitTarget ? profitTarget / 100 : null,
        "עמלת סוכן": agentCommission ? agentCommission / 100 : null,
        
        // שדות בחירה - שולחים רק אם יש להם ערך ולא פלייסהולדר
        ...(selectedCustomerCard && !selectedCustomerCard.startsWith("בחר") ? {"גלוית לקוח": selectedCustomerCard} : {}),
        ...(selectedCustomerLabel && !selectedCustomerLabel.startsWith("בחר") ? {"מדבקת לקוח": selectedCustomerLabel} : {}),
        ...(selectedShippingOption && !selectedShippingOption.startsWith("בחר") ? {"משלוח": selectedShippingOption} : {}),
        ...(selectedPickupApproval && !selectedPickupApproval.startsWith("בחר") ? {"איסוף/משלוח מאושר": selectedPickupApproval} : {}),
        ...(deliveryCompany && !deliveryCompany.startsWith("בחר") ? {"חברת משלוחים": deliveryCompany} : {}),
        
        // שדות נוספים
        "כמות מארזים": packageQuantity !== null ? Number(packageQuantity) : null,
        "כתובת אספקה": deliveryAddress || "",
        
        // שדות משלוח - מספריים
        "עלות חברת משלוחים": shippingCost !== undefined ? Number(shippingCost) : null,
        
        // שדות טקסט
        "כמות קרטונים להובלה": deliveryBoxesCount !== null ? String(deliveryBoxesCount) : "",
        
        // שדה צ'ק בוקס
        "תקציב כולל עלות משלוח": includeShipping === true,
        
        // שדות ייחודיים לאופציה
        "מחיר אופציה": option.total !== undefined ? Number(option.total) : null,
        "כותרת אופציה": option.title ? String(option.title) : "",
        
        // סטטוס האופציה
        "סטאטוס": option.isIrrelevant ? "לא רלוונטי" : "מחכה לבניית הצעה"
      };
      
      // הוספת מידע כללי
      if (searchParams?.customerName) optionFields["שם לקוח"] = searchParams.customerName;
      if (searchParams?.email) optionFields["אימייל לקוח"] = searchParams.email;
      if (searchParams?.phone) optionFields["טלפון"] = searchParams.phone;
      if (searchParams?.customerNotes) optionFields["דגשים"] = searchParams.customerNotes;
      if (searchParams?.deliveryDate) optionFields["תאריך אספקה"] = searchParams.deliveryDate;
      
      // הוסף הוצאות נוספות אם יש
      if (typeof calculateAdditionalExpensesByBudget === 'function' && budgetBeforeVAT !== null) {
        const additionalExpenses = calculateAdditionalExpensesByBudget(budgetBeforeVAT);
        if (!isNaN(additionalExpenses)) {
          optionFields["הוצאות נוספות"] = Number(additionalExpenses);
        }
      }
      
      // הוסף את שדות התמחור
      if (shippingCost !== undefined && shippingCost !== null) {
        optionFields["תמחור משלוח ללקוח"] = Number(shippingCost);
      }
      
      if (shippingPerPackage !== undefined && shippingPerPackage !== null) {
        optionFields["הובלה במארז"] = Number(shippingPerPackage);
      }
      
      if (option.customerShippingCostBeforeVAT !== undefined) {
        optionFields["תמחור משלוח ללקוח"] = Number(option.customerShippingCostBeforeVAT);
      }
      
      if (option.customerShippingCostPerPackageBeforeVAT !== undefined) {
        optionFields["הובלה במארז"] = Number(option.customerShippingCostPerPackageBeforeVAT);
      }
      
      try {
        console.log(`יוצר רשומה חדשה לאופציה "${option.title}" (${i+1})`);
        const newRecord = await base("הצעות מחיר").create(optionFields);
        console.log(`נוצרה רשומה חדשה לאופציה "${option.title}" עם ID ${newRecord.id}`);
      } catch (error) {
        console.error(`שגיאה ביצירת רשומה לאופציה "${option.title}":`, error);
        console.log("שדות שניסינו לשמור:", JSON.stringify(optionFields, null, 2));
      }
    }
    
    toast({ title: "הצעת המחיר נשמרה בהצלחה" });
  } catch (error) {
    console.error("Error in handleSaveQuote:", error);
    toast({
      variant: "destructive",
      title: "שגיאה בשמירת ההצעה",
      description: error.message || "אירעה שגיאה בעת שמירת הצעת המחיר"
    });
  }
};
  const duplicateOption = (optionId: string) => {
    const optionToDuplicate = quoteOptions.find((opt) => opt.id === optionId);
    if (!optionToDuplicate) return;
    const newOption = {
      ...optionToDuplicate,
      id: String.fromCharCode(65 + quoteOptions.length),
      title: `${optionToDuplicate.title} (עותק)`,
      items: optionToDuplicate.items.map((item) => ({
        ...item,
        id: `${item.id}-copy-${Date.now()}`,
      })),
      additionalCosts: optionToDuplicate.additionalCosts
        ? optionToDuplicate.additionalCosts.map((cost) => ({
            ...cost,
            id: `cost-copy-${Date.now()}`,
          }))
        : [],
      isCollapsed: false,
      isIrrelevant: optionToDuplicate.isIrrelevant || false,
    };
    setQuoteOptions((prev) => [...prev, newOption]);
  };
const updateOptionShippingData = (optionId: string, field: string, value: any) => {
    setQuoteOptions(prev => 
      prev.map(opt => {
        if (opt.id === optionId) {
          return { ...opt, [field]: value };
        }
        return opt;
      })
    );
  };
  /* =====================
     Add Custom Row
  ===================== */
  const addCustomRow = (optionId: string) => {
    setQuoteOptions((prev) =>
      prev.map((opt) => {
        if (opt.id === optionId) {
          const regularItems = opt.items.filter((item) => item.type !== "packaging");
          const packagingItems = opt.items.filter((item) => item.type === "packaging");
          return {
            ...opt,
            items: [
              ...regularItems,
              {
                id: `custom-${Date.now()}`,
                name: "",
                details: "",
                isCustom: true,
                isEditable: true,
                type: "product",
              },
              ...packagingItems,
            ],
          };
        }
        return opt;
      })
    );
  };

  /* =====================
     Shipping Section
  ===================== */
const renderShippingSection = (option) => (
    <div className="mt-4 pb-4 border-b border-gray-200">
      <div className="flex items-center">
        <input
          type="checkbox"
          id={`includeShipping-${option.id}`}
          checked={option.includeShipping || false}
          onChange={(e) => updateOptionShippingData(option.id, 'includeShipping', e.target.checked)}
          className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
        />
        <label htmlFor={`includeShipping-${option.id}`} className="ml-2 text-sm font-medium text-gray-700">
          תקציב כולל עלות משלוח
        </label>
      </div>
    </div>
  );
  /* =====================
     useEffect: טעינת סוכנים
  ===================== */
  useEffect(() => {
    const loadAgents = async () => {
      try {
        const records = await base("הצעות מחיר")
          .select({ fields: ["סוכן"] })
          .all();
        const agentsSet = new Set<string>();
        records.forEach((record) => {
          const agentValue = record.get("סוכן");
          if (agentValue && typeof agentValue === "string") {
            agentsSet.add(agentValue);
          }
        });
        const agentsArray: Agent[] = Array.from(agentsSet).map((name) => ({
          id: name,
          name,
        }));
        setAgents(agentsArray);
      } catch (error) {
        console.error("Error loading agents:", error);
      }
    };
    loadAgents();
  }, []);

  /* =====================
     useEffect: טעינת חברות משלוחים
  ===================== */
  useEffect(() => {
    const loadDeliveryCompanies = async () => {
      try {
        const records = await base("הצעות מחיר")
          .select({ fields: ["חברת משלוחים"] })
          .all();
        const companiesSet = new Set<string>();
        records.forEach((record) => {
          const company = record.get("חברת משלוחים");
          if (company && typeof company === "string") {
            companiesSet.add(company);
          }
        });
        setDeliveryCompanies(Array.from(companiesSet));
      } catch (error) {
        console.error("Error loading delivery companies:", error);
      }
    };
    loadDeliveryCompanies();
  }, []);

/* =====================
   useEffect: טעינת נתונים מהאיירטייבל - מתוקן
===================== */
useEffect(() => {
  const loadAirtableFields = async () => {
    if (!searchParams?.recordId) return;
    try {
      const record = await base("הצעות מחיר").find(searchParams.recordId);
      const fields = record.fields;
      
      // טעינת שדות המספר והתקציב
      const airtablePackageQuantity = fields["כמות מארזים"];
      const airtableProfitTarget = fields["יעד רווחיות"];
      const airtableAgentCommission = fields["עמלת סוכן"];
      const airtableSelectedAgent = fields["סוכן"];
      
      setPackageQuantity(
        airtablePackageQuantity !== undefined
          ? airtablePackageQuantity
          : packageQuantity
      );
      setProfitTarget(
        airtableProfitTarget !== undefined ? airtableProfitTarget * 100 : profitTarget
      );
      setAgentCommission(
        airtableAgentCommission !== undefined ? airtableAgentCommission * 100 : agentCommission
      );
      setSelectedAgent(
        airtableSelectedAgent !== undefined ? airtableSelectedAgent : selectedAgent
      );
      
      // תיקון: טעינת שדות תקציב ומחיר כולל מע"מ
      const airtableBudgetBeforeVAT = fields["תקציב למארז"];
      const airtableBudgetWithVAT = fields["מחיר למארז כולל מעמ"];
      
      setBudgetBeforeVAT(
        airtableBudgetBeforeVAT !== undefined ? airtableBudgetBeforeVAT : budgetBeforeVAT
      );
      setBudgetWithVAT(
        airtableBudgetWithVAT !== undefined ? airtableBudgetWithVAT : budgetWithVAT
      );

      // תיקון: טעינת שדה "תקציב כולל עלות משלוח"
      const airtableIncludeShipping = fields["תקציב כולל עלות משלוח"];
      setIncludeShipping(
        airtableIncludeShipping !== undefined ? Boolean(airtableIncludeShipping) : includeShipping
      );

      // שדות משלוחים
      const airtableDeliveryCompany = fields["חברת משלוחים"];
      const airtableDeliveryBoxesCount = fields["כמות קרטונים להובלה"];
      const airtableDeliveryAddress = fields["כתובת אספקה"];
      const airtableCustomerNotes = fields["דגשים"];
      const airtableShippingCost = fields["עלות חברת משלוחים"];
      
      setDeliveryCompany(
        airtableDeliveryCompany !== undefined ? airtableDeliveryCompany : ""
      );
      setDeliveryBoxesCount(
        airtableDeliveryBoxesCount !== undefined ? airtableDeliveryBoxesCount : null
      );
      setDeliveryAddress(
        airtableDeliveryAddress !== undefined ? airtableDeliveryAddress : ""
      );
      setCustomerNotes(
        airtableCustomerNotes !== undefined ? airtableCustomerNotes : ""
      );
      
      // תיקון: טעינת עלות חברת משלוחים
      if (airtableShippingCost !== undefined) {
        setShippingCost(Number(airtableShippingCost));
      }
      
      // טעינת שדות נוספים
      const customerCard = fields["גלוית לקוח"];
      const customerLabel = fields["מדבקת לקוח"];
      const shippingOption = fields["משלוח"];
      const pickupApproval = fields["איסוף/משלוח מאושר"];

      setSelectedCustomerCard(customerCard || "");
      setSelectedCustomerLabel(customerLabel || "");
      setSelectedShippingOption(shippingOption || "");
      setSelectedPickupApproval(pickupApproval || "");

      console.log("Loaded fields from Airtable:", {
        budgetBeforeVAT: airtableBudgetBeforeVAT,
        budgetWithVAT: airtableBudgetWithVAT,
        includeShipping: airtableIncludeShipping,
        shippingCost: airtableShippingCost
      });

      // עדכון אובייקט quoteData
      setQuoteData((prev) => ({
        ...prev,
        budgetBeforeVAT:
          airtableBudgetBeforeVAT !== undefined
            ? airtableBudgetBeforeVAT
            : budgetBeforeVAT,
        budgetWithVAT:
          airtableBudgetWithVAT !== undefined
            ? airtableBudgetWithVAT
            : budgetWithVAT,
        packageQuantity:
          airtablePackageQuantity !== undefined
            ? airtablePackageQuantity
            : packageQuantity,
        profitTarget:
          airtableProfitTarget !== undefined ? airtableProfitTarget * 100 : profitTarget,
        agentCommission:
          airtableAgentCommission !== undefined ? airtableAgentCommission * 100 : agentCommission,
        selectedAgent:
          airtableSelectedAgent !== undefined ? airtableSelectedAgent : selectedAgent,
        deliveryCompany:
          airtableDeliveryCompany !== undefined ? airtableDeliveryCompany : "",
        deliveryBoxesCount:
          airtableDeliveryBoxesCount !== undefined ? airtableDeliveryBoxesCount : null,
        deliveryAddress:
          airtableDeliveryAddress !== undefined ? airtableDeliveryAddress : "",
        customerNotes:
          airtableCustomerNotes !== undefined ? airtableCustomerNotes : "",
        // שדות חדשים
        customerCard: customerCard || "",
        customerLabel: customerLabel || "",
        shippingOption: shippingOption || "",
        pickupApproval: pickupApproval || "",
        includeShipping: airtableIncludeShipping !== undefined ? Boolean(airtableIncludeShipping) : includeShipping,
        shippingCost: airtableShippingCost !== undefined ? Number(airtableShippingCost) : shippingCost
      }));
    } catch (error) {
      console.error("Error loading Airtable quote data:", error);
    }
  };
  loadAirtableFields();
}, [searchParams?.recordId]);

/* =====================
   useEffect: טעינת הסטטוס של האופציות מאיירטייבל
===================== */
useEffect(() => {
  const loadOptionsStatus = async () => {
    if (!quoteData?.quoteNumber) return;
    
    try {
      // מצא את כל הרשומות עם מספר ההזמנה הזה
      const records = await base("הצעות מחיר")
        .select({
          filterByFormula: `{מספר הזמנה} = "${quoteData.quoteNumber}"`,
          fields: ["סטאטוס"]
        })
        .all();
      
      if (records.length === 0) return;
      
      // מפה את הסטטוסים של האופציות (עכשיו ללא התייחסות לכותרת אופציה)
      const optionStatuses = records.map(record => {
        return record.get("סטאטוס") === "אופציה לא רלוונטית";
      });
      
      // אם יש רק אופציה אחת, עדכן אותה
      if (optionStatuses.length === 1 && quoteOptions.length === 1) {
        setQuoteOptions(prev => [
          { ...prev[0], isIrrelevant: optionStatuses[0] }
        ]);
      }
      // אם יש כמה אופציות, נסה להתאים לפי סדר
      else if (optionStatuses.length > 0 && optionStatuses.length <= quoteOptions.length) {
        setQuoteOptions(prev => 
          prev.map((option, index) => {
            if (index < optionStatuses.length) {
              return { ...option, isIrrelevant: optionStatuses[index] };
            }
            return option;
          })
        );
      }
      
      console.log("טעינת סטטוס האופציות הושלמה:", optionStatuses);
    } catch (error) {
      console.error("שגיאה בטעינת סטטוס האופציות:", error);
    }
  };
  
  loadOptionsStatus();
}, [quoteData?.quoteNumber, quoteOptions.length]); // רק כאשר מספר ההזמנה או מספר האופציות משתנה
  /* =====================
     Handlers for Budget Changes
  ===================== */
  const handleBudgetBeforeVATChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value ? parseFloat(Number(e.target.value).toFixed(2)) : null;
    setBudgetBeforeVAT(value);
    setBudgetWithVAT(value ? parseFloat((value * 1.18).toFixed(2)) : null);
  };

  const handleBudgetWithVATChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value ? parseFloat(Number(e.target.value).toFixed(2)) : null;
    setBudgetWithVAT(value);
    setBudgetBeforeVAT(value ? parseFloat((value / 1.18).toFixed(2)) : null);
  };

  /* =====================
     Effects: Catalog Loading
  ===================== */
  useEffect(() => {
    if (searchParams?.profitUnit) {
      setSelectedCatalog(searchParams.profitUnit);
    }
  }, [searchParams?.profitUnit]);

  useEffect(() => {
    const loadCatalogs = async () => {
      try {
        const data = await fetchCatalogs();
        setCatalogs(data);
      } catch (error) {
        console.error("Error loading catalogs", error);
      }
    };
    loadCatalogs();
  }, []);

  useEffect(() => {
    if (selectedCatalog) {
      const loadData = async () => {
        try {
          const [prods, pkgs] = await Promise.all([
            fetchProductsByCatalog(selectedCatalog),
            fetchPackagesByCatalog(selectedCatalog),
          ]);
          setProducts(prods);
          setPackages(pkgs);
          await syncFromAirtable(prods, pkgs);
          console.log("Data synced to Firebase successfully!");
        } catch (error) {
          console.error("Error loading and syncing data", error);
        }
      };
      loadData();
    } else {
      setProducts([]);
      setPackages([]);
    }
  }, [selectedCatalog]);

  /* =====================
     Combined Effect - Loading Quote Data
  ===================== */
  useEffect(() => {
    const loadQuote = async () => {
      if (!searchParams?.recordId) return;
      try {
        const savedQuote = await getQuoteFromFirebase(searchParams.recordId);
        if (savedQuote) {
          setQuoteData(savedQuote);
          if (savedQuote.options) {
            setQuoteOptions(savedQuote.options);
          }
        } else {
          const quoteNumber = await getAndInitializeQuoteNumber(searchParams.recordId);
          const newQuote = {
            id: searchParams.recordId,
            quoteNumber,
            customerName: searchParams?.customerName || "",
            customerPhone: searchParams?.phone || "",
            options: quoteOptions,
            budgetBeforeVAT,
            budgetWithVAT,
            packageQuantity,
            profitTarget,
            agentCommission,
            selectedAgent,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
// שדות חדשים
customerCard: selectedCustomerCard || "",
customerLabel: selectedCustomerLabel || "",
shippingOption: selectedShippingOption || "",
pickupApproval: selectedPickupApproval || "",
          };
          setQuoteData(newQuote);
        }
      } catch (error) {
        console.error("Error loading quote:", error);
        toast({
          variant: "destructive",
          title: "שגיאה בטעינת נתוני ההצעה",
          description: "אנא נסה שוב מאוחר יותר",
        });
      }
    };
    loadQuote();
  }, [searchParams?.recordId]);

  /* =====================
     Filtering Functions
  ===================== */
  const getFilteredProducts = () => {
    let filtered = products.filter((product: any) => {
      const matchesSearch =
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.price?.toString() === searchTerm;
      return matchesSearch;
    });
    if (filterType === "priceHighToLow") {
      filtered.sort((a: any, b: any) => (b.price || 0) - (a.price || 0));
    } else if (filterType === "priceLowToHigh") {
      filtered.sort((a: any, b: any) => (a.price || 0) - (b.price || 0));
    }
    return filtered;
  };

  const getFilteredPackages = () => {
    let filtered = packages.filter((pkg) => {
      if (!pkg?.name) return false;
      const nameStr = String(pkg.name);
      const matchesSearch =
        nameStr.toLowerCase().includes(searchTerm.toLowerCase()) ||
        pkg.packagePrice?.toString() === searchTerm;
      return matchesSearch;
    });
    if (filterType === "priceHighToLow") {
      filtered.sort((a, b) => (b.packagePrice || 0) - (a.packagePrice || 0));
    } else if (filterType === "priceLowToHigh") {
      filtered.sort((a, b) => (a.packagePrice || 0) - (b.packagePrice || 0));
    }
    return filtered;
  };

  // Handlers for toggling collapse and irrelevant state for an option.
  // כאשר אופציה מסומנת כלא רלוונטית, גם מתמזערת (isCollapsed=true).
  const toggleCollapse = (optionId: string) => {
    setQuoteOptions(prev =>
      prev.map(opt => opt.id === optionId ? { ...opt, isCollapsed: !opt.isCollapsed } : opt)
    );
  };

  const toggleIrrelevant = (optionId: string) => {
    setQuoteOptions(prev =>
      prev.map(opt => {
        if (opt.id === optionId) {
          const newVal = !opt.isIrrelevant;
          return { ...opt, isIrrelevant: newVal, isCollapsed: newVal ? true : opt.isCollapsed };
        }
        return opt;
      })
    );
  };

  const deleteOption = (optionId: string) => {
    setQuoteOptions(prev => prev.filter(opt => opt.id !== optionId));
  };

  // Compute relevant and irrelevant options.
  const relevantOptions = quoteOptions.filter(option => !option.isIrrelevant);
  const irrelevantOptions = quoteOptions.filter(option => option.isIrrelevant);
  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 p-6">
      {/* Header */}
      <div className="max-w-[1800px] mx-auto mb-8">
        <div className="flex flex-col space-y-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-800 mb-4">
                {quoteData ? `הצעת מחיר מספר ${quoteData.quoteNumber}` : "בונה הצעות מחיר"}
              </h1>
              {searchParams && (
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                    <div>
                      <h3 className="text-sm font-medium text-gray-500">שם לקוח</h3>
                      <p className="mt-1 text-lg text-gray-900">{searchParams.customerName}</p>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-gray-500">אימייל</h3>
                      <p className="mt-1 text-lg text-gray-900">{searchParams.email}</p>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-gray-500">טלפון</h3>
                      <p className="mt-1 text-lg text-gray-900">{searchParams.phone}</p>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-gray-500">תקציב למארז לא כולל מע"מ</h3>
                      <div className="mt-1 flex items-center">
                        <input
                          type="number"
                          value={budgetBeforeVAT || ""}
                          onChange={handleBudgetBeforeVATChange}
                          className="text-lg text-gray-900 w-32 border-b border-gray-300 focus:border-blue-500 focus:ring-0"
                          placeholder="--"
                        />
                        <span className="ml-1 text-lg text-gray-900">₪</span>
                      </div>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-gray-500">מחיר למארז כולל מע"מ</h3>
                      <div className="mt-1 flex items-center">
                        <input
                          type="number"
                          value={budgetWithVAT || ""}
                          onChange={handleBudgetWithVATChange}
                          className="text-lg text-gray-900 w-32 border-b border-gray-300 focus:border-blue-500 focus:ring-0"
                          placeholder="--"
                        />
                        <span className="ml-1 text-lg text-gray-900">₪</span>
                      </div>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-gray-500">תאריך אספקה</h3>
                      <p className="mt-1 text-lg text-gray-900">
                        {searchParams.deliveryDate
                          ? new Date(searchParams.deliveryDate).toLocaleDateString("he-IL", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                            })
                          : "--"}
                      </p>
                    </div>
                    {searchParams.customerNotes && (
                      <div className="col-span-2">
                        <h3 className="text-sm font-medium text-gray-500">דגשים</h3>
                        <p className="mt-1 text-lg text-gray-900">{searchParams.customerNotes}</p>
                      </div>
                    )}
                  </div>
                  {/* --- New Additional Fields --- */}
                  <div className="grid grid-cols-2 gap-x-8 gap-y-4 mt-6">
                    <div>
                      <h3 className="text-sm font-medium text-gray-500">גלוית לקוח</h3>
                      <Select value={selectedCustomerCard} onValueChange={setSelectedCustomerCard}>
                        <SelectTrigger className="w-full mt-1">
                          <SelectValue placeholder="בחר גלוית לקוח" />
                        </SelectTrigger>
                        <SelectContent>
                          {customerCards.map((card) => (
                            <SelectItem key={card.id} value={card.id}>
                              {card.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-gray-500">מדבקת לקוח</h3>
                      <Select value={selectedCustomerLabel} onValueChange={setSelectedCustomerLabel}>
                        <SelectTrigger className="w-full mt-1">
                          <SelectValue placeholder="בחר מדבקת לקוח" />
                        </SelectTrigger>
                        <SelectContent>
                          {customerLabels.map((label) => (
                            <SelectItem key={label.id} value={label.id}>
                              {label.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-gray-500">משלוח</h3>
                      <Select value={selectedShippingOption} onValueChange={setSelectedShippingOption}>
                        <SelectTrigger className="w-full mt-1">
                          <SelectValue placeholder="בחר משלוח" />
                        </SelectTrigger>
                        <SelectContent>
                          {shippingOptions.map((option) => (
                            <SelectItem key={option.id} value={option.id}>
                              {option.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-gray-500">איסוף/משלוח מאושר</h3>
                      <Select value={selectedPickupApproval} onValueChange={setSelectedPickupApproval}>
                        <SelectTrigger className="w-full mt-1">
                          <SelectValue placeholder="בחר אפשרות" />
                        </SelectTrigger>
                        <SelectContent>
                          {pickupApprovalOptions.map((option) => (
                            <SelectItem key={option.id} value={option.id}>
                              {option.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {/* ------------------------------ */}
                </div>
              )}
            </div>
            <div className="flex items-center gap-4">
<Button onClick={handleSaveQuote} className="bg-green-600 hover:bg-green-700 text-white">
  שמור הצעת מחיר
</Button>
              <Button onClick={() => setShowSendDialog(true)} className="bg-blue-600 hover:bg-blue-700 text-white">
                <Send className="w-4 h-4 ml-2" /> שלח הצעת מחיר
              </Button>
              <Select onValueChange={setSelectedCatalog}>
                <SelectTrigger className="w-64 bg-white shadow-sm">
                  <SelectValue placeholder="בחר קטלוג" />
                </SelectTrigger>
                <SelectContent>
                  {catalogs.map((catalog) => (
                    <SelectItem key={catalog.id} value={catalog.id}>
                      {catalog.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Main Content Area: Sidebar and Quote Options */}
        <div className="max-w-[1800px] mx-auto grid grid-cols-[250px_1fr] gap-8">
          {/* Sidebar: Available Items */}
          <Card className="sticky top-6 h-[calc(100vh-12rem)] bg-white/50 backdrop-blur-sm border border-gray-200 shadow-lg">
            <div className="border-b bg-white/80 p-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-medium text-gray-800">פריטים זמינים</h2>
                  <div className="flex gap-2">
                    <Select value={filterType} onValueChange={(value: SortOption) => setFilterType(value)}>
                      <SelectTrigger className="h-8 px-2 text-sm">
                        <Filter className="w-4 h-4 ml-1" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(SORT_OPTIONS).map(([val, label]) => (
                          <SelectItem key={val} value={val}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="relative">
                  <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="חיפוש לפי שם או מחיר..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-white pr-10 py-2 text-sm"
                  />
                </div>
              </div>
            </div>
            <CardContent className="p-4 h-[calc(100%-12rem)] overflow-y-auto">
              <Tabs defaultValue="products" className="w-full">
                <TabsList className="w-full mb-4 bg-gray-100 sticky top-0 flex p-0.5 gap-0.5">
                  <TabsTrigger value="products" className="flex-1 text-xs py-2 px-1 h-auto">
                    מוצרים
                  </TabsTrigger>
                  <TabsTrigger value="branding" className="flex-1 text-xs py-2 px-1 h-auto whitespace-normal leading-tight">
                    מוצרי מיתוג<br /> ואריזה
                  </TabsTrigger>
                  <TabsTrigger value="packages" className="flex-1 text-xs py-2 px-1 h-auto">
                    מארזים
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="products" className="mt-0">
                  <div className="space-y-2 overflow-y-auto">
                    {selectedCatalog &&
                      categorizeProducts(getFilteredProducts()).regularProducts.map(
                        (product: Product) => (
                          <div
                            key={product.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, product)}
                            onDragEnd={(e) => handleDragEnd(e)}
                            className="flex justify-between items-start p-3 bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200 cursor-move active:scale-95 hover:border-blue-300"
                          >
                            <div className="flex-1">
                              <div className="font-medium text-sm text-gray-800 mb-1">
                                {product.name}
                              </div>
                              {product.details && (
                                <div className="text-xs text-gray-500">{product.details}</div>
                              )}
                            </div>
                            {product.price && (
                              <div className="text-sm font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded-md mr-2">
                                ₪{product.price}
                              </div>
                            )}
                          </div>
                        )
                      )}
                  </div>
                </TabsContent>
                <TabsContent value="branding" className="mt-0">
                  <div className="space-y-2 overflow-y-auto">
                    {selectedCatalog &&
                      categorizeProducts(getFilteredProducts()).brandingProducts.map(
                        (product: Product) => (
                          <div
                            key={product.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, product)}
                            onDragEnd={(e) => handleDragEnd(e)}
                            className="p-3 bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200 cursor-move active:scale-95 hover:border-blue-300"
                          >
                            <div className="font-medium text-sm text-gray-800">{product.name}</div>
                            <div className="text-xs text-gray-600">{product.details}</div>
                            {product.price && (
                              <div className="text-sm font-semibold text-gray-700 mt-1">
                                ₪{product.price}
                              </div>
                            )}
                          </div>
                        )
                      )}
                  </div>
                </TabsContent>
                <TabsContent value="packages" className="mt-0">
                  <div className="space-y-2">
                    {selectedCatalog &&
                      getFilteredPackages().map((pkg) => (
                        <div
                          key={pkg.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, pkg)}
                          onDragEnd={(e) => handleDragEnd(e)}
                          className="p-3 bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200 cursor-move group"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="font-medium text-sm text-gray-800">{pkg.name}</div>
                              <div className="text-sm font-semibold text-gray-700">₪{pkg.packagePrice}</div>
                              {pkg.parallelPackages && pkg.parallelPackages.length > 0 && (
                                <div className="text-xs text-blue-600 mt-1">
                                  כולל {pkg.parallelPackages.length} מארזים מקבילים
                                </div>
                              )}
                            </div>
                            <button
                              onClick={() =>
                                setExpandedPackage(expandedPackage === pkg.id ? null : pkg.id)
                              }
                              className="p-1 text-gray-400 hover:text-gray-600"
                            >
                              <ChevronDown className={`w-4 h-4 transform transition-transform ${expandedPackage === pkg.id ? "rotate-180" : ""}`} />
                            </button>
                          </div>
                          {expandedPackage === pkg.id && (
                            <div className="mt-2 pt-2 border-t border-gray-100">
                              <div className="text-xs text-gray-600">
                                <div className="font-medium mb-1">תכולת המארז:</div>
                                {pkg.items.map((item: any) => (
                                  <div key={item.id} className="pr-2">
                                    • {item.name}
                                  </div>
                                ))}
                                {pkg.parallelPackages && pkg.parallelPackages.length > 0 && (
                                  <>
                                    <div className="font-medium mt-2 mb-1 text-blue-600">
                                      מארזים מקבילים:
                                    </div>
                                    {pkg.parallelPackages && packages
                                      .filter((p) => pkg.parallelPackages.includes(p.id))
                                      .map((parallelPkg) => (
                                        <div key={parallelPkg.id} className="pr-2 text-blue-600">
                                          • {parallelPkg.name}
                                        </div>
                                      ))}
                                  </>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
          {/* Quote Options (עמודה ימנית) */}
          <div>
            <div className="grid grid-cols-2 gap-6 auto-rows-max">
              {relevantOptions.map((option) => {
                return (
                  <div key={option.id}>
                    <Card className="bg-white/50 backdrop-blur-sm border border-gray-200 shadow-lg">
<CardHeader className="border-b bg-white/80 flex justify-between items-center">
  <div className="flex items-center gap-2">
    <Button variant="ghost" size="sm" onClick={() => toggleCollapse(option.id)}>
      <ChevronDown size={16} className={`${option.isCollapsed ? "rotate-180" : ""} transform transition-transform`} />
    </Button>
    <label className="flex items-center gap-1">
      <input
        type="checkbox"
        checked={option.isIrrelevant || false}
        onChange={() => toggleIrrelevant(option.id)}
        className="form-checkbox"
      />
      <span className="text-sm">לא רלוונטי</span>
    </label>
  </div>
  <Input
    value={option.title}
    onChange={(e) =>
      setQuoteOptions((prev) =>
        prev.map((opt) =>
          opt.id === option.id ? { ...opt, title: e.target.value } : opt
        )
      )
    }
    className="text-xl font-bold bg-transparent border-none focus:ring-0 text-center mx-4 flex-1"
  />
  <div className="flex gap-2">
    <Button variant="ghost" size="sm" onClick={() => duplicateOption(option.id)}>
      <Copy size={16} />
    </Button>
    {quoteOptions.length > 1 && (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => deleteOption(option.id)}
        className="text-red-500 hover:text-red-700"
      >
        <Trash size={16} />
      </Button>
    )}
  </div>
</CardHeader>
                      {!option.isCollapsed && (
                        <CardContent className="p-6">
                          <div
                            onDrop={(e) => handleDrop(e, option.id)}
                            onDragOver={(e) => e.preventDefault()}
                            className="rounded-lg transition-all duration-200"
                          >
                            <div className="bg-white rounded-lg shadow-sm mb-6">
                              <div className="text-sm font-semibold bg-gray-50 text-gray-700 px-4 py-3 border-b">
                                מוצרי אריזה ומיתוג
                              </div>
                              <table className="w-full" dir="rtl">
                                <tbody>
                                  {option.items
                                    .filter((item) => item.type === "packaging")
                                    .map((item) => {
                                      const actualIndex = option.items.findIndex((itm) => itm.id === item.id);
                                      return (
                                        <React.Fragment key={item.id}>
                                          <tr
                                            onDragOver={(e) => handleReorderOver(e, option.id, actualIndex)}
                                            className="border-b last:border-b-0 group"
                                          >
                                            <td className="p-2 border border-gray-300">
                                              <div
                                                draggable
                                                onDragStart={(e) => handleReorderStart(e, option.id, actualIndex)}
                                                onDragEnd={handleDragEnd}
                                                className="cursor-move"
                                              >
                                                <GripVertical size={16} className="text-gray-400" />
                                              </div>
                                            </td>
                                            <td className="p-2 border border-gray-300 w-2/5">
                                              <Input
                                                value={item.name}
                                                onChange={(e) =>
                                                  setQuoteOptions((prev) =>
                                                    prev.map((opt) =>
                                                      opt.id === option.id ? { ...opt, items: opt.items.map((itm) =>
                                                          itm.id === item.id ? { ...itm, name: e.target.value } : itm
                                                        ) } : opt
                                                    )
                                                  )
                                                }
                                                placeholder="שם הפריט"
                                                className="border-none bg-transparent focus:ring-0 text-right"
                                              />
                                            </td>
                                            <td className="p-2 border border-gray-300 w-2/5">
                                              <Input
                                                value={item.details}
                                                onChange={(e) =>
                                                  setQuoteOptions((prev) =>
                                                    prev.map((opt) =>
                                                      opt.id === option.id ? { ...opt, items: opt.items.map((itm) =>
                                                          itm.id === item.id ? { ...itm, details: e.target.value } : itm
                                                        ) } : opt
                                                    )
                                                  )
                                                }
                                                placeholder="משקל/גודל"
                                                className="border-none bg-transparent focus:ring-0 text-right"
                                              />
                                            </td>
                                            <td className="p-2 border border-gray-300 w-1/5">
                                              <Input
                                                value={item.inventory || ""}
                                                onChange={(e) =>
                                                  setQuoteOptions((prev) =>
                                                    prev.map((opt) =>
                                                      opt.id === option.id ? { ...opt, items: opt.items.map((itm) =>
                                                          itm.id === item.id ? { ...itm, inventory: e.target.value } : itm
                                                        ) } : opt
                                                    )
                                                  )
                                                }
                                                placeholder="מלאי"
                                                className="border-none bg-transparent focus:ring-0 text-right"
                                              />
                                            </td>
                                            <td className="p-2 border border-gray-300">
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setShowRowActions(item.id)}
                                                className="text-gray-500 hover:text-gray-700"
                                              >
                                                <MoreVertical size={16} />
                                              </Button>
                                              {showRowActions === item.id && renderRowActions(option, item.id)}
                                            </td>
                                          </tr>
                                          {item.showComment && item.comment && (
                                            <tr>
                                              <td colSpan={6} className="text-sm text-gray-500 mt-1 pr-8">
                                                {item.comment}
                                              </td>
                                            </tr>
                                          )}
                                        </React.Fragment>
                                      );
                                    })}
                                </tbody>
                              </table>

                              <div className="text-sm font-semibold bg-gray-50 text-gray-700 px-4 py-3 border-t border-b">
                                מוצרים
                              </div>
                              <table className="w-full" dir="rtl">
                                <tbody>
                                  {option.items
                                    .filter((item) => item.type !== "packaging")
                                    .map((item) => {
                                      const actualIndex = option.items.findIndex((itm) => itm.id === item.id);
                                      return (
                                        <React.Fragment key={item.id}>
                                          <tr
                                            onDragOver={(e) => handleReorderOver(e, option.id, actualIndex)}
                                            className="border-b last:border-b-0 group"
                                          >
                                            <td className="p-2 border border-gray-300">
                                              <div
                                                draggable
                                                onDragStart={(e) => handleReorderStart(e, option.id, actualIndex)}
                                                onDragEnd={handleDragEnd}
                                                className="cursor-move"
                                              >
                                                <GripVertical size={16} className="text-gray-400" />
                                              </div>
                                            </td>
                                            <td className="p-2 border border-gray-300 w-2/5">
                                              <Input
                                                value={item.name}
                                                onChange={(e) =>
                                                  setQuoteOptions((prev) =>
                                                    prev.map((opt) =>
                                                      opt.id === option.id ? { ...opt, items: opt.items.map((itm) =>
                                                          itm.id === item.id ? { ...itm, name: e.target.value } : itm
                                                        ) } : opt
                                                    )
                                                  )
                                                }
                                                placeholder="שם הפריט"
                                                className="border-none bg-transparent focus:ring-0 text-right"
                                              />
                                            </td>
                                            <td className="p-2 border border-gray-300 w-2/5">
                                              <Input
                                                value={item.details}
                                                onChange={(e) =>
                                                  setQuoteOptions((prev) =>
                                                    prev.map((opt) =>
                                                      opt.id === option.id ? { ...opt, items: opt.items.map((itm) =>
                                                          itm.id === item.id ? { ...itm, details: e.target.value } : itm
                                                        ) } : opt
                                                    )
                                                  )
                                                }
                                                placeholder="משקל/גודל"
                                                className="border-none bg-transparent focus:ring-0 text-right"
                                              />
                                            </td>
                                            <td className="p-2 border border-gray-300 w-1/5">
                                              <Input
                                                value={item.inventory || ""}
                                                onChange={(e) =>
                                                  setQuoteOptions((prev) =>
                                                    prev.map((opt) =>
                                                      opt.id === option.id ? { ...opt, items: opt.items.map((itm) =>
                                                          itm.id === item.id ? { ...itm, inventory: e.target.value } : itm
                                                        ) } : opt
                                                    )
                                                  )
                                                }
                                                placeholder="מלאי"
                                                className="border-none bg-transparent focus:ring-0 text-right"
                                              />
                                            </td>
                                            <td className="p-2 border border-gray-300">
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setShowRowActions(item.id)}
                                                className="text-gray-500 hover:text-gray-700"
                                              >
                                                <MoreVertical size={16} />
                                              </Button>
                                              {showRowActions === item.id && renderRowActions(option, item.id)}
                                            </td>
                                          </tr>
                                          {item.showComment && item.comment && (
                                            <tr>
                                              <td colSpan={6} className="text-sm text-gray-500 mt-1 pr-8">
                                                {item.comment}
                                              </td>
                                            </tr>
                                          )}
                                        </React.Fragment>
                                      );
                                    })}
                                </tbody>
                              </table>
                            </div>
{/* טבלת תמחור ורווחיות מלאה */}
<div className="mt-6 bg-white rounded-lg p-4 border border-gray-200 overflow-hidden">
  <h3 className="font-bold text-lg mb-4 text-right">תמחור ורווחיות</h3>
  <table className="w-full border-collapse text-right" style={{ borderSpacing: 0 }}>
    <tbody>
      <tr>
        <th className="p-2 border border-gray-300 bg-gray-100 text-sm font-bold w-1/3 text-right whitespace-nowrap">
          כמות מארזים
        </th>
        <td className="p-2 border border-gray-300 bg-white" colSpan={2}>
          <input
            type="number"
            value={packageQuantity || ""}
            onChange={(e) =>
              setPackageQuantity(e.target.value ? Number(e.target.value) : null)
            }
            className="w-full text-lg text-gray-900 border-none focus:outline-none focus:ring-0 text-center"
          />
        </td>
      </tr>
      <tr>
        <th className="p-2 border border-gray-300 bg-blue-50 text-sm font-bold text-center whitespace-nowrap">
          תקציב לפני מע"מ
        </th>
        <th className="p-2 border border-gray-300 bg-blue-50 text-sm font-bold text-center whitespace-nowrap">
          תקציב כולל מע"מ
        </th>
      </tr>
      <tr>
        <td className="p-2 border border-gray-300 bg-white align-middle">
          <div className="flex items-center justify-center">
            <input
              type="number"
              value={budgetBeforeVAT || ""}
              onChange={handleBudgetBeforeVATChange}
              className="w-full text-lg text-gray-900 border-none focus:outline-none focus:ring-0 text-center"
            />
            <span className="ml-1 text-lg text-gray-900">₪</span>
          </div>
        </td>
        <td className="p-2 border border-gray-300 bg-white align-middle">
          <div className="flex items-center justify-center">
            <input
              type="number"
              value={budgetWithVAT || ""}
              onChange={handleBudgetWithVATChange}
              className="w-full text-lg text-gray-900 border-none focus:outline-none focus:ring-0 text-center"
            />
            <span className="ml-1 text-lg text-gray-900">₪</span>
          </div>
        </td>
      </tr>
      <tr>
        <th className="p-2 border border-gray-300 bg-green-50 text-sm font-bold text-center whitespace-nowrap">
          יעד רווח %
        </th>
        <th className="p-2 border border-gray-300 bg-green-50 text-sm font-bold text-center whitespace-nowrap">
          % רווח בפועל למארז
        </th>
        <th className="p-2 border border-gray-300 bg-green-50 text-sm font-bold text-center whitespace-nowrap">
          רווח לעסקה בשקלים
        </th>
      </tr>
      <tr>
        <td className="p-2 border border-gray-300 bg-white align-middle">
          <div className="flex items-center justify-center">
            <input
              type="number"
              value={profitTarget}
              onChange={(e) => setProfitTarget(Number(e.target.value))}
              className="w-full text-lg text-gray-900 border-none focus:outline-none focus:ring-0 text-center"
            />
            <span className="ml-1 text-lg text-gray-900">%</span>
          </div>
        </td>
        <td className="p-2 border border-gray-300 bg-white align-middle">
          <div
            className={`flex items-center justify-center text-lg font-bold ${
              (option.actualProfitPercentage || 0) < 0 ? "text-red-600" : "text-green-600"
            }`}
          >
            {(option.actualProfitPercentage || 0).toFixed(1)}%
          </div>
        </td>
        <td className="p-2 border border-gray-300 bg-white align-middle">
          <div
            className={`flex items-center justify-center text-lg font-bold ${
              (option.totalProfit || 0) < 0 ? "text-red-600" : "text-green-600"
            }`}
          >
            {(option.totalProfit || 0).toFixed(2)} ₪
          </div>
        </td>
      </tr>
      <tr>
        <th className="p-2 border border-gray-300 bg-gray-100 text-sm font-bold text-right whitespace-nowrap">
          עמלת סוכן %
        </th>
        <td className="p-2 border border-gray-300 bg-white align-middle" colSpan={2}>
          <div className="flex items-center justify-center">
            <input
              type="number"
              value={agentCommission}
              onChange={(e) => setAgentCommission(Number(e.target.value))}
              className="w-full text-lg text-gray-900 border-none focus:outline-none focus:ring-0 text-center"
            />
            <span className="ml-1 text-lg text-gray-900">%</span>
          </div>
        </td>
      </tr>
      <tr>
        <th className="p-2 border border-gray-300 bg-gray-100 text-sm font-bold text-right whitespace-nowrap">
          הוצאות נוספות
        </th>
        <td className="p-2 border border-gray-300 bg-white align-middle" colSpan={2}>
          <div className="flex items-center justify-center text-lg font-bold">
            {option.additionalExpenses?.toFixed(2) || "0.00"} ₪
          </div>
        </td>
      </tr>
      <tr>
        <th className="p-2 border border-gray-300 bg-yellow-50 text-sm font-bold text-center whitespace-nowrap">
          עלות מוצרי אריזה ומיתוג
        </th>
        <th className="p-2 border border-gray-300 bg-yellow-50 text-sm font-bold text-center whitespace-nowrap">
          עלות עבודת אריזה
        </th>
      </tr>
      <tr>
        <td className="p-2 border border-gray-300 bg-white align-middle">
          <div className="flex items-center justify-center text-lg font-bold">
            {option.packagingItemsCost?.toFixed(2) || "0.00"} ₪
          </div>
        </td>
        <td className="p-2 border border-gray-300 bg-white align-middle">
          <div className="flex items-center justify-center text-lg font-bold">
            {option.packagingWorkCost?.toFixed(2) || "0.00"} ₪
          </div>
        </td>
      </tr>
      <tr>
        <th className="p-2 border border-gray-300 bg-blue-50 text-sm font-bold text-center whitespace-nowrap">
          תקציב נותר למוצרים
        </th>
        <th className="p-2 border border-gray-300 bg-blue-50 text-sm font-bold text-center whitespace-nowrap">
          עלות מוצרים בפועל
        </th>
        <th className="p-2 border border-gray-300 bg-blue-50 text-sm font-bold text-center whitespace-nowrap">
          תקציב פנוי
        </th>
      </tr>
      <tr>
        <td className="p-2 border border-gray-300 bg-white align-middle">
          <div className="flex items-center justify-center text-lg font-bold">
            {option.remainingBudgetForProducts?.toFixed(2) || "0.00"} ₪
          </div>
        </td>
        <td className="p-2 border border-gray-300 bg-white align-middle">
          <div className="flex items-center justify-center text-lg font-bold">
            {option.productsCost?.toFixed(2) || "0.00"} ₪
          </div>
        </td>
        <td className="p-2 border border-gray-300 bg-white align-middle">
          <div className={`flex items-center justify-center text-lg font-bold ${(option.availableBudgetForProducts || 0) < 0 ? "text-red-600" : "text-green-600"}`}>
            {option.availableBudgetForProducts?.toFixed(2) || "0.00"} ₪
          </div>
        </td>
      </tr>
      <tr>
        <th className="p-2 border border-gray-300 bg-purple-50 text-sm font-bold text-center whitespace-nowrap">
          סה"כ לתשלום לפני מע"מ
        </th>
        <th className="p-2 border border-gray-300 bg-purple-50 text-sm font-bold text-center whitespace-nowrap">
          סה"כ לתשלום אחרי מע"מ
        </th>
      </tr>
      <tr>
        <td className="p-2 border border-gray-300 bg-white align-middle">
          <div className="flex items-center justify-center text-lg font-bold">
            {((option.total || 0) * (packageQuantity || 0)).toFixed(2)} ₪
          </div>
        </td>
        <td className="p-2 border border-gray-300 bg-white align-middle">
          <div className="flex items-center justify-center text-lg font-bold">
            {((option.total || 0) * 1.18 * (packageQuantity || 0)).toFixed(2)} ₪
          </div>
        </td>
      </tr>
      <tr>
        <th className="p-2 border border-gray-300 bg-gray-100 text-sm font-bold text-center whitespace-nowrap">
          סוג אריזה
        </th>
        <th className="p-2 border border-gray-300 bg-gray-100 text-sm font-bold text-center whitespace-nowrap">
          כמות בקרטון
        </th>
        <th className="p-2 border border-gray-300 bg-gray-100 text-sm font-bold text-center whitespace-nowrap">
          כמות מוצרים
        </th>
      </tr>
      <tr>
        <td className="p-2 border border-gray-300 bg-white align-middle">
          <div className="flex items-center justify-center text-lg font-bold">
            {option.packagingType || "-"}
          </div>
        </td>
        <td className="p-2 border border-gray-300 bg-white align-middle">
          <div className="flex items-center justify-center text-lg font-bold">
            {(() => {
              const packagingItem = getPrimaryPackagingItem(option.items);
              if (packagingItem && packagingItem.boxesPerCarton && packagingItem.boxesPerCarton > 1) {
                return packagingItem.boxesPerCarton;
              }
              return 1;
            })()}
          </div>
        </td>
        <td className="p-2 border border-gray-300 bg-white align-middle">
          <div className="flex items-center justify-center text-lg font-bold">
            {option.itemCount || 0}
          </div>
        </td>
      </tr>
      <tr>
        <th colSpan={3} className="p-2 border border-gray-300 bg-gray-200 text-sm font-bold text-center whitespace-nowrap">
          נתוני משלוח
        </th>
      </tr>
<tr>
        <th className="p-2 border border-gray-300 bg-indigo-50 text-sm font-bold text-center whitespace-nowrap">
          חברת משלוחים
        </th>
        <th className="p-2 border border-gray-300 bg-indigo-50 text-sm font-bold text-center whitespace-nowrap">
          כמות קרטונים
        </th>
        <th className="p-2 border border-gray-300 bg-indigo-50 text-sm font-bold text-center whitespace-nowrap">
          כתובת לאספקה
        </th>
      </tr>
      <tr>
        <td className="p-2 border border-gray-300 align-middle bg-white">
          <Select 
            value={option.deliveryCompany || ""} 
            onValueChange={(value) => updateOptionShippingData(option.id, 'deliveryCompany', value)}
          >
            <SelectTrigger className="w-full border-none focus:outline-none focus:ring-0">
              <SelectValue placeholder="בחר חברת משלוחים" />
            </SelectTrigger>
            <SelectContent>
              {deliveryCompanies.map((company) => (
                <SelectItem key={company} value={company}>
                  {company}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </td>
        <td className="p-2 border border-gray-300 align-middle bg-white">
          <input
            type="number"
            value={option.deliveryBoxesCount !== null && option.deliveryBoxesCount !== undefined ? option.deliveryBoxesCount : (() => {
              if (!packageQuantity || packageQuantity <= 0) {
                return "";
              }
              if (!option.items || option.items.length === 0) {
                return packageQuantity;
              }
              const packagingItem = getPrimaryPackagingItem(option.items);
              if (!packagingItem) {
                return packageQuantity;
              }
              const boxesPerCarton = packagingItem.boxesPerCarton || 1;
              const calcBoxesCount = Math.ceil(packageQuantity / boxesPerCarton);
              return calcBoxesCount;
            })()}
            onChange={(e) =>
              updateOptionShippingData(option.id, 'deliveryBoxesCount', e.target.value ? Number(e.target.value) : null)
            }
            className="w-full text-lg text-gray-900 border-none focus:outline-none focus:ring-0 text-center"
          />
        </td>
        <td className="p-2 border border-gray-300 align-middle bg-white overflow-visible">
          <input
            type="text"
            value={option.deliveryAddress || ""}
            onChange={(e) => updateOptionShippingData(option.id, 'deliveryAddress', e.target.value)}
            className="w-full text-lg text-gray-900 border-none focus:outline-none focus:ring-0"
            style={{ minWidth: "100%", overflow: "visible" }}
          />
        </td>
      </tr>
<tr>
        <th className="p-2 border border-gray-300 bg-orange-50 text-sm font-bold text-center whitespace-nowrap">
          תמחור לפרויקט לפני מע"מ
        </th>
        <th className="p-2 border border-gray-300 bg-orange-50 text-sm font-bold text-center whitespace-nowrap">
          תמחור לפרויקט כולל מע"מ
        </th>
      </tr>
      <tr>
        <td className="p-2 border border-gray-300 bg-white align-middle">
          <div className="flex items-center justify-center">
            <input
              type="number"
              value={option.shippingCost !== undefined ? option.shippingCost : ""}
              onChange={(e) => {
                const newShippingCost = Number(e.target.value);
                updateOptionShippingData(option.id, 'shippingCost', newShippingCost);
                
                // עדכון החישובים הנגזרים
                const shippingWithVAT = newShippingCost * 1.18;
                const perPackage = packageQuantity ? newShippingCost / packageQuantity : 0;
                const perPackageWithVAT = perPackage * 1.18;
                const customerCost =
                  newShippingCost >= 600 ? newShippingCost : newShippingCost * 1.1;
                const customerCostWithVAT = customerCost * 1.18;
                const customerPerPackage = packageQuantity ? customerCost / packageQuantity : 0;
                const customerPerPackageWithVAT = packageQuantity
                  ? (customerCost * 1.18) / packageQuantity
                  : 0;
                
                updateOptionShippingData(option.id, 'shippingCostBeforeVAT', newShippingCost);
                updateOptionShippingData(option.id, 'shippingCostWithVAT', shippingWithVAT);
                updateOptionShippingData(option.id, 'shippingCostPerPackageBeforeVAT', perPackage);
                updateOptionShippingData(option.id, 'shippingCostPerPackageWithVAT', perPackageWithVAT);
                updateOptionShippingData(option.id, 'customerShippingCostBeforeVAT', customerCost);
                updateOptionShippingData(option.id, 'customerShippingCostWithVAT', customerCostWithVAT);
                updateOptionShippingData(option.id, 'customerShippingCostPerPackageBeforeVAT', customerPerPackage);
                updateOptionShippingData(option.id, 'customerShippingCostPerPackageWithVAT', customerPerPackageWithVAT);
              }}
              className="w-full text-lg text-gray-900 border-none focus:outline-none focus:ring-0 text-center"
            />
            <span className="mr-1 text-lg text-gray-900">₪</span>
          </div>
        </td>
        <td className="p-2 border border-gray-300 bg-white align-middle">
          <div className="flex items-center justify-center text-lg font-bold">
            {(option.shippingCost !== undefined ? option.shippingCost * 1.18 : 0).toFixed(2)} ₪
          </div>
        </td>
      </tr>
      <tr>
        <th className="p-2 border border-gray-300 bg-red-50 text-sm font-bold text-center whitespace-nowrap">
          תמחור לפרויקט ללקוח לפני מע"מ
        </th>
        <th className="p-2 border border-gray-300 bg-red-50 text-sm font-bold text-center whitespace-nowrap">
          תמחור לפרויקט ללקוח כולל מע"מ
        </th>
      </tr>
      <tr>
        <td className="p-2 border border-gray-300 bg-white align-middle">
          <div className="flex items-center justify-center">
            <input
              type="number"
              value={option.customerShippingCostBeforeVAT || ""}
              onChange={(e) => {
                const value = Number(e.target.value);
                setQuoteOptions((prev) =>
                  prev.map((opt) =>
                    opt.id === option.id
                      ? {
                          ...opt,
                          customerShippingCostBeforeVAT: value,
                          customerShippingCostWithVAT: value * 1.18,
                          customerShippingCostPerPackageBeforeVAT: packageQuantity
                            ? value / packageQuantity
                            : 0,
                          customerShippingCostPerPackageWithVAT: packageQuantity
                            ? (value * 1.18) / packageQuantity
                            : 0,
                        }
                      : opt
                  )
                );
              }}
              className="w-full text-lg text-gray-900 border-none focus:outline-none focus:ring-0 text-center"
            />
            <span className="ml-1 text-lg text-gray-900">₪</span>
          </div>
        </td>
        <td className="p-2 border border-gray-300 bg-white align-middle">
          <div className="flex items-center justify-center text-lg font-bold">
            {(option.customerShippingCostWithVAT || 0).toFixed(2)} ₪
          </div>
        </td>
      </tr>
      <tr>
        <th className="p-2 border border-gray-300 bg-red-50 text-sm font-bold text-center whitespace-nowrap">
          תמחור פר מארז ללקוח לפני מע"מ
        </th>
        <th className="p-2 border border-gray-300 bg-red-50 text-sm font-bold text-center whitespace-nowrap">
          תמחור פר מארז ללקוח כולל מע"מ
        </th>
      </tr>
      <tr>
        <td className="p-2 border border-gray-300 bg-white align-middle">
          <div className="flex items-center justify-center text-lg font-bold">
            {option.customerShippingCostPerPackageBeforeVAT?.toFixed(2) || "0.00"} ₪
          </div>
        </td>
        <td className="p-2 border border-gray-300 bg-white align-middle">
          <div className="flex items-center justify-center text-lg font-bold">
            {option.customerShippingCostPerPackageWithVAT?.toFixed(2) || "0.00"} ₪
          </div>
        </td>
      </tr>
    </tbody>
  </table>
  {/* תמונת המארז */}
  <div className="mt-6">
    <h3 className="font-medium mb-3">תמונת המארז</h3>
    {option.image ? (
      <div className="relative rounded-lg overflow-hidden">
        <img
          src={option.image}
          alt={`תמונה של ${option.title}`}
          className="max-w-xs max-h-60 mx-auto object-contain rounded-lg border border-gray-200"
        />
        <div className="absolute top-3 right-3 space-x-2 rtl:space-x-reverse">
          <Button
            variant="secondary"
            size="sm"
            className="bg-white/80 backdrop-blur-sm hover:bg-white/90"
            onClick={() => document.getElementById(`image-upload-${option.id}`)?.click()}
          >
            החלף תמונה
          </Button>
          <Button
            variant="destructive"
            size="sm"
            className="bg-red-500/80 backdrop-blur-sm hover:bg-red-500/90"
            onClick={() =>
              setQuoteOptions((prev) =>
                prev.map((opt) => (opt.id === option.id ? { ...opt, image: null } : opt))
              )
            }
          >
            <Trash size={16} />
          </Button>
        </div>
        <input
          type="file"
          id={`image-upload-${option.id}`}
          accept="image/*"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (file) {
              // כאן ניתן להוסיף העלאה אמיתית לשרת
              setQuoteOptions((prev) =>
                prev.map((opt) => (opt.id === option.id ? { ...opt, image: "/api/placeholder/400/300" } : opt))
              );
            }
          }}
          className="hidden"
        />
      </div>
    ) : (
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center bg-gray-50/50 hover:bg-gray-50 transition-colors">
        <input
          type="file"
          id={`image-upload-${option.id}`}
          accept="image/*"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (file) {
              setQuoteOptions((prev) =>
                prev.map((opt) => (opt.id === option.id ? { ...opt, image: "/api/placeholder/400/300" } : opt))
              );
            }
          }}
          className="hidden"
        />
        <Button
          variant="outline"
          onClick={() => document.getElementById(`image-upload-${option.id}`)?.click()}
          className="bg-white/80 hover:bg-white"
        >
          <Camera className="ml-2 rtl:mr-2" size={20} />
          הוסף תמונת מארז
        </Button>
      </div>
    )}
  </div>
</div>
                            <div className="flex justify-between items-center gap-4 mt-4">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => addCustomRow(option.id)}
                                className="flex items-center gap-2 bg-white"
                              >
                                <Plus size={16} /> הוסף שורה
                              </Button>
                              <div className="flex items-center gap-3 bg-gray-50 px-4 py-2 rounded-lg">
                                <span className="font-medium">סה"כ:</span>
                                <Input
                                  type="number"
                                  value={option.total || ""}
                                  onChange={(e) => {
                                    setQuoteOptions((prev) =>
                                      prev.map((opt) =>
                                        opt.id === option.id
                                          ? { ...opt, total: e.target.value ? Number(e.target.value) : 0 }
                                          : opt
                                      )
                                    );
                                  }}
                                  className="w-28 text-left bg-white"
                                />
                                <span className="font-medium">₪ + מע"מ</span>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      )}
                    </Card>
                  </div>
                );
              })}
            </div>
            <Button
              onClick={() => {
                const newId = String.fromCharCode(65 + quoteOptions.length);
setQuoteOptions((prev) => [
  ...prev,
  {
    id: newId,
    title: `אופציה ${quoteOptions.length + 1}`,
    items: [],
    total: 0,
    image: null,
    additionalCosts: [],
    terms: "",
    templateId: "",
    isCollapsed: false,
    isIrrelevant: false,
    // אתחול נתוני משלוח
    deliveryCompany: "",
    deliveryBoxesCount: null,
    deliveryAddress: "",
    shippingCost: 0,
    includeShipping: false,
  },
]);
              }}
              className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-lg hover:shadow-xl transition-all mt-6"
            >
              הוסף אופציה חדשה
            </Button>
            {irrelevantOptions.length > 0 && (
              <>
                <h2 className="text-xl font-bold mt-8">לא רלוונטי</h2>
                <div className="grid grid-cols-2 gap-6 auto-rows-max">
                  {irrelevantOptions.map((option) => {
                    return (
                      <div key={option.id}>
                        <Card className="bg-white/50 backdrop-blur-sm border border-gray-200 shadow-lg">
<CardHeader className="border-b bg-white/80 flex justify-between items-center">
  <div className="flex items-center gap-2">
    <Button variant="ghost" size="sm" onClick={() => toggleCollapse(option.id)}>
      <ChevronDown size={16} className={`${option.isCollapsed ? "rotate-180" : ""} transform transition-transform`} />
    </Button>
    <label className="flex items-center gap-1">
      <input
        type="checkbox"
        checked={option.isIrrelevant || false}
        onChange={() => toggleIrrelevant(option.id)}
        className="form-checkbox"
      />
      <span className="text-sm">לא רלוונטי</span>
    </label>
  </div>
  <Input
    value={option.title}
    onChange={(e) =>
      setQuoteOptions((prev) =>
        prev.map((opt) =>
          opt.id === option.id ? { ...opt, title: e.target.value } : opt
        )
      )
    }
    className="text-xl font-bold bg-transparent border-none focus:ring-0 text-center mx-4 flex-1"
  />
  <div className="flex gap-2">
    <Button variant="ghost" size="sm" onClick={() => duplicateOption(option.id)}>
      <Copy size={16} />
    </Button>
    {quoteOptions.length > 1 && (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => deleteOption(option.id)}
        className="text-red-500 hover:text-red-700"
      >
        <Trash size={16} />
      </Button>
    )}
  </div>
</CardHeader>
                     {!option.isCollapsed && (
  <CardContent className="p-6">
    <div
      onDrop={(e) => handleDrop(e, option.id)}
      onDragOver={(e) => e.preventDefault()}
      className="rounded-lg transition-all duration-200"
    >
      <div className="bg-white rounded-lg shadow-sm mb-6">
        <div className="text-sm font-semibold bg-gray-50 text-gray-700 px-4 py-3 border-b">
          מוצרי אריזה ומיתוג
        </div>
        <table className="w-full" dir="rtl">
          <tbody>
            {option.items
              .filter((item) => item.type === "packaging")
              .map((item) => {
                const actualIndex = option.items.findIndex((itm) => itm.id === item.id);
                return (
                  <React.Fragment key={item.id}>
                    <tr
                      onDragOver={(e) => handleReorderOver(e, option.id, actualIndex)}
                      className="border-b last:border-b-0 group"
                    >
                      <td className="p-2 border border-gray-300">
                        <div
                          draggable
                          onDragStart={(e) => handleReorderStart(e, option.id, actualIndex)}
                          onDragEnd={handleDragEnd}
                          className="cursor-move"
                        >
                          <GripVertical size={16} className="text-gray-400" />
                        </div>
                      </td>
                      <td className="p-2 border border-gray-300 w-2/5">
                        <Input
                          value={item.name}
                          onChange={(e) =>
                            setQuoteOptions((prev) =>
                              prev.map((opt) =>
                                opt.id === option.id ? { ...opt, items: opt.items.map((itm) =>
                                    itm.id === item.id ? { ...itm, name: e.target.value } : itm
                                  ) } : opt
                              )
                            )
                          }
                          placeholder="שם הפריט"
                          className="border-none bg-transparent focus:ring-0 text-right"
                        />
                      </td>
                      <td className="p-2 border border-gray-300 w-2/5">
                        <Input
                          value={item.details}
                          onChange={(e) =>
                            setQuoteOptions((prev) =>
                              prev.map((opt) =>
                                opt.id === option.id ? { ...opt, items: opt.items.map((itm) =>
                                    itm.id === item.id ? { ...itm, details: e.target.value } : itm
                                  ) } : opt
                              )
                            )
                          }
                          placeholder="משקל/גודל"
                          className="border-none bg-transparent focus:ring-0 text-right"
                        />
                      </td>
                      <td className="p-2 border border-gray-300 w-1/5">
                        <Input
                          value={item.inventory || ""}
                          onChange={(e) =>
                            setQuoteOptions((prev) =>
                              prev.map((opt) =>
                                opt.id === option.id ? { ...opt, items: opt.items.map((itm) =>
                                    itm.id === item.id ? { ...itm, inventory: e.target.value } : itm
                                  ) } : opt
                              )
                            )
                          }
                          placeholder="מלאי"
                          className="border-none bg-transparent focus:ring-0 text-right"
                        />
                      </td>
                      <td className="p-2 border border-gray-300">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowRowActions(item.id)}
                          className="text-gray-500 hover:text-gray-700"
                        >
                          <MoreVertical size={16} />
                        </Button>
                        {showRowActions === item.id && renderRowActions(option, item.id)}
                      </td>
                    </tr>
                    {item.showComment && item.comment && (
                      <tr>
                        <td colSpan={6} className="text-sm text-gray-500 mt-1 pr-8">
                          {item.comment}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
          </tbody>
        </table>

        <div className="text-sm font-semibold bg-gray-50 text-gray-700 px-4 py-3 border-t border-b">
          מוצרים
        </div>
        <table className="w-full" dir="rtl">
          <tbody>
            {option.items
              .filter((item) => item.type !== "packaging")
              .map((item) => {
                const actualIndex = option.items.findIndex((itm) => itm.id === item.id);
                return (
                  <React.Fragment key={item.id}>
                    <tr
                      onDragOver={(e) => handleReorderOver(e, option.id, actualIndex)}
                      className="border-b last:border-b-0 group"
                    >
                      <td className="p-2 border border-gray-300">
                        <div
                          draggable
                          onDragStart={(e) => handleReorderStart(e, option.id, actualIndex)}
                          onDragEnd={handleDragEnd}
                          className="cursor-move"
                        >
                          <GripVertical size={16} className="text-gray-400" />
                        </div>
                      </td>
                      <td className="p-2 border border-gray-300 w-2/5">
                        <Input
                          value={item.name}
                          onChange={(e) =>
                            setQuoteOptions((prev) =>
                              prev.map((opt) =>
                                opt.id === option.id ? { ...opt, items: opt.items.map((itm) =>
                                    itm.id === item.id ? { ...itm, name: e.target.value } : itm
                                  ) } : opt
                              )
                            )
                          }
                          placeholder="שם הפריט"
                          className="border-none bg-transparent focus:ring-0 text-right"
                        />
                      </td>
                      <td className="p-2 border border-gray-300 w-2/5">
                        <Input
                          value={item.details}
                          onChange={(e) =>
                            setQuoteOptions((prev) =>
                              prev.map((opt) =>
                                opt.id === option.id ? { ...opt, items: opt.items.map((itm) =>
                                    itm.id === item.id ? { ...itm, details: e.target.value } : itm
                                  ) } : opt
                              )
                            )
                          }
                          placeholder="משקל/גודל"
                          className="border-none bg-transparent focus:ring-0 text-right"
                        />
                      </td>
                      <td className="p-2 border border-gray-300 w-1/5">
                        <Input
                          value={item.inventory || ""}
                          onChange={(e) =>
                            setQuoteOptions((prev) =>
                              prev.map((opt) =>
                                opt.id === option.id ? { ...opt, items: opt.items.map((itm) =>
                                    itm.id === item.id ? { ...itm, inventory: e.target.value } : itm
                                  ) } : opt
                              )
                            )
                          }
                          placeholder="מלאי"
                          className="border-none bg-transparent focus:ring-0 text-right"
                        />
                      </td>
                      <td className="p-2 border border-gray-300">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowRowActions(item.id)}
                          className="text-gray-500 hover:text-gray-700"
                        >
                          <MoreVertical size={16} />
                        </Button>
                        {showRowActions === item.id && renderRowActions(option, item.id)}
                      </td>
                    </tr>
                    {item.showComment && item.comment && (
                      <tr>
                        <td colSpan={6} className="text-sm text-gray-500 mt-1 pr-8">
                          {item.comment}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
          </tbody>
        </table>
      </div>

      {/* טבלת תמחור ורווחיות מלאה */}
      <div className="mt-6 bg-white rounded-lg p-4 border border-gray-200 overflow-hidden">
        <h3 className="font-bold text-lg mb-4 text-right">תמחור ורווחיות</h3>
        <table className="w-full border-collapse text-right" style={{ borderSpacing: 0 }}>
          <tbody>
            {/* כאן מופיע תוכן טבלת התמחור והרווחיות... */}
            {/* העתק את כל תוכן הטבלה מהאופציות הרגילות */}
          </tbody>
        </table>
        {/* תמונת המארז */}
        <div className="mt-6">
          <h3 className="font-medium mb-3">תמונת המארז</h3>
          {option.image ? (
            <div className="relative rounded-lg overflow-hidden">
              <img
                src={option.image}
                alt={`תמונה של ${option.title}`}
                className="max-w-xs max-h-60 mx-auto object-contain rounded-lg border border-gray-200"
              />
              <div className="absolute top-3 right-3 space-x-2 rtl:space-x-reverse">
                <Button
                  variant="secondary"
                  size="sm"
                  className="bg-white/80 backdrop-blur-sm hover:bg-white/90"
                  onClick={() => document.getElementById(`image-upload-${option.id}`)?.click()}
                >
                  החלף תמונה
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  className="bg-red-500/80 backdrop-blur-sm hover:bg-red-500/90"
                  onClick={() =>
                    setQuoteOptions((prev) =>
                      prev.map((opt) => (opt.id === option.id ? { ...opt, image: null } : opt))
                    )
                  }
                >
                  <Trash size={16} />
                </Button>
              </div>
              <input
                type="file"
                id={`image-upload-${option.id}`}
                accept="image/*"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    // כאן ניתן להוסיף העלאה אמיתית לשרת
                    setQuoteOptions((prev) =>
                      prev.map((opt) => (opt.id === option.id ? { ...opt, image: "/api/placeholder/400/300" } : opt))
                    );
                  }
                }}
                className="hidden"
              />
            </div>
          ) : (
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center bg-gray-50/50 hover:bg-gray-50 transition-colors">
              <input
                type="file"
                id={`image-upload-${option.id}`}
                accept="image/*"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setQuoteOptions((prev) =>
                      prev.map((opt) => (opt.id === option.id ? { ...opt, image: "/api/placeholder/400/300" } : opt))
                    );
                  }
                }}
                className="hidden"
              />
              <Button
                variant="outline"
                onClick={() => document.getElementById(`image-upload-${option.id}`)?.click()}
                className="bg-white/80 hover:bg-white"
              >
                <Camera className="ml-2 rtl:mr-2" size={20} />
                הוסף תמונת מארז
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  </CardContent>
)}
                        </Card>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>

        <Dialog open={showPreview} onOpenChange={setShowPreview}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>תצוגה מקדימה</DialogTitle>
            </DialogHeader>
            <div className="mt-4">
              <div className="flex justify-end mb-4">
                <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="בחר תבנית" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="template1">סטנדרטי</SelectItem>
                    <SelectItem value="template2">מודרני כהה</SelectItem>
                    <SelectItem value="template3">קלאסי</SelectItem>
                  </SelectContent>
                </Select>
                <Button className="mr-2" onClick={() => window.print()}>
                  <FileText className="w-4 h-4 ml-2" /> הדפסה
                </Button>
              </div>
              <div className="bg-white p-8 rounded-lg shadow-lg">
                {/* תוכן תצוגה מקדימה */}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <QuoteSendDialog
          open={showSendDialog}
          onOpenChange={setShowSendDialog}
          quoteData={{
            id: quoteData?.id,
            quoteNumber: quoteData?.quoteNumber || "",
            customerName: searchParams?.customerName || "",
            customerPhone: searchParams?.phone || "",
            options: quoteOptions,
          }}
        />

        <Toaster />
      </div>
    </div>
  );
};

export default PriceQuoteBuilder;
