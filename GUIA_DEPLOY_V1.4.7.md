# Projeto Fazenda 1.4.7 — atualização integral pelo GitHub e Vercel

## Origem e compatibilidade
Este ZIP contém uma versão completa baseada na v1.4.6 previamente preparada para o projeto, com as correções de leituras da v1.4.5 adaptadas. **Não contém dados do Firestore** e não migra/apaga o banco automaticamente. Mudanças não fornecidas posteriormente no GitHub podem não estar presentes; confira o diff da branch antes de substituir arquivos em produção.

## Publicar com segurança
1. **Faça backup do repositório e dos dados do Firestore antes de mudanças irreversíveis.** No plano Spark não há backup gerenciado/PITR incluído; não trate download do código como backup dos dados.
2. Descompacte `Projeto_Fazenda_v1.4.7_COMPLETO.zip` e copie **o conteúdo de `projetocon-main/` para a raiz do seu repositório GitHub**. Não faça upload do ZIP como se fosse código.
3. Prefira criar a branch `feature/v1.4.7-multi-editais`. Substitua os arquivos correspondentes (incluindo as pastas ocultas `.github`). **Não exclua a pasta `.git` do repositório**.
4. Mantenha o mesmo projeto Firebase. Defina as seis variáveis `NEXT_PUBLIC_FIREBASE_*` no painel da Vercel, nos ambientes **Production e Preview**. Não exponha os valores no GitHub.
5. Após o commit, aguarde no GitHub Actions o teste `npm ci`, `npm run audit:safe`, `npm run typecheck`. Na Vercel, confira `Ready` no Preview e os Build Logs.
6. Teste login, escolha do concurso, Dashboard, Conteúdo, abertura de um tópico, Questões e Gerenciar disciplinas na branch.
7. **Primeiro teste somente Retirar/Reativar** uma disciplina de testes; ainda não faça exclusão definitiva nem reimporte toda a base.
8. Depois de confirmar a persistência de dados e leituras no Firebase, faça merge da branch na `main` para publicar Production.

## Gerenciar várias provas
- Crie ATA, CGU e outros concursos na página **Concursos**, com IDs distintos.
- Selecione o concurso ativo no menu esquerdo antes de importar mapas, conteúdos e questões.
- A importação de tópicos e questões usa IDs específicos do concurso. O conteúdo canônico (`canonicalContentId`) é reutilizável; o progresso de microblocos agora é separado por concurso.
- Conteúdo > Gerenciar disciplinas > **Retirar do concurso**: esconde no índice ativo e nas questões desse edital, sem apagar dados nem progresso.
- **Padronizar nome**: renomeia somente a classificação dos tópicos, questões e materiais/blocos exclusivos do concurso ativo. Se a disciplina destino já existir, os títulos de tópicos eventualmente repetidos precisarão ser conferidos manualmente; a ação não funde automaticamente IDs de tópicos.
- **Excluir se vazia**: somente se os testes de vínculos e histórico não apontarem registros. Se houver dados em outro edital ou no histórico, a exclusão será bloqueada por segurança.
- Conteúdo > Materiais permite editar título/texto de microblocos e arquivar em vez de excluir os que têm histórico.
- Edital possui edição manual de disciplina, título e conteúdo canônico dos itens do edital.

## Economia de Firestore
- Cache em memória de 5 minutos para consultas repetidas de concursos, tópicos, materiais e questões, com compartilhamento de Promises e invalidação em operações importantes.
- Consulta filtrada por `contestId` para vários históricos e planejamentos.
- A aba Conteúdo não carrega a coleção completa de tópicos ao abrir; a **Biblioteca geral** realiza a consulta somente quando solicitada.
- Questões carrega os tópicos do concurso ativo, não o mapa completo de todos os editais.
- Exclusão de disciplina usa consultas pontuais `limit(1)` em vez de baixar coleções completas.
- Busca global e dashboards ainda podem consumir várias leituras quando abertos; recomenda-se acompanhar o uso antes de importações em massa.

## Atenção ao status de publicação
A Vercel falhou anteriormente em Preview com `auth/invalid-api-key` quando as variáveis estavam habilitadas somente para Production. Se isso reaparecer, ative `NEXT_PUBLIC_FIREBASE_*` também em Preview e execute novo Redeploy. Esse erro não significa que o código apagou registros.

## Testes e limitações
Executada conferência sintática de TS/TSX por parser/transpilador e testes estáticos. **O build completo `npm run build` e os fluxos com Firebase real não foram executados neste ambiente** (dependências não ficaram disponíveis via npm). A publicação só deve ser considerada validada depois de `npm ci`, `npm run typecheck`, `npm run build` e teste da Vercel na sua branch.

Se falhar, **não restaure o banco automaticamente**. Reverter o commit no GitHub/Vercel reverte apenas o código; os dados existentes no Firestore devem ser investigados separadamente.
