# Projeto Fazenda v1.4 — decisões consolidadas

## Objetivo
Reduzir tempo perdido procurando material, reconstruindo filtros, comparando estudado x pendente e decidindo o próximo passo. A interface deve conduzir o estudo sem transformar a organização em uma segunda tarefa.

## Fluxo ideal
`Edital → conteúdo canônico → microbloco → recuperação ativa → questões → erro → revisão → domínio`

## Regras pedagógicas
- Progresso de leitura é por microbloco, não por permanência passiva em uma tela.
- Questões curtas podem aparecer entre blocos de teoria.
- Um tópico estudado não é automaticamente dominado.
- O indicador de evidência mede quão confiável é o domínio observado.
- Acertos marcados como “entre duas” ou “chutei” têm peso menor no domínio.
- O sistema deve priorizar contrastes, literalidade, pegadinhas e conceitos próximos quando o histórico indicar esse padrão.
- Antes de recomendar releitura longa, priorizar diagnóstico por poucas questões quando houver base suficiente.

## Caderno de Erros
O histórico de erros é permanente. O status ativo é controlado por três acertos consecutivos:

`erro → 0/3 → 1/3 → 2/3 → 3/3 → consolidado/revisão`

Novo erro posterior:

`consolidado → novo erro → 0/3 → ativo`

A recorrência e a sequência de acertos são indicadores diferentes e ambos devem permanecer registrados.

## Diagnóstico SEDES aplicado
A v1.4 procura reduzir os problemas observados na preparação anterior: cobertura irregular, falsa segurança em conteúdo apenas “visto”, confusão entre conceitos próximos, literalidade, interpretação por extrapolação/restrição e falta de evidência suficiente antes de considerar um tópico forte.

O Dashboard ganhou o diagnóstico “Se a prova fosse amanhã” e o Modo Reta Final aumenta o peso de questões, erros, Lei Seca e revisões.

## Edital e conteúdo canônico
O texto original do edital é preservado. Uma versão nova não deve apagar a anterior nem o histórico do usuário. O `canonicalContentId` é a ponte para reaproveitar conhecimento entre concursos e versões, enquanto a cobertura permanece específica de cada edital.

## Materiais
PDF original, texto fiel extraído e camada de estudo são coisas distintas. A v1.4 inicia essa separação com `materials` + `content_blocks`. A classificação automática deve ser conferida antes de persistir quando não houver correspondência segura.

## Lei Seca
Texto legal oficial deve permanecer intacto. Histórico, revogado e itens incertos podem ser guardados para auditoria, mas o estudo padrão prioriza vigente. `legalRefs` cria a ponte granular entre questão e artigo/dispositivo.

## UX
- Design limpo e com baixa distração.
- A ação principal deve estar evidente.
- Detalhes ficam em drawers/painéis quando possível.
- Mobile é um cenário principal, não uma adaptação posterior.
- Filtros e contexto devem ser preservados.
- Nenhuma função nova deve exigir mais gerenciamento do que estudo.

## Itens que ainda merecem evolução posterior
- Rollback transacional completo de uma versão de edital já publicada.
- Exportação/backup completo do banco em um clique.
- Deduplicação global de documentos legais entre concursos com `contest_law_refs` plenamente separado.
- Classificação semiautomática mais inteligente de grandes lotes de questões/materiais com revisão humana.
- Ajuste fino do algoritmo adaptativo depois de dados reais de algumas semanas de estudo.
