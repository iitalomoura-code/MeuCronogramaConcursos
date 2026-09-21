"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const app = fs.readFileSync(path.resolve(__dirname, "..", "app.js"), "utf8");

assert.ok(app.includes("function safeRender"), "A renderização deve ter proteção por painel.");
assert.ok(app.includes("function renderAppViews"), "A aplicação deve renderizar painéis de forma centralizada.");
assert.ok(app.includes('safeRender("Ciclo atual", renderGeneratedSchedule)'), "O ciclo atual deve renderizar independentemente.");
assert.ok(app.includes('safeRender("Continuar", renderContinuePanel, renderContinueError)'), "Continuar deve ter estado de erro localizado.");
assert.ok(app.includes('safeRender("Painel de evolução", renderEvolution, renderEvolutionError)'), "Evolução deve ter estado de erro localizado.");
assert.ok(!app.includes("  renderEvolution();\n  renderContinuePanel();\n\n  if (!state.generatedBlocks.length)"), "O ciclo não deve renderizar painéis secundários antes de montar sua lista.");
assert.ok(app.includes("const restoredTab = setupIsIncomplete()") && app.includes("saved.activeTab"), "A aba válida salva deve ser restaurada ou direcionada à configuração incompleta.");
assert.ok(app.includes("function restoreAppState() { return false; }"), "Planejamentos locais não devem ser restaurados.");
assert.ok(app.includes("const horas = entries.reduce"), "A métrica de tempo deve retornar a variável correta.");
assert.ok(app.includes("void initializeCloudPlanSource().then((loadedFromCloud) =>"), "A abertura deve carregar o planejamento diretamente da nuvem.");
assert.ok(!app.includes("restoreAppState({ cacheOnly: true })"), "A recuperação legada não pode reintroduzir dados locais.");
const appStart = app.slice(app.indexOf("async function startMeuCronogramaApp"));
assert.ok(!appStart.includes("loadAICoachHistory()"), "O histórico do Coach não deve carregar na abertura do cronograma.");
assert.ok(app.includes("function scheduleStartupBackgroundWork") && app.includes('"knowledge base bootstrap"'), "A Base Permanente deve aguardar a fase ociosa posterior à primeira tela.");

console.log("OK - inicialização restaura painéis independentemente e preserva a aba salva.");
