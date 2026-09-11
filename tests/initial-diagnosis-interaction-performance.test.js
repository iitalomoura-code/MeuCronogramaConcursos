"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const app = fs.readFileSync(path.resolve(__dirname, "..", "app.js"), "utf8");
const handlerStart = app.indexOf('els.initialDiagnosisList?.addEventListener("change"');
const handlerEnd = app.indexOf('els.initialDiagnosisList?.addEventListener("click"', handlerStart);
const handler = app.slice(handlerStart, handlerEnd);

assert.ok(app.includes("function updateInitialDiagnosisSubjectNotice"), "A autoavaliação precisa atualizar apenas o texto da matéria escolhida.");
assert.ok(app.includes('data-diagnosis-notice'), "A linha deve expor uma região pequena para atualização local.");
assert.ok(handler.includes('setInitialDiagnosisLevel(row.dataset.diagnosisSubject, input.value, { save: false })'), "A escolha individual não deve disparar persistência síncrona.");
assert.ok(handler.includes("updateInitialDiagnosisSubjectNotice(row)"), "A escolha individual deve atualizar somente sua própria linha.");
assert.ok(handler.includes("scheduleAutoSave()"), "A persistência deve continuar em segundo plano.");
assert.ok(!handler.includes("renderInitialDiagnosis()"), "Uma escolha individual não pode reconstruir os temas e os resumos históricos da página inteira.");

console.log("OK - autoavaliação individual atualiza somente a linha escolhida.");
