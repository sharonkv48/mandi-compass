# Mandi Compass

**Follow the compass. Find the tannour.**

A delightful, respectful Next.js PWA that turns the hunt for authentic Yemeni pit-cooked Mandi into a real-world adventure. Use your phone’s actual compass + GPS to navigate to hand-picked Mandi spots, then claim the find in your personal Passport with photo proof, badges, and beautiful shareable conquest cards.

Built as a fun, entertaining passion project (inspired by Culture Compass cards, Qibla compass mechanics, and FoodCompass simplicity).

## Quick Start (No API Key Needed for Demo)

```bash
npm install
npm run dev
```

Open http://localhost:3000 (or the network URL shown). Works great on a real phone over the same Wi-Fi.

**Recommended for full magic**: Use `--experimental-https` for sensor permissions in local dev:

```bash
npm run dev -- --experimental-https
```

## Real Google Maps + Places (Recommended)

1. Copy `.env.local.example` → `.env.local`
2. Get a browser-restricted Google Maps key (enable Maps JavaScript API + Places API (New))
3. Add the key. The app will use live nearby search in a future iteration (currently beautiful curated mock data + full compass + passport work perfectly).

## How to Play

1. **Discover** — Browse curated authentic-leaning Mandi spots
2. **Accept Quest** — The compass locks onto your chosen destination
3. **Follow the Needle** — Real device orientation + bearing math. Tap the compass on desktop to simulate
4. **Arrive & Claim** — When close, tap the big arrival button. Camera + rating + beautiful Passport entry
5. **Share the Story** — (Prototype ready for expansion) Conquest cards coming soon

## Tech Highlights

- Next.js 16 + App Router + TypeScript + Tailwind
- `@vis.gl/react-google-maps` ready (not yet wired in UI)
- Real `DeviceOrientationEvent` compass with iOS permission handling + rAF smoothing
- Pure great-circle bearing + haversine (no heavy deps required)
- Framer Motion, canvas-confetti, haptics, flip cards
- Fully offline-capable localStorage Passport
- Mobile-first PWA shell (manifest ready)

## Project Status

MVP core loop is complete and highly playable:
- Real compass pointing works on physical iOS/Android
- Full quest → arrival → claim → Passport flow with persistence
- Themed, respectful, and genuinely fun

Next up (easy to continue): live Google Places search + small inset map in Compass view, proper camera capture on claim, generated share images, spin-the-wheel, more lore, full Serwist PWA offline shell, and deployment.

## Cultural Note

Mandi originates in Hadhramaut, Yemen. This project exists to celebrate that heritage respectfully through exploration and discovery. All copy and spot selection aim for accuracy and appreciation.

---

Made with ❤️ for people who believe the best meals are worth following an arrow for.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
