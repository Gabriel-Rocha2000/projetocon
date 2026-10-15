# Roteiro de validação — v1.4.6 (antes do deploy em produção)

## Importações CSV e PDF

1. Abra **Conteúdo → Materiais**.
2. Localize um material CSV e clique em **Editar**. Use a busca por ID/título caso o material tenha muitos blocos.
3. Altere título e texto de UM bloco, clique **Salvar alterações** e reabra o tópico. Texto atualizado deve aparecer; questões e progresso anteriores devem permanecer.
4. Edite o vínculo de um bloco para outro subtópico da MESMA disciplina e salve. O bloco deve aparecer no novo subtópico.
5. Marque **Arquivar bloco**, salve e visite o tópico. O bloco deve desaparecer da leitura. Clique em **Restaurar bloco**, salve e confira o retorno.
6. Exclua um bloco SEM questões nem progresso: só esse bloco deve sumir. Em outro bloco COM questões/progresso, a exclusão deve ser bloqueada e o arquivamento deve continuar possível.
7. Faça a prévia de um CSV real; confirme que o importador existente ainda aceita IDs do Mapa-Mestre. Não reimporte tudo até concluir os testes.

## Disciplinas

1. Abra **Conteúdo → Disciplinas**.
2. Use **Retirar do concurso** em uma disciplina de teste; confirme que ela some do Mapa-Mestre ativo (e dos indicadores de cobertura baseados nos tópicos ativos).
3. Clique **Reativar**; confirme que todos os tópicos voltam e que as questões e o histórico permanecem.
4. Teste **Excluir definitivamente** numa disciplina COM materiais, questões ou progresso: o comando deve bloquear.
5. Só teste exclusão definitiva em disciplina descartável e sem vínculos, depois de fazer backup.

## Entrega GitHub

1. Compare arquivos de uma branch de teste com `main`.
2. Rode `npm ci`, `npm run typecheck` e `npm run build` em máquina com acesso às dependências.
3. Teste login, Firestore e Storage no ambiente já configurado.
4. Faça merge apenas depois dos testes de edição, arquivamento e disciplina.

> Esta entrega teve validação sintática TypeScript e integridade do ZIP. Sem Firebase real, não foi possível executar um teste de ponta a ponta.
