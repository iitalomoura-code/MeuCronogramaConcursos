"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
const moduleFiles = [
  "js/diagnostic-confidence.js",
  "js/readiness.js",
  "js/ai-strategic-snapshot.js",
  "js/ai-coach-client.js",
  "js/ai-coach-cycle-target.js",
  "js/ai-coach-checkpoint.js",
  "js/ai-coach-delta.js",
  "js/ai-coach-memory.js",
];

const appPosition = index.indexOf("app.js?v=20260912-ai-coach-local-dependencies");
let previousPosition = -1;
for (const file of moduleFiles) {
  const position = index.indexOf(file);
  assert.ok(position >= 0 && position < appPosition, `${file} deve carregar antes de app.js`);
  assert.ok(position > previousPosition, `${file} deve respeitar a ordem de dependências`);
  previousPosition = position;
}

const browser = { console };
browser.window = browser;
browser.globalThis = browser;
vm.createContext(browser);
for (const file of moduleFiles) {
  vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), browser, { filename: file });
}

assert.equal(typeof browser.AIStrategicSnapshot?.buildStrategicSnapshot, "function");
assert.equal(typeof browser.AIStrategicCoachClient?.checkProgress, "function");
assert.equal(typeof browser.AIStrategicCoachClient?.ask, "function");
assert.equal(typeof browser.AIStrategicCoachClient?.analyzeCycle, "function");

const engineSnapshot = browser.AIStrategicSnapshot.buildStrategicSnapshot({
  now: "2026-09-12T00:00:00.000Z",
  exam: { name: "Concurso", role: "Analista", board: "FGV" },
  subjects: [{ name: "Português", topicCount: 1 }],
  topics: [{
    subject: "Português",
    topic: "Pontuação",
    diagnosis: { level: "attention", accuracy: .6, questions: 20, sessionCount: 3 },
    currentEvidence: { questions: 20, correctAnswers: 12, sessions: 3, studiedMinutes: 90 },
    strategic: { score: .7, rank: 1, learningState: { key: "reinforcement" } },
  }],
  weeklyCycle: { plannedMinutes: 600, executedMinutes: 120 },
});
assert.ok(engineSnapshot && engineSnapshot.signature, "um planejamento válido deve gerar snapshot serializável");

const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const adapterStart = app.indexOf("function buildCurrentAIStrategicSnapshot");
const adapterEnd = app.indexOf("function strategicAdvisorModel", adapterStart);
const adapterSource = app.slice(adapterStart, adapterEnd);
const adapterRuntime = {
  window: { AIStrategicSnapshot: { buildStrategicSnapshot: (input) => ({ ...input, built: true }) } },
  Map,
  state: { cycleHistory: [], planningBase: { materias: [{ materia: "Português", assuntos: [{ assunto: "Pontuação" }] }] }, generatedBlocks: [], reviews: [] },
  scheduleConfig: () => ({ concurso: "Concurso", cargo: "Analista", banca: "FGV", horasSemana: 10 }),
  strategicPlanningTopics: () => [{ materia: "Português", assunto: "Pontuação", diagnosis: {}, strategic: {}, errorSignals: {}, initialProfile: {} }],
  aiStrategicRankMap: () => new Map([[0, 1]]),
  previousStrategicAdvisorSnapshot: () => null,
  adaptivePerformanceForTopic: () => [],
  entryContactDateValue: () => 0,
  weeklyStudyCycleSummary: () => ({}),
  isStrategicPlanSessionBlock: () => false,
  weeklyStudyCycleApi: () => ({ recordedMinutes: () => 0 }),
  weeklyBlockKey: () => "block",
  topicMatches: () => false,
  previousStrategicAdvisorTopics: () => [],
};
vm.createContext(adapterRuntime);
vm.runInContext(`${adapterSource}; globalThis.build = buildCurrentAIStrategicSnapshot;`, adapterRuntime);
assert.equal(adapterRuntime.build({ now: "2026-09-12T00:00:00.000Z" }).built, true, "ciclo atual sem ciclo anterior deve gerar snapshot");
adapterRuntime.state.cycleHistory = [{ savedAt: "2026-09-05T00:00:00.000Z" }];
assert.equal(adapterRuntime.build({ now: "2026-09-12T00:00:00.000Z" }).built, true, "histórico de planejamento não impede o snapshot");
assert.deepEqual(adapterRuntime.state.reviews, [], "a primeira análise não exige review anterior do Coach");

console.log("OK - módulos do AI Coach carregam na ordem do navegador e o snapshot local permanece disponível.");
