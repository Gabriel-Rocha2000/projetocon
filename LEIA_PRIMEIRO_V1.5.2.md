# Concurseiro CLT — versão 1.5.2

## O que esta versão implementa

- Marca **Concurseiro CLT** no menu, login, título do navegador e manifesto.
- **Modo Estudos**: mantém Início (Dashboard), Conteúdo, Mapa-Mestre, Questões, Revisões e leitor contextual da 1.5.1, sem os botões de importar/editar nesses índices.
- **Configurações → Modo Desenvolvedor**: entrada explícita mediante confirmação.
- **Modo Desenvolvedor** com menu independente e **Voltar ao Modo Estudos**. A página anterior de estudo é lembrada por sessão nesta aba.
- Gerenciar Mapa-Mestre: editar títulos e nomes, retirar/restaurar tópicos e disciplinas; importação de estrutura CSV em seção própria.
- Conteúdos: gerenciar materiais e microblocos existentes, corrigir título/texto/vínculos, arquivar/restaurar, importação CSV/PDF experimental e **adicionar novo microbloco manualmente** a um material.
- Questões: localizar, corrigir enunciados, alternativas, gabaritos, comentários e vínculos por ID; área separada de importação CSV/PDF experimental.
- Materiais: consultar lista e visualizar PDFs **já existentes no Firebase Storage** (se houver permissão e arquivo).
- Auditoria de leitura sob demanda: questões sem vínculos, questões incompletas, tópicos sem pai, PDFs sem arquivo no Storage.
- Segurança: tela informa quais recursos AINDA não existem: histórico imutável completo de versões, backup automático e controle real de administrador no Firebase.

## Instalar no VS Code — branch Teste

1. Faça um commit da versão local atual ou crie uma cópia da pasta antes de sobrescrever arquivos.
2. Extraia o ZIP `SOMENTE_ALTERADOS` **fora da pasta do repositório**.
3. Copie o **conteúdo** do ZIP para a pasta `projetocon`, mesclando as subpastas `app`, `components`, `lib`, `scripts`, `services` etc. Não coloque o ZIP extraído como uma nova subpasta dentro de `projetocon`.
4. Preserve seu `.env.local` e o diretório `.git`.
5. Dentro da raiz que contém `package.json`, execute:

   ```bash
   npm ci
   npm run audit:safe
   npm run typecheck
   npm run build
   npm run dev
   ```

6. Abra `http://localhost:3000/configuracoes` e confirme a transição para Modo Desenvolvedor.
7. Teste **sem excluir dados reais**: abra mapa, encontre um tópico; abra materiais; edite um microbloco de teste; volte para estudos e confira o mesmo conteúdo; confira edição de questão de teste; execute auditoria; retorne para o mesmo ponto de estudo.
8. **Somente depois de build e testes concluídos**, confirme a branch e publique:

   ```bash
   git branch --show-current
   git status
   git add -A
   git commit -m "feat: Concurseiro CLT v1.5.2 - modo desenvolvedor"
   git push origin Teste
   ```

## Atenção à segurança

O botão Modo Desenvolvedor é uma **separação visual por sessão**, não um mecanismo seguro de autorização. Nas regras atuais de Firestore, qualquer usuário autenticado pode escrever em várias coleções compartilhadas. **Antes de cadastrar terceiros**, implemente autorização administrativa no backend (Custom Claims ou política equivalente) e modifique as regras do Firestore/Storage para restringir escritas globais; não basta ocultar opções na interface.

Não rode migrações, exclusões em lote ou `npm audit fix --force`. A atualização do código, sozinha, não exclui nenhum documento Firebase.

A edição do gabarito de uma questão preserva tentativas anteriores, mas não recalcula automaticamente notas históricas. Refaça a conferência das estatísticas se gabaritos oficiais mudarem.

A auditoria consulta coleções sob demanda (pode consumir leituras do Firestore). Relatório sem alertas não garante fidelidade ao PDF; a auditoria textual de página a página e o versionamento completo continuam planejados.

A visualização do PDF nesta versão está na área Desenvolvedor para materiais existentes no Storage; a experiência de comparação PDF/texto lado a lado no Modo Estudos continua sendo uma evolução futura.

## Verificações realizadas neste pacote

- Análise de sintaxe de arquivos TypeScript/TSX.
- Resolução de imports internos e auditoria estática.
- Integridade dos arquivos ZIP.
- **Build Next.js completo ainda precisa ser executado no VS Code**, pois o `npm ci` não conseguiu instalar as dependências no ambiente de preparação.
