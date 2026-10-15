# Projeto Fazenda v1.4.9b — Gerenciador alternativo

- **Nova rota:** `http://localhost:3000/gerenciar-mapa` (abra diretamente para testar, mesmo que Mapa-Mestre exiba a versão anterior).
- **Nova opção na barra lateral:** Gerenciar Mapa. **Novo botão no Mapa-Mestre:** Gerenciar Mapa.
- Edição e retirada/restauração reversível por disciplina, tópico ou subtópico.
- Não utiliza o componente compartilhado `HierarchyIndex` para renderizar os botões, portanto é uma alternativa independente.
- Não realiza exclusão física no Firestore: modifica `activeInCurrentEdital`; mantém questões, materiais e histórico.
- Seleção de concurso preservada via `ContestContext`. As operações são restritas ao concurso ativo.
- Se a nova rota retornar 404, a execução local não está usando os arquivos atualizados. Confirme a pasta de trabalho e o processo Next.js, antes de apagar qualquer coisa.
- Não copie `.env.local` para o GitHub; o ZIP não contém senhas/chaves.
- Para testar: `npm run typecheck`, `npm run build`, depois `npm run dev`.
