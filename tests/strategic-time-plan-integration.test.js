"use strict";

const assert = require("assert");
const fs = require("fs");

const app = fs.readFileSync(require.resolve("../app.js"), "utf8");
const capturedState = app.slice(app.indexOf("function captureAppState"), app.indexOf("function resetPlanningAccess"));

assert.match(app, /function strategicPlanningTopics\(\)/, "Orientador e allocator devem compartilhar a base estratégica completa.");
assert.match(app, /topics: strategicPlanningTopics\(\)/, "A alocação deve receber os tópicos estratégicos derivados, não topicStates resumidos.");
assert.match(app, /completedAllocationsForToday\?\.\(weeklyStudyEvents\(\), new Date\(\)\)/, "A janela recente deve partir de execução canônica filtrada para hoje.");
assert.match(app, /data-strategic-time-minutes/, "A tela Continuar deve disponibilizar atalhos de capacidade.");
assert.match(app, /data-study-strategic-plan-session/, "Cada sessão planejada deve entregar o conteúdo ao modo foco existente.");
assert.match(app, /strategicPlanSessionOnly/, "A sessão iniciada pelo plano deve ser transitória e não alterar o ciclo.");
assert.match(capturedState, /!block\.strategicPlanSessionOnly/, "A persistência deve excluir o bloco transitório do plano estratégico.");
assert.match(app, /filter\(\(block\) => !isStrategicPlanSessionBlock\(block\)\)/, "Leituras de ciclo devem ignorar o bloco transitório enquanto ele transporta o modo foco.");
assert.match(app, /block\.strategicPlanSession \? "strategicPlanStudy" : "diagnosticIntervention"/, "Sessões estratégicas precisam permanecer distintas de intervenções corretivas no histórico derivado.");
assert.ok(!capturedState.includes("strategicTimePlanUI"), "O plano de tempo é efêmero e não pode entrar no snapshot persistido.");
assert.ok(!app.includes("dailyStudyGoal") && !app.includes("studyDebt") && !app.includes("remainingDailyTarget"), "A integração não deve introduzir metas ou dívida de estudo.");

console.log("strategic-time-plan integration tests passed");
