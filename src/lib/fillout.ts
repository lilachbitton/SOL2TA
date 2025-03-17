interface QuoteOption {
 id: string;
 title: string;
 items: Array<{
   id: string;
   name: string;
   details: string;
 }>;
 total: number;
}

export const createFilloutForm = async (data: {
  quoteNumber: string;
  options: QuoteOption[];
}) => {
  try {
    const response = await fetch('/api/create-fillout-form/route', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });

  if (!response.ok) {
      const error = await response.text();
      throw new Error(`Error creating Fillout form: ${error}`);
    }

    const result = await response.json();
    return result.id;
  } catch (error) {
    console.error('Error creating Fillout form:', error);
    throw error;
  }
};

export const getFilloutResponses = async (formId: string) => {
 try {
   const response = await fetch(`/api/get-fillout-responses?formId=${formId}`);
   if (!response.ok) {
     throw new Error('Error getting form responses');
   }
   return await response.json();
 } catch (error) {
   console.error('Error getting form responses:', error);
   throw error;
 }
};