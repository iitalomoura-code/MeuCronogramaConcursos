"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const engine = require("../js/initial-diagnosis.js");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const index = fs.readFileSync(path.join(root, "index.html"), "utf8");

assert.strictEqual(engine.levelInfo("none").label, "Nunca estudei", "Valores antigos devem migrar sem perda.");
assert.strictEqual(engine.levelInfo("weak").label, "Básico", "Valores antigos devem migrar sem perda.");
assert.strictEqual(engine.levelInfo("intermediate").label, "Intermediário");
assert.strictEqual(engine.levelInfo("good").label, "Avançado", "Valores antigos devem migrar sem perda.");
assert.strictEqual(engine.influenceFor("unknown", {}).adjustment, 0, "Não sei avaliar deve ser neutro.");

const noHistoryWeak = engine.influenceFor("weak", {});
const someHistoryWeak = engine.influenceFor("weak", { questions: 15, sessions: 2, reviews: 1, hours: 2 });
const reliableHistoryWeak = engine.influenceFor("weak", { questions: 40, sessions: 4, reviews: 3, hours: 6, reinforcements: 2 });
assert.ok(noHistoryWeak.adjustment > someHistoryWeak.adjustment, "O diagnóstico deve perder peso com dados reais.");
assert.strictEqual(reliableHistoryWeak.adjustment, 0, "Uma amostra completa deve substituir o diagnóstico.");
assert.strictEqual(engine.suggestedActivity("never-studied", {}, "Questões"), "Teoria e questões", "Sem contato deve favorecer teoria inicialmente.");
assert.strictEqual(engine.suggestedActivity("advanced", {}, "Teoria e questões"), "Questões diagnósticas", "Base avançada deve começar por questões diagnósticas.");
assert.strictEqual(engine.suggestedActivity("weak", { questions: 40, sessions: 4, reviews: 3, hours: 6 }, "Revisão"), "Revisão", "Histórico confiável não deve ser sobrescrito.");
const estimatedFromEvidence = engine.estimatedLevel({
  initialLevel: "advanced",
  evidence: { questions: 40, sessions: 3, hours: 3 },
  diagnosis: { level: "adequate", accuracy: .74 },
});
assert.equal(estimatedFromEvidence.id, "intermediate", "O nível estimado deve refletir evidência suficiente.");
assert.equal(estimatedFromEvidence.informedLevel, "advanced", "A autopercepção original não pode ser regravada pela evidência.");
assert.equal(estimatedFromEvidence.differsFromInformed, true, "A divergência deve ficar disponível para uma comunicação gentil.");
assert.strictEqual(engine.subjectIdForName("Língua Portuguesa"), engine.subjectIdForName("LINGUA PORTUGUESA"), "O ID da matéria deve ser estável entre caixa e acentuação.");

assert.ok(app.includes("initialDiagnosis: state.initialDiagnosis"), "O diagnóstico deve integrar o snapshot/backup.");
assert.ok(app.includes("Array.isArray(saved.initialDiagnosis)"), "Backups antigos sem diagnóstico devem manter compatibilidade.");
assert.ok(app.includes("masteryDiagnosisForTarget"), "A geração deve consultar o motor de domínio que pondera a influência inicial.");
assert.ok(app.includes("initialDiagnosisReason(block.materia, block.assunto, block.subarea)"), "A tela Continuar deve explicar o diagnóstico por assunto quando relevante.");
assert.ok(app.includes("initialDiagnosisEvidence(materia, assunto, subarea)"), "A evidência inicial deve ser calculada por assunto sem misturar temas da matéria.");
assert.ok(index.includes('./js/initial-diagnosis.js?v=20260911-initial-profile'), "O módulo local deve ser carregado antes do app.");
assert.ok(index.includes('./js/mastery-diagnosis.js?v=20260909-topic-isolation'), "O motor de domínio deve ser carregado antes do app.");
assert.ok(!index.includes('data-tab-target="diagnostico"'), "O diagnóstico não deve aparecer como item permanente da navegação.");

console.log("OK - diagnóstico inicial é neutro quando desconhecido, perde peso com evidência e preserva compatibilidade.");
