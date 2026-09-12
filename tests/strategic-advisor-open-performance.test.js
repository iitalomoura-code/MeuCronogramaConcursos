"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const app = fs.readFileSync(path.resolve(__dirname, "..", "app.js"), "utf8");
const section = (start, end) => app.slice(app.indexOf(start), app.indexOf(end, app.indexOf(start)));

const shell = section("function strategicAdvisorShellMarkup", "function strategicAdvisorDialogMarkup");
assert.ok(shell.includes("Carregando sua análise estratégica"), "O shell do modal deve comunicar carregamento imediatamente.");
assert.ok(shell.includes('aria-busy="true"'), "O shell deve expor o estado de carregamento para leitores de tela.");

const open = section("function openStrategicAdvisorModal", "function closeStrategicAdvisorModal");
assert.ok(open.indexOf("els.strategicAdvisorModal.hidden = false") < open.indexOf("yieldForInteraction"), "O modal precisa aparecer antes de qualquer cálculo adiado.");
assert.ok(!open.includes("strategicAdvisorModel()"), "A abertura do shell não pode calcular o Orientador no clique.");
assert.ok(!open.includes("renderContinuePanel") && !open.includes("switchTab") && !open.includes("scroll"), "Abrir o Orientador não pode reconstruir Continuar, trocar de aba ou deslocar a página.");
assert.ok(!open.includes("AIStrategicCoachClient") && !open.includes("loadAICoachHistory"), "Abrir o Orientador não pode chamar provider nem carregar histórico do Coach.");

const coachMarkup = section("function aiCoachMarkup", "async function loadAICoachHistory");
assert.ok(!coachMarkup.includes("buildCurrentAIStrategicSnapshot") && !coachMarkup.includes("AICoachDelta?.compare"), "A marcação inicial do Coach não pode gerar snapshot nem delta pesado.");
assert.ok(coachMarkup.includes("data-ai-coach-content"), "A seção do Coach deve poder ser atualizada isoladamente.");

const content = section("function renderStrategicAdvisorContent", "function openStrategicAdvisorModal");
assert.ok(content.includes('"strategic advisor model"') && content.includes('"strategic advisor history"') && content.includes('"strategic advisor evolution"'), "O conteúdo do Orientador deve manter etapas de perfil separadas.");
assert.ok(content.includes('"AI Coach markup"') && content.includes('"render icons"'), "A montagem do Coach e dos ícones deve permanecer mensurável.");

const coachContext = section("function scheduleStrategicAdvisorCoachContext", "function renderStrategicAdvisorContent");
assert.ok(coachContext.includes("requestIdleCallback") && coachContext.includes("buildCurrentAIStrategicSnapshot") && coachContext.includes("AICoachDelta?.compare"), "Snapshot e delta do Coach devem rodar apenas na etapa secundária e ociosa.");

console.log("OK - o shell do Orientador abre antes dos cálculos estratégicos e o Coach é preenchido depois.");
