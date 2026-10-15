# Projeto Fazenda v1.4.8 — VS Code / GitHub / Vercel

## O que está neste pacote
Versão consolidada a partir do pacote completo v1.4.7 gerado nesta conversa e do arquivo integral `firestore.ts` revisado hoje. **Não é uma cópia obtida diretamente da branch remota `Teste` após seu último commit.** Portanto, confira o `git diff` antes de substituir alterações mais recentes que tenha feito fora desta conversa.

### Alterações consolidadas
- Gerenciamento em **Conteúdo → Gerenciar conteúdo e disciplinas**: editar título/texto/vínculos dos microblocos, arquivar/desarquivar, remover blocos sem vínculos verificados, retirar/reativar disciplina, padronizar nomes e excluir disciplina vazia mediante proteções.
- `ensureUser` não sobrescreve `activeContestId` nem `studySettings` ao fazer login.
- IDs e progresso de conteúdo separados por edital; importação de mapa-mestre em lotes, sem limite silencioso de 450 linhas.
- Cache curto de consultas e buscas por concurso em funções de leitura; não garante limite de consumo de Firestore.
- **CSV seguro:** importar outra versão do mesmo material faz *upsert* por `content_block_id` e `material_id`, sem apagar automaticamente blocos ausentes do arquivo. Para remover dados incorretos, use o gerenciador. Isso reduz exclusões e preserva vínculos antigos.
- Validação de IDs de microblocos duplicados durante importação CSV.
- ID de importação CSV sem `material_id` passa a ser estável a partir do nome do arquivo; importar o mesmo arquivo novamente não cria outra coleção de blocos. PDFs iguais são isolados por edital (exceto compatibilidade do ATA padrão).
- Dashboard só mostra métricas depois que o concurso e as consultas forem carregados. Em caso de falha do Firestore, exibe uma mensagem de erro em vez de zeros enganosos.

## Passo a passo no VS Code
1. Faça backup da pasta atual e das informações importantes do Firestore. **Não importe novamente PDFs/CSVs nem execute exclusões até testar a nova versão.**
2. Abra ou clone o repositório `Gabriel-Rocha2000/projetocon` no VS Code. Selecione a branch **Teste** (`git switch Teste`), não `main`.
3. Extraia este ZIP. Copie **o conteúdo da pasta `projetocon`** para a raiz da sua pasta Git, preservando as pastas. Não crie `projetocon/projetocon` nem substitua `.env.local` local.
4. Confira alterações no Source Control ou rode `git status` e `git diff --stat`. **Se houver arquivos da branch Teste mais novos que os deste ZIP, reconcilie antes de sobrescrever.**
5. No terminal execute, nesta ordem:

   ```bash
   npm ci
   npm run audit:safe
   npm run typecheck
   npm run build
   ```

6. Se todos passarem, teste localmente com `npm run dev` e verifique acesso aos concursos antigos, mapa-mestre, questões e Conteúdo.
7. Commit e push **apenas na branch Teste**:

   ```bash
   git add -A
   git commit -m "fix: v1.4.8 consolidacao e importacao segura"
   git push origin Teste
   ```

8. Na Vercel, confira Preview `Ready` para o **commit novo**. As seis `NEXT_PUBLIC_FIREBASE_*` devem estar corretamente configuradas para **Preview e Production** no mesmo projeto Firebase. Não coloque essas variáveis no GitHub.
9. Teste **Retirar** e **Reativar** com uma disciplina de teste e confira que seus demais editais continuam com as questões. Não teste exclusão definitiva com dados reais nesta primeira rodada. Faça merge na `main` apenas depois.

## Cuidados e limitações
- **O build completo não pôde ser executado neste ambiente:** instalação das dependências ficou bloqueada pelo acesso indisponível ao npm registry. Verificação realizada: sintaxe TypeScript/TSX dos 37 arquivos, auditoria estática do script do projeto e integridade dos arquivos.
- A exclusão definitiva consulta vínculos de questões e registros de estudo conhecidos, mas não representa verificação global de todos os usuários/formatos legados. Prefira *Arquivar* ou *Retirar do concurso* quando houver dúvida.
- Há consultas globais com cache e consultas de muitas questões ainda presentes; não é possível prometer permanecer abaixo da cota gratuita de 50 mil leituras/dia sem medição no Firebase.
- **Deploy de código não apaga nem restaura os registros do Firestore.** Se aparecerem zeros, confira se Preview aponta para o mesmo Firebase e se as consultas não falharam por cota.
- Não suba `.env`, `.env.local`, senhas nem `node_modules` ao GitHub.
