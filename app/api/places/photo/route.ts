import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: 'Google Places is not configured on the server.' },
      { status: 503 }
    );
  }

  const { searchParams } = new URL(request.url);
  const name = searchParams.get('name');
  const maxWidthPx = searchParams.get('maxWidthPx') || '1200';

  if (!name) {
    return NextResponse.json({ error: 'Missing photo name.' }, { status: 400 });
  }

  const mediaUrl = new URL(`https://places.googleapis.com/v1/${name}/media`);
  mediaUrl.searchParams.set('key', apiKey);
  mediaUrl.searchParams.set('maxWidthPx', maxWidthPx);
  mediaUrl.searchParams.set('skipHttpRedirect', 'true');

  const response = await fetch(mediaUrl.toString(), {
    headers: {
      'X-Goog-Api-Key': apiKey,
    },
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    return NextResponse.json(
      { error: `Google photo fetch failed.${errorText ? ` ${errorText}` : ''}` },
      { status: 502 }
    );
  }

  const data = await response.json() as { photoUri?: string };

  if (!data.photoUri) {
    return NextResponse.json({ error: 'Missing photo URI.' }, { status: 502 });
  }

  return NextResponse.redirect(data.photoUri, 307);
}
