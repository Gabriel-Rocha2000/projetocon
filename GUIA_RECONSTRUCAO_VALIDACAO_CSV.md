# Concurseiro CLT — Guia de reconstrução e validação da base

## 0. Antes de recomeçar
1. Abra Configurações → Modo Desenvolvedor → **Reinicializar base**.
2. Clique em **Conferir base inteira**. Confira quantos registros existem por coleção.
3. Baixe o backup JSON e confirme que o arquivo foi salvo e possui tamanho maior que zero.
4. Digite `ZERAR BASE COMPLETA` e confirme o alerta **somente se tiver certeza de que não precisa dos dados antigos no site**.
5. Aguarde a conferência final. O aplicativo precisa mostrar **Base reinicializada e conferida**.
6. Os PDFs salvos no Firebase Storage e seus cadastros com caminho válido serão preservados. Os mapas, questões, microblocos e históricos de estudos serão reiniciados.
7. **Não importe nada** se a limpeza der erro, restarem documentos ou o backup não estiver salvo. As operações podem ter sido concluídas parcialmente.

**Importante:** o backup JSON guarda os dados e IDs, mas o aplicativo ainda não tem restauração automática. Os registros de progresso de outras contas Firebase não são apagados.

## 1. Uma disciplina por vez
Cada conjunto conterá os CSVs de Mapa-Mestre, Conteúdo e Questões, mais um relatório de auditoria com:
- arquivo PDF de origem, hash do arquivo e aulas;
- total de páginas físicas e numeração impressa, com eventuais deslocamentos;
- IDs de tópicos, subtópicos, seções, blocos, materiais e questões;
- contagens e exceções identificadas;
- status de cobertura, texto e vínculos.

### A. Validar o Mapa-Mestre
1. No Modo Desenvolvedor, abra **Importar Mapa-Mestre**.
2. Confira se o CSV pertence ao concurso e à disciplina corretos.
3. Verifique IDs únicos, hierarquia pai → filho e texto original do edital.
4. Faça a importação e confira se o site apresenta exatamente o número previsto de tópicos/subtópicos.
5. Reabra o Mapa-Mestre e percorra todos os grupos, incluindo o último tópico. Se faltar um, pare antes do conteúdo.

### B. Validar o conteúdo e a fonte
1. Abra **Conteúdos e importações**.
2. Importe um CSV de conteúdo por vez e anote o número de linhas aceitas e rejeitadas.
3. Confira se os IDs do CSV apontam a tópicos reais e se as sete seções (quando houver) respeitam a ordem da apostila.
4. Compare início/fim das seções e trechos de transição diretamente com as páginas do PDF: nenhum texto de teoria deve sumir silenciosamente.
5. Verifique tabelas, fórmulas, quadros e imagens separadamente; se não forem representáveis no CSV, registre conferência manual.
6. Confira o `material_id` do CSV contra `materials.id` e o `storagePath` do PDF no Firebase.
7. Na tela de estudos, teste índice, subtítulos, navegação, zoom, PDF ao lado e marcação de conclusão.
8. Não avance se houver texto ausente, seções duplicadas, paginação incorreta ou PDF não localizado.

### C. Validar as questões
1. Confira questão por questão no CSV: identificador, órgão, banca, ano, enunciado completo, alternativas, gabarito oficial, comentário e página do PDF.
2. Compare o total extraído com o índice, deduplicando questões repetidas em listas e comentários.
3. Identifique questões visuais e de múltiplos itens; sinalize as que precisam de revisão manual, sem inventar texto.
4. Importe as questões e compare número de documentos novos com o número de itens únicos previstos.
5. No leitor, teste questões ligadas diretamente a um conceito e questões relacionadas por tópico.
6. Resolva uma questão de teste para verificar feedback e registro no Caderno de Erros. Lembre-se de que esse registro aparecerá no seu histórico após o reset.

### D. Validar revisões e relatório final
1. Marque um conceito estudado como Fácil, Médio ou Difícil; confirme o registro em Revisões.
2. Use a Auditoria do Modo Desenvolvedor para identificar questões órfãs, sem gabarito e subtópicos sem pai.
3. Registre **Aprovado / Pendente / Corrigir** para cada entrega.
4. **A próxima disciplina só começa depois de resolver todas as pendências da atual.**

## 2. Ordem sugerida
Primeiro Direito Constitucional — Aula 00. Depois acrescente as demais aulas de DC conforme prioridade de estudo, sempre sem apagar o trabalho aprovado. AFO, Administração Pública e outras disciplinas serão adicionadas gradualmente.

## 3. Atenção sobre IDs
Os IDs canônicos do Mapa-Mestre, blocos, questões e `material_id` devem ser preservados entre arquivos e versões. Um CSV corrigido deve atualizar o mesmo ID, sem duplicar conteúdo nem usar títulos como chave de vínculo.

## 4. Limitações e segurança
- O reset tem escopo de conteúdo global do MVP e histórico da conta logada; outras contas não são modificadas.
- A exclusão é em lotes e pode falhar no meio: nesse caso NÃO comece a importar enquanto houver pendência.
- Os documentos de contas, concursos e configurações não são apagados; os PDFs originais permanecem no Storage.
- O código atual do Firestore concede escrita global a qualquer usuário autenticado. Antes de liberar múltiplos usuários, restrinja essas permissões à administração, preferencialmente no backend.
