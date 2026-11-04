import { IconBoard, IconBulb, IconImage, IconMap, IconNewsletter, IconPosts, IconSettings, IconTarget, IconTemplates, IconUsers, IconVideo } from '../icons';

export type NavItem = { href: string; label: string; icon: React.ReactNode; exclude?: string[]; /** outros caminhos que também deixam este item ativo */ also?: string[]; /** aparece na barra fixa do celular */ primary?: boolean; /** rótulo curto da barra do celular */ short?: string };
export type NavGroup = { label: string; items: NavItem[] };

/** Menu do admin: uma única fonte para a barra lateral (desktop) e para a barra + folha "Menu" (celular). */
export const NAV: NavGroup[] = [
  { label: 'Posts de imagem', items: [
    { href: '/admin/posts', label: 'Posts', icon: <IconPosts />, also: ['/admin/gerar'], primary: true },
    { href: '/admin/templates', label: 'Templates', icon: <IconTemplates /> },
  ] },
  { label: 'Roteiros de vídeo', items: [
    { href: '/admin/videos', label: 'Roteiros', icon: <IconVideo />, exclude: ['/admin/videos/esteira'], primary: true },
    { href: '/admin/videos/esteira', label: 'Esteira de produção', icon: <IconBoard /> },
  ] },
  { label: 'Substack', items: [
    { href: '/admin/substack', label: 'Artigos', icon: <IconNewsletter /> },
  ] },
  { label: 'Estratégia', items: [
    { href: '/admin/personas', label: 'Personas', icon: <IconTarget /> },
    { href: '/admin/territorios', label: 'Territórios', icon: <IconMap />, primary: true },
    { href: '/admin/ideias', label: 'Ideias de conteúdo', short: 'Ideias', icon: <IconBulb />, primary: true },
  ] },
  { label: 'Marca', items: [
    { href: '/admin/galeria', label: 'Imagens', icon: <IconImage /> },
    { href: '/admin/configuracoes', label: 'Configurações', icon: <IconSettings /> },
    { href: '/admin/usuarios', label: 'Usuários', icon: <IconUsers /> },
  ] },
];

export const isActive = (path: string, it: Pick<NavItem, 'href' | 'exclude' | 'also'>) => (path.startsWith(it.href) || (it.also ?? []).some((x) => path.startsWith(x))) && !(it.exclude ?? []).some((x) => path.startsWith(x));
