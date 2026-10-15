# Considerações v1.4.2

## Decisão de fluxo para a carga inicial

Nesta fase do Projeto Fazenda, a prioridade é qualidade e consistência da base. Por isso, conteúdos e questões devem ser preparados fora do app, conferidos e então importados por CSV.

Fluxo recomendado:

`PDF → extração/classificação/conferência → CSV validado → importação → Firestore`

A importação automática de PDF continua no sistema apenas como recurso experimental.

## Conteúdo

Foi incluído `MODELO_IMPORTACAO_CONTEUDO.csv` e um importador próprio na página Conteúdo. O importador:

- exige disciplina, título e texto;
- tenta resolver `subtopico_id`, depois `topico_id`, e por último `content_id`;
- grava o `content_block_id` estável informado no CSV;
- preserva material, fonte, páginas, ordem, tempo estimado e tags;
- não força blocos sem correspondência no Mapa-Mestre;
- informa quantas linhas ficaram de fora e por quê.

Isso permite que o ChatGPT prepare microblocos diretamente a partir dos PDFs e que cada bloco já entre relacionado ao conteúdo canônico correto.

## Questões

O CSV de questões continua como caminho principal. O `content_block_id` deve ser preenchido sempre que for possível apontar a questão para um microbloco exato da teoria.

O importador automático por PDF passa a aparecer como **PDF experimental**, reduzindo o risco de uma classificação heurística entrar na base principal sem revisão.

## Resultado esperado

A base passa a crescer de forma controlada:

`Mapa-Mestre → contentId → microbloco → questão → erro → revisão`

A meta é começar os estudos já com conteúdo e questões consistentes, evitando retrabalho de classificação depois de milhares de registros.
