import { redirect } from 'next/navigation';

/** Endereço antigo: a "Esteira de produção" agora fica em /admin/videos/esteira. */
export default function OldBoardPage() {
  redirect('/admin/videos/esteira');
}
