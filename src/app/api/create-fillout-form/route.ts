// app/api/create-fillout-form/route.ts
export async function POST(request: Request) {
  const data = await request.json();
  
  const response = await fetch(`https://api.fillout.com/v1/forms`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.FILLOUT_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: `הצעת מחיר ${data.quoteNumber}`,
      type: 'STANDARD',
      settings: { theme: { direction: 'rtl', font: 'Assistant' } },
      fields: [/* ... */]
    })
  });

  if (!response.ok) {
    return new Response('Error creating form', { status: 500 });
  }

  const result = await response.json();
  return new Response(JSON.stringify({ id: result.id }));
}