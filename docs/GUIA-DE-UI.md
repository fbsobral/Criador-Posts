# Guia de UI e navegação do admin

Regras para manter as telas consistentes. Antes de criar uma tela nova, siga isto.

## Estrutura do menu
Três grupos, sempre nesta ordem:
- **Posts de imagem:** Posts, Gerar posts, Galeria, Templates.
- **Roteiros de vídeo:** Roteiros, Quadro de produção.
- **Marca:** Configurações, Usuários.

Cada item do menu tem um nome curto (a barra do celular não mostra os títulos dos grupos). Subtelas (gerar, formatos, detalhe) ficam dentro da página do módulo, não no menu.

## Vocabulário
- **Post** = peça de imagem (carrossel ou Tweet Card). **Roteiro** = texto de vídeo curto. Não use "roteiro" para posts: em "Gerar posts" o modo é "textos prontos".
- Gerar em lote com IA: "Gerar posts" (imagem) e "Gerar roteiros" (vídeo).
- Etapas do vídeo: Rascunho → Revisado → Gravado → Editado → Publicado.

## Página
- Cabeçalho sempre com `PageHead` (`app/admin/ui.tsx`): voltar (só em subtelas), título, descrição de uma frase e ações à direita.
- Estado vazio sempre com `EmptyState`: ícone, título, explicação e a ação principal.
- Cada página define `metadata.title` (aba do navegador: "Título · Criador de Posts").
- Subtelas têm link "voltar" para o módulo, com o nome da tela de origem.

## Ações
- Um único botão `btn primary` por tela (a ação principal). Criar e gerar levam ícone (`IconPlus`, `IconSpark`).
- Destrutivas: `btn ghost danger`, com confirmação. Duplicar e excluir ficam nos cartões e nas linhas, como ícones.
- Alternância de visão (cards/lista, lista/quadro) usa `.view-toggle` e fica nas ações do cabeçalho.

## Feedback
- Avisos: `notice` com `info`, `warn`, `err` ou `ok`. Erros de ação aparecem na própria tela, em português, nunca como erro genérico.
- Custos de IA aparecem antes de executar e a IA só gasta depois de uma aprovação quando há escolha (ideias, descrição de imagem, ajuste de texto).
