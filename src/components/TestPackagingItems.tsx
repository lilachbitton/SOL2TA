"use client";

import React, { useState, useEffect } from "react";
import { base, fetchProductsByCatalog } from "@/lib/airtable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// סוג נתונים למוצר אריזה
interface PackagingProduct {
  id: string;
  name: string;
  productType?: string;
  boxesPerCarton?: number;
  price?: number;
}

const TestPackagingItems: React.FC = () => {
  const [catalogs, setCatalogs] = useState<any[]>([]);
  const [selectedCatalog, setSelectedCatalog] = useState<string | null>(null);
  const [packagingProducts, setPackagingProducts] = useState<PackagingProduct[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // טעינת קטלוגים
  useEffect(() => {
    const loadCatalogs = async () => {
      try {
        const records = await base('קטלוגים').select().all();
        setCatalogs(records.map(record => ({
          id: record.id,
          name: record.get('שם הקטלוג') as string
        })));
      } catch (err) {
        console.error("שגיאה בטעינת קטלוגים:", err);
        setError("שגיאה בטעינת קטלוגים");
      }
    };

    loadCatalogs();
  }, []);

  // פונקציה לטעינת מוצרי אריזה מקטלוג נבחר
  const loadPackagingProducts = async () => {
    if (!selectedCatalog) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      // טעינת כל המוצרים מהקטלוג הנבחר
      const allProducts = await fetchProductsByCatalog(selectedCatalog);
      
      // סינון רק מוצרי אריזה
      const packagingItems = allProducts.filter(product => 
        product.productType?.toLowerCase() === "אריזה" ||
        (product.name && (
          product.name.toLowerCase().includes("סלסל") ||
          product.name.toLowerCase().includes("קופס") ||
          product.name.toLowerCase().includes("מארז") ||
          product.name.toLowerCase().includes("ארגז")
        ))
      );
      
      // שמירת המוצרים המסוננים
      setPackagingProducts(packagingItems);
      
      // הדפסת פרטי כל מוצר לקונסול
      packagingItems.forEach(product => {
        console.log("=== פרטי מוצר אריזה ===");
        console.log("שם:", product.name);
        console.log("סוג:", product.productType);
        console.log("כמות בקרטון:", product.boxesPerCarton);
        console.log("מחיר:", product.price);
        console.log("====================");
      });
      
    } catch (err) {
      console.error("שגיאה בטעינת מוצרי אריזה:", err);
      setError("שגיאה בטעינת מוצרי אריזה");
    } finally {
      setIsLoading(false);
    }
  };

  // בדיקה ישירה מול איירטייבל
  const checkAirtableDirectly = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // בדיקה ישירה של השדה "כמות בקרטון" באיירטייבל
      const records = await base('קטלוג מוצרים')
        .select({
          filterByFormula: "AND({סוג מוצר} = 'אריזה')"
        })
        .all();
      
      const packagingItems = records.map(record => {
        const fields = record.fields;
        return {
          id: record.id,
          name: fields['מוצר'] || 'מוצר ללא שם',
          productType: fields['סוג מוצר'] as string,
          boxesPerCarton: fields['כמות בקרטון'] ? Number(fields['כמות בקרטון']) : undefined,
          // הצגת הערך המקורי לדיבוג
          rawBoxesPerCarton: fields['כמות בקרטון'],
          price: fields['מחיר לפני מעמ'] ? Number(fields['מחיר לפני מעמ']) : undefined
        };
      });
      
      console.log("=== בדיקה ישירה מול איירטייבל ===");
      packagingItems.forEach(item => {
        console.log("שם:", item.name);
        console.log("סוג:", item.productType);
        console.log("ערך גולמי 'כמות בקרטון':", item.rawBoxesPerCarton);
        console.log("כמות בקרטון (לאחר המרה למספר):", item.boxesPerCarton);
        console.log("--------------------");
      });
      
      // שמירת התוצאות
      setPackagingProducts(packagingItems);
      
    } catch (err) {
      console.error("שגיאה בבדיקה ישירה מול איירטייבל:", err);
      setError("שגיאה בבדיקה ישירה מול איירטייבל");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div dir="rtl" className="p-6 max-w-4xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>בדיקת מוצרי אריזה ושדה "כמות בקרטון"</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex gap-4">
              <Select value={selectedCatalog || ""} onValueChange={setSelectedCatalog}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="בחר קטלוג" />
                </SelectTrigger>
                <SelectContent>
                  {catalogs.map(catalog => (
                    <SelectItem key={catalog.id} value={catalog.id}>
                      {catalog.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Button 
                onClick={loadPackagingProducts} 
                disabled={!selectedCatalog || isLoading}
              >
                טען מוצרי אריזה
              </Button>
              
              <Button 
                onClick={checkAirtableDirectly}
                variant="outline"
              >
                בדיקה ישירה מול איירטייבל
              </Button>
            </div>
            
            {error && (
              <div className="p-4 bg-red-50 text-red-500 rounded-md">
                {error}
              </div>
            )}
            
            {isLoading && (
              <div className="text-center p-4">
                טוען נתונים...
              </div>
            )}
            
            {packagingProducts.length > 0 && (
              <div>
                <h3 className="text-lg font-medium mb-2">מוצרי אריזה ({packagingProducts.length})</h3>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="border p-2 text-right">שם</th>
                        <th className="border p-2 text-right">סוג מוצר</th>
                        <th className="border p-2 text-right">כמות בקרטון</th>
                        <th className="border p-2 text-right">מחיר</th>
                      </tr>
                    </thead>
                    <tbody>
                      {packagingProducts.map(product => (
                        <tr key={product.id} className="hover:bg-gray-50">
                          <td className="border p-2">{product.name}</td>
                          <td className="border p-2">{product.productType || "-"}</td>
                          <td className="border p-2 font-bold">{product.boxesPerCarton || "-"}</td>
                          <td className="border p-2">{product.price ? `₪${product.price}` : "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TestPackagingItems;