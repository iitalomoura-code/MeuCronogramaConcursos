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

for (const value of [1, 2, 3, 4, 5, 4, 3, 2, 4, 5, 4, 3, 2, 1, 2, 3, 4, 5, 4, 5]) runtime.apply(0, "peso", value);
assert.equal(runtime.state.planningBase.materias[0].peso, 5, "dez cliques preservam o último valor imediatamente.");
assert.equal(priorityRowUpdates, 20, "cada clique atualiza somente a linha afetada.");
assert.equal(scheduledAutoSaves.length, 20, "cada alteração agenda persistência sem aguardar a rede.");
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
for (const value of [1, 2, 3, 4, 5, 4, 3, 2, 4, 5, 4, 3, 2, 1, 2, 3, 4, 5, 4, 5]) largeRuntime.apply(12, "dominio", value);
assert.equal(largeRuntime.state.planningBase.materias[12].dominio, 5, "a sequência rápida no planejamento com 13 matérias e 143 temas preserva o último clique.");
assert.ok(!applySource.includes("explainPriority("), "a explicação adaptativa não pode executar dentro do clique crítico.");
assert.ok(!applySource.includes("adaptivePriorityAdjustment("), "o clique crítico não pode executar diagnóstico adaptativo.");

const clickBenchmarkStartedAt = performance.now();
for (let click = 0; click < 20; click += 1) largeRuntime.apply(12, "peso", (click % 5) + 1);
const clickBenchmarkMs = performance.now() - clickBenchmarkStartedAt;
assert.ok(clickBenchmarkMs < 100, `vinte alterações da matéria isolada devem concluir abaixo de 100 ms no teste de regressão; obtido: ${clickBenchmarkMs.toFixed(2)} ms.`);

const schedulerSource = between("function scheduleCloudSave", "async function flushCloudSave");
const scheduled = [];
const saveCalls = [];
const schedulerRuntime = {
  CLOUD_SAVE_DELAY: 900,
  PRIORITY_CLOUD_SAVE_DELAY: 2500,
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
for (let index = 0; index < 20; index += 1) schedulerRuntime.schedule("Salvo", { source: "priority" });
const pending = scheduled.filter((timer) => !timer.cleared);
assert.equal(pending.length, 1, "vinte cliques rápidos criam uma única gravação remota pendente.");
assert.equal(pending[0].delay, 2500, "a prioridade aguarda uma janela de inatividade antes de salvar.");
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

const captureSource = between("function captureAppState", "function resetPlanningAccess");
const sliderSource = between("function syncPlanningSliders", "function priorityScore");
assert.ok(captureSource.includes('!["priority", "exam-structure"].includes(source)') && captureSource.includes("priorityCaptureSkippedControls"), "snapshots incrementais não relêem os controles da aba de pesos.");
assert.ok(sliderSource.includes("targetIndex") && !sliderSource.includes("materias.forEach"), "a sincronização de sliders aceita atualização incremental sem recalcular todas as matérias.");
assert.ok(app.includes("PRIORITY_CLOUD_SAVE_DELAY = 2500"), "prioridade deve esperar a sequência de cliques terminar antes de preparar o snapshot.");
assert.ok(app.includes("PRIORITY_DERIVED_DELAY = 3200"), "resumo e explicação não podem disputar o thread principal logo após o último clique.");

let scoreCalls = 0;
const sliderRuntime = {
  state: { planningBase: { materias: largeSubjects.map((subject) => ({ ...subject })) } },
  document: {
    querySelectorAll: (selector) => {
      const match = selector.match(/data-plan="(\d+)"/);
      if (!match) return [];
      return [{ dataset: { field: "peso" }, value: String(Number(match[1]) % 5 + 1) }];
    },
    querySelector: () => null,
  },
  priorityPerformanceMeasure: (_label, work) => work(),
  priorityScore: () => { scoreCalls += 1; return .6; },
  priorityInfo: () => ({ label: "Média", className: "medium", percent: 60 }),
};
vm.createContext(sliderRuntime);
vm.runInContext(`${sliderSource}; this.sync = syncPlanningSliders;`, sliderRuntime);
sliderRuntime.sync({ index: 12 });
assert.equal(scoreCalls, 1, "a sincronização incremental recalcula somente a matéria alterada; o caminho anterior recalculava as 13 matérias.");

assert.ok(app.includes("priorityRevisionAtRequest") && app.includes("priorityConfirmedRevision"), "a confirmação acompanha a revisão enviada e não descarta alterações mais novas.");
assert.ok(app.includes("supabaseRequests") && app.includes("lastPayloadBytes"), "métricas locais registram chamadas, duração e tamanho do payload sem conteúdo sensível.");
assert.ok(app.includes("window.lucide.createIcons(els.planningGrid)"), "a atualização completa da grade limita os ícones ao próprio painel.");

console.log(`OK - 20 cliques em planejamento com 13 matérias/143 temas permaneceram abaixo de 100 ms (${clickBenchmarkMs.toFixed(2)} ms), geraram uma única gravação pendente e preservaram a revisão mais nova.`);
