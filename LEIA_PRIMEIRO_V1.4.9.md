# Projeto Fazenda v1.4.9 — Ações no Mapa-Mestre

Base: versão 1.4.8 consolidada em 14/10/2026.

## Atualização
- Botão ⋯ no fim de cada linha do Mapa-Mestre (disciplinas, tópicos e subtópicos).
- Editar disciplina (nome), tópico/subtópico (título, texto original, código canônico). IDs não são alterados.
- Excluir da lista = retirada reversível no concurso ativo. Não deleta documentos Firestore nem progresso.
- Retirada de tópico também retira descendentes para evitar linhas órfãs.
- Botão "Itens retirados" restaura disciplinas e itens.
- Nenhuma mudança de autenticação, chaves ou regras do Firestore.

## Atualizar no VS Code
1. Fazer backup do projeto atual. Não substituir o .env.local.
2. Copiar os arquivos da pasta projetocon sobre o repositório da branch Teste.
3. Instalar dependências via npm ci, executar npm run audit:safe, npm run typecheck e npm run build.
4. Testar primeiro com tópicos fictícios e validar restauração antes de qualquer uso real.
5. Somente depois enviar o commit para a branch Teste e validar na Vercel Preview.

## Notas
- Editar disciplina renomeia tópicos, questões e materiais do concurso atual; registros históricos antigos podem reter o nome anterior.
- A exclusão da lista NÃO representa exclusão permanente no banco. Foi intencional para preservar progresso e vínculos.
- Mudanças de classificação feitas pelo nome e conteúdo canônico precisam de validação manual quando há material importado.
- O pacote não inclui credenciais, node_modules nem dados privados do Firebase.
