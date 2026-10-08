import type { Style } from '@/db/schema';

type Preset = { name: string; theme: Style['theme'] };

/** Templates globais iniciais (mesmos temas do editor). */
export const GLOBAL_PRESETS: Preset[] = [
  { name: 'Original', theme: { bg: '#FAF8F5', title: '#0A0A0A', text: '#1A1A1A', muted: '#BDBAB5', handle: '#7A7773', marker: '#3A3A3A', badge: '#1D9BF0', slotA: '#D9D9DC', slotB: '#F3E7B6' } },
  { name: 'P&B', theme: { bg: '#FFFFFF', title: '#000000', text: '#111111', muted: '#9A9A9A', handle: '#555555', marker: '#000000', badge: '#000000', slotA: '#E6E6E6', slotB: '#CFCFCF' } },
  { name: 'Escuro', theme: { bg: '#121212', title: '#F5F5F5', text: '#D9D9D9', muted: '#6B6B6B', handle: '#9A9A9A', marker: '#F5F5F5', badge: '#1D9BF0', slotA: '#2A2A2A', slotB: '#3A3320' } },
  { name: 'Azul noite', theme: { bg: '#0B1B33', title: '#FFFFFF', text: '#D6E2F5', muted: '#5C7396', handle: '#8FA7C9', marker: '#5BB0FF', badge: '#5BB0FF', slotA: '#16325C', slotB: '#1F4A85' } },
  { name: 'Floresta', theme: { bg: '#F1F5EC', title: '#12301F', text: '#20382B', muted: '#9FB3A3', handle: '#5E7A67', marker: '#2F7A4D', badge: '#2F7A4D', slotA: '#D3DECF', slotB: '#EAD9A8' } },
  { name: 'Terracota', theme: { bg: '#FBEFE6', title: '#3B1A0E', text: '#4A2A1C', muted: '#D2A98F', handle: '#9A6A52', marker: '#C4542B', badge: '#C4542B', slotA: '#EBCDB8', slotB: '#F6DDA0' } },
  { name: 'Violeta', theme: { bg: '#1B1030', title: '#FFFFFF', text: '#E5DAF7', muted: '#7A66A6', handle: '#A892D4', marker: '#FF7AC6', badge: '#FF7AC6', slotA: '#33205C', slotB: '#5A2A7A' } },
];

export const DEFAULT_STYLE: Style = { theme: GLOBAL_PRESETS[0].theme, font: 'Inter', width: '860' };
