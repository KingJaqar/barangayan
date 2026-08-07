// Polled every 5s by use-paymongo-source.ts while a QR Ph payment is pending. Read-only
// lookup against PayMongo's Sources API — the secret key stays server-side here, same
// boundary as create-payment-source.
const PAYMONGO_SECRET_KEY = Deno.env.get('PAYMONGO_SECRET_KEY')!;

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const { sourceId } = await req.json();
  if (!sourceId) {
    return new Response(JSON.stringify({ error: 'sourceId is required' }), { status: 400 });
  }

  const response = await fetch(`https://api.paymongo.com/v1/sources/${sourceId}`, {
    headers: { Authorization: `Basic ${btoa(`${PAYMONGO_SECRET_KEY}:`)}` },
  });

  const source = await response.json();
  if (!response.ok) {
    return new Response(JSON.stringify({ error: source }), { status: 502 });
  }

  return new Response(JSON.stringify({ status: source.data.attributes.status }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
