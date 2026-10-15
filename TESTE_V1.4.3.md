# Checklist — v1.4.3

## Importação direta no Mapa-Mestre

1. Selecione o concurso correto no Projeto Fazenda.
2. Abra **Mapa-Mestre**.
3. Clique em **Importar estrutura CSV**.
4. Selecione `AFO_AULA01_ESTRUTURA_MAPA_MESTRE.csv` ou `MODELO_IMPORTACAO_MAPA_MESTRE.csv`.
5. Confira a prévia:
   - disciplina;
   - quantidade de tópicos;
   - quantidade de subtópicos;
   - IDs e títulos;
   - avisos de validação.
6. Clique em **Adicionar ... item(ns)**.
7. Confirme que a disciplina aparece no Mapa-Mestre.
8. Abra Conteúdo e importe o CSV validado de conteúdo.
9. Abra Questões e importe o CSV validado de questões.
10. Verifique se os contadores/índices encontram os tópicos recém-adicionados.

## Testes negativos

- CSV com ID duplicado: deve avisar e ignorar a segunda ocorrência.
- Linha sem disciplina: deve ficar fora da importação.
- Subtópico sem `parent_id`: deve gerar aviso.
- `parent_id` inexistente: deve gerar aviso.
- Cancelar na prévia: não deve gravar nada.

## Observação

A importação no Mapa-Mestre não cria versão do edital. Para um novo edital oficial, use a área **Edital**.
