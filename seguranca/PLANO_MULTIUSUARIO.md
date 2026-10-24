# Projeto Fazenda — ativação segura do modo multiusuário

## Situação verificada em 24/10/2026

- Branch de preparação: `preparacao-multiusuario`; `Teste` não foi alterada por este trabalho.
- `DeveloperGate.tsx` exige `request.auth.token.admin === true` no token Firebase para liberar o painel.
- Configurações oculta o botão de Modo Desenvolvedor de quem não possui a claim.
- `firebase/firestore.rules` nesta **branch** já contém regras candidatas: leitura global por autenticados, escrita global apenas por admin e `users/{uid}/**` acessível apenas ao próprio UID.
- As regras **não foram publicadas no Firebase por esta operação**. Alterar arquivo no GitHub não garante ativação.
- Não há evidência confirmada do UID/e-mail do proprietário no Firebase Authentication nem da claim admin existente. **Não fazer merge nem deploy até verificar**.
- Storage mantém PDFs em `users/{uid}/materials/**` privados do proprietário; outros usuários podem visualizar metadados de materiais globais, mas não baixar o PDF alheio. Revisar essa UX e licenças antes de compartilhar biblioteca.
- Se o recrutador usa a mesma conta Firebase que o proprietário, não é possível distingui-los por papel: criar conta própria de demonstração, sem claim admin.

## Etapa 1 — identificar e provisionar proprietário com segurança

1. Abrir o projeto correto no Firebase Console > Authentication > Users; confirmar **UID e e-mail** da conta do proprietário. Não adivinhar UID a partir do GitHub.
2. Verificar se a conta está ativa e se o recrutador possui **UID diferente**.
3. Fazer backup do Firestore e Storage, anotando projeto, horário e versão das regras atuais.
4. Em computador/ambiente confiável, instalar a dependência administrativa **somente localmente**:
   `npm install --no-save --package-lock=false firebase-admin`
5. Configurar `GOOGLE_APPLICATION_CREDENTIALS` para credenciais **fora do repositório**, `FIREBASE_PROJECT_ID` e `EXPECTED_ADMIN_EMAIL`.
6. Rodar `node scripts/set-admin-claim.cjs UID` (simulação; não altera nada). Confirmar projeto, UID, e-mail, `currentAdmin`.
7. Somente após conferir tudo, rodar `node scripts/set-admin-claim.cjs UID --apply` para atribuir `admin: true` preservando outras claims. O script confirma a alteração.
8. Fazer logout/login na conta do proprietário para renovar o token; verificar que o Modo Desenvolvedor continua disponível.

## Etapa 2 — testes antes de produção

Usar o Firebase Emulator Suite ou um projeto de homologação com duas contas distintas, uma admin e uma aluno/recrutador. Não utilizar dados reais no ambiente de teste.

| Cenário | Resultado esperado |
|---|---|
| Admin entra em Configurações | Botão do Modo Desenvolvedor aparece |
| Admin entra em /desenvolvedor | Acesso permitido |
| Aluno entra em Configurações | Botão não aparece |
| Aluno abre /desenvolvedor pela URL | Acesso negado e redirecionamento |
| Aluno lê `questions`, `topics` | Permitido |
| Aluno cria/edita/exclui `questions`, `topics` | Negado |
| Admin escreve nas coleções globais | Permitido |
| Aluno grava `users/UID_ALUNO/question_progress` | Permitido |
| Aluno tenta ler `users/UID_ADMIN/**` | Negado |
| Admin tenta ler `users/UID_ALUNO/**` | Negado |
| Usuário troca de conta sem recarregar | Nenhum progresso ou cache privado de outra conta aparece |
| Aluno tenta abrir PDF privado de outro UID | Negado |
| Recrutador explora biblioteca e questões com conta própria | Acesso normal sem recursos administrativos |

## Etapa 3 — publicação controlada

1. Confirmar backup restaurável e testes acima.
2. Publicar frontend com gate **e** regras do Firestore na mesma janela controlada, evitando períodos de permissões inconsistentes.
3. Se `firebase/firestore.rules` não for o arquivo de regras configurado no projeto, configurar explicitamente o caminho no `firebase.json` antes do deploy; atualmente não foi encontrado `firebase.json` no repositório.
4. Publicar regras via Firebase CLI autenticado no projeto certo (`firebase deploy --only firestore:rules --project ID_DO_PROJETO`), após validar sintaxe no emulador.
5. Testar em produção com as duas contas e acompanhar `permission-denied` nos logs.
6. Se falhar, reverter frontend e regras usando versões de backup, sem apagar dados.

## Ponto de bloqueio

Não é seguro ativar apenas com acesso ao GitHub: é necessário confirmar o UID e o e-mail do proprietário no Firebase Authentication, conceder a claim admin por credenciais confiáveis e testar uma conta separada de recrutador/aluno. Até lá, manter `Teste` e regras de produção inalteradas.

**Não publicar PDFs de apostilas privadas como material compartilhado sem direito de distribuição.**
