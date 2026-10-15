# Checklist rápido — Projeto Fazenda v1.4.1

## 1. Inicialização

1. Copie o `.env.local` da versão anterior.
2. Rode `npm install` se necessário.
3. Rode `npm run dev`.
4. Entre com o mesmo usuário Firebase.

## 2. Teste principal — PDF de AFO

1. Abra **Conteúdo → Importar material**.
2. Escolha o mesmo PDF de AFO que antes retornava Administração Pública/Conhecimentos Gerais.
3. Confirme que a tela agora mostra primeiro **Disciplina**.
4. Verifique se **Administração Financeira e Orçamentária** aparece como candidata/detectada quando o PDF contém evidência suficiente.
5. Se AFO não estiver no edital ativo, confirme o aviso de que o material irá para biblioteca, sem ser forçado para outra disciplina.
6. Confira alguns blocos e veja se os tópicos sugeridos pertencem somente a AFO.
7. Um bloco de baixa confiança deve aparecer como **Não classificado**.
8. Não marque criação de conteúdos novos no primeiro teste.
9. Salve apenas os blocos classificados e abra **Biblioteca geral**.

## 3. Índice de Conteúdos

1. Abra Conteúdo.
2. Verifique as disciplinas recolhidas.
3. Expanda uma disciplina.
4. Expanda um tópico.
5. Confira o contador de questões à direita.
6. Teste **Expandir tudo**, **Recolher tudo** e a busca.
7. Alterne entre **Concurso ativo** e **Biblioteca geral**.
8. Abra um conteúdo a partir da árvore.

## 4. Índice de Questões

1. Abra Questões.
2. Expanda uma disciplina e confira a quantidade total.
3. Expanda tópico/subtópico.
4. Clique em **Resolver** no nível da disciplina e confirme que a bateria contém apenas aquela disciplina.
5. Repita em tópico e subtópico.
6. Teste a busca do índice.
7. Abra os filtros avançados e confirme que continuam funcionando.

## 5. Importação de questões por PDF

1. Em Questões, clique **Importar PDF**.
2. Escolha um PDF pequeno de questões.
3. Confira disciplina detectada e confiança.
4. Revise pelo menos 3 questões.
5. Confirme/corrija tema e gabarito.
6. Itens sem tema ou gabarito não devem ser gravados.
7. Depois da importação, confira os novos contadores no índice.

## Resultado esperado

O teste é aprovado quando nenhum PDF de AFO é empurrado para Administração Pública/Conhecimentos Gerais apenas por semelhança genérica e quando Questões/Conteúdos podem ser navegados pelo índice sem rolagem extensa.
