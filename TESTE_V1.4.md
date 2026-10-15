# Checklist de validação — Projeto Fazenda v1.4

Faça os testes nesta ordem. Se algo falhar, anote a tela, a ação feita e a mensagem do console/navegador.

## 1. Preparação
- [ ] Copiar `.env.local` da v1.3 para a raiz da v1.4.
- [ ] `npm install` concluir sem erro.
- [ ] Publicar `firebase/firestore.rules`.
- [ ] Publicar `firebase/storage.rules`.
- [ ] Rodar `npm run dev`.
- [ ] Fazer login normalmente.

## 2. Dashboard
- [ ] “Seu dia” aparece no topo.
- [ ] Botão **Iniciar** abre o destino correto.
- [ ] Testar 10, 20, 30 e 60 min em “Tenho alguns minutos agora”.
- [ ] Conferir “Continuar de onde parei”.
- [ ] Abrir cards Cobertura, Domínio, Evidência e Erros.
- [ ] Abrir “Se a prova fosse amanhã”.

## 3. Responsividade
- [ ] Abrir DevTools e testar largura de celular.
- [ ] Menu lateral vira menu recolhível.
- [ ] Não há elementos críticos cortados.
- [ ] Questões continuam confortáveis de responder.
- [ ] Drawers continuam utilizáveis no celular.

## 4. Questões
- [ ] Importar o CSV já conhecido que funcionava na v1.3.
- [ ] Importar `MODELO_IMPORTACAO_QUESTOES.csv` como teste opcional.
- [ ] Salvar/restaurar filtro.
- [ ] Iniciar uma bateria.
- [ ] Navegar Anterior/Próxima.
- [ ] Responder uma questão marcando “Sabia”.
- [ ] Responder outra com “Entre duas” ou “Chutei”.
- [ ] Conferir que domínio/evidência são atualizados.

## 5. Regra 3/3 do Caderno de Erros
- [ ] Errar deliberadamente uma questão: item deve entrar ativo em 0/3.
- [ ] Refazer e acertar: 1/3.
- [ ] Acertar novamente: 2/3.
- [ ] Acertar pela terceira vez: 3/3 e Consolidado.
- [ ] O item continua visível na lista completa.
- [ ] Errar de novo: volta a ativo e 0/3.

## 6. Edital
- [ ] Abrir Edital e conferir as cinco abas.
- [ ] Importar um CSV.
- [ ] Conferir preview antes de publicar.
- [ ] Publicar uma versão.
- [ ] Importar uma segunda versão de teste e conferir comparação.
- [ ] Editar manualmente um tópico.
- [ ] Conferir leis detectadas.

## 7. Material PDF e microblocos
- [ ] Importar um PDF de aula pequeno/médio.
- [ ] Conferir os microblocos sugeridos.
- [ ] Conferir os vínculos ao Mapa-Mestre antes de salvar.
- [ ] Abrir um conteúdo com microblocos.
- [ ] Marcar Fácil/Médio/Difícil.
- [ ] Avançar um bloco e sair da página.
- [ ] Voltar e verificar retomada do ponto.
- [ ] Responder uma questão entre blocos.

## 8. Lei Seca
- [ ] Abrir Lei → Artigo → Dispositivo.
- [ ] Conferir que “Revisões pendentes” não mostra todos os dispositivos não estudados.
- [ ] Abrir questões de um artigo.
- [ ] Conferir se links antigos da Lei 8.112 ainda abrem.

## 9. Mapa-Mestre e Revisão
- [ ] Conferir status: pendente, em andamento, revisão, frágil e dominado.
- [ ] Usar “Próximo pendente”.
- [ ] Abrir Revisão do Almoço.
- [ ] Conferir erros ativos e progresso 0/3–3/3.

## 10. Reta final
- [ ] No Planejador, alternar entre Normal e Reta Final.
- [ ] Gerar plano e verificar maior presença de questões/revisões no modo Reta Final.

## Critério para começarmos a carga grande no feriado
Só começar a importação massiva depois de: login, regras Firebase, importação de questões, bateria, Caderno de Erros 3/3, filtros e Mapa-Mestre estarem estáveis. Edital PDF e material PDF podem receber ajustes finos depois sem bloquear a carga de questões.
