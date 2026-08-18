"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const app = fs.readFileSync(path.resolve(__dirname, "..", "app.js"), "utf8");
const helperStart = app.indexOf("function settleFocusedSessionForCycleClosure()");
const closureStart = app.indexOf("async function confirmCycleClosure()");
const closureBody = app.slice(closureStart, app.indexOf("function aggregateHistoricalSubjects", closureStart));

assert.ok(helperStart >= 0, "O fechamento deve tratar uma sessão de foco ativa.");
assert.ok(app.slice(helperStart, app.indexOf("function removeFocusedStudyOverlay", helperStart)).includes("stopFocusedTimerInterval();"), "O cronômetro deve ser interrompido antes de fechar o ciclo.");
assert.ok(app.slice(helperStart, app.indexOf("function removeFocusedStudyOverlay", helperStart)).includes("clearFocusedSessionPersistenceTimers();"), "Os salvamentos periódicos da sessão devem ser interrompidos.");
assert.ok(app.slice(helperStart, app.indexOf("function removeFocusedStudyOverlay", helperStart)).includes("state.activeFocusSession = null;"), "A sessão ativa deve ser removida antes de arquivar os blocos.");
assert.ok(closureBody.indexOf("settleFocusedSessionForCycleClosure();") < closureBody.indexOf("hasRecordedCycleActivity()"), "A sessão de foco deve ser resolvida antes de validar o fechamento.");
assert.ok(app.includes("syncReviews = true"), "O salvamento deve declarar explicitamente o controle de sincronização das revisões.");
assert.ok(app.includes("if (syncReviews) syncBlockReviewRecords(block);"), "O salvamento não deve acessar uma opção fora do escopo.");

console.log("OK - fechamento do ciclo encerra sessão de foco e preserva o registro.");
