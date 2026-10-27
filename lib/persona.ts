/** Tipos e utilidades do módulo de personas (servidor e navegador). */

export type PersonaData = {
  age: string;
  role: string;
  location: string;
  bio: string;
  goals: string[];
  pains: string[];
  objections: string[];
  triggers: string[];
  channels: string[];
  quote: string;
};

export const emptyPersonaData = (): PersonaData => ({ age: '', role: '', location: '', bio: '', goals: [], pains: [], objections: [], triggers: [], channels: [], quote: '' });

export const MAX_PERSONAS_PER_RUN = 15;
export const MIN_PERSONAS_PER_RUN = 1;
export const ESTIMATED_COST_PER_PERSONA = 0.017;
export const ESTIMATED_COST_PERSONA_BASE = 0.01;

/** Cor de cada grupo (pelo índice da coluna). */
export const GROUP_COLORS = ['#F97335', '#1D9BF0', '#8B5CF6', '#1F9D63', '#E5484D', '#F59E0B', '#0EA5A4', '#B8481C'];

export const lines = (t: string) => t.split('\n').map((l) => l.replace(/^\s*[-•*]\s*/, '').trim()).filter(Boolean);

/** Normaliza o nome do grupo para comparar ("Gestores " = "gestores"). */
export const normName = (s: string) => s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ');

/** "Juliana, a analista que quer sair da poupança" → primeiro nome e denominação. */
export function splitPersonaName(n: string): { first: string; label: string } {
  const i = n.indexOf(',');
  return i < 0 ? { first: n.trim(), label: '' } : { first: n.slice(0, i).trim(), label: n.slice(i + 1).trim() };
}
