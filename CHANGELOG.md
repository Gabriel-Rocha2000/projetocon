## v1.4.8 — 14/10/2026
- Consolidação de edições v1.4.7 e correções de gerenciamento revisadas hoje.
- CSV de conteúdo atualizado por ID sem exclusões automáticas dos registros antigos.
- Verificação de IDs de blocos duplicados.
- Dashboard com estado de carregamento e erro do Firestore, sem indicadores falsamente zerados.
- Proteções de exclusão e concurso ativo preservadas.

## v1.4.7 — Otimização do Firestore e multi-editais
- Consulta filtrada e cache curto, com mensagens visíveis quando o Firestore falha.
- Seleção do concurso preservada no login.
- Importação do mapa-mestre com lotes >450 e validação completa.
- Materiais e progresso de microblocos com escopo por edital.
- Retirada/reclassificação manual de disciplinas e exclusão segura somente quando vazias.
- Evita carregar biblioteca completa nas telas principais.
- Diagnóstico mais claro do limite experimental de importação PDF.

## v1.4.6 — Gerenciamento de CSV e disciplinas

- Tela Conteúdo: listagem pesquisável de importações CSV/PDF, sem limite de oito materiais.
- Edição manual de título, texto, ordem e vínculo por microbloco, sem mudar IDs.
- Arquivar/restaurar bloco sem perder questões nem histórico; microblocos arquivados somem da leitura.
- Exclusão de bloco condicionada à ausência de questões e progresso associado ao usuário.
- Exclusão integral de uma importação, com aviso quando há questões ligadas a seus blocos.
- Gerenciamento de disciplinas do concurso: retirar/reativar via `activeInCurrentEdital`.
- Exclusão definitiva de disciplina só quando não existem questões, materiais, blocos nem histórico detectado.
- Projeto preparado para alterações no repositório GitHub, com verificação TypeScript por GitHub Actions e busca por microblocos. Ver `GITHUB_ATUALIZACAO_V1.4.6.md`.

# Changelog

## v1.4.5 — 12/10/2026

- Dashboard: novo **Relatório para ChatGPT** copiável com cobertura, domínio, evidência, questões, confiança, erros, riscos e próximas tarefas.
- Revisão do Almoço: novo relatório copiável com fila priorizada, recorrência e progresso 0/3–3/3 para gerar atividades no ChatGPT.
- Conteúdo: gestão de materiais importados com **reclassificar**, **editar vínculo por microbloco** e **remover importação** sem apagar questões ou tópicos.
- CSV de conteúdo: opção padrão para **substituir blocos de um `material_id` já existente**, evitando coexistência de importações antigas classificadas incorretamente.
- Storage: remoção segura do PDF original ao excluir uma importação, quando o arquivo existir.
- Projeto preparado para versionamento em GitHub com arquivo `VERSION`, changelog e guia dedicado.

## v1.4.4

- Navegação Anterior/Próximo em Conteúdo.
- Questões navegáveis dentro do tema e modo foco com teoria recolhível.
- Índice hierárquico no Mapa-Mestre mantendo indicadores de status.


## v1.4.9 — 14/10/2026
- Mapa-Mestre: menu de ações por disciplina, tópico e subtópico, com edição.
- Retirada reversível de itens, inclusive descendentes, sem apagar questões ou histórico.
- Tela "Itens retirados" para restauração.
