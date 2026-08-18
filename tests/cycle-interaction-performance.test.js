"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const app = fs.readFileSync(path.resolve(__dirname, "..", "app.js"), "utf8");

const inputStart = app.indexOf('els.scheduleWrap.addEventListener("input"');
const inputEnd = app.indexOf('els.cycleClosurePanel', inputStart);
const inputHandler = app.slice(inputStart, inputEnd);
assert.ok(inputStart >= 0 && inputEnd > inputStart, "O listener de digitação do ciclo deve existir.");
["renderWeeklyResult", "renderCompleted", "renderReviews", "renderEvolution", "renderContinuePanel", "renderGeneratedSchedule", "scheduleAutoSave", "saveAppStateNow"]
  .forEach((call) => assert.ok(!inputHandler.includes(call), `Digitar no desempenho não deve chamar ${call}.`));

const changeStart = app.indexOf('els.scheduleWrap.addEventListener("change"');
const changeEnd = app.indexOf('els.scheduleWrap.addEventListener("input"', changeStart);
const changeHandler = app.slice(changeStart, changeEnd);
["renderWeeklyResult", "renderCompleted", "renderReviews", "renderEvolution", "renderContinuePanel"]
  .forEach((call) => assert.ok(!changeHandler.includes(call), `Alterar o rascunho não deve recalcular ${call}.`));

const openStart = app.indexOf('const performanceButton = event.target.closest("[data-toggle-performance]")');
const openEnd = app.indexOf('const unitButton = event.target.closest("[data-toggle-unit]")', openStart);
const openHandler = app.slice(openStart, openEnd);
assert.ok(openHandler.includes("renderPerformancePanelOnly(index)"), "O painel deve abrir sem reconstruir a lista do ciclo.");
assert.ok(!openHandler.includes("renderGeneratedSchedule()"), "Abrir desempenho não deve redesenhar todo o ciclo.");

assert.ok(app.includes('.focused-study-modal, .performance-modal, .ql-editor'), "O rascunho de desempenho não deve acionar o autosave global a cada tecla.");
assert.ok(app.includes("let performanceDraft = null;"), "O painel deve manter um rascunho separado do estado salvo.");
assert.ok(app.includes("persist: false,"), "Salvar desempenho deve liberar a interface antes de sincronizar.");

console.log("OK - interações do Ciclo Atual evitam renderizações e salvamentos durante a digitação.");
