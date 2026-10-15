# Projeto Fazenda v1.4.1 — Classificação hierárquica e índice de navegação

Esta atualização corrige um ponto estrutural percebido ao testar um PDF de AFO: o importador anterior comparava blocos diretamente com tópicos do concurso ativo e podia sugerir disciplinas genéricas incorretas, como Administração Pública ou Conhecimentos Gerais.

## Nova regra de importação

O fluxo passa a ser:

**PDF → Disciplina → Tópico → Subtópico → contentId canônico → conferência → gravação**

1. O sistema extrai o texto e divide o material em blocos.
2. Identifica primeiro a disciplina usando nome do arquivo, títulos, texto inicial e termos fortes.
3. A disciplina detectada é apresentada ao usuário com um indicador de confiança e pode ser trocada manualmente.
4. Somente depois os blocos são comparados com tópicos/subtópicos daquela disciplina.
5. Sugestões com confiança abaixo de 65% permanecem sem vínculo.
6. O usuário revisa cada classificação antes de salvar.
7. Se a disciplina não pertence ao edital ativo, o material pode ser armazenado na biblioteca canônica sem ser forçado para uma disciplina incorreta.
8. A criação de novos conteúdos canônicos para blocos não classificados exige autorização explícita.

AFO possui pistas específicas como AFO, Administração Financeira e Orçamentária, orçamento público, PPA, LDO, LOA, receita, despesa, créditos adicionais e Lei 4.320/1964. O catálogo também usa as disciplinas já existentes no banco, então não fica limitado a uma lista fixa.

## Questões por PDF

A página Questões recebe um importador inicial de PDF com conferência:

- extrai questões numeradas por heurística;
- tenta detectar alternativas e gabarito;
- identifica primeiro a disciplina;
- classifica o tema somente dentro da disciplina confirmada;
- permite corrigir o tópico e o gabarito antes de salvar;
- itens sem tema ou gabarito ficam de fora, evitando gravação incompleta;
- se a disciplina não existir no edital ativo, a importação é bloqueada até haver vínculo correto com o concurso.

A extração de PDF de questões é necessariamente heurística e deve sempre ser conferida.

## Índice hierárquico

Questões e Conteúdos deixam de depender de listas longas com rolagem contínua.

Estrutura principal:

**Disciplina → Tópico → Subtópico → Tema/Conteúdo**

Cada nível mostra a quantidade de questões vinculadas.

### Questões

- disciplinas começam recolhidas;
- ao expandir, aparecem tópicos e subtópicos;
- o contador mostra a quantidade disponível em cada nível;
- qualquer nível pode iniciar uma bateria daquele escopo;
- busca por disciplina/tópico/tema;
- Expandir tudo / Recolher tudo;
- filtros avançados continuam disponíveis sem dominar a interface.

### Conteúdos

- mesma lógica de árvore;
- alternância entre **Concurso ativo** e **Biblioteca geral**;
- número à direita informa questões vinculadas;
- clicar em conteúdo abre diretamente sua página;
- clicar em disciplina pode levar às questões daquele escopo;
- materiais importados fora do edital atual permanecem acessíveis na biblioteca canônica.

## Princípio de segurança da classificação

**É preferível deixar um bloco sem classificação a gravá-lo no tema errado.**

O sistema nunca deve transformar baixa confiança em vínculo silencioso.
