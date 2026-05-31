import { NextRequest, NextResponse } from 'next/server';

type GooglePlace = {
  id?: string;
  displayName?: { text?: string } | string;
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  rating?: number;
  userRatingCount?: number;
  priceLevel?: string | number;
  photos?: Array<{ name?: string }>;
};

const MANDI_STOCK_PHOTOS = [
  'https://images.pexels.com/photos/19805189/pexels-photo-19805189.jpeg?auto=compress&cs=tinysrgb&w=1200',
  'https://images.pexels.com/photos/36984975/pexels-photo-36984975.jpeg?auto=compress&cs=tinysrgb&w=1200',
  'https://images.pexels.com/photos/17650170/pexels-photo-17650170.jpeg?auto=compress&cs=tinysrgb&w=1200',
  'https://images.pexels.com/photos/29414985/pexels-photo-29414985.jpeg?auto=compress&cs=tinysrgb&w=1200',
  'https://images.pexels.com/photos/17696654/pexels-photo-17696654.jpeg?auto=compress&cs=tinysrgb&w=1200',
  'https://images.pexels.com/photos/21385826/pexels-photo-21385826.jpeg?auto=compress&cs=tinysrgb&w=1200',
] as const;

function haversineDistanceMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
) {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;

  return 2 * R * Math.asin(Math.sqrt(h));
}

export async function GET(request: NextRequest) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: 'Google Places is not configured on the server.' },
      { status: 503 }
    );
  }

  const { searchParams } = new URL(request.url);
  const lat = Number(searchParams.get('lat'));
  const lng = Number(searchParams.get('lng'));
  const radiusMeters = Math.min(Number(searchParams.get('radiusMeters') || 30000), 50000);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: 'Missing location coordinates.' }, { status: 400 });
  }

  const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': [
        'places.id',
        'places.displayName',
        'places.formattedAddress',
        'places.location',
        'places.rating',
        'places.userRatingCount',
        'places.priceLevel',
        'places.photos',
      ].join(','),
    },
    body: JSON.stringify({
      textQuery: 'mandi restaurant OR yemeni mandi OR mandi rice',
      languageCode: 'en',
      maxResultCount: 15,
      rankPreference: 'DISTANCE',
      locationBias: {
        circle: {
          center: {
            latitude: lat,
            longitude: lng,
          },
          radius: radiusMeters,
        },
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    return NextResponse.json(
      { error: `Google Places search failed.${errorText ? ` ${errorText}` : ''}` },
      { status: 502 }
    );
  }

  const data = await response.json();
  const places: GooglePlace[] = data.places || [];

  const spots = places.map((place, index) => {
    const spotLat = place.location?.latitude ?? lat;
    const spotLng = place.location?.longitude ?? lng;
    const photoName = place.photos?.[0]?.name;
    const fallbackPhotoUrl = MANDI_STOCK_PHOTOS[index % MANDI_STOCK_PHOTOS.length];

    const photoUrl = photoName
      ? `/api/places/photo?name=${encodeURIComponent(photoName)}&maxWidthPx=1200`
      : fallbackPhotoUrl;

    return {
      id: place.id || `${index}-${spotLat}-${spotLng}`,
      name:
        (typeof place.displayName === 'string'
          ? place.displayName
          : place.displayName?.text) || 'Mandi Restaurant',
      lat: spotLat,
      lng: spotLng,
      address: place.formattedAddress || 'Nearby',
      rating: place.rating,
      userRatingCount: place.userRatingCount,
      priceLevel:
        typeof place.priceLevel === 'number'
          ? place.priceLevel
          : place.priceLevel
            ? Number(place.priceLevel)
            : undefined,
      photoUrl,
      fallbackPhotoUrl,
      distance: haversineDistanceMeters({ lat, lng }, { lat: spotLat, lng: spotLng }),
    };
  });

  spots.sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));

  return NextResponse.json({ spots });
}
