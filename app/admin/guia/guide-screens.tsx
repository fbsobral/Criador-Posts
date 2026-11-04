import type { ScreenKey } from '@/lib/guides';

/** Telas ilustradas dos guias: miniaturas desenhadas com o visual do produto (cartões, quadros, painéis). São decorativas; o texto do passo explica tudo. */

const Ln = ({ w = 100, d, b }: { w?: number; d?: boolean; b?: boolean }) => <i className={`gs-l${d ? ' d' : ''}${b ? ' b' : ''}`} style={{ width: `${w}%` }} />;
const Av = ({ c = 'a', t }: { c?: 'a' | 'b' | 'c' | 'd'; t?: string }) => <span className={`gs-av ${c}`}>{t}</span>;
const Chip = ({ on, children }: { on?: boolean; children: React.ReactNode }) => <span className={`gs-chip${on ? ' on' : ''}`}>{children}</span>;
const Btn = ({ p, hl, children }: { p?: boolean; hl?: boolean; children: React.ReactNode }) => <span className={`gs-btn${p ? ' p' : ''}${hl ? ' hl' : ''}`}>{children}</span>;
const Card = ({ hl, className = '', children }: { hl?: boolean; className?: string; children: React.ReactNode }) => <div className={`gs-card${hl ? ' hl' : ''} ${className}`}>{children}</div>;
const Tag = ({ children }: { children: React.ReactNode }) => <b className="gs-tag">{children}</b>;
const Img = ({ n = 1, ia }: { n?: number; ia?: boolean }) => <i className={`gs-img g${n}`}>{ia && <u>IA</u>}</i>;
const Pill = ({ c = '', children }: { c?: 'ok' | 'bl' | 'dk' | ''; children: React.ReactNode }) => <span className={`gs-pill ${c}`}>{children}</span>;
const Row = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => <div className={`gs-row ${className}`}>{children}</div>;

const SCREENS: Record<ScreenKey, () => React.ReactElement> = {
  menu: () => (
    <Row>
      <div className="gs-side">
        <Tag>Estratégia</Tag><span>Personas</span><span className="on">Territórios</span><span>Ideias de conteúdo</span>
        <Tag>Produção</Tag><span>Posts</span><span>Gerar posts</span><span>Galeria</span><span>Roteiros</span>
        <Tag>Marca</Tag><span>Configurações</span>
      </div>
      <div className="gs-phone"><div className="gs-ph-top"><Ln w={50} d /><Ln w={80} /></div><div className="gs-ph-nav"><span>Posts</span><span>Roteiros</span><span>Territ.</span><span>Ideias</span><span className="on">Menu</span></div></div>
    </Row>
  ),
  flow: () => (
    <Row className="gs-flow">
      <Card><Tag>Persona</Tag><Av t="H" /><Ln w={90} d /><Ln w={60} /></Card><i className="gs-ar" />
      <Card><Tag>Território</Tag><span className="gs-node">Acesso ao ensino</span><span className="gs-node sb">Custos e bolsas</span></Card><i className="gs-ar" />
      <Card><Tag>Ideia</Tag><Ln w={90} d /><Ln /><Ln w={55} /></Card><i className="gs-ar" />
      <Card className="dk"><Tag>Conteúdo</Tag><Chip>Post</Chip><Chip>Roteiro</Chip></Card>
    </Row>
  ),
  brand: () => (
    <Card className="gs-form"><Tag>O que a organização faz</Tag>
      <div className="gs-ta hl"><Ln /><Ln w={92} /><Ln w={60} /></div>
      <Row><div className="gs-fld"><Tag>Tom de voz</Tag><Ln w={70} /></div><div className="gs-fld"><Tag>Regras</Tag><Ln w={80} /></div></Row>
    </Card>
  ),
  paths: () => (
    <div className="gs-paths">
      <Row><Pill c="dk">A</Pill><Chip on>Persona</Chip><i className="gs-ar" /><Chip>Território</Chip><i className="gs-ar" /><Chip>Ideia</Chip></Row>
      <Row><Pill c="dk">B</Pill><Chip on>Território</Chip><i className="gs-ar" /><Chip>Persona</Chip><i className="gs-ar" /><Chip>Ideia</Chip></Row>
      <small>As dores da pessoa pedem os temas. Ou um tema maior é traduzido para cada pessoa.</small>
    </div>
  ),
  idea: () => (
    <div className="gs-idea">
      <Card><Tag>Dor</Tag><Ln d w={95} b /><Ln w={70} d b /></Card>
      <Row><Card><Tag>Impacto</Tag><Ln /><Ln w={60} /></Card><Card><Tag>Causa</Tag><Ln /><Ln w={70} /></Card></Row>
      <Card><Tag>Argumentos</Tag><div className="gs-li"><Ln w={85} /></div><div className="gs-li"><Ln w={75} /></div><div className="gs-li"><Ln w={80} /></div></Card>
      <Card><Tag>CTA</Tag><Ln w={65} d /></Card>
    </div>
  ),
  approve: () => (
    <Card className="gs-diff">
      <Tag>Antes</Tag><div className="gs-old"><Ln w={95} /><Ln w={80} /></div>
      <Tag>Sugestão</Tag><div><Ln w={95} d /><Ln w={70} d /></div>
      <Row><Btn p hl>✓ Aplicar</Btn><Btn>Outro ajuste</Btn><Btn>Descartar</Btn></Row>
    </Card>
  ),
  help: () => (
    <div className="gs-help">
      <div className="gs-top"><Av t="" /><span className="gs-org">Marca ▾</span><span className="gs-q hl">?</span><Av c="b" /></div>
      <Card className="gs-pop"><b>Guia desta página</b><b>Tour inicial</b><b>Reiniciar as dicas</b></Card>
    </div>
  ),
  'posts-new': () => (
    <Card className="gs-form"><Tag>Novo post</Tag>
      <Row className="gs-fmts"><div className="gs-fmt on"><Img n={3} /><span>Notícia</span></div><div className="gs-fmt"><Img n={1} /><span>Carrossel</span></div><div className="gs-fmt"><Img n={4} /><span>Tweet Card</span></div></Row>
      <Row><div className="gs-inp"><Ln w={45} /></div><Btn p>+ Criar post</Btn></Row>
    </Card>
  ),
  editor: () => (
    <Row className="gs-ed">
      <div className="gs-rail"><i className="on" /><i /><i /></div>
      <div className="gs-slide"><small>MARKETING · 2026</small><Ln d w={90} b /><Ln d w={60} b /><Ln w={95} /><Ln w={80} /><Img n={2} /></div>
      <div className="gs-panel"><Card><Ln w={60} d /></Card><span className="gs-ai hl">✨ Refinar com IA</span><Card><Ln w={50} /></Card><Card><Ln w={70} /></Card></div>
    </Row>
  ),
  export: () => (
    <div className="gs-exp">
      <Card><Tag>Legenda · Instagram</Tag><Ln /><Ln w={85} /><Ln w={50} /><small>238 / 2.200</small></Card>
      <Row><Btn p>PNG</Btn><Btn p>PDF</Btn><Btn p hl>ZIP</Btn></Row>
      <Row className="gs-folders"><span>📁 @marca_ig</span><span>📁 @marca_tiktok</span></Row>
    </div>
  ),
  'posts-list': () => (
    <div className="gs-grid4">
      {[['Rascunho', 1, ''], ['Publicado', 3, 'ok'], ['Rascunho', 2, ''], ['Publicado', 4, 'ok']].map(([st, n, c], i) => (
        <Card key={i}><Img n={Number(n)} /><Ln w={80} d /><Pill c={c as 'ok' | ''}>{st}</Pill></Card>
      ))}
    </div>
  ),
  'gen-modes': () => (
    <Row className="gs-modes">
      <Card hl><b>Escrever a partir de temas</b><small>A IA cria o post inteiro</small></Card>
      <Card><b>Estruturar textos prontos</b><small>Ela só organiza em slides</small></Card>
    </Row>
  ),
  'gen-form': () => (
    <Card className="gs-form"><Row><Chip on>Notícia</Chip><Chip>Carrossel</Chip><Chip>Tweet</Chip></Row>
      <Tag>Temas (um por linha)</Tag>
      <div className="gs-ta hl"><Ln w={70} /><Ln w={85} /><Ln w={60} /></div>
      <Row><Chip>7 slides</Chip><small>3 temas</small><Btn p>✨ Gerar post</Btn></Row>
    </Card>
  ),
  'gen-images': () => (
    <div className="gs-gi">
      <Card hl><Row><span className="gs-sw" /><b>Gerar também as imagens dos slides</b></Row></Card>
      <Row><Img n={1} ia /><Img n={2} ia /><Img n={3} ia /><Img n={4} ia /></Row>
    </div>
  ),
  gallery: () => (
    <div className="gs-grid4 big">
      {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => <Card key={n}><Img n={((n - 1) % 5) + 1} ia={n === 2 || n === 5} /><Ln w={70} /></Card>)}
    </div>
  ),
  'gallery-search': () => (
    <div className="gs-gs">
      <div className="gs-search hl"><span>🔍</span><Ln w={40} d /></div>
      <Row><Card><Img n={2} /><Ln w={80} /><Row><Chip>mesa</Chip><Chip>reunião</Chip></Row></Card><Card><Img n={4} /><Ln w={70} /><Row><Chip>equipe</Chip></Row></Card><Card><Img n={5} /><Ln w={60} /><Row><Chip>sala</Chip></Row></Card></Row>
    </div>
  ),
  templates: () => (
    <Row className="gs-tpl">
      {[['Capa de Notícia', 3, 'Global'], ['Carrossel', 1, 'Global'], ['Meu formato', 2, 'Da marca']].map(([n, g, p]) => <Card key={n as string}><Img n={Number(g)} /><b>{n}</b><Pill c={p === 'Global' ? '' : 'dk'}>{p}</Pill></Card>)}
    </Row>
  ),
  'video-gen': () => (
    <div className="gs-vg">
      <Row><Pill c="dk">1 Conteúdo</Pill><Pill>2 Ideias</Pill><Pill>3 Roteiros</Pill></Row>
      <div className="gs-ta hl"><Ln /><Ln w={90} /><Ln w={70} /></div>
      <Row><Chip>Gancho + dica + CTA</Chip><Chip on>30s</Chip><Chip>45s</Chip><Chip>60s</Chip></Row>
    </div>
  ),
  script: () => (
    <div className="gs-script">
      <div className="gs-pbar"><span className="p1">Gancho</span><span className="p2">Dica</span><span className="p3">CTA</span></div>
      <Card><Row><b>1 · Gancho</b><Pill>22/23 palavras</Pill><span className="gs-ai hl">✨ Refinar</span></Row><Tag>Fala</Tag><Ln /><Ln w={65} /></Card>
      <Card><Row><b>2 · Dica</b><Pill>12/98 palavras</Pill></Row><Tag>Fala</Tag><Ln w={90} /></Card>
    </div>
  ),
  esteira: () => (
    <Row className="gs-kan">
      {[['Rascunho', 2], ['Revisado', 1], ['Gravado', 1], ['Editado', 0], ['Publicado', 1]].map(([st, n]) => (
        <div key={st as string} className="gs-kc"><b>{st}</b>{Array.from({ length: Number(n) }).map((_, i) => <Card key={i} hl={st === 'Revisado'}><Ln w={85} d /><Ln w={60} /></Card>)}</div>
      ))}
    </Row>
  ),
  'video-format': () => (
    <Card className="gs-form"><Tag>Partes do vídeo</Tag>
      {[['1 Gancho', 20, 'p1'], ['2 Dica', 60, 'p2'], ['3 CTA', 20, 'p3']].map(([n, w, c]) => <Row key={n as string} className="gs-part"><b>{n}</b><div className="gs-slider"><i className={c as string} style={{ width: `${w}%` }} /></div><small>{w}%</small></Row>)}
      <Row><Btn>+ Adicionar parte</Btn><Btn p>Salvar formato</Btn></Row>
    </Card>
  ),
  personas: () => (
    <Row className="gs-cols">
      <div className="gs-colm"><Row><b>Doadores</b><Pill>2</Pill><span className="gs-ai">✨</span></Row><Card><Row><Av t="A" /><div><Ln w={90} d /><Ln w={60} /></div></Row></Card><Card><Row><Av c="b" t="B" /><div><Ln w={80} d /><Ln w={55} /></div></Row></Card></div>
      <div className="gs-colm"><Row><b>Mentores</b><Pill>1</Pill><span className="gs-ai">✨</span></Row><Card><Row><Av c="c" t="C" /><div><Ln w={85} d /><Ln w={50} /></div></Row></Card></div>
    </Row>
  ),
  'personas-ai': () => (
    <Card className="gs-form"><Tag>Seu ICP</Tag>
      <div className="gs-ta"><Ln /><Ln w={88} /><Ln w={50} /></div>
      <Row><small>Quantas?</small><Chip>3</Chip><Chip on>5</Chip><Chip>8</Chip></Row>
      <div className="gs-more">▸ Instruções extras <small>(opcional)</small></div>
      <Btn p hl>✨ Sugerir 5 personas</Btn>
    </Card>
  ),
  map: () => (
    <div className="gs-map">
      <span className="gs-rootn">Marca</span>
      <div className="gs-br">
        <span className="gs-node o hl">Moradia e aluguel<em><u /><u className="b" /></em></span>
        <span className="gs-node bl">Trabalho por app<em><u /></em></span>
        <span className="gs-node pu">Saúde pública<em><u className="g" /><u /></em></span>
      </div>
    </div>
  ),
  bridge: () => (
    <Card className="gs-form"><Row className="gs-tabs"><span>Tema</span><span className="on">Personas <u>2</u></span><span>Ideias</span></Row>
      <Row><Av t="H" /><b>Helena</b></Row><div className="gs-ta"><Ln /><Ln w={70} /></div>
      <Row><Av c="b" t="S" /><b>Shelton</b></Row><div className="gs-ta"><Ln w={80} /></div>
      <Btn hl>🔁 Traduzir com IA</Btn>
    </Card>
  ),
  matrix: () => (
    <Card className="gs-mx">
      <div className="gs-mxh"><span /><Av t="A" /><Av c="b" t="B" /><Av c="c" t="C" /></div>
      {[['Moradia', ['f', 'h', 'n']], ['Reajuste', ['f', 'n', 'n']], ['Trabalho', ['h', 'f', 'h']], ['Saúde', ['n', 'n', 'f']]].map(([t, c]) => (
        <div key={t as string} className="gs-mxr"><span>{t}</span>{(c as string[]).map((k, i) => <i key={i} className={`gs-dot ${k}`} />)}</div>
      ))}
      <small>cheio: traduzido · vazado: ligada, sem tradução · tracejado: sem ligação</small>
    </Card>
  ),
  'map-score': () => (
    <div className="gs-map">
      <span className="gs-rootn">Marca</span>
      <div className="gs-br">
        <span className="gs-node o">Moradia e aluguel<em className="sc hi">82</em></span>
        <span className="gs-node bl">Trabalho por app<em className="sc md">64</em></span>
        <span className="gs-node pu hl">Saúde pública<em className="sc lo">47</em></span>
        <span className="gs-bar">↳ subtema · 🔁 traduzir · 💡 ideias</span>
      </div>
    </div>
  ),
  'idea-gen': () => (
    <Card className="gs-form"><Row className="gs-seg"><span className="on">Partir da persona</span><span>Partir do território</span></Row>
      <div className="gs-sel"><Ln w={50} /></div><div className="gs-sel"><Ln w={65} /></div>
      <Tag>Objetivo destas ideias</Tag>
      <Row className="gs-wrap"><Chip on>A IA escolhe</Chip><Chip>Conscientizar</Chip><Chip>Engajar</Chip><Chip>Aproximar</Chip><Chip>Apoiar</Chip></Row>
    </Card>
  ),
  'ideas-board': () => (
    <Row className="gs-kan three">
      <div className="gs-kc"><b>Ideia</b><Card><Ln w={90} d /><Ln w={60} /></Card><Card className="drag hl"><Ln w={85} d /><Ln w={50} /></Card></div><div className="gs-kc over"><b>Aprovada</b><Card><Ln w={80} d /><Ln w={55} /></Card></div><div className="gs-kc"><b>Já usada</b><Card><Ln w={75} d /><Ln w={60} /></Card></div>
    </Row>
  ),
  'idea-convert': () => (
    <div className="gs-conv">
      <Card><Tag>Ideia aprovada</Tag><Ln w={90} d /><Ln w={60} /></Card>
      <Row><Btn p hl>🎬 Criar roteiro</Btn><Btn p>🖼 Criar post</Btn></Row>
      <Row className="gs-outs"><Card><Img n={2} /></Card><Card><div className="gs-pbar mini"><span className="p1" /><span className="p2" /><span className="p3" /></div></Card></Row>
    </div>
  ),
  'brand-profile': () => (
    <Card className="gs-form"><Row><span className="gs-avl" /><div className="gs-fl"><div className="gs-inp"><Ln w={50} /></div><div className="gs-inp"><Ln w={40} /></div></div></Row>
      <Tag>Cores padrão</Tag><Row><i className="gs-sw1" style={{ background: '#F97335' }} /><i className="gs-sw1 hl" style={{ background: '#1D9BF0' }} /><i className="gs-sw1" style={{ background: '#16140F' }} /><i className="gs-sw1" style={{ background: '#1F9D63' }} /><i className="gs-sw1" style={{ background: '#8B5CF6' }} /></Row>
    </Card>
  ),
  users: () => (
    <Card className="gs-users">
      {[['Ana Souza', 'Administrador', 'dk'], ['Bruno Lima', 'Membro', ''], ['Carla Dias', 'Membro', '']].map(([n, r, c], i) => <Row key={i} className="gs-u"><Av c={(['a', 'b', 'c'] as const)[i]} t={String(n)[0]} /><b>{n}</b><Pill c={c as 'dk' | ''}>{r}</Pill></Row>)}
    </Card>
  ),
  invite: () => (
    <div className="gs-inv">
      <Card><Row><div className="gs-inp"><Ln w={60} /></div><span className="gs-sel s">Membro ▾</span><Btn p hl>+ Convidar</Btn></Row></Card>
      <Card><Row className="gs-u"><Av c="d" t="@" /><b>Convite enviado</b><Pill>Pendente</Pill></Row></Card>
    </div>
  ),
};

export function GuideScreen({ name }: { name: ScreenKey }) {
  const S = SCREENS[name];
  return <div className="gs" aria-hidden><div className="gs-in"><S /></div></div>;
}
