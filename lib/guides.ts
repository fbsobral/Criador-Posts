/** Conteúdo dos guias de ajuda: o tour geral (primeiro acesso) e um guia por módulo. Só dados, sem React (vale no servidor e no navegador). */

export type GuideIcon = 'spark' | 'posts' | 'image' | 'templates' | 'video' | 'board' | 'target' | 'map' | 'bulb' | 'settings' | 'users' | 'check' | 'help';

/** Tela ilustrada de cada passo (desenhada em app/admin/guia/guide-screens.tsx). */
export type ScreenKey =
  | 'menu' | 'flow' | 'brand' | 'paths' | 'idea' | 'approve' | 'help'
  | 'posts-new' | 'editor' | 'export' | 'posts-list'
  | 'gen-modes' | 'gen-form' | 'gen-images'
  | 'gallery' | 'gallery-search' | 'templates'
  | 'video-gen' | 'script' | 'esteira' | 'video-format'
  | 'personas' | 'personas-ai' | 'map' | 'bridge' | 'matrix' | 'map-score'
  | 'idea-gen' | 'ideas-board' | 'idea-convert'
  | 'brand-profile' | 'users' | 'invite';

export type GuideStep = {
  icon: GuideIcon;
  /** Tela ilustrada mostrada acima do texto. */
  screen?: ScreenKey;
  title: string;
  text: string;
  /** Pontos curtos, para quem quer o detalhe. */
  bullets?: string[];
  /** Dica de uso (caixa destacada). */
  tip?: string;
};

export type Guide = {
  key: string;
  title: string;
  /** Uma frase: para que serve. */
  subtitle: string;
  steps: GuideStep[];
  /** Ação ao final do guia. */
  cta?: { label: string; href: string };
};

export const GENERAL_KEY = 'geral';

export const GUIDES: Record<string, Guide> = {
  geral: {
    key: 'geral',
    title: 'Bem-vindo ao Criador de Posts',
    subtitle: 'Um tour de 2 minutos pelo que a plataforma faz.',
    cta: { label: 'Ir para as configurações da marca', href: '/admin/configuracoes' },
    steps: [
      { icon: 'spark', screen: 'flow', title: 'Da estratégia ao conteúdo pronto', text: 'Aqui você pensa o que dizer, para quem e por quê, e transforma isso em posts de imagem e roteiros de vídeo com a identidade da sua marca. A IA ajuda em cada etapa, mas nada é salvo ou publicado sem a sua aprovação.' },
      { icon: 'map', screen: 'menu', title: 'O mapa do produto', text: 'O menu tem três áreas. No celular, o botão Menu, no rodapé, abre todas as seções.', bullets: ['Estratégia: Personas, Territórios e Ideias de conteúdo, para decidir o que falar e para quem.', 'Produção: Posts, Gerar posts, Galeria e Templates (imagem) e Roteiros e Esteira (vídeo).', 'Marca: Configurações (identidade e IA) e Usuários (equipe).'] },
      { icon: 'settings', screen: 'brand', title: 'Comece pela marca', text: 'Em Configurações, descreva o que a sua organização faz, o tom de voz, as regras e o público ideal. É isso que deixa personas, ideias, textos e legendas com a cara da sua marca, e não genéricos.', tip: 'Se só der para preencher uma coisa agora, preencha “O que a organização faz”.' },
      { icon: 'target', screen: 'paths', title: 'Dois caminhos para chegar a uma ideia', text: 'Você escolhe por onde começar.', bullets: ['Persona → território → ideia: parta das dores de uma pessoa e veja que temas ela precisa ver.', 'Território → persona → ideia: parta de um tema maior, um debate coletivo, e traduza para o dia a dia de cada persona.'], tip: 'O segundo caminho é ótimo para assuntos coletivos, que não aparecem nas dores individuais.' },
      { icon: 'bulb', screen: 'idea', title: 'Da ideia ao conteúdo', text: 'Cada ideia conta uma história completa: dor, impacto, causa, guia, argumentos, ganho, desejo e CTA. Com ela pronta, um clique cria um roteiro de vídeo ou um post de imagem. Se preferir, gere posts em lote a partir de temas.' },
      { icon: 'check', screen: 'approve', title: 'A IA sugere, você decide', text: 'Toda sugestão aparece para você comparar com o que já existe, com o antes e o depois. Você aplica, pede outro ajuste ou descarta, e quase tudo pode ser desfeito.', bullets: ['O botão Refinar com IA aparece em cada bloco de texto.', 'A IA não deve inventar números, datas nem fontes; o que precisa de conferência vem marcado.'] },
      { icon: 'help', screen: 'help', title: 'A ajuda fica sempre à mão', text: 'O botão ? (no canto do menu) abre o guia da página em que você está, rever este tour ou reiniciar as dicas. Cada módulo mostra um guia curto na primeira visita.' },
    ],
  },

  posts: {
    key: 'posts',
    title: 'Posts',
    subtitle: 'Seus posts de imagem, do rascunho ao arquivo pronto.',
    cta: { label: 'Criar um post', href: '/admin/posts' },
    steps: [
      { icon: 'posts', screen: 'posts-new', title: 'Escolha o formato e crie', text: 'No topo, escolha o formato (Carrossel, Carrossel Feed, Tweet Card ou Capa de Notícia), dê um nome e crie. O post abre no editor visual.', tip: 'Os formatos disponíveis estão em Templates.' },
      { icon: 'templates', screen: 'editor', title: 'Edite no editor visual', text: 'Cada slide tem texto, imagem e cores da marca. Clique no texto para editar, arraste imagens e use a barra de formatação.', bullets: ['No celular, os slides ficam em uma faixa no topo e o painel de ajustes abaixo.', 'O botão Refinar com IA ajusta o texto de um slide mostrando antes e depois.'] },
      { icon: 'spark', screen: 'export', title: 'Legenda e download', text: 'Cada post tem legenda para a rede escolhida, no limite de caracteres dela. Baixe em PNG, PDF ou ZIP, com uma pasta por conta e o @ certo aplicado.' },
      { icon: 'board', screen: 'posts-list', title: 'Organize', text: 'Veja em cards ou em lista, renomeie, duplique, converta entre formatos e marque como rascunho ou publicado. Nada é publicado sozinho nas redes.' },
    ],
  },

  gerar: {
    key: 'gerar',
    title: 'Gerar posts',
    subtitle: 'Vários posts de uma vez, escritos pela IA no tom da sua marca.',
    cta: { label: 'Gerar meus primeiros posts', href: '/admin/gerar' },
    steps: [
      { icon: 'spark', screen: 'gen-modes', title: 'Dois modos', text: 'Escolha entre escrever a partir de temas (a IA cria o texto do post inteiro) ou estruturar textos prontos (ela só organiza o seu texto em slides).' },
      { icon: 'templates', screen: 'gen-form', title: 'Formato, temas e slides', text: 'Escolha o formato e cole um tema por linha (até 30). Defina quantos slides cada post terá e, se quiser, dê instruções extras e dados que a IA pode usar.', tip: 'Sem dados reais no pedido, a IA escreve sem números em vez de inventar.' },
      { icon: 'image', screen: 'gen-images', title: 'Imagens (opcional)', text: 'Marque para gerar também as imagens dos slides. A descrição de cada imagem fica à mostra para você ajustar.' },
      { icon: 'check', screen: 'posts-list', title: 'Tudo chega como rascunho', text: 'Os posts aparecem na página do lote conforme ficam prontos. Revise, ajuste e baixe; nada vai para as redes sozinho.' },
    ],
  },

  galeria: {
    key: 'galeria',
    title: 'Galeria',
    subtitle: 'As imagens da sua marca, para reaproveitar nos posts.',
    steps: [
      { icon: 'image', screen: 'gallery', title: 'Envie e reaproveite', text: 'Envie imagens da sua marca ou traga as que já estão nos posts. As imagens geradas pela IA também ficam aqui, com a etiqueta IA.' },
      { icon: 'spark', screen: 'gallery-search', title: 'Busque por palavras', text: 'Cada imagem tem descrição e etiquetas. Use a busca para achar “mesa de reunião” ou “jovens sorrindo” sem procurar uma a uma.', tip: 'Quanto melhor a descrição, mais fácil de achar e de a IA reaproveitar.' },
      { icon: 'check', screen: 'gallery', title: 'Veja o que é usado', text: 'O cartão mostra quantas vezes a imagem já foi usada. Exclua o que não serve mais; os posts que já a usam não são afetados.' },
    ],
  },

  templates: {
    key: 'templates',
    title: 'Templates',
    subtitle: 'Os formatos de post que você pode usar.',
    steps: [
      { icon: 'templates', screen: 'templates', title: 'O que é um template', text: 'É o formato do post: quais slides existem e como cada um se organiza. Há formatos globais da plataforma (Carrossel, Tweet Card, Capa de Notícia) e os da sua marca.' },
      { icon: 'settings', screen: 'templates', title: 'Formatos da marca', text: 'Administradores podem criar formatos próprios a partir de um editor existente e excluir os da marca. Quem é membro escolhe e usa.' },
      { icon: 'posts', screen: 'posts-new', title: 'Onde usar', text: 'Escolha o formato ao criar um post em Posts, ao gerar em lote em Gerar posts ou ao transformar uma ideia em post.' },
    ],
  },

  roteiros: {
    key: 'roteiros',
    title: 'Roteiros de vídeo',
    subtitle: 'Roteiros para vídeos curtos (Reels, TikTok e Shorts), parte por parte.',
    cta: { label: 'Gerar roteiros', href: '/admin/videos/gerar' },
    steps: [
      { icon: 'video', screen: 'video-gen', title: 'Gere a partir de um conteúdo', text: 'Cole um artigo, uma transcrição ou anotações, escolha o formato (as partes do vídeo, como gancho, dica e CTA) e a duração. A IA sugere ideias de vídeo, você aprova e ela escreve um roteiro para cada uma.' },
      { icon: 'templates', screen: 'script', title: 'Edite parte por parte', text: 'Cada parte tem a fala, o texto na tela e o que mostrar. O editor conta as palavras e avisa se cabe no tempo.', bullets: ['Refinar com IA existe em cada parte, na legenda e no roteiro inteiro, sempre com antes e depois.', 'O Teleprompter mostra a fala em tela cheia para gravar.'] },
      { icon: 'board', screen: 'esteira', title: 'Acompanhe a produção', text: 'Cada roteiro tem uma etapa: Rascunho, Revisado, Gravado, Editado e Publicado. Mude pela lista ou arraste na Esteira de produção.', tip: 'No celular, use o seletor de etapa de cada cartão da Esteira.' },
      { icon: 'settings', screen: 'video-format', title: 'Formatos próprios', text: 'Em Formatos, crie ou ajuste os modelos de vídeo: as partes, o peso de tempo de cada uma e as instruções que a IA segue.' },
    ],
  },

  personas: {
    key: 'personas',
    title: 'Personas',
    subtitle: 'Quem você quer alcançar, organizado em grupos.',
    cta: { label: 'Sugerir personas com IA', href: '/admin/personas' },
    steps: [
      { icon: 'target', screen: 'personas', title: 'Personas e grupos', text: 'Uma persona é um perfil realista de quem você quer alcançar: contexto, dores, objetivos e objeções. Os grupos reúnem personas com situação parecida.' },
      { icon: 'spark', screen: 'personas-ai', title: 'Deixe a IA propor', text: 'Descreva o seu ICP (perfil do público ideal) e peça personas. Você também pode gerar só os grupos, ou pedir personas dentro de um grupo específico pelo ícone ✨ dele.', tip: 'Instruções extras ajudam: “separe quem doa dinheiro de quem doa tempo”.' },
      { icon: 'board', screen: 'personas', title: 'Organize e refine', text: 'Arraste os cartões entre os grupos (no celular, use o seletor do cartão), edite e use Refinar com IA para ajustar uma persona.' },
      { icon: 'map', screen: 'map', title: 'Próximo passo', text: 'Com personas prontas, vá em Territórios para ligar temas a elas e traduzir cada tema para o dia a dia de cada uma.' },
    ],
  },

  territorios: {
    key: 'territorios',
    title: 'Territórios',
    subtitle: 'O mapa de temas da marca e como cada persona os vive.',
    cta: { label: 'Gerar territórios', href: '/admin/territorios' },
    steps: [
      { icon: 'map', screen: 'map', title: 'Um mapa de temas', text: 'Território é um tema de conteúdo, em níveis (áreas, subtemas e tópicos). O mapa é um só, da marca. Cada tema pode nascer das dores de uma persona ou de um debate maior, sem persona.' },
      { icon: 'target', screen: 'bridge', title: 'Ligue personas e traduza', text: 'Selecione um tema e, na aba Personas, ligue quem o enxerga. A tradução diz como o tema aparece no dia a dia de cada persona, e a IA escreve para você revisar.', tip: 'Os subtemas herdam as personas ligadas ao tema de cima.' },
      { icon: 'board', screen: 'matrix', title: 'Ver como uma persona, ou a matriz', text: 'Escolha “Ver como uma persona” para filtrar o mapa. A Matriz mostra território por persona: o que está traduzido, o que está ligado sem tradução e onde há lacuna.' },
      { icon: 'bulb', screen: 'map-score', title: 'Prioridade e ideias', text: 'Defina critérios de prioridade e a IA dá uma nota a cada tema. De um tema, gere ideias de conteúdo para uma persona.', bullets: ['Duplicar e Excluir ficam na barra do tema; excluir avisa o que será perdido.', 'No celular, toque em um tema e use a barra de ações; Detalhes abre o painel completo.'] },
    ],
  },

  ideias: {
    key: 'ideias',
    title: 'Ideias de conteúdo',
    subtitle: 'Cada ideia é uma história completa, pronta para virar post ou roteiro.',
    cta: { label: 'Gerar ideias com IA', href: '/admin/ideias' },
    steps: [
      { icon: 'bulb', screen: 'idea', title: 'A estrutura de uma ideia', text: 'Dor, impacto, causa, guia, argumentos, ganho, desejo e CTA. Os argumentos sustentam a solução da dor; não são um passo a passo. Sem persona, a dor vira uma afirmação sobre o tema, não uma fala.' },
      { icon: 'spark', screen: 'idea-gen', title: 'Gere por persona e território', text: 'Parta da persona ou do território, escolha quantas ideias e o objetivo (conscientizar, engajar, aproximar, apoiar, participar) e, se quiser, dê instruções. A IA lê as ideias que já existem para não repetir.' },
      { icon: 'board', screen: 'ideas-board', title: 'Quadro por estágio', text: 'Arraste as ideias entre Ideia, Aprovada e Já usada. Clique em uma para ler e editar caixa por caixa; o Refinar com IA existe em cada caixa e salva ao concluir.', tip: 'No celular, mude o estágio pelo seletor do cartão.' },
      { icon: 'video', screen: 'idea-convert', title: 'Vire conteúdo', text: 'Em cada ideia, crie um roteiro de vídeo ou um post de imagem com um clique. Ela passa a constar como já usada.' },
    ],
  },

  configuracoes: {
    key: 'configuracoes',
    title: 'Configurações',
    subtitle: 'A identidade da marca e o que a IA precisa saber.',
    steps: [
      { icon: 'settings', screen: 'brand-profile', title: 'Perfil e cores', text: 'Nome, @ de cada rede, foto de perfil, tema e as cores padrão dos novos posts. Isso aparece nos posts e nos downloads.' },
      { icon: 'spark', screen: 'brand', title: 'Identidade para a IA', text: 'Descreva o que a organização faz, o nicho, o público ideal, o tom de voz, as regras (o que sempre ou nunca fazer), a CTA padrão e exemplos de que você gosta. Quanto melhor isto, melhores personas, ideias, textos e legendas.', tip: 'Comece por “O que a organização faz”: é a base de tudo.' },
      { icon: 'image', screen: 'brand', title: 'Imagens e legendas', text: 'Defina o briefing visual das imagens geradas e as regras das legendas (tamanho, hashtags e tom por rede).' },
    ],
  },

  usuarios: {
    key: 'usuarios',
    title: 'Usuários',
    subtitle: 'Quem tem acesso à marca.',
    steps: [
      { icon: 'users', screen: 'users', title: 'Equipe da marca', text: 'Veja quem tem acesso e o papel de cada pessoa: Administrador ou Membro. Cada marca tem a sua própria equipe, galeria, posts e configurações.' },
      { icon: 'settings', screen: 'invite', title: 'Convide por e-mail', text: 'Administradores convidam novas pessoas por e-mail e escolhem o papel. O convite aparece como pendente até ser aceito.', tip: 'Administradores editam configurações, formatos e critérios; membros criam e editam conteúdo.' },
    ],
  },
};

/** Qual guia vale para cada página do admin. Páginas de edição (um post, um roteiro) ficam sem guia próprio. */
export function guideKeyForPath(path: string): string | null {
  const p = path.replace(/\/+$/, '');
  if (p === '/admin/posts') return 'posts';
  if (p === '/admin/gerar') return 'gerar';
  if (p === '/admin/galeria') return 'galeria';
  if (p === '/admin/templates') return 'templates';
  if (p === '/admin/videos' || p === '/admin/videos/esteira' || p === '/admin/videos/quadro' || p === '/admin/videos/formatos' || p === '/admin/videos/gerar') return 'roteiros';
  if (p === '/admin/personas') return 'personas';
  if (p === '/admin/territorios') return 'territorios';
  if (p === '/admin/ideias') return 'ideias';
  if (p === '/admin/configuracoes') return 'configuracoes';
  if (p === '/admin/usuarios') return 'usuarios';
  return null;
}

export const GUIDE_KEYS = Object.keys(GUIDES);
