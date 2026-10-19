# Atualização do Concurseiro CLT — leitor contínuo

Esta branch é uma prévia para Pull Request contra Teste. Não mescle antes de conferir o build e a navegação.

## Como validar

1. Em um ambiente com as mesmas variáveis Firebase, execute npm ci, npm run typecheck, npm run audit:safe e npm run build.
2. Abra Conteúdo > Direito Constitucional > um tópico com microblocos.
3. Confira se o índice reúne conceitos por seção, sem misturar materiais diferentes.
4. Confirme que a conclusão registra progresso e mantém revisões.
5. Abra PDF fonte e confirme que o materialId referencia o documento cadastrado em materials.
6. Confira questões diretas e relacionadas separadamente.

## Dados

O código não apaga dados existentes do Firestore e não importa automaticamente as sete seções piloto. Para reproduzir a demonstração com a Aula 00, os microblocos devem possuir os IDs DC_CGU_PASSO_A00_B001 até B032 e o mesmo materialId. Campos secao_id, secao_titulo e secao_ordem no CSV têm precedência; caso contrário, o agrupamento da Aula 00 segue os 7 grupos de teste. Outros materiais sem metadados de seção ficam em leitura contínua.

Aposte apenas em CSVs auditados; a importação agora é bloqueada se alguma linha não tiver destino.

**Atenção:** esta branch deve ser testada em Preview antes da publicação de produção. Não altere regras do Firebase apenas para validar o visual.
