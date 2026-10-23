# Preparação multiusuário — ativação adiada
## Estado de hoje
- Branch Teste continua intacta; recrutador ainda pode visualizar a demonstração.
- A UI de modo desenvolvedor utiliza sessionStorage por UID, sem autorização administrativa real.
- Firestore: coleções globais aceitam escrita de qualquer autenticado. É risco conhecido.
- users/{uid}/** é privado do próprio UID.
- PDFs em users/{uid}/materials/** são privados; não compartilhar apostilas de terceiros automaticamente.

## Plano de ativação
1. Fazer backup Firestore/Storage, anotar versão atual e inventário.
2. Definir UID(s) de administrador e conceder claim via Admin SDK em ambiente confiável.
3. Ajustar DeveloperGate e Configurações para exigir claim admin (não apenas sessionStorage).
4. Validar com uma conta aluno que não possui claim.
5. Aplicar as regras candidatas e confirmar admin escreve e aluno só lê a biblioteca.
6. Reavaliar 'materials': documentos pessoais e globais precisam escopos distintos; nunca liberar leitura de dados pessoais só por estarem na coleção global.
7. Testar isolamento do dashboard/caderno de erros/revisões/planejador, sign-out e troca de conta.
8. Publicar depois do período de avaliação do recrutador e observar erros no Firebase.

## Observação
As regras candidatas em seguranca/firestore.rules.proposta NÃO são regras ativas.
Não sobrescrever firebase/firestore.rules até concluir a configuração de claims e os testes.
