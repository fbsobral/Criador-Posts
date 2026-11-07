import { IconBoard, IconBulb, IconHome, IconImage, IconMap, IconNewsletter, IconPosts, IconSettings, IconTarget, IconTemplates, IconUsers, IconVideo } from '../icons';

export type NavItem = { href: string; label: string; icon: React.ReactNode; exclude?: string[]; /** outros caminhos que também deixam este item ativo */ also?: string[]; /** aparece na barra fixa do celular */ primary?: boolean; /** rótulo curto da barra do celular */ short?: string; /** ativo só no caminho exato (o Início) */ exact?: boolean };
export type NavGroup = { label: string; items: NavItem[] };

/** Menu do admin, na ordem do trabalho: começar pelo Início, planejar (temas e ideias), criar (posts, roteiros, artigos) e, por fim, marca e produção. Uma única fonte para a barra lateral (desktop) e para a barra + folha "Menu" (celular). */
export const NAV: NavGroup[] = [
  { label: 'Começar', items: [
    { href: '/admin', label: 'Início', icon: <IconHome />, exact: true, primary: true },
  ] },
  { label: '1 · Planejar', items: [
    { href: '/admin/territorios', label: 'Territórios (temas)', short: 'Temas', icon: <IconMap />, primary: true },
    { href: '/admin/ideias', label: 'Ideias de conteúdo', short: 'Ideias', icon: <IconBulb />, primary: true },
    { href: '/admin/personas', label: 'Personas (opcional)', icon: <IconTarget /> },
  ] },
  { label: '2 · Criar', items: [
    { href: '/admin/posts', label: 'Posts de imagem', short: 'Posts', icon: <IconPosts />, also: ['/admin/gerar'], primary: true },
    { href: '/admin/videos', label: 'Roteiros de vídeo', short: 'Roteiros', icon: <IconVideo />, exclude: ['/admin/videos/esteira'] },
    { href: '/admin/substack', label: 'Artigos (Substack)', short: 'Artigos', icon: <IconNewsletter /> },
  ] },
  { label: 'Produção e marca', items: [
    { href: '/admin/videos/esteira', label: 'Esteira de produção', icon: <IconBoard /> },
    { href: '/admin/templates', label: 'Templates', icon: <IconTemplates /> },
    { href: '/admin/galeria', label: 'Imagens', icon: <IconImage /> },
    { href: '/admin/configuracoes', label: 'Configurações da marca', icon: <IconSettings /> },
    { href: '/admin/usuarios', label: 'Usuários', icon: <IconUsers /> },
  ] },
];

export const isActive = (path: string, it: Pick<NavItem, 'href' | 'exclude' | 'also' | 'exact'>) => (it.exact ? path === it.href : (path.startsWith(it.href) || (it.also ?? []).some((x) => path.startsWith(x))) && !(it.exclude ?? []).some((x) => path.startsWith(x)));
