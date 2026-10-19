import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const db = read("services/firestore.ts");
const content = read("components/ConteudoWorkspace.tsx");
const contest = read("contexts/ContestContext.tsx");
const questions = read("components/QuestoesWorkspace.tsx");
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
assert.match(packageJson.version, /^\d+\.\d+\.\d+$/, "Versão do package.json inválida");
assert.equal(packageJson.version, read("VERSION").trim(), "VERSION deve corresponder ao package.json");
assert(!content.includes("await deleteContentBlocksByMaterial(material.id)"), "Importação de CSV não deve apagar microblocos automaticamente");
assert(read("app/dashboard/page.tsx").includes("dashboardError"), "Dashboard deve exibir falhas de carregamento");


assert(read("components/MapaAdminWorkspace.tsx").includes("updateTopicEditable("), "Gerenciamento do Mapa-Mestre deve permanecer disponível no modo desenvolvedor");
assert(db.includes("setTopicTreeActiveStatus("), "Retirada reversível por tópico ausente");

assert(questions.includes('selectedDisciplines.includes(q.discipline)') && questions.includes('topicSelectionSet.has(q.topicId)'), "Questões precisam filtrar por múltiplas disciplinas e temas");
assert(questions.includes('Gerar simulado') && questions.includes('toggleSelectedTopic('), "Montagem de simulado misto ausente");
assert(read("components/HierarchyIndex.tsx").includes('hierarchyFocusBanner') && read("components/HierarchyIndex.tsx").includes('Mostrar todos'), "Foco reversível no índice ausente");
assert(content.includes('shortBlocks.length') && content.includes('texto integral do CSV'), "Validação de texto sem contexto ausente");
assert(read("app/api/material-import/route.ts").includes('> 4500'), "PDF ainda está dividindo a teoria em trechos excessivamente curtos");
console.log("Concurseiro CLT v1.5.3: verificações estáticas passaram.");

// Leitor contextual deve ser funcional e preservar vinculos diretos.
const contextual = read("components/ContextualReader.tsx");
const detail = read("app/conteudo/[id]/page.tsx");
assert(contextual.includes('q.contentBlockId === block.id'), "Questões diretas precisam usar o ID do microbloco");
assert(contextual.includes('não têm vínculo direto comprovado'), "Questões relacionadas devem ser identificadas");
assert(contextual.includes('Voltar à teoria') && contextual.includes('Comentário / fundamento'), "Leitura e correção contextual ausentes");
assert(contextual.includes('sessionStorage.setItem(storageKey'), "Posição de leitura deve ser mantida");
assert(detail.includes('addError('), "Erros precisam alimentar o caderno");
const questionDetail = read("app/questoes/[id]/page.tsx");
assert(questionDetail.includes('const contentHref =') && questionDetail.includes('?block=') && questionDetail.includes('href={contentHref}'), "Retorno ao microbloco precisa conservar o ID e linkar para o leitor");
console.log("Leitor contextual: 6 verificações adicionais passaram.");

// Separação de interface na v1.5.2: não executar operações administrativas no Modo Estudos.
assert(read("components/Sidebar.tsx").includes('"/configuracoes"') && !read("components/Sidebar.tsx").includes('["/gerenciar-mapa"'), "Gerenciar mapa não pode permanecer no menu de estudos");
assert(read("components/ConteudoWorkspace.tsx").includes('isDeveloper && <section className="panel managementHub"'), "Gestão de conteúdo precisa ser exclusiva do Modo Desenvolvedor");
assert(read("components/QuestoesWorkspace.tsx").includes('isDeveloper && <label className="actionButton fileButton"'), "Importação de questões precisa ficar no Modo Desenvolvedor");
assert(read("components/MapaIndexWorkspace.tsx").includes('developer && showManual'), "Cadastro manual do mapa precisa ficar no Modo Desenvolvedor");
assert(read("components/DeveloperGate.tsx").includes('isDeveloperSession(user.uid)'), "Modo desenvolvedor precisa de entrada explícita");
assert(read("app/desenvolvedor/auditoria/page.tsx").includes('Nenhum item será apagado'), "Auditoria precisa ser somente de leitura");
console.log("Separação entre Modo Estudos e Desenvolvedor: 6 verificações passaram.");

// v1.5.3 — alterações visuais não podem remover os vínculos, navegação ou separação dos modos.
assert(contextual.includes('mode === "pdf"') && contextual.includes('contextPdfPane') && contextual.includes('getDownloadURL('), "Visualizador contextual de PDF ausente");
assert(contextual.includes('mode === "resumo"') && contextual.includes('não tem um resumo validado'), "Resumo não validado deve ser sinalizado explicitamente");
assert(read("components/Sidebar.tsx").includes('secondaryLinks.map(renderLink)') && read("components/Sidebar.tsx").includes('"/configuracoes"'), "Navegação de ferramentas ou Configurações perdida");
assert(read("app/globals.css").includes('contextReader.withPdf') && read("app/globals.css").includes('sidebarMore'), "Estilos responsivos de navegação e PDF ausentes");
assert(read("app/layout.tsx").includes('Concurseiro CLT'), "Título da aplicação incorreto");
console.log("UI v1.5.3: 5 verificações adicionais passaram.");

// Leitor v1.5.4: valida integração sem alterar dados persistidos.
const readerSource = read('components/ContinuousReader.tsx');
assert.ok(readerSource.includes('buildReadingSections'), 'Leitor contínuo sem agrupamento de seções.');
assert.ok(readerSource.includes('onFinishSection'), 'Leitor contínuo sem conclusão de seção.');
assert.ok(read("app/conteudo/[id]/page.tsx").includes("getContentBlocksByTopicIds(childIds)"), "O tema principal deve carregar a teoria dos subtópicos.");
console.log('Leitor contínuo: estruturas verificadas.');
