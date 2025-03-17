// components/SignatureCanvas.tsx
"use client";

import React, { useRef } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { Button } from '@/components/ui/button';

interface SignatureFieldProps {
  onSave: (signature: string) => void;
  className?: string;
}

export function SignatureField({ onSave, className = '' }: SignatureFieldProps) {
  const signatureRef = useRef<SignatureCanvas>(null);

  const handleClear = () => {
    if (signatureRef.current) {
      signatureRef.current.clear();
    }
  };

  const handleSave = () => {
    if (signatureRef.current) {
      const dataUrl = signatureRef.current.toDataURL();
      onSave(dataUrl);
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="border-2 border-gray-200 rounded-lg">
        <SignatureCanvas
          ref={signatureRef}
          canvasProps={{
            className: "w-full h-48 bg-white rounded-lg"
          }}
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={handleClear}>
          נקה חתימה
        </Button>
        <Button onClick={handleSave}>
          שמור חתימה
        </Button>
      </div>
    </div>
  );
}