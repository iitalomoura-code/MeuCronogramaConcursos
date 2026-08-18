"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const engine = require("../js/exam-phase.js");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const index = fs.readFileSync(path.join(root, "index.html"), "utf8");

assert.strictEqual(engine.normalizePhase("Pré-edital"), engine.PRE_NOTICE);
assert.strictEqual(engine.normalizePhase("Pós-edital"), engine.POST_NOTICE);
assert.strictEqual(engine.normalizePhase(""), "", "Planejamentos antigos não devem receber fase gravada automaticamente.");

const now = new Date("2026-08-17T12:00:00");
const far = engine.postNoticeUrgency({ phase: engine.POST_NOTICE, examDate: "2027-02-13", now });
const near = engine.postNoticeUrgency({ phase: engine.POST_NOTICE, examDate: "2026-09-14", now });
assert.ok(near.value > far.value, "A urgência pós-edital deve crescer continuamente com a aproximação da prova.");
assert.strictEqual(engine.postNoticeUrgency({ phase: engine.POST_NOTICE, examDate: "", now }).available, false, "Sem data não pode haver urgência presumida.");

const pre = engine.phaseProfile({ phase: engine.PRE_NOTICE, examDate: "2026-09-14", now });
const post = engine.phaseProfile({ phase: engine.POST_NOTICE, examDate: "2026-09-14", now });
assert.ok(pre.incidenceMultiplier < post.incidenceMultiplier, "A incidência deve pesar mais no pós-edital.");
assert.ok(pre.diagnosisMultiplier > post.diagnosisMultiplier, "O diagnóstico inicial deve perder influência no pós-edital.");
assert.ok(post.reviewMultiplier > pre.reviewMultiplier, "Revisões devem ganhar espaço gradualmente no pós-edital.");
assert.strictEqual(engine.suggestActivity({ phase: engine.POST_NOTICE, examDate: "2026-09-14", hasContact: false, currentActivity: "Teoria" }), "Teoria", "Conteúdo novo não pode ser bloqueado na reta final.");
assert.strictEqual(engine.suggestActivity({ phase: engine.POST_NOTICE, examDate: "2026-09-14", hasContact: true, currentActivity: "Teoria e questões" }), "Questões");

const insufficient = engine.coverageRisk({ phase: engine.POST_NOTICE, examDate: "2026-09-14", totalTopics: 50, contactedTopics: 10, recentContactCount: 2, observedDays: 14, weeklyHours: 20 });
assert.strictEqual(insufficient.available, false, "A projeção não deve inventar risco com amostra insuficiente.");
const risk = engine.coverageRisk({ phase: engine.POST_NOTICE, examDate: "2026-09-14", totalTopics: 50, contactedTopics: 10, recentContactCount: 4, observedDays: 14, weeklyHours: 20 });
assert.strictEqual(risk.available, true);
assert.strictEqual(risk.atRisk, true);

assert.ok(index.includes('id="examPhase"'), "Dados do Concurso deve permitir escolher a fase.");
assert.ok(index.includes('id="newPlanExamPhase"'), "Novo planejamento deve permitir escolher a fase.");
assert.ok(index.includes('./js/exam-phase.js?v=20260817-exam-phase'), "O motor de fase deve ser carregado antes do app.");
assert.ok(app.includes("examPhase: window.ExamPhaseEngine?.normalizePhase"), "A fase deve integrar o snapshot sem pontuação derivada.");
assert.ok(app.includes("phaseUpdatedAt"), "A atualização da fase deve ser persistida.");
assert.ok(app.includes("O ciclo atual") && app.includes("não será reorganizado"), "A transição deve preservar explicitamente o ciclo atual.");
assert.ok(app.includes("currentExamPhaseState().profile"), "Recomendação e geração devem consultar o mesmo motor de fase.");

console.log("OK - fases pré/pós-edital preservam legado, usam urgência contínua e afetam apenas planejamento futuro.");
