"use strict";

const assert = require("assert");
const engine = require("../js/strategic-priority.js");

function diagnosis(overrides = {}) {
  return {
    level: "adequate",
    confidence: .65,
    accuracy: .75,
    overallAccuracy: .75,
    questions: 60,
    trend: { label: "stable" },
    errorSignals: { recurrence: "low", recentErrors: 0, types: [] },
    ...overrides,
  };
}

function candidate({ peso = 4, dominio = 3, hasContact = true, coverage = 1, ...overrides } = {}) {
  return {
    subject: { peso, dominio },
    hasContact,
    coverage,
    ...overrides,
  };
}

const poorImportant = engine.calculate(candidate({
  peso: 5,
  dominio: 4,
  diagnosis: diagnosis({ level: "deficiency", accuracy: .54, overallAccuracy: .60, errorSignals: { recurrence: "high", recentErrors: 4, types: ["Confusão conceitual"] } }),
}));
assert.ok(["high", "very-high"].includes(poorImportant.band), "Matéria muito importante com deficiência e boa amostra deve ter retorno alto.");

const stableStrong = engine.calculate(candidate({
  peso: 5,
  dominio: 3,
  diagnosis: diagnosis({ level: "strong", confidence: .8, accuracy: .90, overallAccuracy: .89, questions: 120 }),
}));
assert.equal(stableStrong.learningState.key, "maintenance", "Bom desempenho estável e confiável deve entrar em manutenção.");
assert.ok(stableStrong.score < poorImportant.score, "Manutenção não pode superar uma deficiência relevante apenas pela importância.");

const falling = engine.calculate(candidate({
  diagnosis: diagnosis({ level: "attention", accuracy: .45, overallAccuracy: .75, trend: { label: "falling" } }),
}));
assert.ok(falling.score > engine.calculate(candidate({ diagnosis: diagnosis() })).score, "Queda recente confiável deve elevar a oportunidade sem alterar a dificuldade pessoal.");
assert.equal(falling.scoreComponents.difficulty, .6, "A dificuldade pessoal é estrutural e não pode ser alterada pela queda de desempenho.");

const tinyExcellent = engine.calculate(candidate({
  diagnosis: diagnosis({ level: "insufficient", confidence: .12, accuracy: 1, overallAccuracy: 1, questions: 3, trend: { label: "insufficient" } }),
}));
assert.notEqual(tinyExcellent.learningState.key, "maintenance", "Três acertos em três questões não podem entrar em manutenção.");

const recovery = engine.calculate(candidate({
  diagnosis: diagnosis({
    level: "attention",
    confidence: .72,
    accuracy: .55,
    overallAccuracy: .85,
    questions: 100,
    trend: { label: "falling" },
    errorSignals: { recurrence: "high", recentErrors: 5, types: ["Conteúdo não dominado"] },
  }),
}));
assert.equal(recovery.learningState.key, "recovery", "Queda forte, confiável e recorrente após histórico forte deve entrar em recuperação.");

const noContact = engine.calculate(candidate({
  peso: 5,
  hasContact: false,
  coverage: 0,
  diagnosis: diagnosis({ level: "insufficient", confidence: 0, accuracy: null, overallAccuracy: null, questions: 0, trend: { label: "insufficient" } }),
}));
assert.equal(noContact.learningState.key, "not-started", "Ausência de evidência deve representar cobertura, não estado crítico.");
assert.ok(noContact.score > 0, "Tema importante sem contato deve ganhar prioridade gradual de cobertura.");

const neverStudiedProfile = engine.calculate(candidate({
  hasContact: false,
  coverage: 0,
  initialProfile: { level: "never-studied", label: "Nunca estudei", active: true, remainingWeight: 1 },
  diagnosis: diagnosis({ level: "insufficient", confidence: 0, accuracy: null, overallAccuracy: null, questions: 0, trend: { label: "insufficient" } }),
}));
assert.equal(neverStudiedProfile.learningState.key, "not-started", "Nunca estudei deve começar como cobertura inicial, sem rótulo de deficiência.");
assert.equal(neverStudiedProfile.recommendedSession.kind, "theory_questions", "Nunca estudei deve iniciar por teoria e questões.");

const basicProfile = engine.calculate(candidate({
  hasContact: false,
  coverage: 0,
  initialProfile: { level: "basic", label: "Básico", active: true, remainingWeight: 1 },
  diagnosis: diagnosis({ level: "insufficient", confidence: 0, accuracy: null, overallAccuracy: null, questions: 0, trend: { label: "insufficient" } }),
}));
assert.equal(basicProfile.learningState.key, "building", "Perfil básico sem evidência deve iniciar com construção guiada.");
assert.equal(basicProfile.recommendedSession.kind, "theory_questions", "Perfil básico deve começar com teoria e questões.");

const advancedProfile = engine.calculate(candidate({
  hasContact: false,
  coverage: 0,
  initialProfile: { level: "advanced", label: "Avançado", active: true, remainingWeight: 1 },
  diagnosis: diagnosis({ level: "insufficient", confidence: 0, accuracy: null, overallAccuracy: null, questions: 0, trend: { label: "insufficient" } }),
}));
assert.equal(advancedProfile.learningState.awaitingDiagnostic, true, "Perfil avançado sem dados deve aguardar confirmação, não ser tratado como deficiência.");
assert.equal(advancedProfile.recommendedSession.kind, "diagnostic_questions", "Perfil avançado deve iniciar por questões diagnósticas.");

const lowStrong = engine.calculate(candidate({
  peso: 1,
  dominio: 2,
  diagnosis: diagnosis({ level: "strong", confidence: .82, accuracy: .90, overallAccuracy: .89, questions: 120 }),
}));
assert.equal(lowStrong.band, "very-low", "Tema pouco relevante e forte deve liberar espaço para outros assuntos.");

const smallDrop = engine.calculate(candidate({
  diagnosis: diagnosis({ level: "attention", confidence: .22, accuracy: .60, overallAccuracy: .88, questions: 105, trend: { label: "falling" } }),
}));
assert.notEqual(smallDrop.learningState.key, "recovery", "Queda pequena ou pouco confiável não pode disparar recuperação automaticamente.");

const recurring = engine.calculate(candidate({ diagnosis: diagnosis({ level: "attention", accuracy: .65, overallAccuracy: .65, errorSignals: { recurrence: "high", recentErrors: 4, types: ["Cálculo"] } }) }));
const isolated = engine.calculate(candidate({ diagnosis: diagnosis({ level: "attention", accuracy: .65, overallAccuracy: .65, errorSignals: { recurrence: "low", recentErrors: 1, types: [] } }) }));
assert.ok(recurring.score > isolated.score, "Erros recorrentes devem diferenciar assuntos com mesmo desempenho.");

const queue = engine.buildStrategicStudyQueue([
  { index: 0, unit: { materia: "A", assunto: "1" }, ...candidate({ diagnosis: diagnosis({ level: "deficiency", accuracy: .50, overallAccuracy: .55 }) }) },
  { index: 1, unit: { materia: "A", assunto: "2" }, ...candidate({ diagnosis: diagnosis({ level: "deficiency", accuracy: .52, overallAccuracy: .56 }) }) },
  { index: 2, unit: { materia: "B", assunto: "1" }, ...candidate({ diagnosis: diagnosis({ level: "attention", accuracy: .68, overallAccuracy: .68 }) }) },
]);
assert.notEqual(queue[0].unit.materia, queue[1].unit.materia, "A fila estratégica deve alternar matérias quando houver alternativa relevante.");
assert.deepStrictEqual(queue.map((item) => item.queueRank), [1, 2, 3], "A fila deve ser derivada e reconstruível, sem criar dívida de estudo.");

const urgent = engine.calculate(candidate({ examUrgency: .9, diagnosis: diagnosis({ level: "deficiency", accuracy: .56, overallAccuracy: .60 }) }));
const preNotice = engine.calculate(candidate({ examUrgency: 0, diagnosis: diagnosis({ level: "deficiency", accuracy: .56, overallAccuracy: .60 }) }));
assert.ok(urgent.score > preNotice.score, "A proximidade da prova deve aumentar o retorno de lacunas relevantes sem criar uma meta semanal rígida.");

const immutableInput = candidate({
  diagnosis: diagnosis({ level: "attention", accuracy: .65, overallAccuracy: .70, errorSignals: { recurrence: "moderate", recentErrors: 2, types: ["Cálculo"] } }),
});
const immutableBefore = structuredClone(immutableInput);
const guidedPractice = engine.explainStrategicPriority(immutableInput);
assert.deepStrictEqual(immutableInput, immutableBefore, "Calcular prioridade não pode alterar sessões, erros ou demais evidências de origem.");
assert.equal(guidedPractice.recommendedSession.kind, "guided_practice", "Erro de cálculo em consolidação deve recomendar prática orientada, não teoria extensa.");

console.log("OK - prioridade estratégica usa domínio central, retorno marginal, cobertura, diversidade e fase da prova.");
