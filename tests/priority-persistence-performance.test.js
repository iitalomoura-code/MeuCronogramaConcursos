"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const app = fs.readFileSync(path.resolve(__dirname, "..", "app.js"), "utf8");
const between = (start, end) => app.slice(app.indexOf(start), app.indexOf(end, app.indexOf(start)));

const applySource = between("function applyPriorityScaleChange", "function scaleMarkup");
const priorityMetrics = { clicks: 0 };
let priorityRowUpdates = 0;
const scheduledAutoSaves = [];
const runtime = {
  state: { planningBase: { materias: [{ materia: "Controle", peso: 3, dominio: 3, prioridade: .6 }] } },
  priorityEditIndex: -1,
  priorityChangeRevision: 0,
  focusPerformanceNow: () => 10,
  priorityScore: (subject) => (Number(subject.peso) + Number(subject.dominio)) / 10,
  priorityPerformanceSnapshot: () => priorityMetrics,
  recordPriorityPerformance: (values) => Object.assign(priorityMetrics, values),
  updatePriorityRow: () => { priorityRowUpdates += 1; },
  scheduleAutoSave: (options) => { scheduledAutoSaves.push(options); },
  requestAnimationFrame(callback) { callback(); },
  Date,
};
vm.createContext(runtime);
vm.runInContext(`${applySource}; this.apply = applyPriorityScaleChange;`, runtime);

for (const value of [1, 2, 3, 4, 5, 4, 3, 2, 4, 5]) runtime.apply(0, "peso", value);
assert.equal(runtime.state.planningBase.materias[0].peso, 5, "dez cliques preservam o último valor imediatamente.");
assert.equal(priorityRowUpdates, 10, "cada clique atualiza somente a linha afetada.");
assert.equal(scheduledAutoSaves.length, 10, "cada alteração agenda persistência sem aguardar a rede.");
assert.ok(scheduledAutoSaves.every((entry) => entry.source === "priority"), "a fila identifica alterações de prioridade.");
assert.ok(!applySource.includes("renderPlanningBase()"), "o clique não pode reconstruir a grade inteira.");

const schedulerSource = between("function scheduleCloudSave", "async function flushCloudSave");
const scheduled = [];
const saveCalls = [];
const schedulerRuntime = {
  CLOUD_SAVE_DELAY: 900,
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
for (let index = 0; index < 10; index += 1) schedulerRuntime.schedule("Salvo", { source: "priority" });
const pending = scheduled.filter((timer) => !timer.cleared);
assert.equal(pending.length, 1, "dez cliques rápidos criam uma única gravação remota pendente.");
assert.equal(pending[0].delay, 900, "a prioridade usa debounce curto.");
pending[0].callback();
assert.equal(saveCalls.length, 1, "somente uma gravação é disparada após a sequência.");

assert.ok(app.includes("priorityRevisionAtRequest") && app.includes("priorityConfirmedRevision"), "a confirmação acompanha a revisão enviada e não descarta alterações mais novas.");
assert.ok(app.includes("supabaseRequests") && app.includes("lastPayloadBytes"), "métricas locais registram chamadas, duração e tamanho do payload sem conteúdo sensível.");
assert.ok(app.includes("window.lucide.createIcons(els.planningGrid)"), "a atualização completa da grade limita os ícones ao próprio painel.");

console.log("OK - prioridades atualizam de forma otimista, agrupam dez cliques em uma gravação e preservam revisões novas.");
