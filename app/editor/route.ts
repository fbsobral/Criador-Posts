import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { auth } from '@clerk/nextjs/server';

const STORAGE_KEY = "const KEY = 'editor-carrossel-v1';";

export async function GET() {
  const { userId, orgId } = await auth();
  if (!userId) return new Response('Não autenticado', { status: 401 });
  if (!orgId) return new Response('Selecione uma organização', { status: 403 });

  let html = await readFile(join(process.cwd(), 'private', 'editor-carrossel.html'), 'utf8');
  // Isola o auto-save local por organização + usuário
  html = html.replace(STORAGE_KEY, `const KEY = ${JSON.stringify(`editor-carrossel-v1:${orgId}:${userId}`)};`);

  return new Response(html, {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'private, no-store' },
  });
}
