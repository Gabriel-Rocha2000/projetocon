# Projeto Fazenda v1.4.7

> Para atualizar e publicar, leia `GUIA_DEPLOY_V1.4.7.md` e `RELATORIO_AUDITORIA_V1.4.7.md`.

> Consulte `GITHUB_VERSIONAMENTO.md` para publicar e manter as próximas versões no GitHub.

## Navegação ativa em Conteúdo
- `Voltar para conteúdos`, `Anterior` e `Próximo` dentro da página de estudo.
- Questões do microbloco navegáveis no próprio conteúdo com contador `Questão X de Y`.
- Modo foco permite recolher a teoria e estudar só pelas questões; a teoria pode ser reaberta sem perder a questão atual.
- Estado da questão atual e do modo foco é preservado durante a sessão.

## Mapa-Mestre em índice
- O Mapa-Mestre agora segue o mesmo padrão hierárquico de Questões/Conteúdo: Disciplina → Tópico → Subtópico.
- As disciplinas começam recolhidas e podem ser expandidas individualmente.
- Ao expandir, permanecem os indicadores visuais por item: pendente, em andamento, revisão vencida, domínio frágil e dominado.
- Mantidos busca, Expandir tudo / Recolher tudo, Próximo pendente e importação de estrutura CSV.


## v1.4.3 — Importação direta no Mapa-Mestre

A página **Mapa-Mestre** agora possui **Importar estrutura CSV**. O fluxo valida o arquivo, exibe prévia por disciplina e só grava após confirmação. Isso é útil para adicionar árvores de disciplinas/conteúdos preparadas e validadas externamente sem criar uma versão artificial do edital.

Modelo incluído: `MODELO_IMPORTACAO_MAPA_MESTRE.csv`.

# Projeto Fazenda v1.4.2

A v1.4.2 mantém a base da v1.4.1 e muda o fluxo principal de entrada de dados: nesta fase, conteúdos e questões devem entrar preferencialmente por CSV previamente classificado e validado. A importação automática por PDF continua disponível apenas como recurso experimental. O objetivo é proteger a qualidade da base antes da carga em massa.


## Destaques da v1.4.2

### CSV validado como caminho principal

Fluxo recomendado para esta fase:

`PDF → análise externa/conferência → CSV validado → Projeto Fazenda → Firestore`

- Questões: use `MODELO_IMPORTACAO_QUESTOES.csv`.
- Conteúdo: use `MODELO_IMPORTACAO_CONTEUDO.csv`.
- O importador de conteúdo valida disciplina, tema existente no Mapa-Mestre, `contentId`, páginas, material e microbloco antes de gravar.
- Linhas de conteúdo sem disciplina, título, texto ou tema reconhecido ficam de fora e são informadas ao usuário.
- O vínculo fino `content_block_id` permite que uma questão abra exatamente o microbloco de teoria correspondente.
- A importação automática de PDF foi mantida como **experimental**, para testes futuros, sem ser o caminho padrão da base principal.

### Classificação hierárquica de PDFs

O importador não tenta mais encaixar um bloco diretamente em qualquer tópico parecido. O fluxo é:

`PDF → disciplina → tópico/subtópico → contentId → confiança → conferência → salvar`

- a disciplina é identificada e confirmada primeiro;
- a classificação temática ocorre apenas dentro dela;
- confiança abaixo de 65% não gera vínculo automático;
- AFO é reconhecida por termos como AFO, orçamento público, PPA, LDO, LOA, receita, despesa, créditos adicionais e Lei 4.320/1964, além do catálogo existente;
- material de disciplina ausente no edital ativo pode ir para a **Biblioteca geral** sem ser forçado para Administração Pública/Conhecimentos Gerais;
- novos conteúdos canônicos só são criados com autorização explícita.

### Índice em Questões e Conteúdos

As duas áreas passam a usar árvore expansível:

`Disciplina → Tópico → Subtópico → Tema/Conteúdo`

Cada nível mostra quantidade de questões. Questões podem ser iniciadas diretamente de qualquer nível; Conteúdo alterna entre o concurso ativo e a biblioteca geral. Há busca, Expandir tudo e Recolher tudo.

### PDF de questões — experimental

O importador automático de PDF de questões permanece disponível para testes, mas não é o caminho recomendado para a carga principal. Para a fase atual, prefira CSV validado, com disciplina, tópico, subtópico, tema, gabarito e vínculos conferidos previamente.

## Princípios da versão

- **O sistema organiza. O usuário estuda.**
- Cobertura do edital e domínio são indicadores diferentes.
- Conteúdo estudado só ganha confiança com evidência em questões.
- Sessões longas não devem ser exclusivamente passivas.
- Material, questões, erros, revisões e Lei Seca devem estar conectados pelo conteúdo.
- Histórico não deve ser apagado quando edital, concurso ou classificação mudar.

## Principais novidades

### Dashboard e Planejador
- **Seu dia** no topo do Dashboard, com botão **Iniciar**.
- **Tenho alguns minutos agora**: 10, 20, 30 ou 60 minutos.
- **Continuar de onde parei**.
- Diagnóstico **Se a prova fosse amanhã**.
- Cobertura, domínio e **evidência** separados.
- Alerta de cobertura frágil.
- **Modo Reta Final**, priorizando questões, erros e revisões.

### Estudo ativo e Conteúdo
- Importação principal de conteúdo por **CSV validado**; PDF automático permanece experimental.
- PDF preservado como fonte e segmentado em **microblocos**.
- Conferência do vínculo entre microbloco e Mapa-Mestre antes de salvar.
- Progresso por bloco, não por uma hora contínua de leitura.
- Recuperação ativa e questões entre blocos.
- Link direto da questão para o conteúdo relacionado.
- Retomada do bloco onde o estudo parou.

### Questões
- Filtros recentes, último filtro e filtros salvos.
- Entrada por Mapa-Mestre/Planejador já aplica o contexto da questão.
- Campo `content_block_id` para vínculo fino com teoria.
- Campo `legal_refs` para vínculo com artigo/dispositivo legal.
- Confiança após responder: **Sabia / Entre duas / Chutei**.
- Acerto com baixa confiança pesa menos no indicador de domínio.

### Caderno de Erros
- A lista completa de erros é permanente.
- Erro ativo começa em **0/3 acertos consecutivos**.
- Em 3/3, vira **Consolidado** e segue apenas para revisão adaptativa.
- Um novo erro futuro zera a sequência e reativa o item.
- Filtros para todos, ativos, consolidados e recorrentes.
- Integração direta com Revisão do Almoço.

### Edital versionado
- Área própria: **Visão Geral | Conteúdo Programático | Leis Detectadas | Versões | Editar**.
- Importação por CSV ou PDF.
- PDF usa extração heurística e sinaliza itens de baixa confiança para conferência.
- Nova versão preserva histórico de estudo.
- Comparação entre versões.
- `canonicalContentId` permite reaproveitar conhecimento em editais diferentes sem confundir cobertura.

### Lei Seca
- Navegação **Lei → Artigo → Dispositivo**.
- Revisões pendentes contam somente o que efetivamente venceu.
- Questões por referência legal.
- Texto oficial preservado.
- Separação entre vigente, histórico, revogado e item a conferir.

### Interface e responsividade
- Visual mais clean, com menos cor decorativa e mais espaço em branco.
- Sidebar recolhível no celular.
- Drawers adaptados para telas pequenas.
- Questões, erros, Mapa-Mestre, Conteúdo e Lei Seca responsivos.
- Áreas de toque maiores no mobile.
- Tabelas críticas adaptadas para evitar dependência de rolagem horizontal.

### Busca global
Pesquise em uma única tela por conteúdo, questões, leis, erros e materiais.

## Instalação / atualização a partir da v1.4

1. Extraia a v1.4.2 em uma nova pasta.
2. **Copie o `.env.local` da versão anterior para a raiz da v1.4.2.** Não compartilhe esse arquivo.
3. Rode:

```bash
npm install
npm run dev
```

4. Publique as novas regras do Firestore do arquivo `firebase/firestore.rules`.
5. Para importar PDFs de materiais no Firebase Storage, publique também `firebase/storage.rules`.

Se usar Firebase CLI, a forma usual é:

```bash
firebase deploy --only firestore:rules
firebase deploy --only storage
```

Se o projeto não estiver configurado para Firebase CLI, copie as regras pelos respectivos consoles do Firebase.

## Novas coleções usadas pela v1.4

Além das coleções anteriores, a v1.4 pode usar:

- `contest_versions`
- `edital_items`
- `content_blocks`
- `materials`
- subcoleção `content_block_progress` dentro de `users/{uid}`

As regras incluídas nesta versão são adequadas ao uso pessoal/MVP autenticado. Antes de transformar o projeto em plataforma pública multiusuário, restrinja gravações nas coleções globais a uma função administrativa.

## Importação em massa de questões e conteúdos

Para questões, use `MODELO_IMPORTACAO_QUESTOES.csv`. Para conteúdo, use `MODELO_IMPORTACAO_CONTEUDO.csv`.

No CSV de questões, os campos mais importantes para integração com a teoria são:

- `content_block_id`: microbloco exato da teoria, quando conhecido.
- `legal_refs`: uma ou mais referências legais estáveis, separadas por `;`.

É possível importar questões mesmo sem esses campos; elas continuam vinculadas por tópico/subtópico e podem ser refinadas depois.

No CSV de conteúdo, priorize `content_block_id`, `disciplina`, `topico_id`, `subtopico_id`, `content_id`, `titulo`, `texto`, páginas e `material_id`. O importador só grava linhas que consiga relacionar com segurança ao Mapa-Mestre.

## Validação desta entrega

Os arquivos TypeScript/TSX foram submetidos a verificação sintática local e a checagem de imports internos. O ambiente usado para gerar o pacote não conseguiu concluir a instalação das dependências npm, portanto o `npm run build` completo **não foi executado nesta entrega**. A validação funcional no seu Firebase deve seguir `TESTE_V1.4.2.md`, com atenção especial à importação dos dois modelos CSV e ao vínculo Questão ↔ `content_block_id` ↔ Conteúdo.
