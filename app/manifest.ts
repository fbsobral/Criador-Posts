import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Criador de Posts',
    short_name: 'Posts',
    description: 'Carrosséis, Tweet Cards e roteiros de vídeo com IA e a identidade da sua marca.',
    start_url: '/admin/posts',
    display: 'standalone',
    background_color: '#F4F1EB',
    theme_color: '#F97335',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  };
}
