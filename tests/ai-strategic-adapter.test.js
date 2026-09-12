"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.resolve(__dirname, "..", "app.js"), "utf8");
const start = source.indexOf("function aiStrategicTopicIdentity");
const end = source.indexOf("// Public read-only adapter for a future AI boundary.", start);
assert.ok(start >= 0 && end > start, "O seletor temporal do histórico estratégico deve estar isolado no adaptador.");

const snapshots = [
  { createdAt: "2026-08-20T12:00:00.000Z", topics: [{ materia: "Direito", assunto: "A", strategicScore: .3, strategic: { rank: 9 } }] },
  { createdAt: "2026-09-05T12:00:00.000Z", topics: [{ materia: "Direito", assunto: "A", strategicScore: .4, strategic: { rank: 8, learningState: "building" }, diagnosisLevel: "deficiency" }] },
  { createdAt: "2026-09-09T12:00:00.000Z", topics: [{ materia: "Direito", assunto: "A", strategicScore: .9, strategic: { rank: 1, learningState: "recovery" }, diagnosisLevel: "attention" }] },
];
const before = JSON.stringify(snapshots);
const context = vm.createContext({
  console,
  state: { strategicAdvisorSnapshots: snapshots },
  window: {
    StrategicPriorityEngine: {
      buildStrategicStudyQueue(entries) {
        return [...entries]
          .sort((left, right) => Number(right.strategic?.score) - Number(left.strategic?.score))
          .map((entry, index) => ({ ...entry, queueRank: index + 1 }));
      },
    },
  },
});
vm.runInContext(source.slice(start, end), context, { filename: "app.js#ai-strategic-history-adapter" });

const selected = vm.runInContext("previousStrategicAdvisorSnapshot('2026-09-08T00:00:00.000Z')", context);
assert.equal(selected.createdAt, "2026-09-05T12:00:00.000Z", "Deve selecionar o marco criado até o encerramento do ciclo anterior.");
const topics = vm.runInContext("previousStrategicAdvisorTopics({ referenceAt: '2026-09-08T00:00:00.000Z' })", context);
assert.equal(topics[0].strategic.rank, 8, "O estado estratégico persistido deve ser transportado para previousTopics.");
assert.equal(topics[0].diagnosis.masteryLevel, "deficiency");
assert.equal(JSON.stringify(snapshots), before, "Selecionar o histórico não pode mutar snapshots persistidos.");

const onlyFutureContext = vm.createContext({
  console,
  state: { strategicAdvisorSnapshots: [snapshots[2]] },
  window: context.window,
});
vm.runInContext(source.slice(start, end), onlyFutureContext, { filename: "app.js#ai-strategic-history-fallback" });
assert.equal(vm.runInContext("previousStrategicAdvisorSnapshot('2026-09-08T00:00:00.000Z').createdAt", onlyFutureContext), "2026-09-09T12:00:00.000Z", "Sem marco elegível, o histórico posterior pode ser fornecido apenas como snapshot estratégico.");

const emptyContext = vm.createContext({ console, state: { strategicAdvisorSnapshots: [] }, window: context.window });
vm.runInContext(source.slice(start, end), emptyContext, { filename: "app.js#ai-strategic-history-empty" });
assert.equal(vm.runInContext("previousStrategicAdvisorSnapshot('2026-09-08T00:00:00.000Z')", emptyContext), null);
assert.equal(vm.runInContext("previousStrategicAdvisorTopics({ referenceAt: '2026-09-08T00:00:00.000Z' }).length", emptyContext), 0);

console.log("OK - o adaptador seleciona histórico estratégico temporalmente compatível sem mutar os snapshots.");
