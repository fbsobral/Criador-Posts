/** Editores disponíveis. Cada template (formato de post) aponta para um deles. */
export const EDITORS = {
  carrossel: { label: 'Carrossel 1080×1350', file: 'editor-carrossel.html' },
  tweet: { label: 'Tweet Card 1080×1350', file: 'editor-tweet.html' },
} as const;

export type EditorKey = keyof typeof EDITORS;

export const editorFile = (key?: string) => (EDITORS[key as EditorKey] ?? EDITORS.carrossel).file;
