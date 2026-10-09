import type { PostData } from '@/db/schema';
import { DEFAULT_STYLE } from './themes';

type Settings = {
  displayName: string; handle: string; instagram: string; tiktok: string; x: string;
  topic: string; year: string; avatarUrl: string | null;
  style: { theme: Record<string, string>; font: string; width: string } | null;
} | undefined;

const NETS = ['instagram', 'tiktok', 'x'] as const;

/** Rede exibida por padrão no editor: a primeira que tem @ preenchido. */
export const firstView = (s: Settings) => NETS.find((k) => s?.[k]) ?? 'instagram';
const firstHandle = (s: Settings) => s?.[firstView(s)] || s?.handle || '';

/** Dados iniciais de um post: perfil, contas e cores padrão da marca. */
export function initialPostData(s: Settings, slides: unknown[] | null = null): PostData {
  const style = s?.style ?? DEFAULT_STYLE;
  return {
    v: 2,
    slides,
    g: {
      name: s?.displayName, handle: firstHandle(s),
      accounts: { instagram: s?.instagram ?? '', tiktok: s?.tiktok ?? '', x: s?.x ?? '' },
      view: firstView(s), topic: s?.topic, year: s?.year,
      avatar: s?.avatarUrl ?? null, font: style.font, width: style.width, theme: style.theme,
    },
  };
}

/**
 * Faz um post assumir a identidade de outra marca (nome, @, contas e foto).
 * No carrossel também assume as cores/fonte padrão da marca; o Tweet Card mantém as suas cores.
 */
export function applyBrandIdentity(data: PostData, editor: string | null, destination: Settings): PostData {
  const base = initialPostData(destination).g;
  const g: Record<string, unknown> = { ...data.g, name: base.name, handle: base.handle, accounts: base.accounts, view: base.view, avatar: base.avatar };
  if (editor === 'carrossel') Object.assign(g, { theme: base.theme, font: base.font, width: base.width });
  return { ...data, g };
}
