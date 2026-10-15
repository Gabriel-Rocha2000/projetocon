# Auditoria — Projeto Fazenda v1.4.7

## Base
- Código: ZIP local v1.4.6 gerado anteriormente e importado nesta execução, incorporando correção de leituras da base 1.4.5.
- Histórico recebido: sintomas de 51 mil leituras do Firestore e consulta de concursos mostrando o ID padrão após exceder cota. O código não demonstra sozinho quantas leituras cada usuário provocou.

## Falhas objetivas e correções
1. `ensureUser` reescrevia `activeContestId` e `studySettings` em cada login. Removida a sobrescrita.
2. `getContests` falhava sem notificação clara, parecendo lista vazia. `ContestContext` e sidebar agora exibem erro sem apagar estado em memória.
3. Coleções consultadas e filtradas só no navegador. Usadas consultas filtradas nas subcoleções de histórico e cache de consultas globais necessárias.
4. `getAllTopics` na carga inicial de Conteúdo e Questões, repetindo consulta global. Agora carrega tópicos do concurso; a Biblioteca geral é opt-in.
5. `importEditalRows` truncava em `rows.slice(0,450)`. Agora processa todas as linhas em lotes de 350, valida pai e ID duplicado antes de gravar.
6. `content_block_progress` gravava com ID do bloco sem levar edital em conta. Nos editais adicionais grava com chave específica do concurso, sem migrar dados antigos.
7. CSV de conteúdo podia sobrescrever `material_id` e `content_block_id` entre editais. Para concursos diferentes do legado ATA, as novas importações usam prefixo do concurso (e a importação das questões acompanha esse prefixo).
8. Deleção de disciplina baixava coleções inteiras para verificar vínculos. Agora consulta apenas a existência de vínculos com `limit(1)`. É conservadora: dados de outro edital podem bloquear exclusão, para evitar perda.
9. Exclusão de microblocos e materiais agora confere questões e progresso do usuário atual; é sempre recomendado arquivar registros já estudados.
10. Padronização manual da classificação por edital muda somente documentos daquele concurso; não altera IDs nem os conteúdos canônicos compartilhados. Não executa fusão automática de tópicos equivalentes.
11. APIs de importação experimental de PDF agora avisam explicitamente quando atingem limites de prévia (250 blocos e 500 questões). Os limites continuam existindo para manter a operação controlada.

## Observações e riscos remanescentes
- Material legado sem `contestId` permanece visível na biblioteca e pode aparecer em mais de um concurso; não executamos migração destrutiva automática.
- Renomear uma disciplina com dados antigos globais não altera automaticamente esses documentos compartilhados.
- Uma disciplina retirada do concurso tem tópicos e questões ocultados no índice principal de estudo, mas históricos e relatórios acumulados podem continuar indicando resultados antigos.
- O Firestore ainda permite acesso amplo às coleções globais por qualquer usuário autenticado nas regras legadas (`firebase/firestore.rules`). Revisar permissões antes de oferecer login a outras pessoas; não alteramos permissões automaticamente para não bloquear sua conta atual.
- `getMaterials` e `getAllTopics` ainda dispõem de consultas globais quando explicitamente necessárias; cache reduz repetição, mas a cota não pode ser garantida sem medir tráfego de verdade.
- Antes de remover ou mesclar tópicos com questões associadas, é necessário implementar uma ferramenta de migração de referências e histórico. A versão presente bloqueia exclusão insegura.
- Alguns tipos de relatórios do Dashboard não usam filtragem por disciplinas arquivadas; o histórico continua intacto propositalmente.
- O plano Spark do Firestore impõe cotas diárias; acompanhe o painel em janelas de teste controlado.

## Teste solicitado após deploy
1. Autenticar e verificar que a seleção de concurso persiste após sair/entrar.
2. Navegar entre Dashboard, Conteúdo, Questões com a cota de leituras acompanhada em paralelo.
3. Retirar e reativar disciplina sem perder tópicos, questões ou progresso.
4. Renomear uma disciplina de teste e alternar entre ATA e CGU; verificar que só um edital mudou.
5. Abrir um tópico com blocos e responder uma questão em dois concursos distintos; confirmar que o progresso não se mistura.
6. Importar um CSV de teste com >450 tópicos e pais válidos apenas em um ambiente de teste; confirmar contagem.
7. Testar visualização de erros de cota/permissão sem apagar registros.

## Documentação de referência
- https://firebase.google.com/docs/firestore/pricing — cota diária, leituras de documentos e índices.
- https://firebase.google.com/docs/firestore/query-data/query-cursors — paginação e `limit`.
- https://firebase.google.com/docs/firestore/best-practices — orientação de índices e consultas.
- https://firebase.google.com/docs/firestore/security/rules-query — regras de segurança não filtram consultas automaticamente.
