"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const CapacityPlanning = require("../js/capacity-planning.js");
const MasteryDiagnosis = require("../js/mastery-diagnosis.js");
const LearningDiagnosisView = require("../js/learning-diagnosis-view.js");

const app = fs.readFileSync(path.resolve(__dirname, "..", "app.js"), "utf8");
const cut = app.indexOf("els.tabs.forEach((button) => button.addEventListener");
const runtimeSource = `${app.slice(0, cut)}\nglobalThis.__topicDiagnosisIsolation = { state, invalidateDerivedStudyCaches, masteryDiagnosisForTarget, adaptivePriorityAdjustment, learningDiagnosisModel };`;
const noop = () => {};
const context = {
  console, Date, Math, JSON, Set, Map, Array, Object, String, Number, Boolean, RegExp, Error, structuredClone,
  setTimeout: noop, clearTimeout: noop, setInterval: noop, clearInterval: noop, requestAnimationFrame: noop,
  localStorage: { getItem: () => null, setItem: noop, removeItem: noop },
  document: { querySelectorAll: () => [], querySelector: () => null, addEventListener: noop, documentElement: { dataset: {}, style: { setProperty: noop } }, body: {} },
  window: {
    setTimeout: noop, clearTimeout: noop, setInterval: noop, clearInterval: noop, addEventListener: noop,
    matchMedia: () => ({ matches: false }), innerWidth: 1200,
    CapacityPlanning, MasteryDiagnosis, LearningDiagnosisView,
  },
};
vm.createContext(context);
vm.runInContext(runtimeSource, context);
const runtime = context.__topicDiagnosisIsolation;

const materia = "Administração Geral e Pública";
const planejamento = "Planejamento estratégico";
const semDados = ["Gestão de pessoas", "Políticas públicas", "Governança"];
runtime.state.planningBase = { materias: [{ materia, peso: 4, dominio: 3 }] };
runtime.state.rows = [planejamento, ...semDados].map((assunto) => ({ materia, assunto, estudar: "Sim" }));
runtime.state.completedHistory = [{
  materia,
  assunto: planejamento,
  questoes: 22,
  acertos: 19,
  tempoEstudado: 1,
  status: "Concluído",
  concluidoEm: "01/09/2026",
}];
runtime.invalidateDerivedStudyCaches();

const topicWithEvidence = runtime.masteryDiagnosisForTarget({ materia, assunto: planejamento });
assert.strictEqual(topicWithEvidence.questions, 22, "O tema estudado deve usar suas próprias 22 questões.");
assert.notStrictEqual(topicWithEvidence.level, "strong", "Uma única sessão boa deve ficar em consolidação, não em domínio forte.");
assert.strictEqual(topicWithEvidence.evidenceStage, "preliminary", "O tema com uma sessão deve guardar estágio preliminar.");

semDados.forEach((assunto) => {
  const diagnosis = runtime.masteryDiagnosisForTarget({ materia, assunto });
  assert.strictEqual(diagnosis.level, "insufficient", `${assunto} sem registro deve exigir mais dados.`);
  assert.strictEqual(diagnosis.available, false, `${assunto} sem registro não pode estar disponível como diagnóstico consolidado.`);
  assert.strictEqual(diagnosis.needsDiagnostic, true, `${assunto} sem registro deve pedir sessão diagnóstica.`);
  assert.strictEqual(diagnosis.questions, 0, `${assunto} não pode herdar as 22 questões de Planejamento estratégico.`);
  assert.strictEqual(diagnosis.confidence, 0, `${assunto} sem evidência deve manter confiança zero.`);
  assert.ok(diagnosis.reasons[0].includes("registro próprio"), `${assunto} deve explicar a ausência de evidência própria.`);
});

const subjectDiagnosis = runtime.masteryDiagnosisForTarget({ materia });
assert.strictEqual(subjectDiagnosis.questions, 22, "O diagnóstico agregado da matéria pode usar o histórico de todos os temas.");
assert.strictEqual(subjectDiagnosis.basis, "subject", "A consulta sem assunto deve ser reconhecida como diagnóstico da matéria.");

const unseenAdjustment = runtime.adaptivePriorityAdjustment({ materia, assunto: "Gestão de pessoas" });
assert.strictEqual(unseenAdjustment.mastery.level, "insufficient", "O motor adaptativo deve receber insuficiência para tema sem evidência própria.");
assert.strictEqual(unseenAdjustment.hasContact, false, "Tema sem registro não pode parecer já estudado para o agendador.");

const model = runtime.learningDiagnosisModel();
semDados.forEach((assunto) => {
  const topic = model.topics.find((item) => item.assuntoOriginal === assunto);
  assert.strictEqual(topic?.diagnosis.level, "insufficient", `A tela de Diagnóstico deve manter ${assunto} como mais dados necessários.`);
});

console.log("OK - diagnóstico por assunto não herda desempenho de outros temas da matéria.");
