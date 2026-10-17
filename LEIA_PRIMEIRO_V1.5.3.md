# Concurseiro CLT — Versão 1.5.3 (atualização de UI/UX)

## O que muda

- A base é a **v1.5.2**. O Modo Desenvolvedor continua em **Configurações**, separado do Modo Estudos.
- Sidebar redesenhada com logo em livro, menu de estudo prioritário e **Outras ferramentas** recolhível (não foram removidas páginas).
- Paleta suavizada de azul-marinho, branco, verde e cinza-claro, com espaçamento, cards e hierarquia visuais melhores.
- Tela de **Questões e simulados** com cards, listas e filtros com a nova identidade.
- Dashboard/`Início` com aparência revisada; métricas reais continuam provenientes do Firestore.
- Leitor contextual possui **quatro abas**: Teoria, Questões, Resumo e PDF fonte.
- Ao clicar em **PDF fonte**, o leitor busca o PDF no Storage e o exibe ao lado da teoria (ou abaixo no celular). Existe opção de abrir em outra guia. **Se não houver PDF com `storagePath` válido, aparece um aviso — não é gerado documento fictício.**
- O botão **Resumo** não gera sínteses inventadas: sinaliza quando o resumo ainda não está cadastrado/validado. A construção de resumos por microbloco depende de uma etapa de conteúdo posterior.
- O leitor preserva o fluxo de resolução, comentários, confiança, posição e vínculos diretos da v1.5.2.

## Como instalar no VS Code

1. Faça cópia da pasta do projeto, ou crie uma branch para testar.
2. Baixe `Concurseiro_CLT_v1.5.3_SOMENTE_ALTERADOS.zip`, extraia e copie **mantendo a estrutura de pastas** para a raiz `projetocon/`.
3. **Não substitua nem exponha seu `.env.local`** e não apague `.git/`.
4. No terminal do VS Code, na pasta `projetocon`, execute:

```bash
npm ci
npm run audit:safe
npm run typecheck
npm run build
npm run dev
```

5. Abra a URL local exibida no terminal e confira as telas **Questões e simulados**, **Conteúdo → microbloco**, **Configurações → Modo Desenvolvedor**, navegação no celular e as revisões.
6. Verifique a aba **PDF fonte** com uma apostila realmente enviada ao Firebase Storage. Se não houver `storagePath` ou se a permissão não permitir leitura, o leitor exibirá o aviso correspondente. A página impressa e a página física do arquivo podem divergir.
7. Somente após passar nos testes locais, faça `git add -A && git commit -m "style: Concurseiro CLT v1.5.3 - UI estudos e leitor PDF" && git push origin Teste`.

## Prévia visual

Abra `PREVIA_LAYOUT_V1.5.3.html` no navegador para alternar entre **Questões** e **Leitor + PDF**. A prévia usa o mesmo `app/globals.css` do projeto e funciona sem conexão com o Firebase; **os dados são ilustrativos**.

## Verificações executadas neste ambiente

- Análise sintática de 56 arquivos TypeScript/TSX: **0 erros sintáticos**.
- `npm run audit:safe`: verifique o resultado antes de publicar (checagens de regressão, não equivalem a teste de build).
- Renderização da prévia HTML/CSS em navegador: **confirmada por captura de tela**.
- `npm ci` **não concluiu** neste ambiente: erro interno do npm durante download das dependências; por isso o `npm run typecheck` e o `npm run build` completos **não puderam ser validados aqui**. Precisam ser executados no seu VS Code.

## Limitações assumidas

- A aparência real dependerá dos dados carregados e do tamanho de tela; a imagem de design produzida anteriormente era conceitual, não captura do software em funcionamento.
- A aba PDF depende de um arquivo real no Storage. A página indicada em `sourcePageStart` **não tem mapeamento verificado** entre numeração impressa e página física; ajuste o dado no Modo Desenvolvedor ao auditar o PDF.
- Histórico de versões completo e políticas administrativas reais no Firebase continuam pendências de segurança/gestão da base.
- A conclusão de tópico e o ciclo de revisões seguem as regras já existentes na v1.5.2, sem migração automática de dados.

## Detalhes adicionais desta atualização

- Na **Revisão**, quando a recuperação falhar, use **“Não lembro · reestudar”** para abrir a teoria do tópico. Essa navegação não marca a revisão como concluída; ela só será concluída pela ação específica existente.
- Quando um tópico ainda não tem microblocos, a tela de estudos é somente de leitura; o editor foi retirado dali para respeitar a separação entre Estudar e Gerenciar.
- Os indicadores de microblocos e erros permanecem disponíveis **abaixo do leitor**, para priorizar o texto e o PDF na parte superior da página.
