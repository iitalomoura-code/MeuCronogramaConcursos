const assert = require("node:assert/strict");
const composer = require("../js/study-plan-composer.js");

const base = [
  { key: "critical", materia: "AFO", assunto: "Despesa pública", priority: .7, diagnosis: { level: "critical" } },
  { key: "deficiency", materia: "Português", assunto: "Pontuação", priority: .8, diagnosis: { level: "deficiency" } },
  { key: "attention", materia: "Controle Externo", assunto: "Fiscalização", priority: .6, diagnosis: { level: "attention" } },
  { key: "same-subject", materia: "Português", assunto: "Sintaxe", priority: .9, diagnosis: { level: "deficiency" } },
  { key: "adequate", materia: "TI", assunto: "Redes", priority: .8, diagnosis: { level: "adequate" } },
];

// A e C: crítico e deficiência ganham prioridade, mantendo diversidade por matéria.
const normal = composer.composeAdaptiveCandidates({ candidates: base, plannedHours: 6 });
assert.equal(normal[0].key, "critical");
assert.ok(normal.some((item) => item.materia === "Português" && item.adaptiveScore === 82));
assert.equal(normal.filter((item) => item.materia === "Português").length, 1);

// B: tema adequado não recebe reforço só por existir no ciclo.
assert.equal(normal.some((item) => item.key === "adequate"), false);

// D: pouca evidência produz sessão diagnóstica, não rótulo de deficiência.
const insufficient = composer.composeAdaptiveCandidates({ candidates: [{ key: "sample", materia: "RLM", diagnosis: { level: "insufficient" } }], plannedHours: 3 });
assert.equal(insufficient[0].adaptiveType, "diagnostic");

// E e F: a camada é limitada e pode reservar espaço maior após edital publicado.
const before = composer.composeAdaptiveCandidates({ candidates: base, plannedHours: 8, examContext: { examPhase: "PRE_NOTICE" } });
const after = composer.composeAdaptiveCandidates({ candidates: base, plannedHours: 8, examContext: { effectiveExamPhase: "POST_NOTICE", urgency: { value: 1 } } });
assert.ok(before.length <= 3);
assert.ok(after.length <= 3);
assert.ok(after.length >= before.length);

console.log("study-plan-composer tests passed");
