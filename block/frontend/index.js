import {
    initializeBlock,
    useBase,
    useRecords,
    useLoadable,
    useWatchable,
    Button,
    Box,
} from '@airtable/blocks/ui';
import { cursor } from '@airtable/blocks';
import React, { useEffect, useState } from 'react';

function QuoteCreatorBlock() {
    const base = useBase();
    const table = base.getTableByName('הצעות מחיר');
    const records = useRecords(table);
    const [selectedRecordId, setSelectedRecordId] = useState(null);

    useLoadable(cursor);
    useWatchable(cursor, ['selectedRecordIds']);

    useEffect(() => {
        if (cursor.selectedRecordIds.length > 0) {
            setSelectedRecordId(cursor.selectedRecordIds[0]);
        } else {
            setSelectedRecordId(null);
        }
    }, [cursor.selectedRecordIds]);

    async function handleCreateQuote() {
        if (!selectedRecordId) return;

        const selectedRecord = records.find(record => record.id === selectedRecordId);
        
        if (selectedRecord) {
            const data = {
                customerName: selectedRecord.getCellValue('שם לקוח'),
                deliveryDate: selectedRecord.getCellValue('תאריך אספקה'),
                customerNotes: selectedRecord.getCellValue('דגשים'),
                packageBudget: selectedRecord.getCellValue('תקציב למארז'),
                profitUnit: selectedRecord.getCellValue('profit unit'),
                phone: selectedRecord.getCellValue('Phone'),
                email: selectedRecord.getCellValue('Email')
            };

            const params = Object.fromEntries(
                Object.entries(data).filter(([_, v]) => v != null)
            );

            const url = 'http://localhost:3000/quote-builder?' + new URLSearchParams(params).toString();
            window.open(url, '_blank');
        }
    }

    return (
        <Box padding={3} display="flex" alignItems="center" justifyContent="center">
            <Button
                onClick={handleCreateQuote}
                disabled={!selectedRecordId}
                size="large"
                variant="primary"
                width="100%"
            >
                הכן הצעת מחיר
            </Button>
        </Box>
    );
}

initializeBlock(() => <QuoteCreatorBlock />);