# Projeto Fazenda v1.2 — considerações incorporadas

Esta versão consolida as decisões de UX e integração discutidas em 08/10/2026.

## 1. Conteúdo como centro do sistema
- O Mapa-Mestre continua preservando o texto original do edital.
- Cada item do Mapa-Mestre agora abre uma tela de conteúdo.
- A tela de conteúdo permite:
  - ler/editar a teoria;
  - registrar fonte e páginas do material;
  - abrir diretamente as questões daquele tópico;
  - registrar uma sessão de estudo já com o tópico selecionado;
  - visualizar erros e dispositivos legais relacionados.
- Foi incluída a área principal **Conteúdo** no menu.

## 2. Questões
- Mantida a navegação Anterior / Próxima dentro da bateria.
- Filtros separados por:
  - disciplina;
  - tópico;
  - assunto;
  - tema/subassunto;
  - tipo;
  - banca;
  - quantidade.
- A questão possui atalho para abrir o conteúdo relacionado.

## 3. Caderno de Erros
- A tela passa a exibir a lista completa, em vez de um erro por vez.
- Filtros por disciplina, status e recorrência.
- Totais de erros, ativos, recorrentes e consolidados.
- Clique em um erro abre drawer lateral com questão, observação, tipo, recorrência e ações.
- Erros recorrentes recebem prioridade maior.

## 4. Erros + Revisão do Almoço
- Os módulos passam a trabalhar sobre a mesma fila adaptativa.
- Erros recorrentes podem entrar no almoço antes do intervalo padrão.
- Ordem de prioridade: erros recorrentes → revisões vencidas → domínio baixo → Lei Seca.
- Concluir uma revisão do almoço atualiza o histórico e agenda nova revisão conforme a dificuldade.

## 5. Dashboard explorável
- O card de erros mostra **todos os erros**, com ativos e recorrentes no resumo.
- Cobertura, Domínio, Questões e Erros são clicáveis.
- Cada card abre drawer com detalhamento por disciplina e indicadores relevantes.
- Evolução por disciplina inclui quantidade de erros.

## 6. Lei Seca reconstruída
- Biblioteca de leis com seleção e controle de progresso.
- Importação de PDF oficial diretamente no sistema.
- O parser organiza o documento em artigo → parágrafo → inciso → alínea.
- O texto extraído é preservado como texto oficial: a IA não o reescreve.
- O sistema registra fonte, URL informada, nome do arquivo e hash SHA-256 do PDF usado.
- Redações históricas, revogadas e trechos que precisam de conferência são preservados com status próprio.
- A revisão usa, por padrão, apenas dispositivos marcados como vigentes.
- É possível editar, adicionar e excluir dispositivos manualmente.

## Observação importante sobre textos consolidados
PDFs oficiais consolidados podem conter redações anteriores, dispositivos revogados e notas de alteração. O importador usa regras determinísticas para separar essas versões, mas mantém uma categoria **revisar** para trechos ambíguos. O texto original importado é sempre preservado para conferência.

## Próximos refinamentos planejados
- Persistência do arquivo PDF original no Firebase Storage.
- Comparação automática entre versões novas e antigas da mesma lei.
- Importação dos PDFs do Estratégia para a área Conteúdo, mantendo referências de aula/página.
- Vinculação semiautomática questão ↔ conteúdo ↔ dispositivo legal.
