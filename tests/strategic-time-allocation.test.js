"use strict";

const assert = require("assert");
const allocator = require("../js/strategic-time-allocation.js");

const topic = (materia, assunto, score, learningState = "practice", minutes = null) => ({
  materia,
  assunto,
  strategic: {
    score,
    learningState: { key: learningState },
    recommendedSession: minutes ? { kind: "questions", label: "Sessão sugerida", minutes } : undefined,
  },
});

let result = allocator.allocate({
  availableMinutes: 45,
  topics: [topic("Contabilidade", "Lançamentos", .9, "recovery"), topic("Português", "Reescrita", .8, "consolidating"), topic("AFO", "Receita", .7)],
});
assert.equal(result.sessions.length, 1, "Pouca capacidade deve se concentrar na melhor oportunidade.");
assert.equal(result.sessions[0].materia, "Contabilidade", "Recovery com maior score deve receber os 45 minutos disponíveis.");
assert.equal(result.sessions[0].durationMinutes, 45, "A sessão ideal deve ser preservada quando houver tempo suficiente.");

result = allocator.allocate({ availableMinutes: 60, topics: [topic("A", "Recuperação", .9, "recovery"), topic("B", "Prática", .85, "practice")] });
assert.equal(result.sessions[0].materia, "A", "A melhor oportunidade deve ser escolhida primeiro de forma determinística.");
assert.ok(result.allocatedMinutes === 45 || result.allocatedMinutes === 60, "A capacidade de 60 minutos deve usar apenas sessões pedagogicamente úteis.");

result = allocator.allocate({ availableMinutes: 90, topics: [topic("A", "Tema", .9, "recovery"), topic("B", "Tema", .82), topic("C", "Tema", .75)] });
assert.ok(new Set(result.sessions.map((session) => session.materia)).size >= 2, "Com capacidade para mais de um bloco, o motor deve alternar oportunidades úteis.");

result = allocator.allocate({ availableMinutes: 180, topics: [topic("A", "Tema", .95, "recovery"), topic("B", "Tema", .8), topic("C", "Tema", .76), topic("D", "Tema", .7)] });
assert.ok(result.sessions.some((session) => session.materia !== "A"), "Um assunto muito forte não pode monopolizar automaticamente toda a capacidade quando há concorrentes úteis.");

result = allocator.allocate({ availableMinutes: 90, topics: [topic("A", "Tema", .9, "recovery")] });
assert.equal(result.sessions.length, 2, "Uma única oportunidade forte pode receber blocos repetidos quando não houver concorrentes úteis.");
assert.ok(result.sessions[1].effectiveOpportunity < result.sessions[0].effectiveOpportunity && result.sessions[1].marginalMultiplier < 1, "O segundo bloco do mesmo assunto deve ter retorno marginal menor.");

result = allocator.allocate({ availableMinutes: 90, topics: [topic("A", "Tema", .9, "recovery"), topic("B", "Tema", .82)] });
assert.equal(result.sessions[1].materia, "B", "Uma alternativa próxima deve superar a segunda sessão do mesmo assunto após a queda marginal.");

result = allocator.allocate({ availableMinutes: 20, topics: [topic("A", "Tema", .7, "practice", 30)] });
assert.equal(result.sessions[0].durationMinutes, 20, "Vinte minutos devem permitir sessão reduzida útil quando esse é o mínimo configurado.");
result = allocator.allocate({ availableMinutes: 15, topics: [topic("A", "Tema", .7)] });
assert.equal(result.sessions.length, 0, "Tempo abaixo do mínimo útil não deve gerar bloco artificial.");
assert.equal(result.unusedMinutes, 15, "Tempo insuficiente deve permanecer não alocado sem erro.");

result = allocator.allocate({ availableMinutes: 60, topics: [topic("A", "Tema", .3, "maintenance"), topic("B", "Tema", .8, "recovery")] });
assert.equal(result.sessions[0].materia, "B", "Manutenção não deve competir igualmente com recuperação mais relevante.");
result = allocator.allocate({ availableMinutes: 45, topics: [topic("A", "Tema", 0), { materia: "B", assunto: "", strategic: { score: .9 } }] });
assert.equal(result.sessions.length, 0, "Scores inválidos ou candidatos sem estrutura não devem dominar a alocação.");

const recentWithMinutes = [{ materia: "Contabilidade", assunto: "Lançamentos", durationMinutes: 90 }];
const recentBefore = JSON.stringify(recentWithMinutes);
result = allocator.allocate({ availableMinutes: 120, recentAllocations: recentWithMinutes, topics: [topic("Contabilidade", "Lançamentos", .99, "recovery"), topic("Português", "Reescrita", .72)] });
assert.equal(result.sessions[0].materia, "Português", "Minutos recentes devem participar do soft cap e evitar concentração indevida.");
assert.equal(JSON.stringify(recentWithMinutes), recentBefore, "recentAllocations não pode ser alterado pelo motor.");

result = allocator.allocate({ availableMinutes: 120, recentAllocations: [{ materia: "Contabilidade", assunto: "Lançamentos" }], topics: [topic("Contabilidade", "Lançamentos", .99, "recovery"), topic("Português", "Reescrita", .72)] });
assert.ok(result.sessions.length, "Registros antigos sem duração devem continuar compatíveis.");

const longDayTopics = Array.from({ length: 8 }, (_, index) => topic(`Matéria ${index + 1}`, "Tema", .9 - index * .03, "practice", 30));
result = allocator.allocate({ availableMinutes: 240, topics: longDayTopics });
assert.ok(result.sessions.length > 6 && result.allocatedMinutes === 240, "Quatro horas com candidatos úteis não podem parar artificialmente em seis sessões.");
result = allocator.allocate({ availableMinutes: 1200, topics: Array.from({ length: 12 }, (_, index) => topic(`Segurança ${index + 1}`, "Tema", .8 - index * .02, "practice", 30)) });
assert.ok(result.sessions.length <= 12, "Capacidade muito grande deve respeitar o teto de segurança configurado.");

result = allocator.allocate({ availableMinutes: 45, topics: [topic("Auditoria", "Tema", .8)] });
assert.ok(Object.prototype.hasOwnProperty.call(result.sessions[0], "marginalMultiplier") && Object.prototype.hasOwnProperty.call(result.sessions[0], "subjectMultiplier") && Object.prototype.hasOwnProperty.call(result.sessions[0], "concentrationMultiplier"), "Cada sessão deve expor todos os multiplicadores temporários para auditoria.");

result = allocator.allocate({ availableMinutes: 30, recentAllocations: [{ materia: "Contabilidade", assunto: "Lançamentos", durationMinutes: 30 }], topics: [topic("Contabilidade", "Lançamentos", .9), topic("Contabilidade", "Estoques", .9)] });
assert.equal(result.sessions[0].assunto, "Estoques", "Repetir o mesmo assunto deve receber penalização maior que outro assunto da mesma matéria.");

const immutableTopics = [topic("A", "Tema", .8), topic("B", "Tema", .7)];
const before = JSON.stringify(immutableTopics);
const firstRun = allocator.allocate({ availableMinutes: 120, topics: immutableTopics });
const secondRun = allocator.allocate({ availableMinutes: 120, topics: immutableTopics });
assert.equal(JSON.stringify(immutableTopics), before, "Alocar tempo não pode alterar score, estado ou qualquer dado de origem.");
assert.deepEqual(firstRun, secondRun, "A mesma entrada deve gerar a mesma alocação.");

result = allocator.allocate({ availableMinutes: 0, topics: immutableTopics });
assert.equal(result.allocatedMinutes, 0, "Capacidade nula deve retornar plano vazio sem erro.");
result = allocator.allocate({ availableMinutes: 120, topics: [] });
assert.equal(result.allocatedMinutes, 0, "Sem candidatos, nenhum bloco deve ser criado.");
assert.equal(result.unusedMinutes, 120, "Sem candidatos, toda a capacidade deve permanecer disponível.");

console.log("OK - alocação estratégica transforma prioridade existente em blocos úteis sem criar score paralelo ou alterar a origem.");
