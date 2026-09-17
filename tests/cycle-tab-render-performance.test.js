"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const app = fs.readFileSync(path.resolve(__dirname, "..", "app.js"), "utf8");
const styles = fs.readFileSync(path.resolve(__dirname, "..", "styles.css"), "utf8");
const currentRender = app.slice(app.indexOf("function renderGeneratedSchedule()"), app.indexOf("function renderGeneratedScheduleLegacy()"));
const batchRender = app.slice(app.indexOf("async function appendCycleCardsInBatches"), app.indexOf("function renderGeneratedSchedule()"));

assert.ok(app.includes("function buildCycleViewModel"), "O Ciclo Atual deve montar um modelo visual antes de tocar no DOM.");
assert.ok(app.includes("function cycleGroupKey"), "Os cartões devem ser agrupados nos dados, sem reorganização posterior do DOM.");
assert.ok(!currentRender.includes("organizeCycleBlocksByStatus"), "O render atual não pode inserir e depois mover os mesmos cartões.");
assert.ok(currentRender.includes("cycleRenderedRevision") && currentRender.includes("cacheHit"), "Voltar para a aba sem mudanças deve reutilizar a visualização existente.");
assert.ok(batchRender.includes("CYCLE_RENDER_BATCH_BUDGET_MS") && batchRender.includes("await yieldForPaint()"), "Listas grandes devem ceder ao navegador entre lotes com orçamento de tempo.");
assert.ok(app.includes("window.__cycleRenderPerf") && app.includes("cycleTabClick") && app.includes("cycleInteractive"), "O modo de depuração deve expor a medição do clique até a interatividade.");
assert.ok(styles.includes("content-visibility: auto") && styles.includes("contain-intrinsic-size"), "Cartões fora da área visível devem poder adiar layout e pintura.");

console.log("OK - Ciclo Atual agrupa antes do DOM, reutiliza a revisão visual e renderiza listas por lotes.");
