'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MapPin, Compass, Award, BookOpen, ArrowRight, X, Camera, Share2, 
  RotateCcw, Target 
} from 'lucide-react';
import { MandiMap } from '@/components/MandiMap';
import { useNearbyMandi } from '@/hooks/useNearbyMandi';
import confetti from 'canvas-confetti';
import { toast } from 'sonner';

import { calculateBearing, haversineDistance, formatDistance, isAligned } from '@/lib/geo';
import { useCompassPermission } from '@/hooks/useCompassPermission';
import { useCompassHeading } from '@/hooks/useCompassHeading';
import { useBearing } from '@/hooks/useBearing';
import type { MandiSpot, UserFind, QuestState } from '@/types';

// Simple star rating component (Google-style)
function StarRating({ rating, reviewCount }: { rating?: number; reviewCount?: number }) {
  if (!rating) return null;

  const fullStars = Math.floor(rating);
  const hasHalf = rating % 1 >= 0.5;
  const emptyStars = 5 - fullStars - (hasHalf ? 1 : 0);

  return (
    <div className="flex items-center gap-1 text-sm">
      <div className="flex text-[#C45C26]">
        {Array.from({ length: fullStars }).map((_, i) => (
          <span key={`full-${i}`}>★</span>
        ))}
        {hasHalf && <span>⯪</span>}
        {Array.from({ length: emptyStars }).map((_, i) => (
          <span key={`empty-${i}`} className="text-[#EDE4D8]">★</span>
        ))}
      </div>
      <span className="font-medium text-[#2C2522]">{rating.toFixed(1)}</span>
      {reviewCount && (
        <span className="text-[#6B5F55] text-xs">({reviewCount.toLocaleString()})</span>
      )}
    </div>
  );
}

// ============================================
// MOCK DATA — Realistic authentic-leaning spots
// (In production: replace with Google Places "mandi" + "yemeni" search)
// ============================================
const MOCK_SPOTS: MandiSpot[] = [
  {
    id: 'dubai-bait',
    name: 'Bait Al Mandi',
    lat: 25.2717,
    lng: 55.3167,
    address: 'Deira, Dubai, UAE',
    rating: 4.6,
    priceLevel: 2,
    photoUrl: 'https://picsum.photos/id/1018/600/400', // placeholder - real app uses Places photos
  },
  {
    id: 'dubai-almarhabani',
    name: 'Al Marhabani Mandi',
    lat: 25.2048,
    lng: 55.2708,
    address: 'Al Muraqqabat, Dubai',
    rating: 4.5,
    priceLevel: 2,
    photoUrl: 'https://picsum.photos/id/106/600/400',
  },
  {
    id: 'hyderabad-barkas',
    name: '36 Arabian Kitchen',
    lat: 17.3578,
    lng: 78.4758,
    address: 'Barkas, Hyderabad, India',
    rating: 4.7,
    priceLevel: 2,
    photoUrl: 'https://picsum.photos/id/292/600/400',
  },
  {
    id: 'jeddah-seddah',
    name: 'Al Seddah Restaurant',
    lat: 21.5433,
    lng: 39.1728,
    address: 'Jeddah, Saudi Arabia',
    rating: 4.4,
    priceLevel: 3,
    photoUrl: 'https://picsum.photos/id/160/600/400',
  },
];

// Flavorful, respectful descriptions for the details modal
const SPOT_DESCRIPTIONS: Record<string, string> = {
  'dubai-bait': 
    "One of Dubai’s most beloved Yemeni institutions. Slow-cooked in traditional tannour pits, their lamb mandi is legendary for its deep smoky aroma and perfectly moist rice. A true taste of Hadhrami hospitality in the heart of Deira.",
  'dubai-almarhabani': 
    "Family-run spot known for generous portions and authentic technique. The chicken here is particularly prized — tender, fragrant with hawaij, and served on large platters meant for sharing. Locals and expats alike swear by it.",
  'hyderabad-barkas': 
    "Located in Hyderabad’s historic Barkas neighborhood (home to a large Yemeni diaspora), this kitchen stays true to the original Hadhrami method. Bold spices, fall-apart lamb, and rice that carries the soul of the pit.",
  'jeddah-seddah': 
    "A Jeddah classic with a reputation for excellence. Their mandi uses high-quality local lamb and is cooked with patience in underground pits. The rice is always perfectly separate yet infused with the essence of the meat above it.",
};

// ============================================
// STORAGE HELPERS (local only — private & instant)
// ============================================
const STORAGE_KEY = 'mandi-compass-finds';
const QUEST_KEY = 'mandi-compass-quest';

function loadFinds(): UserFind[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveFinds(finds: UserFind[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(finds));
}

function loadQuest(): QuestState {
  if (typeof window === 'undefined') return { activeSpot: null };
  try {
    const raw = localStorage.getItem(QUEST_KEY);
    return raw ? JSON.parse(raw) : { activeSpot: null };
  } catch { return { activeSpot: null }; }
}

function saveQuest(quest: QuestState) {
  localStorage.setItem(QUEST_KEY, JSON.stringify(quest));
}

// ============================================
// MAIN APP
// ============================================
export default function MandiCompassApp() {
  const [activeTab, setActiveTab] = useState<'discover' | 'compass' | 'passport' | 'lore'>('discover');
  const [finds, setFinds] = useState<UserFind[]>([]);
  const [quest, setQuest] = useState<QuestState>({ activeSpot: null });
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [selectedSpot, setSelectedSpot] = useState<MandiSpot | null>(null);
  const [isClaiming, setIsClaiming] = useState(false);
  const [manualHeading, setManualHeading] = useState<number | null>(null);

  // Real Google Places integration (now with auto + distance sorting)
  const {
    spots: realSpots,
    userLocation,
    isLoading: isSearchingPlaces,
    error: placesError,
    permissionState,
    findNearbyMandi,
    hasRealData,
  } = useNearbyMandi();

  const [hasAttemptedRealSearch, setHasAttemptedRealSearch] = useState(false);

  // Real device sensors
  const { status: permStatus, error: permError, requestPermission, isIOS } = useCompassPermission();
  const { heading: deviceHeading, supported: compassSupported } = useCompassHeading({ smoothing: 0.16 });

  // Live bearing + distance to active quest target
  const activeTarget = quest.activeSpot ? { lat: quest.activeSpot.lat, lng: quest.activeSpot.lng } : null;
  const { bearing: liveBearing, distance: liveDistance, etaMinutes, userPos } = useBearing(activeTarget);

  // Effective heading (real device or manual override for desktop/testing)
  const currentHeading = manualHeading !== null ? manualHeading : deviceHeading;

  // Relative rotation for the big needle (0° = pointing straight "up" toward target)
  const needleRotation = activeTarget 
    ? ((liveBearing - currentHeading + 360) % 360) 
    : 0;

  const isCurrentlyAligned = activeTarget ? isAligned(currentHeading, liveBearing, 20) : false;

  // Load persisted state on mount
  useEffect(() => {
    const savedFinds = loadFinds();
    setFinds(savedFinds);

    const savedQuest = loadQuest();
    if (savedQuest.activeSpot) {
      setQuest(savedQuest);
      setActiveTab('compass');
    }

    // Friendly first-time onboarding
    const hasSeen = localStorage.getItem('mandi-onboarded');
    if (!hasSeen) {
      setTimeout(() => setShowOnboarding(true), 650);
    }
  }, []);

  // Persist quest changes
  useEffect(() => {
    saveQuest(quest);
  }, [quest]);

  // ============================================
  // QUEST ACTIONS
  // ============================================
  const startQuest = (spot: MandiSpot) => {
    const newQuest: QuestState = { activeSpot: spot, startTime: new Date().toISOString() };
    setQuest(newQuest);
    setSelectedSpot(spot);
    setManualHeading(null);
    setActiveTab('compass');
    toast.success(`Quest accepted: ${spot.name}`, { 
      description: "The compass is now pointing the way. Walk toward the needle." 
    });
  };

  const clearQuest = () => {
    setQuest({ activeSpot: null });
    setSelectedSpot(null);
    setManualHeading(null);
    toast.info("Quest cleared");
  };

  // ============================================
  // ARRIVAL + CLAIM (the magical payoff)
  // ============================================
  const triggerArrivalCelebration = () => {
    confetti({
      particleCount: 180,
      spread: 70,
      origin: { y: 0.6 }
    });
    confetti({
      particleCount: 120,
      angle: 60,
      spread: 55,
      origin: { x: 0.1, y: 0.7 }
    });

    // Gentle haptics if available
    if (navigator.vibrate) {
      navigator.vibrate([40, 30, 120]);
    }

    toast.success("You have arrived!", {
      description: "The tannour is calling. Time to claim your find.",
      duration: 4000,
    });
  };

  const claimFind = async (spot: MandiSpot, photoFile?: File) => {
    setIsClaiming(true);

    let photoDataUrl: string;

    if (photoFile) {
      // Read real photo from device
      photoDataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(photoFile);
      });
    } else {
      // Fallback nice placeholder if user skips photo
      photoDataUrl = `https://picsum.photos/id/${Math.floor(Math.random() * 40) + 10}/800/600`;
    }

    const distanceAtClaim = userPos && spot 
      ? haversineDistance(userPos, { lat: spot.lat, lng: spot.lng }) 
      : 120;

    const newFind: UserFind = {
      spot,
      claimedAt: new Date().toISOString(),
      photoDataUrl,
      authenticityRating: 4 + Math.random() * 1,
      notes: "",
      distanceWalked: Math.round(distanceAtClaim),
      badge: distanceAtClaim < 400 ? 'gold' : distanceAtClaim < 1200 ? 'silver' : 'bronze',
    };

    const updated = [newFind, ...finds];
    setFinds(updated);
    saveFinds(updated);

    setQuest({ activeSpot: null });
    setSelectedSpot(null);
    setIsClaiming(false);
    setActiveTab('passport');

    triggerArrivalCelebration();

    setTimeout(() => {
      toast(`Mandi Find claimed — ${newFind.badge.toUpperCase()}!`, {
        description: `${spot.name} added to your Passport. Beautiful work, Seeker.`,
      });
    }, 420);
  };

  // Actual device camera / photo picker
  const handleClaimWithPhoto = () => {
    if (!quest.activeSpot) return;

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment'; // Prefer back camera on phones

    input.onchange = (e: any) => {
      const file = e.target.files?.[0];
      if (file) {
        claimFind(quest.activeSpot!, file);
      } else {
        // User cancelled file picker — still let them claim
        claimFind(quest.activeSpot!);
      }
    };

    input.click();
  };

  // Demo helper kept for future "I'm close" testing button if needed
  const simulateArrival = () => {
    if (quest.activeSpot) {
      claimFind(quest.activeSpot);
    } else {
      triggerArrivalCelebration();
    }
  };

  // === REAL PLACES SEARCH (Auto + nice permission flow) ===
  const searchForRealMandi = async () => {
    setHasAttemptedRealSearch(true);
    await findNearbyMandi(30); // 30km
  };

  // Auto-trigger real search on first visit to Discover (if user has API key)
  useEffect(() => {
    if (
      activeTab === 'discover' &&
      hasRealData &&
      !hasAttemptedRealSearch &&
      realSpots.length === 0 &&
      !isSearchingPlaces
    ) {
      // Gentle auto-attempt (user can still use demo spots)
      // We don't force it — just try once nicely
      const timer = setTimeout(() => {
        searchForRealMandi();
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [activeTab, hasRealData, hasAttemptedRealSearch, realSpots.length, isSearchingPlaces]);

  // Current spots to display
  // Rule: Once user has tried real search, we stay in "near me" mode.
  // We do NOT show far-away demo spots if real search returned nothing.
  const isInRealMode = hasAttemptedRealSearch || realSpots.length > 0;
  const displaySpots = isInRealMode ? realSpots : MOCK_SPOTS;

  // ============================================
  // SIMPLE MANUAL COMPASS (desktop + testing fallback)
  // ============================================
  const handleManualCompass = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!quest.activeSpot) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    const angle = Math.atan2(e.clientX - cx, -(e.clientY - cy)) * (180 / Math.PI);
    const normalized = ((angle + 360) % 360);
    setManualHeading(normalized);
  };

  const resetManual = () => setManualHeading(null);

  // ============================================
  // ENTERTAINING PASSPORT SYSTEM
  // ============================================
  const passportStats = {
    total: finds.length,
    avgAuth: finds.length ? (finds.reduce((sum, f) => sum + f.authenticityRating, 0) / finds.length) : 0,
    gold: finds.filter(f => f.badge === 'gold').length,
    totalDistance: finds.reduce((sum, f) => sum + (f.distanceWalked || 0), 0),
  };

  // Seeker Levels - the fun progression system
  const getSeekerLevel = (totalFinds: number) => {
    if (totalFinds >= 15) return { title: "Mandi Sage", level: 4, next: null };
    if (totalFinds >= 8)  return { title: "Pit Guardian", level: 3, next: 15 };
    if (totalFinds >= 3)  return { title: "Spice Wanderer", level: 2, next: 8 };
    return { title: "Apprentice Seeker", level: 1, next: 3 };
  };

  const levelInfo = getSeekerLevel(passportStats.total);
  const progressToNext = levelInfo.next 
    ? Math.min(100, Math.floor((passportStats.total / levelInfo.next) * 100))
    : 100;

  // Fun achievements / badges
  const achievements = [
    { id: 'first', label: "First Conquest", unlocked: passportStats.total >= 1, icon: "🗡️" },
    { id: 'night', label: "Night Hunter", unlocked: finds.some(f => new Date(f.claimedAt).getHours() >= 20 || new Date(f.claimedAt).getHours() <= 5), icon: "🌙" },
    { id: 'long', label: "Epic Journey", unlocked: finds.some(f => (f.distanceWalked || 0) > 3000), icon: "🚶" },
    { id: 'auth', label: "Authenticity Expert", unlocked: passportStats.avgAuth >= 4.7, icon: "⭐" },
    { id: 'gold', label: "Gold Collector", unlocked: passportStats.gold >= 3, icon: "🏅" },
    { id: 'multi', label: "Multi-City Seeker", unlocked: new Set(finds.map(f => f.spot.address.split(',').pop()?.trim())).size >= 2, icon: "🌍" },
  ];

  // ============================================
  // RENDER
  // ============================================
  return (
    <div className="min-h-screen flex flex-col bg-[#F9F4ED] text-[#1F1A17] font-sans">
      {/* Top Bar */}
      <header className="sticky top-0 z-50 bg-[#F9F4ED]/95 backdrop-blur-xl border-b border-[#EDE4D8] px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-9 h-9 rounded-2xl bg-[#B4532A] flex items-center justify-center text-white flex-shrink-0 shadow-sm">
            <Compass className="w-4.5 h-4.5" />
          </div>
          <div className="min-w-0">
            <div className="font-semibold tracking-[-0.3px] text-xl sm:text-2xl">Mandi Compass</div>
            <div className="text-[10px] text-[#8A7665] -mt-0.5 tracking-[0.5px] hidden sm:block">EST. 2025 — FOLLOW THE TANNOUR</div>
          </div>
        </div>
        {quest.activeSpot && (
          <button 
            onClick={clearQuest}
            className="text-xs px-4 py-2 min-h-[38px] rounded-full border border-[#B4532A]/25 text-[#B4532A] hover:bg-[#B4532A]/5 active:bg-[#B4532A]/10 flex items-center gap-1.5 font-medium transition-colors"
          >
            <X className="w-3.5 h-3.5" /> End Quest
          </button>
        )}
      </header>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 pb-20">
        {/* DISCOVER TAB */}
        {activeTab === 'discover' && (
          <div className="p-5 max-w-xl mx-auto">
            <div className="mb-6">
              <div className="text-[#B4532A] text-[10px] tracking-[2px] font-medium mb-1.5">THE JOURNEY BEGINS</div>
              <h1 className="text-[34px] leading-none font-semibold tracking-[-1.2px]">Find your Mandi.<br />Follow the compass.</h1>
              <p className="mt-4 text-[#5C5148] max-w-[320px] text-[15px] leading-relaxed">
                Authentic Yemeni pit-cooked Mandi is rare. These are the places worth the journey.
              </p>

              {/* Real data controls - nice automatic flow */}
              <div className="mt-4">
                {hasRealData && realSpots.length === 0 && !isSearchingPlaces && (
                  <div className="bg-white border border-[#EDE4D8] rounded-2xl p-4">
                    <div className="flex items-start gap-3">
                      <div className="text-2xl">📍</div>
                      <div className="flex-1">
                        <div className="font-medium text-sm">Want real mandi spots near you?</div>
                        <div className="text-xs text-[#6B5F55] mt-0.5">
                          We can search Google for actual restaurants right now.
                        </div>
                        <button
                          onClick={searchForRealMandi}
                          disabled={isSearchingPlaces}
                          className="mt-3 px-5 py-2 bg-[#C45C26] text-white rounded-2xl text-sm font-semibold active:bg-[#9C451C] disabled:opacity-60"
                        >
                          {isSearchingPlaces ? 'Searching...' : 'Find mandi near my location'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {isSearchingPlaces && (
                  <div className="text-sm text-[#6B5F55] flex items-center gap-2">
                    <div className="animate-pulse">●</div> Searching for real mandi spots near you...
                  </div>
                )}

                {realSpots.length > 0 && userLocation && (
                  <div className="flex items-center gap-2 text-xs">
                    <div className="px-3 py-1 rounded-full bg-[#4A7043] text-white font-medium">LIVE • NEAR YOU</div>
                    <button 
                      onClick={() => {
                        // Allow user to go back to demo spots
                        // For now we just let them refresh if they want
                      }}
                      className="text-[#C45C26] underline"
                    >
                      Using your location
                    </button>
                  </div>
                )}

                {placesError && (
                  <div className="mt-2 text-xs text-[#C45C26]">{placesError}</div>
                )}
              </div>
            </div>

            {/* Live Google Map — centers on you when we have real location */}
            <div className="mb-6 -mx-1">
              <MandiMap 
                spots={displaySpots} 
                onSpotSelect={(spot) => setSelectedSpot(spot)}
                center={userLocation || { lat: 22.5, lng: 58 }}
                zoom={userLocation ? 11 : 4.2}
                className="h-[180px] sm:h-[220px] w-full rounded-3xl shadow-sm border border-[#EDE4D8] overflow-hidden"
                showUserLocation={!!userLocation}
                userLocation={userLocation}
              />
            </div>

            <div className="space-y-3">
              {displaySpots.length === 0 && isInRealMode ? (
                <div className="bg-white border border-[#EDE4D8] rounded-3xl p-6 text-center">
                  <div className="text-4xl mb-3">🧭</div>
                  <div className="font-semibold text-lg">No mandi spots found nearby</div>
                  <p className="text-sm text-[#6B5F55] mt-2 max-w-xs mx-auto">
                    We couldn’t find any mandi restaurants within ~30km of your location.
                  </p>

                  <div className="mt-5 flex flex-col gap-2">
                    <button
                      onClick={() => findNearbyMandi(60)}
                      disabled={isSearchingPlaces}
                      className="w-full py-3 rounded-2xl bg-[#2C2522] text-white text-sm font-semibold active:bg-black disabled:opacity-60"
                    >
                      Try wider search (60 km)
                    </button>
                    <button
                      onClick={() => {
                        // Allow user to see popular demo cities
                        setHasAttemptedRealSearch(false);
                        // Optionally clear real results so mocks show cleanly
                      }}
                      className="text-xs text-[#C45C26] py-2"
                    >
                      Show popular mandi cities instead
                    </button>
                  </div>
                </div>
              ) : displaySpots.map((spot) => (
                <div key={spot.id} className="mandi-card rounded-3xl overflow-hidden shadow-sm">
                  <div className="relative h-44">
                    <img src={spot.photoUrl} alt={spot.name} className="absolute inset-0 w-full h-full object-cover" />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-4 text-white">
                      <div className="flex items-baseline justify-between">
                        <div>
                          <div className="font-semibold text-xl tracking-tight">{spot.name}</div>
                          <div className="text-xs opacity-80">{spot.address}</div>
                        </div>
                        <div className="text-right text-sm">
                          <StarRating 
                            rating={spot.rating} 
                            reviewCount={(spot as any).userRatingCount} 
                          />
                          <div className="text-[10px] opacity-70 mt-0.5">{spot.priceLevel === 3 ? '$$$ ' : '$$ '}</div>
                          {(spot as any).distance && (
                            <div className="text-[10px] text-white/90 mt-0.5">
                              {(spot as any).distance < 1000 
                                ? `${Math.round((spot as any).distance)} m` 
                                : `${((spot as any).distance / 1000).toFixed(1)} km`}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="p-4 flex gap-3">
                    <button
                      onClick={() => startQuest(spot)}
                      className="quest-button flex-1 bg-[#C45C26] hover:bg-[#9C451C] active:bg-black text-white rounded-2xl py-3.5 text-sm font-semibold flex items-center justify-center gap-2"
                    >
                      ACCEPT THE QUEST <ArrowRight className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setSelectedSpot(spot)}
                      className="px-5 rounded-2xl border border-[#EDE4D8] text-sm font-medium hover:bg-white"
                    >
                      Details
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="text-center text-[10px] text-[#6B5F55] mt-8">
              {isInRealMode 
                ? "Showing spots from Google Places near your location." 
                : "Real version uses Google Places “mandi” + “yemeni restaurant” near you."}
            </div>
          </div>
        )}

        {/* COMPASS TAB — THE HEART OF THE EXPERIENCE */}
        {activeTab === 'compass' && (
          <div className="flex flex-col items-center pt-6 px-4">
            {!quest.activeSpot ? (
              <div className="text-center py-16 max-w-xs">
                <Target className="w-12 h-12 mx-auto text-[#C45C26]/40 mb-4" />
                <h2 className="text-2xl font-semibold tracking-tight">No active quest</h2>
                <p className="text-[#6B5F55] mt-2">Choose a Mandi from the Discover tab to begin your journey.</p>
                <button onClick={() => setActiveTab('discover')} className="mt-6 px-8 py-3 rounded-full bg-[#2C2522] text-white text-sm">
                  Browse Mandi spots
                </button>
              </div>
            ) : (
              <>
                <div className="text-center mb-1">
                  <div className="text-[#C45C26] text-xs tracking-[1.5px]">YOUR QUEST</div>
                  <div className="text-2xl font-semibold tracking-[-0.5px] mt-0.5">{quest.activeSpot.name}</div>
                  <div className="text-sm text-[#6B5F55]">{quest.activeSpot.address}</div>
                </div>

                {/* THE BIG COMPASS — Premium Instrument */}
                <div 
                  className="compass-container relative w-[min(85vw,300px)] h-[min(85vw,300px)] rounded-full mt-5 flex items-center justify-center cursor-pointer select-none active:scale-[0.985] transition-all duration-200"
                  onClick={handleManualCompass}
                  title="Tap to manually rotate"
                >
                  {/* Outer rings for depth */}
                  <div className="absolute inset-2 rounded-full border border-[#1F1A17]/10" />
                  <div className="absolute inset-4 rounded-full border border-[#1F1A17]/5" />
                  
                  {/* Cardinal directions */}
                  {['N', 'E', 'S', 'W'].map((dir, i) => (
                    <div key={i} className="absolute text-xs font-mono text-[#8A7665] tracking-[1px]"
                      style={{ 
                        top: i === 0 ? 22 : i === 2 ? 'auto' : '50%', 
                        bottom: i === 2 ? 22 : 'auto',
                        left: i === 3 ? 26 : i === 1 ? 'auto' : '50%',
                        right: i === 1 ? 26 : 'auto',
                        transform: i % 2 === 1 ? 'translateY(-50%)' : 'translateX(-50%)'
                      }}>
                      {dir}
                    </div>
                  ))}

                  {/* Rotating Needle */}
                  <motion.div 
                    className="compass-needle absolute leading-none z-10"
                    style={{ 
                      fontSize: 'clamp(5rem, 24vw, 7.5rem)',
                      transform: `rotate(${needleRotation}deg)` 
                    }}
                    animate={{ rotate: needleRotation }}
                    transition={{ type: "spring", stiffness: 55, damping: 16 }}
                  >
                    ↑
                  </motion.div>

                  {/* Refined center hub */}
                  <div className="absolute w-8 h-8 bg-[#1F1A17] rounded-full z-20 flex items-center justify-center ring-[6px] ring-[#F9F4ED]">
                    <div className="w-2 h-2 bg-[#C5A46E] rounded-full" />
                  </div>

                  {/* Alignment indicator */}
                  {isCurrentlyAligned && (
                    <div className="aligned absolute inset-10 rounded-full border-[3px] border-[#3F5C42]" />
                  )}
                </div>

                {/* Small inset map showing the target + your location (when real data) */}
                {quest.activeSpot && (
                  <div className="mt-4 w-full max-w-[min(85vw,280px)] rounded-2xl overflow-hidden border border-[#EDE4D8] shadow-sm">
                    <MandiMap 
                      spots={[quest.activeSpot]} 
                      center={{ lat: quest.activeSpot.lat, lng: quest.activeSpot.lng }}
                      zoom={13}
                      className="h-28 w-full"
                      showUserLocation={!!userLocation}
                      userLocation={userLocation}
                    />
                  </div>
                )}

                {/* Live Stats — Refined */}
                <div className="mt-7 text-center space-y-1.5">
                  <div className="text-3xl font-semibold tracking-[-1px] text-[#B4532A]">
                    {formatDistance(liveDistance || 850)}
                  </div>
                  <div className="text-[#8A7665] text-sm tracking-wide">
                    {etaMinutes || 11} MIN WALK &nbsp;·&nbsp; {Math.round(liveBearing)}° BEARING
                  </div>
                  {isCurrentlyAligned && (
                    <div className="inline-block mt-2 px-5 py-1 text-xs tracking-[1.5px] bg-[#3F5C42] text-[#F9F4ED] rounded-full font-medium">
                      ALIGNED WITH THE TANNOUR
                    </div>
                  )}
                </div>

                {/* Permission + Controls */}
                <div className="flex flex-col items-center gap-2 mt-7 w-full max-w-xs">
                  {permStatus !== 'granted' && compassSupported && (
                    <button
                      onClick={requestPermission}
                      className="w-full py-3 rounded-2xl bg-[#2C2522] text-white text-sm font-semibold active:bg-black flex items-center justify-center gap-2"
                    >
                      <Compass className="w-4 h-4" /> ENABLE REAL COMPASS {isIOS && "(iOS)"}
                    </button>
                  )}
                  {permError && <div className="text-xs text-red-600 text-center">{permError}</div>}

                  {manualHeading !== null && (
                    <button onClick={resetManual} className="text-xs flex items-center gap-1 text-[#C45C26]">
                      <RotateCcw className="w-3 h-3" /> Reset to device heading
                    </button>
                  )}

                  <button
                    onClick={handleClaimWithPhoto}
                    disabled={isClaiming}
                    className="mt-1 w-full py-4 min-h-[56px] rounded-2xl border-2 border-[#C45C26] text-[#C45C26] font-semibold text-sm active:bg-[#C45C26] active:text-white transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    <Camera className="w-4 h-4" />
                    {isClaiming ? 'CLAIMING...' : 'I HAVE ARRIVED — CLAIM MY MANDI'}
                  </button>
                  <div className="text-[10px] text-center text-[#6B5F55] leading-tight max-w-[240px] px-2">
                    On real devices the needle uses your phone’s magnetometer.<br />
                    Tap the compass circle to manually rotate for testing.
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* PASSPORT TAB — Now actually fun */}
        {activeTab === 'passport' && (
          <div className="p-5 max-w-xl mx-auto">
            {/* Header with Seeker Level */}
            <div className="mb-6">
              <div className="flex items-end justify-between mb-3">
                <div>
                  <div className="text-[#B4532A] text-[10px] tracking-[2px]">YOUR JOURNEY</div>
                  <h2 className="text-3xl font-semibold tracking-[-0.8px]">Mandi Passport</h2>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-semibold text-[#B4532A] tracking-tight tabular-nums">{passportStats.total}</div>
                  <div className="text-[10px] text-[#8A7665] -mt-1 tracking-wider">FINDS</div>
                </div>
              </div>

              {/* Seeker Level + Progress */}
              <div className="bg-white border border-[#EDE4D8] rounded-3xl p-5">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="text-xs text-[#6B5F55]">CURRENT RANK</div>
                    <div className="text-xl font-semibold tracking-tight">{levelInfo.title}</div>
                  </div>
                  <div className="text-right text-sm font-mono text-[#C45C26]">
                    LVL {levelInfo.level}
                  </div>
                </div>

                {levelInfo.next && (
                  <div>
                    <div className="h-2 bg-[#F5EDE3] rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-[#C45C26] transition-all duration-700 rounded-full" 
                        style={{ width: `${progressToNext}%` }}
                      />
                    </div>
                    <div className="text-[10px] text-[#6B5F55] mt-1 text-right">
                      {passportStats.total} / {levelInfo.next} finds to next rank
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Fun Achievements */}
            {passportStats.total > 0 && (
              <div className="mb-6">
                <div className="text-xs tracking-widest text-[#6B5F55] mb-2 px-1">ACHIEVEMENTS UNLOCKED</div>
                <div className="flex flex-wrap gap-2">
                  {achievements.map((ach) => (
                    <div 
                      key={ach.id}
                      className={`px-3.5 py-1.5 rounded-2xl text-xs flex items-center gap-1.5 border transition-all ${
                        ach.unlocked 
                          ? 'bg-[#2A3F35] text-[#F9F4ED] border-[#2A3F35]' 
                          : 'bg-white text-[#8A7665] border-[#EDE4D8] opacity-50'
                      }`}
                    >
                      <span className="text-base leading-none">{ach.icon}</span>
                      <span className="font-medium">{ach.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* The Actual Passport Entries */}
            {finds.length === 0 ? (
              <div className="bg-white border border-[#EDE4D8] rounded-3xl p-9 text-center">
                <div className="text-6xl mb-5 opacity-80">🗺️</div>
                <div className="font-semibold text-2xl tracking-[-0.4px] mb-3">The tannour awaits.</div>
                <p className="text-[#5C5148] text-[15px] leading-relaxed max-w-[280px] mx-auto">
                  Your passport is empty. Begin your first quest and start collecting the rarest mandi experiences.
                </p>
                <button 
                  onClick={() => setActiveTab('discover')}
                  className="mt-7 px-8 py-3.5 rounded-2xl bg-[#B4532A] text-white text-sm font-medium active:bg-[#8C3F20] transition-colors"
                >
                  Begin Your Journey
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {finds.map((find, idx) => (
                  <div key={idx} className="flip-card h-44 sm:h-48" onClick={(e) => {
                    const card = e.currentTarget;
                    card.classList.toggle('flipped');
                  }}>
                    <div className="flip-card-inner">
                      {/* Front — looks like a stamped passport entry */}
                      <div className="flip-card-front bg-white rounded-3xl overflow-hidden border border-[#EDE4D8] flex relative">
                        <div className="absolute top-3 right-3 text-[9px] px-2 py-px border border-[#C45C26]/30 rounded text-[#C45C26] font-mono tracking-widest">
                          {find.badge.toUpperCase()}
                        </div>
                        
                        <img src={find.photoDataUrl} alt="" className="w-2/5 object-cover" />
                        
                        <div className="flex-1 p-4 flex flex-col">
                          <div>
                            <div className="font-semibold tracking-tight leading-tight pr-2">{find.spot.name}</div>
                            <div className="text-xs text-[#6B5F55] mt-0.5 line-clamp-1">{find.spot.address}</div>
                          </div>
                          
                          <div className="mt-auto">
                            <div className="flex items-center gap-2 text-xs">
                              <div className="font-mono">★ {find.authenticityRating.toFixed(1)}</div>
                              <div className="text-[#6B5F55]">•</div>
                              <div className="text-[#6B5F55]">{formatDistance(find.distanceWalked || 0)}</div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Back — more personal & story-like */}
                      <div className="flip-card-back bg-[#2F4A3E] text-[#FDF8F3] rounded-3xl p-5 flex flex-col">
                        <div className="text-[10px] opacity-60 tracking-widest">CLAIMED ON {new Date(find.claimedAt).toLocaleDateString()}</div>
                        
                        <div className="mt-2 text-lg leading-tight font-medium">{find.spot.name}</div>
                        
                        {find.notes ? (
                          <div className="mt-2 text-sm opacity-90 italic">“{find.notes}”</div>
                        ) : (
                          <div className="mt-2 text-sm opacity-70">No notes from this conquest.</div>
                        )}

                        <div className="mt-auto pt-3 border-t border-white/20 text-xs opacity-75 flex justify-between">
                          <span>Walked {formatDistance(find.distanceWalked || 0)}</span>
                          <span className="text-[#C5A26F]">★ {find.authenticityRating.toFixed(1)} authenticity</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Fun aggregate stats at the bottom */}
            {passportStats.total > 0 && (
              <div className="mt-6 text-center text-xs text-[#6B5F55]">
                You’ve walked <span className="font-medium text-[#2C2522]">{formatDistance(passportStats.totalDistance)}</span> chasing mandi.<br />
                That’s dedication to the tannour.
              </div>
            )}
          </div>
        )}

        {/* LORE / MINI ENTERTAINMENT */}
        {activeTab === 'lore' && (
          <div className="p-5 max-w-md mx-auto">
            <h2 className="text-3xl tracking-tighter font-semibold mb-4">Mandi Lore</h2>
            <div className="prose prose-sm text-[#6B5F55]">
              <p><strong>Origin:</strong> Hadhramaut, Yemen. The name comes from <em>nadā</em> — “dew” — for the moist, steamed meat that results from hours suspended above fragrant rice in an underground tannour pit.</p>
              <p className="mt-3">Traditional mandi is a communal act of hospitality. Large platters are placed on the floor. Hands only. No forks. The best pieces go to the guest.</p>
            </div>

            <div className="mt-8 p-5 bg-white rounded-3xl border border-[#EDE4D8] text-sm">
              <div className="font-medium mb-2 text-[#C45C26]">Quick authenticity test</div>
              <ul className="space-y-1.5 text-[#6B5F55]">
                <li>• Smoky aroma that clings to your clothes for hours</li>
                <li>• Rice is never dry — always kissed by the meat juices</li>
                <li>• Served on the floor or low table, never plated individually</li>
                <li>• Hawaij spice blend (cardamom, cumin, turmeric, loomi...)</li>
              </ul>
            </div>

            <div className="text-center text-xs mt-8 text-[#6B5F55]">
              More quizzes, streaks, and daily whispers coming in the full version.
            </div>
          </div>
        )}
      </main>

      {/* BOTTOM TAB NAV — Mobile PWA native feel */}
      <nav className="bottom-nav fixed bottom-0 left-0 right-0 z-50 flex border-t text-sm pb-[env(safe-area-inset-bottom)]">
        {[
          { id: 'discover', label: 'Discover', icon: MapPin },
          { id: 'compass', label: 'Compass', icon: Compass },
          { id: 'passport', label: 'Passport', icon: Award },
          { id: 'lore', label: 'Lore', icon: BookOpen },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 py-3 flex flex-col items-center gap-1 transition-colors ${isActive ? 'text-[#C45C26]' : 'text-[#6B5F55] hover:text-[#2C2522]'}`}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'scale-110' : ''}`} />
              <span className="text-[10px] tracking-wider font-medium">{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* ONBOARDING / WELCOME STORY */}
      <AnimatePresence>
        {showOnboarding && (
          <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 p-4 pb-[env(safe-area-inset-bottom)]" onClick={() => {
            localStorage.setItem('mandi-onboarded', 'true');
            setShowOnboarding(false);
          }}>
            <motion.div 
              initial={{ y: 60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              className="bg-[#FDF8F3] w-full max-w-md rounded-3xl p-7 text-center shadow-xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="mx-auto mb-4 w-12 h-1.5 bg-[#EDE4D8] rounded" />
              <h3 className="text-2xl tracking-[-0.5px] font-semibold">You are a Mandi Seeker.</h3>
              <p className="mt-3 text-[#6B5F55] leading-relaxed">
                The most authentic pit-cooked Mandi does not reveal itself to the hurried. 
                It calls to those willing to follow the compass.
              </p>
              <p className="mt-4 text-sm text-[#C45C26] font-medium">Grant location + compass access.<br />Let the tannour guide you.</p>

              <button 
                onClick={() => {
                  localStorage.setItem('mandi-onboarded', 'true');
                  setShowOnboarding(false);
                  setActiveTab('discover');
                }}
                className="mt-7 w-full bg-[#C45C26] text-white py-3.5 rounded-2xl font-semibold active:bg-[#9C451C]"
              >
                Begin the Hunt
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MANDI DETAILS MODAL — replaces the old placeholder toast */}
      <AnimatePresence>
        {selectedSpot && (
          <div 
            className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 p-0 pb-[env(safe-area-inset-bottom)]"
            onClick={() => setSelectedSpot(null)}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 280 }}
              className="bg-[#FDF8F3] w-full max-w-xl rounded-t-3xl overflow-hidden shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              {/* Hero Photo */}
              <div className="relative h-48 sm:h-56">
                <img 
                  src={selectedSpot.photoUrl} 
                  alt={selectedSpot.name} 
                  className="absolute inset-0 w-full h-full object-cover" 
                />
                <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/30 to-black/70" />
                
                <button 
                  onClick={() => setSelectedSpot(null)}
                  className="absolute top-4 right-4 w-9 h-9 rounded-full bg-black/50 text-white flex items-center justify-center backdrop-blur"
                >
                  <X className="w-4 h-4" />
                </button>

                <div className="absolute bottom-4 left-5 text-white">
                  <div className="text-2xl font-semibold tracking-tight drop-shadow">{selectedSpot.name}</div>
                  <div className="text-sm opacity-90">{selectedSpot.address}</div>
                </div>
              </div>

              <div className="p-5">
                {/* Info Row */}
                <div className="flex items-center gap-4 text-sm mb-4">
                  {selectedSpot.rating && (
                    <div className="flex items-center gap-2 bg-white px-3 py-1 rounded-full border border-[#EDE4D8]">
                      <StarRating 
                        rating={selectedSpot.rating} 
                        reviewCount={(selectedSpot as any).userRatingCount} 
                      />
                    </div>
                  )}
                  <div className="bg-white px-3 py-1 rounded-full border border-[#EDE4D8] text-[#6B5F55]">
                    {selectedSpot.priceLevel === 3 ? '$$$' : '$$'}
                  </div>
                  <div className="text-[#6B5F55] text-xs ml-auto">
                    Authentic Yemeni Mandi
                  </div>
                </div>

                {/* Description */}
                <p className="text-[#2C2522] leading-relaxed">
                  {SPOT_DESCRIPTIONS[selectedSpot.id] || 
                    "A real mandi spot found near you. Many of these locations serve traditional Yemeni-style pit-cooked mandi with authentic technique and generous hospitality."}
                </p>

                {/* Actions */}
                <div className="mt-6 flex flex-col gap-3">
                  <button
                    onClick={() => {
                      startQuest(selectedSpot);
                      setSelectedSpot(null);
                    }}
                    className="quest-button w-full bg-[#C45C26] hover:bg-[#9C451C] active:bg-black text-white py-4 rounded-2xl font-semibold text-base flex items-center justify-center gap-2"
                  >
                    ACCEPT THE QUEST <ArrowRight className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => setSelectedSpot(null)}
                    className="w-full py-3.5 text-sm font-medium text-[#6B5F55] active:text-[#2C2522]"
                  >
                    Maybe later
                  </button>

                  {/* External Google Maps link */}
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${selectedSpot.lat},${selectedSpot.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-center text-xs text-[#C45C26] underline underline-offset-2 mt-1"
                  >
                    Open in Google Maps →
                  </a>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
