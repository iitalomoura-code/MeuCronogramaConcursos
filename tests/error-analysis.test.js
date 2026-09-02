"use strict";

const assert = require("assert");
const engine = require("../js/error-analysis.js");
const now = Date.now();
const daysAgo = (days) => new Date(now - days * 86400000).toISOString();
const error = (materia, assunto, quantidade, session, days) => ({ materia, assunto, quantidade, sessaoId: session, registradaEm: daysAgo(days) });
const signals = (errors, materia = "Português", assunto = "Pontuação", interventions = []) => engine.signalsFor(engine.aggregate(errors, interventions, now), materia, assunto);

let result = signals([error("Português", "Pontuação", 10, "s1", 3)]);
assert.equal(result.recurrence, "low", "Muitos erros em uma sessão devem permanecer como episódio pontual.");

result = signals([1, 2, 3, 4, 5, 6].flatMap((index) => [error("Português", "Pontuação", 2, `s${index}`, index)]));
assert.equal(result.recurrence, "high", "Erros em seis sessões diferentes devem indicar alta recorrência.");
assert.equal(result.sessionsWithErrors, 6, "A agregação deve distinguir sessões, não apenas volume absoluto.");

const intervention = [{ materia: "Português", assunto: "Pontuação", intervencao: { createdAt: daysAgo(10) } }];
result = signals([error("Português", "Pontuação", 4, "before", 18)], "Português", "Pontuação", intervention);
assert.equal(result.postInterventionErrors, 0, "Erros anteriores ao reforço não podem ser tratados como persistência posterior.");

result = signals([
  error("Português", "Pontuação", 3, "before", 18),
  error("Português", "Pontuação", 2, "after1", 7),
  error("Português", "Pontuação", 2, "after2", 3),
], "Português", "Pontuação", intervention);
assert.equal(result.postInterventionErrors, 4, "Erros após reforço devem ficar identificados separadamente.");

result = signals([error("Português", "Pontuação", 30, "old", 190)]);
assert.equal(result.recentErrors, 0, "Erros antigos devem perder peso na leitura atual.");

result = signals([
  error("Português", "Pontuação", 14, "p1", 3),
  error("Português", "Semântica", 10, "s1", 4),
  error("Português", "Interpretação", 5, "i1", 2),
  error("Português", "Crase", 4, "c1", 5),
]);
assert.ok(result.concentration >= .4, "Um assunto com cerca de 40% dos erros da matéria deve ser destacado.");

result = signals([
  { ...error("Português", "Pontuação", 4, "same-session", 2), registroAutomatico: true },
  { ...error("Português", "Pontuação", 1, "same-session", 2), registroManual: true, tipoErro: "Interpretação" },
]);
assert.equal(result.recentErrors, 4, "O registro rápido não pode somar em duplicidade à contagem automática da mesma sessão.");

console.log("OK - análise de erros diferencia episódio, recorrência, persistência, recência e concentração.");
