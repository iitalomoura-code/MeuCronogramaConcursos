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
assert.ok(app.includes('console.error("Falha ao restaurar planejamento:", error)'), "Falhas de restauração devem ser registradas no console.");
assert.ok(app.includes("const horas = entries.reduce"), "A métrica de tempo deve retornar a variável correta.");
assert.ok(app.includes("const restoredImmediately = restoredFromCloudCache || restoreAppState({ preserveDataSource: true, preferCloudCache: false })"), "O F5 deve restaurar o snapshot local enquanto a nuvem é consultada.");
assert.ok(app.includes("if (!loadedFromCloud && (state.dataSource === \"cloud-empty\" || !restoredImmediately))"), "A recuperação legada deve respeitar o estado restaurado imediatamente.");
const appStart = app.slice(app.indexOf("async function startMeuCronogramaApp"));
assert.ok(appStart.indexOf("scheduleKnowledgeBaseBootstrap();") > appStart.indexOf("initializeCloudPlanSource().then"), "O bootstrap pesado deve começar depois da recuperação da fonte principal.");

console.log("OK - inicialização restaura painéis independentemente e preserva a aba salva.");
