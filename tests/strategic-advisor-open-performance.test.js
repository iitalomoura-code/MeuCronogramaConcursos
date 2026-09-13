"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const app = fs.readFileSync(path.resolve(__dirname, "..", "app.js"), "utf8");
const styles = fs.readFileSync(path.resolve(__dirname, "..", "styles.css"), "utf8");
const section = (start, end) => app.slice(app.indexOf(start), app.indexOf(end, app.indexOf(start)));

const shell = section("function strategicAdvisorShellMarkup", "function strategicAdvisorDialogMarkup");
assert.ok(shell.includes("Carregando sua análise estratégica"), "O shell do modal deve comunicar carregamento imediatamente.");
assert.ok(shell.includes('aria-busy="true"'), "O shell deve expor o estado de carregamento para leitores de tela.");

const open = section("function openStrategicAdvisorModal", "function closeStrategicAdvisorModal");
assert.ok(open.indexOf("els.strategicAdvisorModal.hidden = false") < open.indexOf("yieldForPaint"), "O modal precisa aparecer antes de qualquer cálculo adiado.");
assert.ok(!open.includes("strategicAdvisorModel()"), "A abertura do shell não pode calcular o Orientador no clique.");
assert.ok(!open.includes("renderContinuePanel") && !open.includes("switchTab") && !open.includes("scroll"), "Abrir o Orientador não pode reconstruir Continuar, trocar de aba ou deslocar a página.");
assert.ok(!open.includes("AIStrategicCoachClient") && !open.includes("loadAICoachHistory"), "Abrir o Orientador não pode chamar provider nem carregar histórico do Coach.");
assert.ok(open.includes('yieldForPaint({ frames: 2 })'), "A abertura precisa aguardar dois frames antes do primeiro cálculo pesado.");
assert.ok(!open.includes("invalidateDerivedStudyCaches"), "Abrir o Orientador não pode invalidar cache estratégico.");
assert.ok(open.includes("renderStrategicAdvisorPersistedCoachPreview"), "Reviews persistidos do Coach devem aparecer já no shell, sem esperar o diagnóstico local.");

const coachMarkup = section("function aiCoachMarkup", "async function loadAICoachHistory");
assert.ok(!coachMarkup.includes("buildCurrentAIStrategicSnapshot") && !coachMarkup.includes("AICoachDelta?.compare"), "A marcação inicial do Coach não pode gerar snapshot nem delta pesado.");
assert.ok(coachMarkup.includes("data-ai-coach-content"), "A seção do Coach deve poder ser atualizada isoladamente.");

const content = section("function renderStrategicAdvisorContent", "function openStrategicAdvisorModal");
assert.ok(content.includes("strategicAdvisorModelForModal") && content.includes("await yieldForPaint()"), "O modelo deve ser montado em uma etapa cooperativa, com pintura entre as seções.");
assert.ok(content.includes('"strategic advisor history"') && content.includes('"strategic advisor evolution"'), "O conteúdo do Orientador deve manter etapas de perfil separadas.");
assert.ok(content.includes('"AI Coach markup"') && content.includes('"DOM replacement"') && content.includes('"renderLucideIcons"'), "A montagem do Coach, DOM e ícones deve permanecer mensurável.");
assert.ok(content.includes("body.innerHTML") && !content.includes("els.strategicAdvisorModal.innerHTML = markup"), "O shell do modal deve ser preservado enquanto apenas o conteúdo interno é atualizado.");

const coachContext = section("function scheduleStrategicAdvisorCoachContext", "function renderStrategicAdvisorContent");
assert.ok(coachContext.includes("requestIdleCallback") && coachContext.includes("buildCurrentAIStrategicSnapshot") && coachContext.includes("AICoachDelta?.compare"), "Snapshot e delta do Coach devem rodar apenas na etapa secundária e ociosa.");
assert.ok(coachContext.indexOf("if (aiCoachUIState.selectedReviewId)") < coachContext.indexOf("buildCurrentAIStrategicSnapshot"), "Abrir uma análise histórica não pode montar snapshot ou delta atual.");

const persistedCoachPreview = section("function renderStrategicAdvisorPersistedCoachPreview", "function scheduleStrategicAdvisorCoachContext");
assert.ok(persistedCoachPreview.includes("aiCoachMarkup") && !persistedCoachPreview.includes("buildCurrentAIStrategicSnapshot") && !persistedCoachPreview.includes("AICoachDelta?.compare"), "O preview de histórico do Coach deve usar apenas a revisão persistida, sem cálculo atual.");

const model = section("async function strategicAdvisorModelForModal", "function strategicAdvisorItems");
assert.ok(model.includes('"strategicPlanningTopics"') && model.includes('"strategicAdvisorModel build"'), "A instrumentação deve separar o custo dos tópicos estratégicos do build do Orientador.");
assert.ok(model.includes("strategicAdvisorModelCache") && model.includes("strategicAdvisorModelBuildPromise"), "O modal deve reutilizar o cache ou o build já em andamento quando a evidência não mudou.");

const paint = section("function yieldForPaint", "async function saveAppStateNow");
assert.ok(paint.includes("requestAnimationFrame") && paint.includes("remainingFrames"), "O yield de abertura deve ceder frames reais ao navegador.");
assert.ok(styles.includes(".strategic-advisor-loading :is(i, svg)") && styles.includes("strategic-advisor-spin"), "O ícone Lucide convertido em SVG deve manter a animação do loader.");

console.log("OK - o shell do Orientador abre antes dos cálculos estratégicos e o Coach é preenchido depois.");
