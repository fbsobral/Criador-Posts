import { VideosPageContent } from '../videos-page';

export const metadata = { title: 'Quadro de produção' };

export default function BoardPage() {
  return <VideosPageContent mode="kanban" />;
}
