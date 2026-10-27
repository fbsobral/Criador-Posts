import { VideosPageContent } from '../videos-page';

export const metadata = { title: 'Esteira de produção' };

export default function BoardPage() {
  return <VideosPageContent mode="kanban" />;
}
