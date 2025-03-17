"use client";

import React, { useEffect, useState } from 'react';
import { fetchPackages, Package } from '@/lib/airtable';

const TestAirtable = () => {
  const [status, setStatus] = useState<string>('checking');
  const [packages, setPackages] = useState<Package[]>([]);
  
  useEffect(() => {
    const testConnection = async () => {
      try {
        console.log('Testing Airtable connection...');
        const fetchedPackages = await fetchPackages();
        setPackages(fetchedPackages);
        setStatus('success');
        console.log('Connection successful!');
      } catch (err) {
        console.error('Error connecting to Airtable:', err);
        setStatus('error');
      }
    };

    testConnection();
  }, []);

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Airtable Connection Test</h2>
      
      {status === 'checking' && (
        <p>בודק חיבור לאיירטייבל...</p>
      )}
      
      {status === 'error' && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <p>שגיאה בחיבור לאיירטייבל</p>
          <p>אנא וודאי שהמפתחות נכונים ושיש לך הרשאות מתאימות</p>
          <p>בדקי בקונסול של הדפדפן לפרטי השגיאה</p>
        </div>
      )}
      
      {status === 'success' && (
        <div className="space-y-4">
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
            <p>החיבור לאיירטייבל הצליח!</p>
            <p>נמצאו {packages.length} מארזים</p>
          </div>
          
          <div className="mt-4">
            <h3 className="text-lg font-semibold mb-2">מארזים שנמצאו:</h3>
            {packages.map(pkg => (
              <div key={pkg.id} className="bg-white p-4 rounded-lg shadow mb-4">
                <h4 className="font-bold">{pkg.name}</h4>
                
                <div className="mt-2">
                  <p className="font-medium">מוצרים במארז:</p>
                  <ul className="list-disc list-inside">
                    {pkg.items.map(item => (
                      <li key={item.id}>{item.name}</li>
                    ))}
                  </ul>
                </div>

                <div className="mt-2">
                  <p className="font-medium">חומרי מיתוג ואריזה:</p>
                  <ul className="list-disc list-inside">
                    {pkg.packagingItems.map(item => (
                      <li key={item.id}>{item.name}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default TestAirtable;