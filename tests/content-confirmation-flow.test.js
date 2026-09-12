"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
assert.ok(index.includes("app.js?v=20260912-mapping-management"), "A publicação precisa solicitar a versão atual do fluxo de confirmação.");
const start = app.indexOf("function contentConfirmationDecision");
const end = app.indexOf("function renderPlanningBase", start);
assert.ok(start >= 0 && end > start, "O fluxo de confirmação do conteúdo deve estar isolado antes da renderização da base.");
const source = app.slice(start, end);

function makeRows(subjectCount = 17, topicsPerSubject = 17) {
  const rows = Array.from({ length: subjectCount }, (_, subjectIndex) =>
    Array.from({ length: topicsPerSubject }, (_, topicIndex) => ({
      materia: `Matéria ${subjectIndex + 1}`,
      assunto: `Tema ${topicIndex + 1}`,
      estudar: "Sim",
    })),
  ).flat();
  // Reproduz a importação grande reportada: 17 matérias e 291 temas.
  rows.push(
    { materia: "Matéria 1", assunto: "Tema extra 1", estudar: "Sim" },
    { materia: "Matéria 1", assunto: "Tema extra 2", estudar: "Sim" },
  );
  return rows;
}

function runConfirmation({ issues = [], reviewProblems = [], setupIncomplete = true, baseSubjects = 17 } = {}) {
  const calls = { modal: 0, diagnosis: 0, step: [], tab: [], history: 0, toast: [] };
  const rows = makeRows();
  const context = {
    console: { error() {} },
    Date,
    state: {
      rows,
      confirmed: false,
      contentDraftPendingConfirmation: true,
      planningBase: null,
      programVersions: [],
    },
    els: {
      confirmationStatus: {
        textContent: "",
        classList: { add() {} },
      },
    },
    pendingProgramVersionChange: null,
    planningSettingsContextTab: "",
    syncRowsFromTable() {},
    renumberRows() {},
    contentValidationIssues() { return issues; },
    contentProblemAnalysis() { return reviewProblems; },
    openContentProblemsModal() { calls.modal += 1; },
    dialogAlert() { throw new Error("Não deveria pedir confirmação para conteúdo válido."); },
    refreshPlanningBaseFromRows() {
      context.state.planningBase = {
        materias: Array.from({ length: baseSubjects }, (_, index) => ({ materia: `Matéria ${index + 1}` })),
      };
    },
    updateExamPhaseStatus() {},
    setTabEnabled() {},
    setupIsIncomplete() { return setupIncomplete; },
    ensureInitialDiagnosisForSubjects() { calls.diagnosis += 1; },
    setSetupStep(step) { calls.step.push(step); },
    switchTab(tab) { calls.tab.push(tab); },
    renderPlanningBase() {},
    updateContentFlowSteps() {},
    refreshHistoryInheritanceSources() { calls.history += 1; return Promise.resolve(); },
    notifyContent(message) { calls.toast.push(message); },
  };
  vm.createContext(context);
  vm.runInContext(`${source}\nthis.confirmRows = confirmRows; this.contentConfirmationDecision = contentConfirmationDecision;`, context);
  return { context, calls };
}

{
  const { context, calls } = runConfirmation({
    issues: [{ id: "review-1", severity: "warning" }],
    reviewProblems: [{ id: "review-1" }],
  });
  assert.equal(context.state.rows.length, 291, "O cenário precisa manter a importação de 17 matérias e 291 temas.");
  context.confirmRows();
  assert.equal(calls.modal, 1, "Avisos devem abrir a conferência antes da confirmação explícita.");
  assert.equal(context.state.confirmed, false);

  context.confirmRows({ force: true });
  assert.equal(context.state.confirmed, true, "Confirmar mesmo assim deve consolidar conteúdo com apenas avisos.");
  assert.equal(context.state.contentDraftPendingConfirmation, false);
  assert.equal(context.state.planningBase.materias.length, 17, "A base do planejamento deve conter as matérias confirmadas.");
  assert.deepEqual(calls.step, [3], "Novo planejamento deve avançar para o diagnóstico.");
  assert.deepEqual(calls.tab, ["diagnostico"]);
  assert.equal(calls.diagnosis, 1);
}

{
  const { context, calls } = runConfirmation({
    issues: [{ id: "invalid-subject", severity: "error" }],
  });
  context.confirmRows({ force: true });
  assert.equal(calls.modal, 1, "Erros estruturais nunca podem ser ignorados à força.");
  assert.equal(context.state.confirmed, false);
  assert.deepEqual(calls.tab, []);
}

{
  const { context, calls } = runConfirmation({ setupIncomplete: false });
  context.confirmRows();
  assert.equal(context.state.confirmed, true, "Planejamento existente válido continua confirmando normalmente.");
  assert.deepEqual(calls.step, [], "Plano legado não deve reiniciar o fluxo guiado.");
  assert.deepEqual(calls.tab, ["pesos"]);
}

{
  const { context, calls } = runConfirmation({ baseSubjects: 0 });
  context.confirmRows();
  assert.equal(context.state.confirmed, false, "Uma base vazia não pode ser confirmada silenciosamente.");
  assert.equal(context.state.contentDraftPendingConfirmation, true);
  assert.deepEqual(calls.tab, []);
  assert.equal(calls.toast.length, 1, "A falha precisa ficar explícita para a pessoa.");
}

console.log("OK - confirmação de conteúdo separa avisos, erros, criação da base e avanço para o diagnóstico.");
