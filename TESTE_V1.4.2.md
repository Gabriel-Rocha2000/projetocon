# Teste v1.4.2

## 1. Preparação

1. Copie o `.env.local` da versão anterior para a raiz da v1.4.2.
2. Rode `npm install` se necessário.
3. Rode `npm run dev`.
4. Entre no concurso que possui o Mapa-Mestre usado pelos CSVs.

## 2. Conteúdo por CSV validado

1. Abra **Conteúdo**.
2. Clique em **Importar CSV validado**.
3. Use `MODELO_IMPORTACAO_CONTEUDO.csv` somente se os IDs do exemplo existirem no seu Mapa-Mestre; caso contrário, use um CSV produzido para a sua estrutura real.
4. Confirme a mensagem de importação.
5. Verifique se os blocos aparecem no conteúdo relacionado e se material/fonte/páginas foram preservados.
6. Teste uma linha com `topico_id` inexistente: ela deve ficar de fora, sem criar classificação silenciosa.

## 3. Questões por CSV validado

1. Abra **Questões**.
2. Clique em **Importar CSV validado**.
3. Importe um CSV compatível com `MODELO_IMPORTACAO_QUESTOES.csv`.
4. Confira a contagem por disciplina/tópico no índice.
5. Abra uma questão que tenha `content_block_id` e valide o acesso ao conteúdo relacionado.

## 4. PDF experimental

1. Confirme que o botão aparece como **PDF experimental** em Questões e Conteúdo.
2. Use apenas para teste; não utilize esse fluxo para a carga principal nesta fase.

## 5. Critério de aceite

A v1.4.2 está pronta para a carga inicial quando:

- CSV de conteúdo importa somente blocos mapeados corretamente;
- CSV de questões mantém disciplina/tópico/subtópico e gabarito;
- `content_block_id` conecta questão e teoria;
- índice mostra as contagens corretas;
- nenhuma linha não reconhecida é alocada automaticamente em tema genérico.
