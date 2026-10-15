# Projeto Fazenda v1.4.4

## Conteúdo + questões
- Navegação explícita para voltar ao índice de Conteúdos.
- Botões Anterior e Próximo conteúdo, com posição `Conteúdo X de Y`.
- A navegação também aparece ao final da página.
- As questões vinculadas ao microbloco passam a ser navegáveis dentro da própria página (`Questão X de Y`, Anterior/Próxima).
- Removido o fluxo de depender de “Abrir completa” para seguir pelas questões do tema.
- Modo foco em questões: a teoria pode ser minimizada e reaberta sem perder a questão atual.
- O índice atual de questão e a preferência teoria visível/recolhida são preservados durante a sessão via `sessionStorage`.
- Ao reabrir a teoria, o bloco atual é mantido como referência visual.

## Mapa-Mestre
- O Mapa-Mestre passa a usar o mesmo padrão de índice hierárquico de Conteúdos e Questões.
- Estrutura: Disciplina → Tópico → Subtópico.
- Disciplinas ficam recolhidas inicialmente e podem ser expandidas individualmente.
- Mantidos os indicadores visuais essenciais ao abrir os itens:
  - cinza: pendente
  - amarelo: em andamento
  - roxo: revisão vencida
  - vermelho: domínio frágil
  - verde: dominado
- Quando houver estudo, o índice também mostra domínio, evidência e erros ativos.
- Mantidos Expandir tudo / Recolher tudo, busca no índice, Próximo pendente e importação de estrutura CSV.
