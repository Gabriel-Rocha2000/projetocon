# Projeto Fazenda — v1.4.3

## Objetivo desta versão

Reduzir uma etapa manual da alimentação da base. Agora o Mapa-Mestre aceita diretamente uma estrutura em CSV, sem obrigar o usuário a publicar uma nova versão de edital apenas para adicionar uma disciplina ou árvore de conteúdo.

## Mapa-Mestre — Importar estrutura CSV

Novo botão **Importar estrutura CSV** na página Mapa-Mestre.

Fluxo:

`CSV → validação → prévia → conferência → adicionar ao concurso ativo`

A prévia informa:
- arquivo selecionado;
- número de disciplinas;
- quantidade de tópicos;
- quantidade de subtópicos;
- itens detectados por disciplina;
- avisos de IDs duplicados, campos obrigatórios vazios, subtópicos sem pai e referências a pais inexistentes.

A importação **não cria uma nova versão formal do edital**. Ela apenas adiciona tópicos/subtópicos à estrutura do Mapa-Mestre do concurso atualmente selecionado.

## Formato aceito

Colunas recomendadas:

- `id`
- `disciplina`
- `titulo`
- `texto_original`
- `nivel` (`topic` ou `subtopic`)
- `parent_id`
- `conteudo_id`
- `ordem`
- `tags` (separadas por `;`)

Foi incluído o arquivo `MODELO_IMPORTACAO_MAPA_MESTRE.csv`.

## Cuidados

1. Confirme o concurso ativo antes de importar.
2. Não importe uma disciplina em um concurso ao qual ela não deve pertencer.
3. IDs devem ser estáveis. O mesmo conteúdo deve manter o mesmo `conteudo_id` canônico quando for reutilizado em outros concursos.
4. A importação por Mapa-Mestre não substitui o versionamento do edital. Quando a estrutura vier de um edital oficial, continue preferindo a área **Edital** para preservar o histórico de versões.
