import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Mandi Compass',
    short_name: 'Mandi Compass',
    description: 'Follow the compass to authentic Mandi. A fun adventure to discover Yemeni pit-cooked heritage.',
    start_url: '/',
    display: 'standalone',
    background_color: '#FDF8F3',
    theme_color: '#C45C26',
    orientation: 'portrait',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any maskable',
      },
    ],
    categories: ['food', 'travel', 'lifestyle'],
  };
}
