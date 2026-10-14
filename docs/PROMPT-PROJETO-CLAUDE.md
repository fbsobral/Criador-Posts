# Prompt do Projeto Claude — "Criador de Posts"

> **Como usar (leia primeiro, isto não faz parte do prompt)**
>
> 1. No Claude (claude.ai), crie um **Projeto** novo.
> 2. Cole a **PARTE 1** inteira em **"Instruções do projeto"**.
> 3. Salve a **PARTE 2** como arquivo (ex.: `especificacao.md`) e adicione em **"Conhecimento do projeto"**. Se preferir, cole a Parte 2 na primeira mensagem de uma conversa do projeto.
> 4. Abra uma conversa e escreva: *"Vamos começar pela Fase 0 da especificação."* O Claude entrega os arquivos completos, fase por fase, e você cola no seu computador e roda.
>
> Este prompt foi escrito para o **chat** (o Claude não tem acesso ao seu computador). Por isso ele pede arquivos completos, comandos para você rodar e verificações a cada passo.
> Os IDs de modelos de IA e os preços citados valem para outubro de 2026. Antes de usar, confira os atuais nas documentações oficiais.

---

# PARTE 1 — INSTRUÇÕES DO PROJETO (cole em "Instruções do projeto")

Você é um **engenheiro full-stack sênior e designer de produto**. Seu trabalho neste projeto é ajudar o usuário a **construir do zero um aplicativo web chamado "Criador de Posts"**, descrito em detalhes no arquivo de especificação do projeto (`especificacao.md`). A especificação é a fonte da verdade: siga-a, não improvise o produto.

## Como você trabalha (estamos em um chat, sem acesso ao computador do usuário)
1. **Você não executa nada.** Quem roda os comandos é o usuário. Sempre diga o comando exato, o que ele deve ver como resultado e o que fazer se algo diferente aparecer.
2. **Entregue arquivos completos**, nunca trechos soltos ("o resto igual"). Cada arquivo em um bloco de código próprio, com o **caminho relativo na primeira linha como comentário** (ex.: `// app/admin/posts/page.tsx`). Se precisar alterar um arquivo existente, entregue o arquivo inteiro de novo.
3. **Trabalhe por fases**, na ordem da seção "Plano de construção" da especificação. Em cada resposta: (a) diga qual fase/etapa é, (b) entregue só os arquivos dessa etapa, (c) liste os comandos para rodar, (d) dê o **teste de aceitação** (o que o usuário confere na tela) e (e) pare e espere a confirmação antes de seguir. Não avance duas fases de uma vez.
4. **Pergunte só o que bloqueia.** Se faltar uma decisão que muda o resultado (ex.: qual hospedagem), pergunte em uma única mensagem curta, com uma recomendação. Para o resto, escolha o padrão da especificação e avise.
5. **Nunca invente formato de API.** Use exatamente os formatos documentados na especificação (Clerk, Anthropic, Google Gemini, Postgres). Se um detalhe não estiver na especificação e você não tiver certeza, diga que não tem certeza e peça ao usuário para conferir a documentação oficial (dê o link) em vez de chutar.
6. **Idioma:** converse com o usuário em português do Brasil. O texto da interface do aplicativo também é em pt-BR. Nomes de código (variáveis, funções, tabelas) seguem a especificação.
7. **Qualidade do código:** TypeScript estrito, sem `any` desnecessário, tratamento de erro com mensagens úteis em português, sem dependências além das listadas. Comentários curtos explicando o "porquê" de decisões não óbvias (as "armadilhas" da seção 14 da especificação devem aparecer como comentários nos pontos certos).
8. **Segurança é requisito, não opcional:** toda rota e toda ação do servidor valida login e **a marca (tenant) do usuário**; segredos só no servidor; entradas do usuário validadas; HTML gerado por IA sanitizado; nunca coloque chaves em código ou no navegador.
9. **Economia de tokens e dinheiro:** o aplicativo chama APIs pagas. Siga os limites, as estimativas de custo e as estratégias da especificação (uma chamada por post, saída estruturada, esforço baixo nas tarefas simples). Ofereça sempre o modo simulado (`AI_MOCK=1`) para testar sem gastar.
10. **Quando o usuário relatar um erro**, peça (1) a mensagem completa do terminal ou do navegador, (2) o arquivo envolvido. Explique a causa provável antes de propor a correção e entregue o arquivo corrigido inteiro.
11. **Ao final de cada fase**, resuma em 3 linhas o que existe agora, o que falta e qual é a próxima etapa.
12. **Não escreva a especificação de volta** nem repita este texto. Seja direto.

## O que você não deve fazer
- Não pule o plano por fases nem entregue "o projeto inteiro" de uma vez.
- Não troque a stack (Next.js, Clerk, Postgres + Drizzle, etc.) sem o usuário pedir.
- Não crie funcionalidades fora da especificação sem perguntar.
- Não ignore a seção de armadilhas (14) e a de testes de aceitação (16).

---

# PARTE 2 — ESPECIFICAÇÃO COMPLETA (salve como `especificacao.md` no Conhecimento do projeto)

## 1. Visão geral
**Criador de Posts** é um aplicativo web **multimarca (multitenant)** para criar **carrosséis de Instagram e cards estilo tweet** com identidade visual da marca, exportar em **PNG, PDF ou ZIP por rede social**, e **gerar posts, legendas e imagens com IA** (Claude para texto; Nano Banana, do Google, para imagens).

- **Usuários:** equipes de marketing/agências. Cada **marca** (cliente) tem seus próprios posts, configurações, galeria de imagens e equipe.
- **Fluxo típico:** o usuário configura a marca (perfil, @ por rede, cores, tom de voz, briefing de imagens) → cria posts à mão ou **gera em lote com IA** a partir de temas/roteiros → revisa e ajusta no editor visual → gera/reaproveita imagens → gera a legenda → baixa os arquivos de cada rede.
- **Princípios:** (1) a IA **nunca publica sozinha**: tudo chega como **rascunho**; (2) **não inventar dados**: a IA só usa fatos fornecidos e marca o que o revisor deve conferir; (3) **custo visível** (estimativa antes, valor real depois, limites diários); (4) **o que aparece na tela é o que sai no arquivo** (exportação fiel).

## 2. Stack e serviços
| Camada | Escolha |
|---|---|
| Framework | **Next.js 16** (App Router, Turbopack), **React 19**, **TypeScript** |
| Login / multitenant | **Clerk** (`@clerk/nextjs` 7, `@clerk/localizations` para pt-BR). **Marca = Organization do Clerk** |
| Banco | **PostgreSQL** (local, Neon, Supabase…) com **Drizzle ORM** (`drizzle-orm`, `drizzle-kit`) e driver **`postgres`** (postgres.js) |
| IA de texto | **Anthropic API** (`@anthropic-ai/sdk`), modelo `claude-opus-5-5` |
| IA de imagem | **Google Gemini API — Nano Banana** (`gemini-nano-banana-2.1`), chamada por `fetch` (sem SDK) |
| Imagens no servidor | **`sharp`** (reencode, miniaturas) |
| Exportação (navegador) | **html2canvas 1.4.1**, **jsPDF 2.5.1**, **JSZip 3.10.1** (carregados sob demanda por CDN) |
| Scripts | `tsx` |
| Deploy | **Docker** + **Coolify** (ou qualquer host Node com Postgres) |
| Estilo | CSS puro (arquivo `app/globals.css`), fontes **Inter** e **Plus Jakarta Sans** via `next/font/google` |

Dependências de execução: `next`, `react`, `react-dom`, `@clerk/nextjs`, `@clerk/localizations`, `drizzle-orm`, `postgres`, `@anthropic-ai/sdk`, `sharp`. Dev: `typescript`, `@types/node`, `@types/react`, `drizzle-kit`, `tsx`.

Scripts do `package.json`: `dev`, `build`, `start`, `db:generate` (`drizzle-kit generate`), `db:migrate` (`drizzle-kit migrate`), `org:create` (`tsx scripts/create-org.ts`).

## 3. Variáveis de ambiente (`.env` e `.env.example`)
```
# Clerk (https://dashboard.clerk.com → API Keys)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/
NEXT_PUBLIC_CLERK_AFTER_CREATE_ORGANIZATION_URL=/
NEXT_PUBLIC_CLERK_AFTER_SELECT_ORGANIZATION_URL=/

# Banco
DATABASE_URL=postgres://usuario:senha@localhost:5432/criador_posts

# Admins da plataforma (e-mails separados por vírgula)
PLATFORM_ADMIN_EMAILS=voce@exemplo.com

# IA de texto (só no servidor)
ANTHROPIC_API_KEY=
AI_DAILY_LIMIT=100            # posts gerados com IA por marca por dia

# IA de imagem (só no servidor; API paga, ~US$ 0,034 por imagem 1K)
GEMINI_API_KEY=
GEMINI_IMAGE_MODEL=gemini-nano-banana-2.1
AI_IMAGE_DAILY_LIMIT=60       # imagens por marca por dia

# Desenvolvimento: simula as IAs (sem gastar)
# AI_MOCK=1
```
- `.env` está no `.gitignore`. No `.env.example`, **nunca** use placeholders que pareçam chaves reais (o GitHub bloqueia o push): use textos como `SUA_CHAVE_AQUI`.
- No Docker/Coolify: as duas chaves do Clerk precisam existir **no build** (`NEXT_PUBLIC_*` é embutida no bundle). Marque-as como "Build Variable" também. As demais são só de execução.

## 4. Arquitetura
```
Navegador
 ├─ Admin (páginas React/Next, Server Components + Server Actions)   /admin/...
 └─ Editor visual (HTML estático em <iframe>)                        /editor?post=ID
        │  fala com o servidor por fetch:
        ├─ PUT   /api/posts/[id]          (salvamento automático do JSON do post)
        ├─ PATCH /api/posts/[id]          (renomear)
        ├─ GET/POST /api/palettes, DELETE /api/palettes/[id]   (cores salvas)
        ├─ GET/POST /api/assets, GET/DELETE /api/assets/[id]   (galeria de imagens)
        └─ POST  /api/ai/image            (descrição e imagem com IA)
Servidor (Next, Node)
 ├─ proxy.ts (Clerk): tudo exige login, exceto /sign-in
 ├─ lib/ctx.ts: resolve usuário + marca ativa (cache por requisição, banco primeiro)
 ├─ lib/actions.ts: Server Actions (criar/duplicar/migrar/converter posts, lotes de IA, configurações…)
 ├─ lib/ai/*: geração de texto, direção de arte, imagens, legenda, fila (worker em processo)
 └─ Postgres (Drizzle)
```
**Decisões-chave**
- Os **editores** (`private/editor-carrossel.html`, `private/editor-tweet.html`) são **arquivos HTML únicos** (HTML + CSS + JS puro), guardados fora de `public/` para não serem servidos sem login. A rota `GET /editor?post=ID` valida login/marca, lê o arquivo, **injeta `window.CARROSSEL = {...}`** antes do script principal e devolve o HTML (`Cache-Control: private, no-store`). A página do admin mostra o editor dentro de um `<iframe>` com loader.
- O JSON do post (`posts.data`) é salvo **inteiro** pelo editor (debounce 500 ms; 2,5 s quando o JSON passa de ~400 KB).
- A fila de geração roda **no processo do servidor** (sem Redis): ver seção 9.
- O servidor é **Node** (não Edge): usa `sharp`, `Buffer`, conexões Postgres.

### Estrutura de pastas
```
app/
  layout.tsx            ClerkProvider (pt-BR) + fontes
  page.tsx              redireciona para /admin/posts
  globals.css           design system
  icon.svg              favicon (quadrado laranja com brilho branco)
  icons.tsx             ícones SVG
  sign-in/[[...sign-in]]/page.tsx
  admin/
    layout.tsx          menu lateral, seletor de marca, usuário; tela "escolha/crie sua marca"
    nav-link.tsx  loading.tsx  post-preview.tsx  template-art.tsx
    posts/              lista (cards/lista), editor do post, ações, legenda, conversão
    gerar/              "Gerar com IA": formulário, lote, itens
    galeria/            galeria de imagens
    templates/          formatos de post
    configuracoes/      perfil, contas, cores, identidade para IA, foto
    usuarios/           membros, convites, lista da plataforma
  api/ ...              rotas listadas acima + /api/ai/kick
  editor/route.ts       serve o editor HTML com os dados injetados
db/ schema.ts  index.ts  migrations/
lib/ actions.ts ctx.ts assets.ts convert.ts posts.ts themes.ts editors.ts format.ts
lib/ai/ generate.ts worker.ts image.ts image-prompt.ts caption.ts constants.ts networks.ts
private/ editor-carrossel.html  editor-tweet.html
scripts/ migrate.mjs  create-org.ts
proxy.ts  Dockerfile  .dockerignore  drizzle.config.ts  next.config.ts
```

## 5. Multitenancy e permissões
- **Marca (tenant) = Organization do Clerk.** Ative "Organizations" no painel do Clerk. O menu tem um **seletor de marca**. Se o usuário não tem marca ativa, a tela mostra `OrganizationList` ("Escolha ou crie sua marca").
- **Cadastro público DESLIGADO** (sem rota `/sign-up`). Pessoas entram por **convite** de organização (feito na tela Usuários) ou criadas no painel do Clerk.
- **Papéis:** `org:admin` (administrador da marca) e membro. **Super-admin da plataforma** = e-mail listado em `PLATFORM_ADMIN_EMAILS`.
  - Membro: cria/edita posts, usa IA, galeria, legendas, conversões.
  - Admin da marca: tudo do membro + Configurações (perfil, cores, identidade de IA, foto), convidar/remover membros, excluir templates e imagens de outros, importar imagens dos posts.
  - Super-admin: tudo + **migrar posts entre marcas**, ver todos os usuários da plataforma, criar/excluir templates globais.
- **`getCtx()`** (`lib/ctx.ts`, cacheado por requisição com `React.cache`): lê `auth()` do Clerk; busca usuário e marca **no banco primeiro**; só chama a API do Clerk (lenta) quando o usuário/marca ainda não existem (cria linhas em `users`, `brands`, `brand_settings`). Retorna `{ userId, brandId, brandName, isBrandAdmin, isPlatformAdmin }`. **Toda** rota/ação usa `getCtx()` e filtra por `brandId`.
- `ensureBrand(clerkOrgId, name?)` cria a marca lazy (necessário ao migrar posts para marcas que ninguém abriu ainda).
- Limitação conhecida: renomear a organização no Clerk não atualiza o nome local (solução futura: webhook).

## 6. Modelo de dados (Postgres)
Use UUIDs (`gen_random_uuid()`), `timestamp` sem fuso, **conexão com `TimeZone: 'UTC'`** (armadilha, seção 14). Todas as tabelas de conteúdo têm `brand_id` com `ON DELETE CASCADE`.

| Tabela | Colunas principais |
|---|---|
| `users` | `id` (id do Clerk, PK), `email`, `name`, `image_url`, `created_at` — espelho do Clerk |
| `brands` | `id`, `clerk_org_id` (único), `name`, `created_at` |
| `brand_settings` (1:1 com marca, PK = `brand_id`) | `display_name`, `handle`, `instagram`, `tiktok`, `x`, `topic`, `year`, `avatar_url` (`/api/assets/ID`), `style` jsonb `{theme, font, width}`; IA: `ai_niche`, `ai_audience`, `ai_voice`, `ai_rules`, `ai_cta`, `ai_examples`, `ai_image_style` (briefing visual da marca), `ai_caption_rules`; `updated_at` |
| `templates` | `id`, `brand_id` (nulo = global), `name`, `description`, `editor` (`'carrossel'`/`'tweet'`), `created_by`, `created_at`. **Template = formato do post** (qual editor abre) |
| `color_palettes` | `brand_id`, `editor`, `name`, `theme` jsonb, `created_by` — "cores salvas" por marca e por editor |
| `posts` | `id`, `brand_id`, `template_id` (restrict), `source_post_id` (post de origem, em conversões), `caption` (legenda), `title`, `status` enum `draft`/`published`, `data` jsonb, `created_by`, `updated_by`, `created_at`, `updated_at`. Índice `(brand_id, updated_at)` |
| `generation_batches` | `brand_id`, `template_id`, `mode` (`tema`/`roteiro`), `slides_target`, `with_images` bool, `image_brief`, `facts`, `instructions`, `created_by`, `created_at` |
| `generation_items` | `batch_id`, `brand_id`, `brief`, `status` enum `queued/running/done/error`, `post_id` (set null), `notes` jsonb `string[]`, `error`, `input_tokens`, `output_tokens`, `image_count`, `attempts`, `created_at`, `updated_at` |
| `image_generations` | `brand_id`, `user_id`, `model`, `prompt`, `aspect_ratio`, `created_at` — auditoria e limite diário de imagens |
| `assets` | `brand_id`, `kind` (`'ai'`/`'upload'`/`'avatar'`), `mime`, `bytes` **bytea**, `thumb` bytea, `size`, `width`, `height`, `description`, `tags` (texto separado por espaço), `content_hash`, `usage_count`, `last_used_at`, `created_by`, `created_at`, **`search` tsvector gerado**: `to_tsvector('portuguese', description \|\| ' ' \|\| tags)`. Índices: GIN em `search`; **único** `(brand_id, content_hash)` |

Migrações geradas com `drizzle-kit generate` e aplicadas com `drizzle-kit migrate` (e, em produção, por `scripts/migrate.mjs` na subida do container). Dados iniciais (templates globais "Carrossel Feed" e "Tweet Card") entram **dentro das migrações SQL** (INSERT), não em script de seed.

### Formato do JSON do post (`posts.data`)
```ts
type PostData = { v: number; g: Record<string, unknown>; slides: unknown[] | null };
```
`g` (globais do post): `name`, `handle`, `accounts {instagram,tiktok,x}`, `view` (rede exibida no editor), `topic` (tema, aparece em caixa alta), `year`, `avatar`, `font`, `width`, `imageBrief` (briefing de imagens do post), e conforme o editor: carrossel → `theme` (cores); tweet → `colors`, `logo`, `showLogo`.
**Slide do carrossel:** `{ format: 'cover'|'text'|'text-image'|'image', html, image (dataURL ou '/api/assets/ID' ou null), fit: 'cover'|'contain', showProfile, showMore, imgH? (altura fixa), imagePrompt?, aiRatio?, imgAdj? {k,x,y,z} }`.
**Slide do Tweet Card:** `{ text, showButton, button, showImage, image, ratio: 'orig'|'16/9'|'4/3'|'1/1'|'custom', h (120–900), fit, showMetrics, c, r, l, size ('42'|'50'|'58'|'68'), imagePrompt?, aiRatio?, imgAdj? }`.
`imgAdj` = ajuste do enquadramento da imagem; `k` é uma impressão digital da imagem atual (`length:últimos 24 caracteres`), então **trocar a imagem zera o ajuste**.

## 7. Telas do admin
Menu lateral: logo, **seletor de marca (Clerk `OrganizationSwitcher`)**, cartão da marca (inicial, nome, "Administrador/Membro") e itens: **Marca → Posts, Gerar com IA, Galeria, Configurações**; **Geral → Templates, Usuários**; rodapé com `UserButton`. No celular o menu vira **barra fixa no rodapé** (só ícones) e o topo fica compacto.

1. **Posts** (`/admin/posts`)
   - Cartão "Novo post": escolha visual do **template** (ilustração + nome + descrição), campo de título, botão "Criar post" → abre o editor.
   - Alternador **Cards / Lista** (lembrado em cookie `posts_view`). Card: prévia do 1º slide (cores e texto reais), selo "N slides", título, formato · "há 2 horas" · autor, selo de status (clique alterna rascunho/publicado), ações em ícones: **renomear** (popover), **migrar para outra marca** (só super-admin), **converter** (carrossel ↔ Tweet Card), **duplicar**, **excluir**. Lista: linha com amostra de cor, título, formato, status, slides, atualizado, ações; no celular cada linha vira um mini-cartão.
   - Aviso verde após migrar: "Post migrado para X. Ele chegou lá como rascunho."
2. **Editor do post** (`/admin/posts/[id]`): barra com "← Posts", **título editável no lugar** (Enter/blur salva, Esc cancela), selo de status, selo "Derivado de outro post ↗" (se convertido), botão **Legenda** (painel), botão **Converter**; abaixo, o `<iframe>` do editor com **loader** ("Abrindo o editor…").
3. **Gerar com IA** (`/admin/gerar`): formulário (seção 9) e "Lotes recentes". **Lote** (`/admin/gerar/[id]`): barra de progresso, custo, lista de itens (miniatura, status, título, brief, notas, ações "Abrir no editor", "Gerar de novo", "Repetir os com erro", "Excluir lote"), atualização automática a cada 3 s enquanto houver pendentes.
4. **Galeria** (`/admin/galeria`): grade com busca por palavras, envio de várias imagens, exclusão (recusada se algum post usa), botão **"Importar imagens dos posts"** (admin).
5. **Configurações** (`/admin/configuracoes`): foto de perfil da marca (com opção "aplicar aos posts existentes sem foto"), nome, **contas por rede** (Instagram, TikTok, X), tema, ano, **cores padrão** (temas prontos + cores salvas) com **prévia ao lado**, **Identidade da marca para a IA** (nicho, público, tom de voz, regras, CTA, **regras das legendas**, **briefing de imagens**, exemplos de posts). Só admin edita; membros veem em modo leitura.
6. **Templates** (`/admin/templates`): cartões dos formatos (global/da marca), exclusão (bloqueada se houver posts); super-admin cria novos (nome, descrição, qual editor).
7. **Usuários** (`/admin/usuarios`): membros da marca (nome, e-mail, papel), convites pendentes, formulário de convite (e-mail + papel), remover (admin); super-admin vê também **todos os usuários da plataforma**.
8. **Login** (`/sign-in`): componente `SignIn` do Clerk com a identidade do app.

## 8. Os dois editores (arquivos HTML autossuficientes)
Slide **1080 × 1350 px**; a tela escala o slide para caber (variável CSS `--s`). Estrutura de cada editor: barra superior (nome do editor, status "Salvo", "+ Novo slide", exportar), **coluna de miniaturas** (clique troca; "+ Novo slide"), **palco** com o slide editável (campos clicáveis direto no slide) e **painel à direita**. Em telas <960 px o layout empilha (miniaturas em linha, palco, painel).

**Protocolo com o servidor (`window.CARROSSEL`)**: `{ initial (post.data), saveUrl, title, imageUrl, assetsUrl, imageEnabled, brandImageBrief, palettesUrl, editor, palettes[] }`. Sem esse objeto (arquivo aberto sozinho) o editor usa `localStorage` e desliga recursos de servidor.

### 8.1 Editor de Carrossel
- **Formatos de slide:** Capa (`cover`: título + texto + imagem embaixo, 450 px), Texto, Texto + imagem, Imagem.
- **Slide:** cabeçalho de uma linha com **tema em CAIXA ALTA à esquerda e ano à direita** (cor própria "eyebrow"; a linha some se tema e ano estiverem vazios, e então a margem de cima iguala a de baixo); bloco de **perfil** (foto 112 px, nome 29 px em negrito, @ 23 px com selo de verificado azul) opcional por slide; **texto rico** (contenteditable: Título, Parágrafo, negrito/itálico/sublinhado, fonte do trecho, listas com ✔, → ou marcador, imagem inline, limpar, desfazer/refazer; colar só texto); espaço de **imagem**; rodapé com @ e "Veja mais →" (opcional por slide). Aviso "O texto excede o espaço do slide" quando estoura.
- **Painel:** formato do slide; opções do slide (mostrar perfil, "Veja mais"); **Imagem** (enviar, remover, **Ajuste**: preencher/mostrar inteira; **altura automática ou personalizada** 150–1100 px; **zoom 100–300% e centralizar**; **arrastar a imagem no slide** reposiciona; clique sem arrastar troca a imagem); bloco **Imagem com IA** (seção 10); **Perfil e cabeçalho** (foto, nome, **contas por rede** com seletor de qual aparece no editor, tema, ano, fonte, largura do texto); **Cores do template** (7 temas prontos — Original, P&B, Escuro, Azul noite, Floresta, Terracota, Violeta — mais **cores salvas** por marca com salvar/aplicar/excluir; 10 cores editáveis: fundo, título/nome, texto, cabeçalho/rodapé, @, marcadores de lista, selo, **título acima do perfil (eyebrow)**, imagem vazia início/fim); **Exportar** (seção 8.3).
- Cores do tema (`g.theme`): `bg, title, text, muted, handle, marker, badge, eyebrow, slotA, slotB`.
- Fontes disponíveis (Google Fonts): Inter, Poppins, Montserrat, DM Sans, Manrope, Space Grotesk, Work Sans, Raleway, Oswald, Playfair Display, Lora, Merriweather, Libre Baskerville, Roboto Slab, Kanit, Barlow.
- Salvar/abrir projeto em `.json` (arquivo) além do salvamento no servidor.

### 8.2 Editor de Tweet Card
- **Slide:** fundo colorido; **logo** centralizado no espaço entre o topo e o card (opcional: "Mostrar logo" liga/desliga; sem logo o card centraliza); **card** branco arredondado (largura 800 px, raio 36, padding 52/46) com foto, nome + selo, @, **texto** (tamanho: pequeno 42 / padrão 50 / grande 58 / extra 68 px), **imagem opcional dentro do card** (formatos: Original, 16:9, 4:3, 1:1 ou altura personalizada 120–900 px; ajuste preencher/inteira; zoom/arrastar como no carrossel; no modo "Original" não há corte), **botão opcional** (texto em caixa alta), linha divisória e **métricas** (comentários, compartilhamentos, curtidas — números editáveis direto no slide).
- **Cores** (`g.colors`): `bg, card, text, name, handle, accent2 (botão), btntext, line, badge, ph`; 6 temas prontos (Verde, Claro, Escuro, Azul noite, Terracota, Violeta) + cores salvas por marca. Fontes: Plus Jakarta Sans (padrão), Inter, Manrope, DM Sans, Poppins, Montserrat, Space Grotesk, Work Sans, Kanit, Barlow.
- Posts de Tweet Card gerados por IA nascem **sem métricas** (nunca inventar números de engajamento).

### 8.3 Exportação (nos dois editores)
- **Caixa "Baixar para a conta":** lista as contas preenchidas (`Instagram · @x`) + **"Todas as contas (N)"**; se nenhuma estiver preenchida, "Perfil atual".
- **PNG** (este slide / todos) e **PDF** (1 página 1080×1350 por slide; renderizado a 2× e comprimido em JPEG 0,92). Nomes de arquivo: `titulo-do-post-01.png`, `titulo-do-post-instagram-01.png`, `titulo-do-post-tiktok.pdf` (título sem acento, minúsculo, com hífens).
- **Várias contas → um `.zip`** com uma pasta por rede (`instagram/`, `tiktok/`, `x/`), cada arquivo com o **@ daquela rede aplicado ao slide** (o @ é trocado só durante a renderização e restaurado depois).
- **Fidelidade:** a imagem do slide é renderizada com `background-image` + `transform: scale()` (ver armadilhas).
- Bibliotecas baixadas sob demanda (CDN `cdnjs.cloudflare.com`): html2canvas, jsPDF, JSZip. Botões desativados durante a exportação.

### 8.4 Contas por rede
Cada marca tem um @ por rede (`brand_settings.instagram/tiktok/x`), copiado para `g.accounts` ao criar o post. O editor mostra **uma** conta por vez (a escolhida no ●) apenas para demonstração; ao editar o @ direto no slide, grava na conta exibida. O "@" é acrescentado automaticamente ao sair do campo.

## 9. IA de texto: gerar posts (individual e em lote)
**Entradas** (formulário "Gerar com IA"): modo **Temas** (um por linha → a IA escreve o post inteiro com N slides, 5–10) ou **Roteiros prontos** (cada roteiro é um **cartão** próprio; "+ Adicionar roteiro"; texto colado com `---` vira vários cartões; a IA só estrutura em slides); **formato** (carrossel ou Tweet Card, com ilustração); "Dados e fatos que a IA pode usar" (opcional); "Instruções extras"; caixa **"Gerar também as imagens dos slides"** + briefing de imagens do lote. Mostra contagem e **estimativa de custo** (≈ US$ 0,035 por post + ≈ 3 imagens × US$ 0,034 se marcado). Máx. **30 itens por lote**, **12 slides por post**, **6.000 caracteres por item**, limite diário `AI_DAILY_LIMIT` por marca.

**Chamada ao Claude** (uma por post): `client.beta.messages.create` com `model: 'claude-opus-5-5'`, `max_tokens: 16000`, `output_config: { effort: 'medium', format: { type: 'json_schema', schema } }` (**saída estruturada**), `betas: ['server-side-fallback-2026-07-01']` + `fallbacks: 'default'`, `system` = montagem de blocos (seção 12), `messages` = TEMA ou ROTEIRO + FATOS PERMITIDOS + INSTRUÇÕES EXTRAS. Tratar `stop_reason`: `refusal` e `max_tokens` viram erro amigável; erros 429/5xx são "retentáveis".
**Esquema de saída — carrossel:** `{ title, topic, caption, to_verify[], slides[{ format, html, show_more, image_note }] }`. **Tweet Card:** `{ title, caption, to_verify[], slides[{ text, button, image_note }] }`.
**Pós-processamento:** `html` passa por **sanitizador** (só `h2, p, ul(class check|arrow|dot), li, b, strong, i, em, u, br`); mapeia para o formato nativo do editor; `image_note` vira `imagePrompt` do slide; `to_verify` e dicas de imagem viram **notas** do item ("⚠ Conferir antes de publicar…"); posts nascem como **rascunho** com o perfil, contas, cores e **foto da marca** (`initialPostData`).

**Fila (sem Redis):** `generation_items` com status `queued → running → done|error`. `kickBatch(batchId)` roda **em segundo plano no processo** com **3 trabalhadores em paralelo**; cada um **reivindica** o próximo item com `UPDATE … WHERE id = (SELECT … FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING id`. Erros retentáveis voltam à fila (até **3 tentativas**, com espera crescente); itens "running" há mais de **5 min** voltam à fila (servidor reiniciou). A tela do lote faz `router.refresh()` a cada 3 s e chama `POST /api/ai/kick` para retomar o processamento.
**Custo medido:** ~US$ 0,02–0,04 por post de 5–7 slides (US$ 4 / 20 por milhão de tokens de entrada/saída). Cada item guarda tokens; a tela soma o custo real.
**Modo simulado:** com `AI_MOCK=1`, texto e imagem são simulados (um tema com a palavra "erro" falha de propósito).

## 10. IA de imagem (Nano Banana) e galeria
### 10.1 Briefing de imagens (como o "tom de voz" dos textos)
Dois níveis, **somados**: **da marca** (`brand_settings.ai_image_style`, até 1.500 caracteres) e **do post** (`g.imageBrief`; no lote vai para cada post gerado). Combinação (`combineBriefs`): `"Marca: …\nEste post: …"`; **em conflito, o do post prevalece**. Entra na direção de arte e no prompt final.

### 10.2 Direção de arte (descrição da imagem)
Chamada barata ao Claude (`effort: 'low'`, saída estruturada `{prompt, ratio, tags[]}`): recebe o **texto do slide**, o **resumo do roteiro inteiro**, título/tema, formato, o briefing combinado, a **instrução do usuário** (se houver) e, na regeração, a **descrição anterior + feedback**. Regras: 2–4 frases em pt-BR (cena, composição, luz, paleta, clima); imagem **estratégica** que reforça a mensagem; **sem texto, números, logotipos, interfaces nem gráficos com dados**; sem pessoas reais identificáveis; composição limpa com espaço para o texto; se a instrução do usuário for boa, preservar e enriquecer, se for vaga, **reescrever por completo**; devolver 5–8 **tags** em português. No **lote** é **uma única chamada por post** que descreve todas as imagens com **a mesma direção de arte** (post coeso); falhas caem para slide a slide.

### 10.3 Chamada ao Google (Nano Banana) — formato exato
```
POST https://generativelanguage.googleapis.com/v1beta/interactions
Headers: x-goog-api-key: $GEMINI_API_KEY ; content-type: application/json
Body: {
  "model": "gemini-nano-banana-2.1",
  "input": [ { "type": "text", "text": "<descrição + briefing + regras>" } ],
  "response_format": { "type": "image", "mime_type": "image/jpeg", "aspect_ratio": "16:9", "image_size": "1K" }
}
Resposta: { status, steps: [ { type: "model_output", content: [ { type: "image", data: "<base64>", mime_type: "image/jpeg" } ] } ] }
```
Proporções usadas: `1:1, 4:3, 16:9, 4:5, 3:4, 9:16`. A resposta é lida procurando, em qualquer nível, o primeiro bloco `{type:'image', data}` (aceita também `inlineData`). Timeout 120 s. Mapear erros: 401/403 (chave), 429 (limite), 400 (pedido recusado, mostrar a mensagem), sem imagem (status). Prompt final = descrição + "Briefing visual (siga; se houver conflito, o do post prevalece): …" + regra fixa "Não inclua texto, letras, números, logotipos nem marcas d'água, a menos que a descrição peça". **API paga** (sem camada gratuita para imagens); toda imagem tem marca d'água invisível SynthID.

### 10.4 Fluxo individual (nos dois editores)
1. Em slide com espaço de imagem vazio, o **placeholder** mostra **✨ Gerar com IA** e **📚 Galeria**. O painel também tem o bloco "Imagem com IA" (briefing do post, descrição, proporção, "Melhorar minha descrição com IA").
2. **Primeiro a galeria:** "Gerar com IA" sem descrição digitada busca na galeria imagens parecidas com o slide (busca com `min=2` palavras em comum, até 3). Se achar, abre a janela **"Já temos imagens parecidas"** (usar uma ou **"Gerar nova imagem com IA"**). Nunca reaproveita sozinho.
3. **Janela "Imagem com IA":** (a) o Claude cria a **descrição editável** (modo `prompt` da rota: não gera imagem nem conta no limite); você edita, escolhe a proporção e clica **Gerar imagem** (≈ US$ 0,03); **"Criar outra descrição"** troca só o texto; opção **"Da próxima vez, gerar direto"** (guardada no navegador) pula essa aprovação. (b) A imagem aparece **na janela** (o slide não muda ainda). (c) **Usar esta imagem**, **Regerar com feedback** (atalhos: mais claro, mais escuro, mais simples, menos objetos, mudar o enquadramento, sem pessoas, mais realista, mais minimalista + texto livre → o Claude reescreve a descrição aplicando o feedback → gera outra) ou **Descartar**. Versões geradas ficam numa fileira de miniaturas; ao **usar** uma, as outras são removidas da galeria; ao descartar, todas.
4. Digitou a descrição no painel e desmarcou "melhorar" → vai direto para a imagem.
5. Se o usuário trocar de slide durante a geração, o resultado vai para o slide certo.

### 10.5 Galeria de imagens da marca
- Imagens ficam na tabela `assets` (bytes no Postgres), e **o post guarda só a referência** `/api/assets/{id}` (não base64): posts leves.
- **Processamento no servidor (`sharp`):** corrige rotação, limita a 2.000 px, reencoda em **JPEG q86** (ou **PNG se tiver transparência**), cria **miniatura 420 px** (JPEG q72), calcula **hash SHA-256** e **deduplica por marca**.
- `GET /api/assets/[id]` devolve os bytes (ou `?thumb=1`) com `Cache-Control: private, max-age=31536000, immutable`, só para quem é da marca dona.
- **Busca ("SEO"):** `keywords()` extrai até 8 palavras do texto (minúsculas, ≥4 letras, sem stopwords em português, por frequência/tamanho). Consulta `to_tsquery('portuguese', 'a | b | c')` sobre o `search` tsvector; ordena por palavras em comum, `ts_rank`, uso e data. As tags vêm **da própria direção de arte** (sem custo extra) + palavras da descrição.
- Excluir é **recusado** se algum post ainda usa a imagem. `kind='avatar'` não aparece na galeria. Envio manual do editor também grava na galeria. "Importar imagens dos posts" troca base64 antigo por referências (idempotente).
- A **foto de perfil da marca** é um asset `avatar`; vai para todo post novo (criado à mão, gerado, convertido ou migrado) e, opcionalmente, para os existentes sem foto (`jsonb_set` em uma única consulta).

## 11. Outras funções
- **Legenda por post** (`posts.caption`): botão **Legenda** na barra do editor → painel com texto editável (salva ao sair do campo), **rede** (Instagram 2.200 / TikTok 4.000 / X 280 caracteres, com contador que fica vermelho), campo de pedido de ajuste ("mais curta, sem hashtags…"), **Gerar / Regerar-ajustar** e **Copiar**. Nos posts criados por IA a legenda **já vem pronta**, gerada **na mesma chamada** do texto dos slides (campo `caption` do esquema). Usa o tom de voz, o CTA e as **"Regras das legendas"** da marca. Guias por rede: Instagram (gancho na 1ª linha, 2–4 parágrafos curtos que complementam e não repetem os slides, CTA, hashtags conforme regras ou 3–5, ideal ≤ 1.200 caracteres), TikTok (1–2 frases + 3–5 hashtags, ≤ 300), X (≤ 270 caracteres no total, 0–2 hashtags).
- **Converter carrossel ↔ Tweet Card:** botão (ícone de setas) em cada post e na barra do editor. Janela "Quantos cards/slides?" (1–12, padrão = quantidade do original, atalhos). A IA reescreve o conteúdo no novo formato (modo roteiro + instrução de conversão, **exatamente N** slides; 1 nova tentativa se errar a contagem; avisa se ainda assim diferir), **mantém imagens** (passam, na ordem, para os espaços de imagem do novo post), foto, contas, tema e briefing de imagens. Cria um **novo rascunho** "Título (Tweet Card)" com `source_post_id`; **o original nunca é alterado**; o custo entra como lote em "Gerar com IA" e conta no limite diário. Abre o novo post ao terminar.
- **Migrar post entre marcas (só super-admin):** popover com a lista de organizações do Clerk, opção "Aplicar nome, @ e foto da marca de destino" (no carrossel aplica também cores/fonte; o Tweet Card mantém as próprias cores e logo). O post chega como **rascunho**; itens de lotes que apontavam para ele ficam sem `post_id`; bloqueia se o template for exclusivo da marca de origem.
- **Duplicar** (sempre rascunho, título "(cópia)"), **renomear** (no editor e na lista), **excluir**, **alternar status**.
- **Cores salvas**: salvar a paleta atual com nome, aplicar com um clique, excluir (quem criou ou admin).

## 12. Prompts de IA (conteúdo essencial a reproduzir)
**Blocos do `system` da geração de posts (montados nesta ordem):**
1. Papel: "Você é um redator sênior de conteúdo para redes sociais. Você produz posts prontos para um editor de slides, em JSON estrito."
2. **IDENTIDADE DA MARCA**: marca, nicho, público, tom de voz, regras, CTA padrão, regras das legendas, e "EXEMPLOS DE POSTS DESTA MARCA (imite o estilo, não copie o conteúdo)".
3. **Formato**:
   - *Carrossel:* formatos `cover` (capa, 1º slide), `text`, `text-image`, `image`; campo `html` só com as tags permitidas; ≤ ~50 palavras por slide (~30 em `text-image`); `<h2>` em quase todo slide de texto, listas quando enumerar; `show_more` verdadeiro em todos menos no último; `image_note` só quando uma imagem ajuda (senão `""`); `topic` curto (≤ 40 caracteres, caixa normal).
   - *Tweet Card:* `text` puro (≤ ~38 palavras; **≤ ~22 quando o slide tem imagem ou botão**), `button` (CTA, só quando pedido ou no último slide) ou `""`, `image_note`; **não criar métricas de engajamento**.
4. **Modo:** *Tema* (slide 1 com gancho forte; meio: uma ideia por slide com progressão do problema à solução; último: fechamento com o CTA da marca; frases curtas e concretas) ou *Roteiro* (preservar texto e tom; só organizar em slides; respeitar a divisão por "Slide N"/"---").
5. **Imagens ativadas** (se marcado): capa já tem espaço; usar `text-image` em até 3 slides do meio (carrossel) / `image_note` no slide 1 e em até 2 outros (tweet); copiar fielmente a instrução do roteiro, ou escrever uma intenção curta baseada no conteúdo; nunca pedir texto/gráfico com números na imagem.
6. **LEGENDA ("caption")**: gancho na 1ª linha; 2–4 parágrafos curtos que complementam (não repetem os slides); CTA da marca; hashtags conforme as regras da marca ou 3–5; ≤ ~900 caracteres.
7. **REGRAS GERAIS:** português do Brasil; **NÃO inventar fatos, números, estatísticas, datas, nomes ou fontes** (usar só o briefing e "FATOS PERMITIDOS"); listar em `to_verify` toda afirmação factual que o revisor deve conferir; respeitar regras e tom; evitar clichês de IA ("mergulhe", "desvende", "no mundo de hoje"); `title` = nome interno curto (≤ 60 caracteres); máximo de 12 slides.

**Prompt da legenda sob demanda:** papel de redator; regras (complementar, respeitar tom/regras, não inventar, devolver só o texto pronto para colar) + bloco de marca + guia da rede escolhida + legenda atual e pedido do usuário (para ajustes). `effort: 'low'`, saída `{caption}`.
**Prompt da direção de arte:** ver 10.2.
**Conversão:** instruções extras do tipo "CONVERSÃO DE FORMATO: … reescreva como X mantendo ideias, ordem, dados e CTA… EXATAMENTE N cards… o post original tem K imagens: o novo deve ter exatamente min(K, N) slides com espaço de imagem…".

## 13. Design system (admin)
- **Cores:** fundo `#F4F1EB`, superfície `#FFFFFF`, superfície 2 `#FAF8F4`, texto `#16140F`, texto secundário `#4A463D`, apagado `#8A857A`, linhas `#E8E3D8` / `#D9D3C5`, **cor principal `#F97335`** (hover `#E8621F`, suave `rgba(249,115,53,.16)`), apoio `#FFB02E`, sucesso `#1F9D63`, perigo `#C8341F`.
- **Tipografia:** corpo **Inter**; títulos **Plus Jakarta Sans** (600/700/800, espaçamento -0,02em). Corpo 14 px.
- **Componentes:** botões (primário laranja com sombra; secundário branco; ghost; perigo), campos com foco laranja, **selos** (rascunho âmbar, publicado verde, "Global/Administrador" laranja), cartões (raio 14, sombra suave), tabelas, **popovers** (`<details>`) para ações rápidas, opções selecionáveis (radio estilizado com `:has(input:checked)`), loaders (spinner laranja), avisos (info/aviso/erro/ok), item ativo do menu em laranja.
- **Responsivo:** ≤ 900 px o menu vira barra fixa no rodapé, grades viram 1–2 colunas, tabelas viram cartões; botões de ação compactos para caber 4 ícones em um cartão de 158 px.
- **Favicon:** quadrado arredondado com degradê `#FFB02E → #F97335` e brilho branco de 4 pontas. **Editores:** mesmos tokens (laranja como destaque), painel em seções separadas, miniaturas com realce.
- Acessibilidade mínima: `aria-label` em botões só-ícone, foco visível, `prefers-reduced-motion` para spinners.

## 14. Armadilhas conhecidas (reproduza as soluções)
1. **html2canvas ignora `object-fit`/`object-position`.** Para ajustar/cortar imagem, use `<div>` com `background-image`, `background-size: cover|contain`, `background-position: X% Y%` e `transform: scale(z)` com `transform-origin: X% Y%`, dentro de um contêiner com `overflow:hidden` e `border-radius` (testado: o PNG/PDF sai igual à tela). `transform` e clipe por borda arredondada funcionam.
2. **Fuso horário:** o `now()` do Postgres usa o fuso do servidor, e o JS grava datas em UTC → diferenças de 3 h ("há 4 horas" para algo recém-criado, limites diários errados). Solução: `postgres(url, { connection: { TimeZone: 'UTC' } })`.
3. **Classe CSS `.check` colidindo:** a classe usada nas caixas de seleção do painel (`font-size:14px; display:flex`) afetava `ul.check` (lista com ✔). Restrinja a `label.check`.
4. **Next 16:** o arquivo de proteção de rotas chama-se **`proxy.ts`** (antes `middleware.ts`). Excluir do `matcher` arquivos estáticos e `_next`.
5. **Desempenho do login:** não chame a API do Clerk em toda requisição; use banco primeiro + `React.cache` (seção 5).
6. **Lista de posts leve:** extraia do JSON só o necessário no SQL (`jsonb_array_length`, `left(data->'slides'->0->>'html', 900)`) em vez de carregar o JSON com imagens.
7. **Imagens no JSON do post** deixam cada salvamento com vários MB: por isso a **galeria** (referências) e o debounce adaptativo.
8. **Uma chamada de direção de arte por post** (não por imagem): mais barato e com estilo coeso.
9. **`.env.example`:** placeholders não podem parecer chaves reais (o GitHub bloqueia o push com "push protection").
10. **Build com Google Fonts:** `next/font/google` baixa as fontes no build; se o servidor de build estiver sem internet o build falha. Alternativa: fontes locais (`next/font/local`).
11. **Gerar PNG/PDF:** carregar html2canvas/jsPDF/JSZip só sob demanda (não bloquear a abertura do editor); fontes do Google com `media="print" onload="this.media='all'"`.
12. **Servidor de desenvolvimento:** após mudar `.env`, banco ou dependências, reinicie; rodar `next build` com o `next dev` ligado pode corromper `.next` (apague `.next` e reinicie).
13. **Transparência:** converter imagens para JPEG remove transparência (logo fica com fundo preto). Mantenha **PNG quando houver canal alfa**.
14. **Dados de teste:** scripts de teste devem criar uma **marca temporária** e removê-la no fim (cascade), sem tocar nos dados reais.

## 15. Deploy (Docker + Coolify)
`Dockerfile` multi-estágio (`node:22-alpine`): `deps` (`npm ci`) → `build` (copia o projeto; `ARG` e `ENV` para `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` e `CLERK_SECRET_KEY`; `npm run build`) → `run` (`NODE_ENV=production`, `PORT=3000`, `HOSTNAME=0.0.0.0`, copia o build, `CMD ["sh","-c","node scripts/migrate.mjs && npm start"]`). `scripts/migrate.mjs` aplica as migrações do Drizzle com `drizzle-orm/postgres-js/migrator` a partir de `./db/migrations`. `.dockerignore`: `node_modules`, `.next`, `.git`, `.env*` (exceto `.env.example`).
No Coolify: crie um recurso **PostgreSQL**; no app, defina `DATABASE_URL` (URL interna), as chaves do Clerk (**também como Build Variable**), `PLATFORM_ADMIN_EMAILS`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`; porta **3000**. Em produção use instância de produção do Clerk (`pk_live_`/`sk_live_`). Criar a primeira organização: `npm run org:create -- "Nome da marca" email@dono.com` (usuário já criado no Clerk).

## 16. Testes de aceitação (peça ao usuário para conferir ao fim de cada fase)
- **Login/tenant:** sem login redireciona a `/sign-in`; sem cadastro público; criar/trocar de marca; membro de outra marca **não** vê posts desta.
- **Posts:** criar nos dois formatos, renomear, duplicar, excluir, alternar status, alternar cards/lista (lembra a escolha); lista leve com 40 posts de imagens pesadas (< 100 ms de consulta).
- **Editores:** salvamento automático ("Salvo"); trocar tema/ano/cores/fonte; listas com ✔ no tamanho certo; imagem: enviar, arrastar, zoom, centralizar, inteira, altura; exportar PNG/PDF/ZIP e **conferir que o arquivo é igual à tela** (inclusive imagem reposicionada).
- **Contas:** preencher 3 @; trocar a conta exibida; "Todas as contas" gera `.zip` com 3 pastas e o @ correto em cada imagem.
- **IA de texto:** lote de 3 temas e 2 roteiros (cartões); progresso; erro isolado não derruba os outros; "Gerar de novo"; "Repetir com erro"; "Conferir" aparece; sem número inventado; legenda pronta; custo bate com a estimativa; limite diário bloqueia.
- **IA de imagem:** descrição editável → imagem → feedback → usar/descartar; sugestão da galeria antes de gerar; briefing do post sobrepõe o da marca; erro do Google aparece em português; limite diário.
- **Galeria:** busca por palavra acha por sinônimo de tema; excluir imagem em uso é recusado; importar imagens dos posts; duplicata não cria segunda cópia.
- **Extras:** converter 6 slides → 4 cards → 5 slides; migrar post (super-admin); foto da marca em post novo e "aplicar aos existentes".
- **Celular (375 px):** menu inferior, listas em cartões, sem rolagem horizontal, botões de ação todos visíveis.

## 17. Plano de construção (siga esta ordem; uma fase por vez)
- **Fase 0 — Projeto e deploy mínimo:** Next.js + TS, Clerk (login, organizações, sem cadastro público), Postgres + Drizzle, `getCtx`, layout do admin (menu, seletor de marca, loading), `.env`, `.gitignore`, favicon.
- **Fase 1 — Posts e editor de carrossel:** tabelas `brands/brand_settings/templates/posts`, migração inicial com o template global, Posts (criar/listar/renomear/duplicar/excluir/status), rota `/editor` com injeção, **editor de carrossel** completo, salvamento automático, exportação PNG.
- **Fase 2 — Configurações e marca:** perfil, contas por rede, cores padrão e **cores salvas** (`color_palettes`), foto de perfil, Templates, Usuários (convites).
- **Fase 3 — Tweet Card:** segundo editor, template global, métricas, botão, imagem no card, cores/temas.
- **Fase 4 — Exportação avançada:** PDF, ZIP por conta, nomes de arquivo.
- **Fase 5 — Visual e responsivo:** design system completo, cards com prévia, alternador cards/lista, mobile.
- **Fase 6 — IA de texto:** identidade da marca, geração individual e em lote com fila, revisão, custos, limites, `AI_MOCK`.
- **Fase 7 — Galeria e imagens com IA:** `assets` + `sharp`, busca em português, página Galeria, briefing de imagens, direção de arte, Nano Banana, janela de aprovação/feedback, sugestão antes de gerar, imagens no lote, ajuste da imagem no slide, importação.
- **Fase 8 — Extras:** legenda, conversão entre formatos, migração entre marcas, duplicação.
- **Fase 9 — Produção:** Dockerfile, migrações na subida, Coolify, instância de produção do Clerk, fontes locais (opcional).

**Para começar:** peça ao usuário, antes da Fase 0, (1) conta no Clerk com Organizations ativado e cadastro público desligado, (2) um Postgres (local ou Neon), (3) a chave da Anthropic (a do Google só na Fase 7) e (4) o e-mail que será super-admin.
