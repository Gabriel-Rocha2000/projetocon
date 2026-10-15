# Projeto Fazenda v1.4.6 — Atualizar pelo GitHub

## Antes de atualizar

1. Faça backup dos dados do Firebase/Firestore e confira o repositório onde a versão atual está publicada.
2. Trabalhe numa branch nova (`feature/gerenciar-conteudos`) em vez de alterar `main` diretamente.
3. **Nunca suba `.env.local`, `node_modules`, PDFs ou CSVs pessoais ao repositório.**
4. O ZIP `PATCH_GITHUB` inclui só arquivos modificados, nos caminhos corretos do repositório.

## Pelo site do GitHub

1. Abra seu repositório em **github.com** e crie uma branch a partir da `main`.
2. Atualize cada arquivo listado em `ARQUIVOS_ALTERADOS.txt`, respeitando seu caminho. Você pode arrastar os arquivos para **Add file → Upload files** dentro da pasta correspondente ou abrir o arquivo e usar **Edit**.
3. Confirme o commit na branch. Não envie o ZIP como se fosse o código-fonte.
4. Se usar hospedagem conectada ao GitHub, abra a prévia de deployment da branch e teste o login antes de fazer merge.
5. O GitHub Actions executa `npm ci` e `npm run typecheck` para cada Pull Request. Aguarde a validação.
6. Após testar a edição de blocos e o gerenciamento de disciplinas, faça merge para `main`.

## Usando GitHub Desktop / VS Code (mais fácil para muitos arquivos)

1. Clone ou abra seu repositório existente no GitHub Desktop/VS Code.
2. Crie uma branch de teste.
3. Extraia o pacote `PATCH_GITHUB` e copie apenas seus arquivos para dentro da raiz do repositório; mantenha a pasta `.git` e o seu `.env.local`.
4. Rode `npm ci`, `npm run typecheck` e `npm run build`.
5. Confirme as alterações, faça push e abra um Pull Request.

## Como usar no app

- **Conteúdo → Gerenciar conteúdo e disciplinas → Materiais:** pesquise o arquivo importado, clique em Editar, ajuste os campos e clique em **Salvar alterações**. É possível arquivar/restaurar ou excluir um bloco.
- **Conteúdo → Gerenciar conteúdo e disciplinas → Disciplinas:** clique em **Retirar do concurso** para sair do mapa e da cobertura sem apagar dados. **Reativar** devolve os tópicos ao concurso.
- **Excluir definitivamente** é uma ação protegida para disciplinas realmente vazias: sem questões, blocos, materiais ou histórico.

## Limitações e segurança

- Código editado localmente, ainda não validado contra o seu Firebase real.
- Esta versão não oferece lixeira/restauração de uma exclusão definitiva. Faça backup antes de apagar.
- A remoção completa de material pode deixar uma questão existente referenciando um ID de bloco antigo; o texto e o histórico da questão continuam, mas o vínculo ao microbloco deixa de funcionar.
- Arquivamento é a alternativa segura para tópicos/blocos já usados nos estudos.
- O arquivo `.gitignore` evita que configurações e PDFs comuns sejam versionados; confira sempre o `git status`.
