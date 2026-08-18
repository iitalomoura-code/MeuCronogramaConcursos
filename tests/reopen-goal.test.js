"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const source = fs.readFileSync(path.resolve(__dirname, "..", "app.js"), "utf8");
const start = source.indexOf("function completedEntryFromBlock");
const end = source.indexOf("function dateToWeekInput");
if (start < 0 || end < 0) throw new Error("Funções de conclusão não encontradas.");

let reviewSyncs = 0;
const state = {
  completedHistory: [
    { materia: "Português", assunto: "Sintaxe", ciclo: "Ciclo 3", sessaoId: "current-session", status: "Concluído" },
    { materia: "Português", assunto: "Sintaxe", ciclo: "Ciclo 2", sessaoId: "old-session", status: "Concluído" },
    { materia: "AFO", assunto: "Receita", ciclo: "Ciclo 3", sessaoId: "other-session", status: "Concluído" },
  ],
  cycleHistory: [{ label: "Ciclo 2", generatedBlocks: [{ materia: "Português", assunto: "Sintaxe", status: "Concluído" }] }],
  cycleResults: [{ label: "Ciclo 2", completed: [{ materia: "Português", assunto: "Sintaxe", status: "Concluído" }] }],
};

const context = {
  state,
  els: { referenceWeek: { value: "2026-W33" } },
  topicKey: (materia, assunto) => `${String(materia || "").toLowerCase()}::${String(assunto || "").toLowerCase()}`,
  normalizeStatus: (status) => status || "Não iniciado",
  currentCycleLabel: () => "Ciclo 3",
  syncBlockReviewRecords: () => { reviewSyncs += 1; },
  syncReviewSource: () => {},
  isMetaComplete: () => true,
  blockDurationValue: () => 1,
};

vm.createContext(context);
vm.runInContext(source.slice(start, end), context);

const block = {
  materia: "Português",
  assunto: "Sintaxe",
  ciclo: "Ciclo 3",
  sessaoId: "current-session",
  status: "Concluído",
  concluidoEm: "18/08/2026",
};

const outcome = context.reopenCompletedBlock(block, "Não iniciado", { previousStatus: "Concluído" });

assert.equal(block.status, "Não iniciado", "A meta reaberta deve voltar para Não iniciado.");
assert.equal(block.concluidoEm, "", "A data de conclusão ativa deve ser removida.");
assert.equal(outcome.removedHistory, 1, "Somente o espelho da conclusão do ciclo atual deve ser removido.");
assert.equal(state.completedHistory.length, 2, "Histórico antigo e outros temas devem ser preservados.");
assert.ok(state.completedHistory.some((entry) => entry.ciclo === "Ciclo 2"), "A conclusão de ciclo encerrado deve permanecer.");
assert.equal(state.cycleHistory.length, 1, "O histórico de ciclos encerrados não deve ser alterado.");
assert.equal(state.cycleResults.length, 1, "Os resultados de ciclos encerrados não devem ser alterados.");
assert.equal(reviewSyncs, 1, "As revisões pendentes devem ser reconciliadas ao reabrir.");

assert.ok(source.includes('data-reopen-block="${index}"'), "Blocos concluídos devem oferecer a ação Reabrir meta.");
assert.ok(source.includes("reopenCompletedBlock(block, nextStatus, { previousStatus, syncReviews: false });"), "O salvamento deve reconciliar a reversão da conclusão.");

console.log("OK - conclusão do ciclo atual pode ser desfeita sem alterar ciclos encerrados.");
