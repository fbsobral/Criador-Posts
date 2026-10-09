/** Redes e seus limites usuais de legenda (caracteres). Seguro para o navegador. */
export const NETWORKS = {
  instagram: { label: 'Instagram', limit: 2200 },
  tiktok: { label: 'TikTok', limit: 4000 },
  x: { label: 'X (Twitter)', limit: 280 },
} as const;
export type Network = keyof typeof NETWORKS;
