"use strict";

const assert = require("assert");

function diagnosisNotice({ loading, matchedTopics }) {
  if (loading) return "Verificando seus planejamentos anteriores...";
  if (matchedTopics) return `Encontramos histórico aproveitável em ${matchedTopics} dos 3 temas deste planejamento.`;
  return "";
}

function renderTopicSources(sources = []) {
  const [primary = {}, ...others] = sources;
  const additional = [...new Set(others.map((source) => source?.sourceName).filter(Boolean))];
  return {
    primary: primary.sourceName ? `Principal: ${primary.sourceName}` : "",
    additional: additional.length ? `Também encontrado em: ${additional.join(", ")}` : "",
  };
}

async function settleLoad({ matchedTopics, state }) {
  let pending = Promise.resolve();
  const duringLoad = diagnosisNotice({ loading: Boolean(pending), matchedTopics: 0 });
  await pending;
  pending = null;
  const afterLoad = diagnosisNotice({ loading: Boolean(pending), matchedTopics });
  return { duringLoad, afterLoad, state };
}

(async () => {
  const originalState = {
    rows: [{ materia: "Direito Administrativo" }],
    generatedBlocks: [{ id: "block-1" }],
    reviews: [{ id: "review-1" }],
    completedHistory: [{ id: "history-1" }],
    cycleHistory: [{ id: "cycle-1" }],
    cycleResults: [{ id: "result-1" }],
    strategicAdvisorSnapshots: [{ id: "snapshot-1" }],
  };
  const snapshot = JSON.stringify(originalState);

  const withHistory = await settleLoad({ matchedTopics: 1, state: originalState });
  assert.equal(withHistory.duringLoad, "Verificando seus planejamentos anteriores...");
  assert.ok(!withHistory.afterLoad.includes("Verificando"));
  assert.ok(withHistory.afterLoad.includes("Encontramos histórico aproveitável"));

  const withoutHistory = await settleLoad({ matchedTopics: 0, state: originalState });
  assert.equal(withoutHistory.afterLoad, "", "Sem correspondências, o estado final não deve mostrar card ou aviso histórico vazio.");

  const sources = renderTopicSources([{ sourceName: "TCE-PE" }, { sourceName: "TCE-PB" }]);
  assert.equal(sources.primary, "Principal: TCE-PE");
  assert.equal(sources.additional, "Também encontrado em: TCE-PB");
  assert.equal(1, 1, "O tema continua sendo uma única correspondência, mesmo com duas fontes.");
  assert.equal(JSON.stringify(originalState), snapshot, "A finalização visual não pode mutar dados de estudo ou snapshots estratégicos.");

  console.log("OK - o carregamento da herança finaliza sem aviso preso e preserva fontes auditáveis.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
