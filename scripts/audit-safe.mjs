import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const db = read("services/firestore.ts");
const content = read("app/conteudo/page.tsx");
const contest = read("contexts/ContestContext.tsx");
const questions = read("app/questoes/page.tsx");
const packageJson = JSON.parse(read("package.json"));
const ensureUser = db.slice(db.indexOf("export async function ensureUser("), db.indexOf("export async function getActiveContestId("));
const importTopics = db.slice(db.indexOf("export async function importEditalRows("), db.indexOf("export async function addStudySession("));
const deleteDiscipline = db.slice(db.indexOf("export async function deleteUnusedDiscipline("), db.indexOf("export async function renameContestDiscipline("));
assert(!ensureUser.includes("activeContestId: DEFAULT_CONTEST"), "Login não deve reescrever concurso ativo");
assert(!ensureUser.includes("studySettings: DEFAULT_SETTINGS"), "Login não deve reescrever preferências");
assert(!importTopics.includes("rows.slice(0, 450)"), "Mapa-mestre não pode descartar linhas > 450");
assert(importTopics.includes("offset += 350"), "Mapa-mestre exige importação em lotes");
assert(importTopics.includes("ID duplicado"), "Mapa-mestre exige validação de IDs");
assert(db.includes("scopedId(contestId, block.id)"), "Progresso de microblocos deve ser por concurso");
assert(db.includes("renameContestDiscipline("), "Padronização de nomes ausente");
assert(db.includes("clearReadCache("), "Invalidação de cache ausente");
assert(deleteDiscipline.includes("limit(1)"), "Exclusão não deve baixar coleções inteiras");
assert(content.includes("Padronizar nome") && content.includes("Retirar do concurso"), "Gerenciamento das disciplinas ausente");
assert(questions.includes("activeDisciplineSet.has(q.discipline)"), "Disciplinas retiradas devem ser ocultas do caderno de questões");
assert(contest.includes("error: string | null"), "Falha de leitura deve ser explicitada");
assert.equal(packageJson.version, "1.5.0");
assert(!content.includes("await deleteContentBlocksByMaterial(material.id)"), "Importação de CSV não deve apagar microblocos automaticamente");
assert(read("app/dashboard/page.tsx").includes("dashboardError"), "Dashboard deve exibir falhas de carregamento");


assert(read("app/mapa-mestre/page.tsx").includes("onManageAction={openManage}"), "Mapa-Mestre deve permitir editar e excluir da lista");
assert(db.includes("setTopicTreeActiveStatus("), "Retirada reversível por tópico ausente");

assert(questions.includes('selectedDisciplines.includes(q.discipline)') && questions.includes('topicSelectionSet.has(q.topicId)'), "Questões precisam filtrar por múltiplas disciplinas e temas");
assert(questions.includes('Gerar simulado') && questions.includes('toggleSelectedTopic('), "Montagem de simulado misto ausente");
assert(read("components/HierarchyIndex.tsx").includes('hierarchyFocusBanner') && read("components/HierarchyIndex.tsx").includes('Mostrar todos'), "Foco reversível no índice ausente");
assert(content.includes('shortBlocks.length') && content.includes('texto integral do CSV'), "Validação de texto sem contexto ausente");
assert(read("app/api/material-import/route.ts").includes('> 4500'), "PDF ainda está dividindo a teoria em trechos excessivamente curtos");
console.log("Projeto Fazenda v1.5.0: 20 verificações estáticas passaram.");
