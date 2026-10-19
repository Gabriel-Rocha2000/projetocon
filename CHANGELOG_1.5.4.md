# Concurseiro CLT — 1.5.4 (prévia)

- Leitor contínuo organizado em seções com subtítulos de conceitos.
- Busca de microblocos pelo materialId, além dos blocos do tópico selecionado.
- PDF original ao lado, quando disponível no Firebase Storage.
- Registro de conclusão por conceito e seção preservando os IDs para revisões.
- CSV de conteúdo aceita secao_id, secao_titulo e secao_ordem.
- Importação interrompida se houver linhas sem vínculo, para evitar descarte silencioso.
- Mantém storagePath do material já cadastrado quando o mesmo materialId é reimportado.

**Sem migração destrutiva do Firestore.** A Aula 00 exige validação dos dados antes de reimportar. Build deve passar no CI e ser testado antes de mesclar.
