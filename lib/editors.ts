/** Editores disponíveis. Cada template (formato de post) aponta para um deles. */
export const EDITORS = {
  carrossel: { label: 'Carrossel 1080×1350', file: 'editor-carrossel.html' },
  tweet: { label: 'Tweet Card 1080×1350', file: 'editor-tweet.html' },
  noticia: { label: 'Capa de Notícia 1080×1350', file: 'editor-noticia.html' },
} as const;

export type EditorKey = keyof typeof EDITORS;

export const editorFile = (key?: string) => (EDITORS[key as EditorKey] ?? EDITORS.carrossel).file;
