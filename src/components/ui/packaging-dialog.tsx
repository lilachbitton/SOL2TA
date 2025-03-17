// components/ui/packaging-dialog.tsx
"use client"

import * as React from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"

export interface PackagingItem {
  id: string
  name: string
  details?: string
  price?: number
}

interface PackagingDialogProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  items: PackagingItem[]
  onConfirm: (selectedItems: PackagingItem[]) => void
  title?: string
}

export function PackagingDialog({
  open,
  onOpenChange,
  items,
  onConfirm,
  title = "בחירת מוצרי אריזה",
}: PackagingDialogProps) {
  const [selectedItems, setSelectedItems] = React.useState<string[]>([])

  const handleConfirm = () => {
    const selected = items.filter(item => selectedItems.includes(item.id))
    onConfirm(selected)
    onOpenChange?.(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-white" dir="rtl">
        <DialogHeader className="mb-4 text-right">
          <DialogTitle className="text-lg font-semibold">{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {items.map((item) => (
            <label
              key={item.id}
              className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 cursor-pointer"
            >
              <Checkbox
                id={item.id}
                checked={selectedItems.includes(item.id)}
                onCheckedChange={(checked) => {
                  setSelectedItems((prev) =>
                    checked
                      ? [...prev, item.id]
                      : prev.filter((id) => id !== item.id)
                  )
                }}
                className="h-5 w-5 border-2 border-gray-300"
              />
              <div className="flex-1">
                <span className="text-sm font-medium text-gray-700">{item.name}</span>
                {item.details && (
                  <p className="text-xs text-gray-500 mt-0.5">{item.details}</p>
                )}
              </div>
            </label>
          ))}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange?.(false)}>
            ביטול
          </Button>
          <Button onClick={handleConfirm}>
            הוסף פריטים
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
