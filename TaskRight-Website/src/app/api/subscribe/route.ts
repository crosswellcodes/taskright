import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const { name, email, businessType, state, customerCount, wantsUpdates } = await request.json();

  if (!name || !email) {
    return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 });
  }

  const apiKey = process.env.MAILERLITE_API_KEY;
  const groupId = process.env.MAILERLITE_GROUP_ID;

  if (!apiKey || !groupId) {
    return NextResponse.json({ error: 'Server configuration error.' }, { status: 500 });
  }

  const res = await fetch('https://connect.mailerlite.com/api/subscribers', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      email,
      fields: {
        name,
        business_type: businessType,
        state,
        customer_count: customerCount,
        wants_updates: wantsUpdates ? 'yes' : 'no',
      },
      groups: [groupId],
    }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(
      { error: data.message || 'Subscription failed.' },
      { status: res.status }
    );
  }

  return NextResponse.json({ success: true });
}
