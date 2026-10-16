# Projeto Fazenda v1.5.0 — Escopo temático e simulados

Base: v1.4.9b com correção de `app/questoes/page.tsx` validada anteriormente.

## Atualizações
- Clique no nome de uma disciplina/tópico/subtópico no Mapa-Mestre, Conteúdo ou Questões para exibir só essa ramificação; `✕ Mostrar todos` desfaz o foco. Setas continuam expandindo/recolhendo. Botões de estudo/questões continuam funcionando.
- Na página Questões: `Escolher disciplinas e temas` permite marcar várias disciplinas e vários tópicos/subtópicos. Dentro de cada grupo o filtro é OU; os dois grupos são combinados como E. `Gerar simulado` escolhe as questões do conjunto filtrado e embaralha ao misturar assuntos.
- Filtros antigos salvos continuam aceitos; os novos passam a guardar listas de disciplinas e temas.
- CSV de conteúdos: aviso sobre texto com menos de 45 palavras, possíveis fragmentos e linhas não vinculadas, com confirmação antes de importar. O sistema preserva texto integral do CSV sem inventar conteúdo que não existe.
- PDF de teoria: blocos automáticos maiores (até ~4500 caracteres antes de tentar dividir em parágrafo) para reduzir explicações cortadas; conteúdo extraído não é reescrito.

## Limitações importantes
- A importação não reconstrói explicações ausentes no CSV de origem. Revisar o arquivo-base para ter definição, aplicação, exceções e exemplo.
- Não apaga nem modifica conteúdos antigos automaticamente. Faça backup antes de reimportações em produção.
- Para o simulado, o sistema busca apenas questões já registradas, não gera questões inéditas por IA. Questões sem vínculo correto não são recuperadas automaticamente.
- O build completo precisa ser executado no VS Code: `npm ci && npm run build` antes de `git push origin Teste`.
- Copie o código sobre a branch Teste e preserve `.env.local`, `node_modules` e `.next` (não os publique).
