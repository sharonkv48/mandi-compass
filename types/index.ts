export interface LatLng {
  lat: number;
  lng: number;
}

export interface MandiSpot {
  id: string;
  name: string;
  lat: number;
  lng: number;
  address: string;
  rating?: number;
  userRatingCount?: number; // number of Google reviews
  priceLevel?: number; // 1-4
  photoUrl?: string;   // Can be Places photo ref or static URL
  fallbackPhotoUrl?: string; // Local/stock photo to use if photoUrl fails
  distance?: number;   // populated at runtime
}

export interface UserFind {
  spot: MandiSpot;
  claimedAt: string;           // ISO
  photoDataUrl?: string;       // base64 from camera (careful with size)
  authenticityRating: number;  // 1-5
  notes?: string;
  distanceWalked?: number;     // approx meters at claim time
  badge: 'bronze' | 'silver' | 'gold';
}

export type QuestState = {
  activeSpot: MandiSpot | null;
  startTime?: string;
};

export interface PassportStats {
  totalFinds: number;
  avgAuthenticity: number;
  regionsExplored: number;
  currentStreak: number;
  loreMastery: number; // 0-100
}
