import { redirect } from 'next/navigation';
import { VideosPageContent } from './videos-page';

export const metadata = { title: 'Roteiros de vídeo' };

export default async function VideosPage({ searchParams }: { searchParams: Promise<{ v?: string }> }) {
  if ((await searchParams).v === 'kanban') redirect('/admin/videos/quadro'); // link antigo
  return <VideosPageContent mode="lista" />;
}
