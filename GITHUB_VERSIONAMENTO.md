# Versionamento do Projeto Fazenda no GitHub

## Estratégia recomendada

Use **um único repositório** para o Projeto Fazenda. A pasta do projeto deixa de ser `v1.4.4`, `v1.4.5`, etc. No GitHub, a versão atual fica na branch `main` e cada versão estável recebe uma **tag** (`v1.4.5`, `v1.4.6`...).

Os ZIPs servem apenas como entrega/backup. Eles **não precisam ser enviados ao repositório**.

Se você quiser guardar também CSVs reais de cursos/questões, prefira um repositório **privado** e, mesmo assim, mantenha esses arquivos fora do código. A v1.4.5 já ignora PDFs e padrões de CSV validado para reduzir o risco de publicação acidental.

## Primeira publicação

Na pasta da v1.4.5:

```bash
git init
git add .
git commit -m "release: Projeto Fazenda v1.4.5"
git branch -M main
git remote add origin URL_DO_SEU_REPOSITORIO
git push -u origin main
git tag -a v1.4.5 -m "Projeto Fazenda v1.4.5"
git push origin v1.4.5
```

O `.env.local` já está ignorado. Nunca envie suas chaves do Firebase/OpenAI para o GitHub. PDFs também estão ignorados nesta versão.

## Quando chegar uma nova versão gerada pelo ChatGPT

1. Faça backup local ou confirme que a versão atual está commitada.
2. Descompacte a nova versão em uma pasta temporária.
3. Copie **os arquivos do projeto** para dentro da pasta do repositório, preservando a pasta oculta `.git`.
4. Não substitua seu `.env.local`.
5. Rode:

```bash
git status
git diff
npm install
npm run typecheck
npm run build
```

6. Se estiver tudo certo:

```bash
git add .
git commit -m "release: Projeto Fazenda v1.4.6"
git push origin main
git tag -a v1.4.6 -m "Projeto Fazenda v1.4.6"
git push origin v1.4.6
```

## Como voltar para uma versão antiga

Para apenas consultar/testar:

```bash
git checkout v1.4.5
```

Para voltar à `main`:

```bash
git checkout main
```

Evite editar permanentemente em uma tag. Para corrigir uma versão antiga, crie uma branch a partir dela.

## Fluxo simples para este projeto

- `main`: versão estável que você usa para estudar.
- `feature/...`: opcional, para mudanças maiores antes de validar.
- tags `v1.4.5`, `v1.4.6`, etc.: pontos de restauração.
- GitHub Releases: opcional para anexar o ZIP de cada versão estável.

Isso elimina a necessidade de manter dezenas de pastas versionadas no computador e permite ver exatamente o que mudou entre uma versão e outra.
