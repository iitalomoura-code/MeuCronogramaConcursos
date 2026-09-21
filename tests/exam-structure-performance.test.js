"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const app = fs.readFileSync(path.resolve(__dirname, "..", "app.js"), "utf8");
const between = (start, end) => app.slice(app.indexOf(start), app.indexOf(end, app.indexOf(start)));

const applyStart = app.indexOf("function applyExamStructureInput");
const applyEnd = app.indexOf("\n}\n\nfunction priorityReason", applyStart) + 2;
const applySource = app.slice(applyStart, applyEnd);
assert.ok(!applySource.includes("renderPlanningBase()"), "digitar questões ou peso não pode reconstruir a grade de prioridades.");
assert.ok(!applySource.includes("refreshExamImportance()"), "o cálculo de todas as matérias deve ficar fora do evento de digitação.");

const subjects = Array.from({ length: 13 }, (_, index) => ({
  materia: `Matéria ${index + 1}`,
  peso: 3,
  dominio: 3,
  examImportance: { questionCount: 10, weight: 1 },
  assuntos: Array.from({ length: 11 }, (_, topicIndex) => `Tema ${topicIndex + 1}`),
}));
let refreshes = 0;
const saves = [];
const runtime = {
  state: { planningBase: { materias: subjects } },
  Number,
  Math,
  scheduleExamStructureRefresh: () => { refreshes += 1; },
  scheduleAutoSave: (options) => saves.push(options),
};
vm.createContext(runtime);
vm.runInContext(`${applySource}; this.apply = applyExamStructureInput;`, runtime);

for (let value = 1; value <= 20; value += 1) {
  runtime.apply({ dataset: { examStructure: "7", examField: "questionCount" }, value: String(value) });
}
assert.equal(runtime.state.planningBase.materias[7].examImportance.questionCount, 20, "a última quantidade digitada fica no estado em memória.");
assert.equal(runtime.state.planningBase.materias[0].examImportance.questionCount, 10, "a digitação não altera outra matéria.");
assert.equal(refreshes, 20, "cada tecla apenas reinicia a janela de cálculo ocioso.");
assert.equal(saves.length, 20, "cada tecla apenas reinicia a janela de sincronização remota.");
assert.ok(saves.every((entry) => entry.source === "exam-structure" && entry.invalidate === false), "a estrutura usa persistência incremental sem limpar todos os caches no evento.");

const schedulerSource = between("function scheduleCloudSave", "async function flushCloudSave");
const scheduled = [];
const saveCalls = [];
const schedulerRuntime = {
  CLOUD_SAVE_DELAY: 900,
  PRIORITY_CLOUD_SAVE_DELAY: 2500,
  EXAM_STRUCTURE_CLOUD_SAVE_DELAY: 2500,
  cloudSaveTimer: 0,
  cloudSavePromise: null,
  cloudSaveQueued: false,
  cloudSaveSource: "",
  isRestoring: false,
  cloudIsPrimary: () => true,
  markUnsavedChanges() {},
  updateSaveStatus() {},
  setTimeout: (callback, delay) => { const token = { callback, delay, cleared: false }; scheduled.push(token); return token; },
  clearTimeout: (token) => { if (token) token.cleared = true; },
  saveAppStateNow: (label, options) => { saveCalls.push({ label, options }); },
};
vm.createContext(schedulerRuntime);
vm.runInContext(`${schedulerSource}; this.schedule = scheduleCloudSave;`, schedulerRuntime);
for (let index = 0; index < 20; index += 1) schedulerRuntime.schedule("Salvo", { source: "exam-structure" });
const pending = scheduled.filter((timer) => !timer.cleared);
assert.equal(pending.length, 1, "vinte alterações de estrutura mantêm uma única gravação pendente.");
assert.equal(pending[0].delay, 2500, "a estrutura aguarda o usuário terminar de digitar antes de salvar.");
pending[0].callback();
assert.equal(saveCalls.length, 1, "o debounce dispara um único snapshot final.");
assert.equal(saveCalls[0].label, "Salvo", "a gravação mantém o rótulo esperado.");
assert.equal(saveCalls[0].options.source, "exam-structure", "o snapshot final recebe a origem incremental.");

const listeners = between('els.examStructureGrid?.addEventListener("input"', "els.planningGrid.addEventListener");
assert.ok(!listeners.includes("renderPlanningBase"), "os listeners da estrutura não podem reconstruir a página durante a edição.");
const captureSource = between("function captureAppState", "function resetPlanningAccess");
assert.ok(captureSource.includes('!["priority", "exam-structure"].includes(source)'), "o snapshot da estrutura não relê sliders de todas as matérias.");
const globalSaveSource = between("function shouldUseGlobalAutoSave", "function restoreAppState");
assert.ok(globalSaveSource.includes("#examStructureGrid"), "o autosave global não pode duplicar a gravação da estrutura.");

console.log("OK - 20 edições da estrutura em planejamento com 13 matérias/143 temas atualizam só o campo alvo e deixam uma única gravação após 2,5 s de inatividade.");
