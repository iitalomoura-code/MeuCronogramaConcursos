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
  ensurePriorityLongTaskObserver() {},
  priorityPerformanceMeasure: (_label, work) => work(),
  priorityScore: (subject) => (Number(subject.peso) + Number(subject.dominio)) / 10,
  priorityPerformanceSnapshot: () => priorityMetrics,
  recordPriorityPerformance: (values) => Object.assign(priorityMetrics, values),
  updatePriorityRow: () => { priorityRowUpdates += 1; },
  invalidatePriorityDerivedCaches() {},
  schedulePriorityExplanationRefresh() {},
  schedulePrioritySummaryRefresh() {},
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
assert.ok(!applySource.includes("invalidateDerivedStudyCaches"), "a prioridade não pode invalidar todos os caches no clique.");

const largeSubjects = Array.from({ length: 13 }, (_, subjectIndex) => ({
  materia: `Matéria ${subjectIndex + 1}`,
  peso: 3,
  dominio: 3,
  prioridade: .6,
  assuntos: Array.from({ length: 11 }, (_, topicIndex) => `Tema ${topicIndex + 1}`),
}));
const largeRuntime = {
  ...runtime,
  state: {
    planningBase: { materias: largeSubjects },
    completedHistory: Array.from({ length: 180 }, (_, index) => ({ materia: `Matéria ${(index % 13) + 1}`, questoes: 10 })),
    reviews: Array.from({ length: 90 }, (_, index) => ({ materia: `Matéria ${(index % 13) + 1}` })),
    errors: Array.from({ length: 70 }, (_, index) => ({ materia: `Matéria ${(index % 13) + 1}` })),
  },
};
vm.createContext(largeRuntime);
vm.runInContext(`${applySource}; this.apply = applyPriorityScaleChange;`, largeRuntime);
for (const value of [1, 2, 3, 4, 5, 4, 3, 2, 4, 5]) largeRuntime.apply(12, "dominio", value);
assert.equal(largeRuntime.state.planningBase.materias[12].dominio, 5, "a sequência rápida no planejamento com 13 matérias e 143 temas preserva o último clique.");
assert.ok(!applySource.includes("explainPriority("), "a explicação adaptativa não pode executar dentro do clique crítico.");
assert.ok(!applySource.includes("adaptivePriorityAdjustment("), "o clique crítico não pode executar diagnóstico adaptativo.");

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

schedulerRuntime.cloudSavePromise = Promise.resolve(true);
schedulerRuntime.cloudSaveQueued = false;
schedulerRuntime.schedule("Salvo", { source: "priority" });
assert.equal(schedulerRuntime.cloudSaveQueued, true, "alterações durante uma requisição são consolidadas para uma única gravação posterior.");

const priorityRowSource = between("function updatePriorityRow", "function priorityExplanationMarkup");
assert.ok(!priorityRowSource.includes("outerHTML"), "a linha não pode substituir o painel inteiro a cada clique.");
assert.ok(priorityRowSource.includes("data-priority-panel-badge") && priorityRowSource.includes("querySelectorAll"), "a linha atualiza somente a seleção e os valores visíveis.");
assert.ok(app.includes("requestIdleCallback") && app.includes("schedulePriorityExplanationRefresh"), "a explicação detalhada é reagendada para o período ocioso.");
assert.ok(app.includes("priorityDerivedCacheRevision") && app.includes("invalidatePriorityDerivedCaches"), "modelos dependentes de prioridade ficam obsoletos sem limpar caches de histórico, revisão ou erros.");

assert.ok(app.includes("priorityRevisionAtRequest") && app.includes("priorityConfirmedRevision"), "a confirmação acompanha a revisão enviada e não descarta alterações mais novas.");
assert.ok(app.includes("supabaseRequests") && app.includes("lastPayloadBytes"), "métricas locais registram chamadas, duração e tamanho do payload sem conteúdo sensível.");
assert.ok(app.includes("window.lucide.createIcons(els.planningGrid)"), "a atualização completa da grade limita os ícones ao próprio painel.");

console.log("OK - prioridades atualizam de forma otimista, agrupam dez cliques em uma gravação e preservam revisões novas.");
