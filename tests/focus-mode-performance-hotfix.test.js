"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const app = fs.readFileSync(path.resolve(__dirname, "..", "app.js"), "utf8");
const section = (start, end) => app.slice(app.indexOf(start), app.indexOf(end, app.indexOf(start)));

const suspend = section("function suspendFocusedStudy", "function clearOrphanedFocusedSession");
assert.ok(suspend.indexOf("removeFocusedStudyOverlay") < suspend.indexOf("scheduleFocusedStudyCloseWork"), "O overlay deve sair antes de qualquer trabalho adiado.");
assert.ok(!suspend.includes("renderContinuePanel()"), "Minimizar não pode reconstruir o painel completo no clique.");

const closeWork = section("function scheduleFocusedStudyCloseWork", "async function saveFocusedStudy");
assert.ok(closeWork.indexOf("renderActiveFocusSessionCard") < closeWork.indexOf("yieldForInteraction"), "O card mínimo deve aparecer antes de ceder o controle ao navegador.");
assert.ok(closeWork.includes("scheduleContinuePanelRefresh"), "A atualização completa deve ser agendada separadamente.");
assert.ok(!closeWork.includes("buildCurrentAIStrategicSnapshot") && !closeWork.includes("loadAICoachHistory"), "Fechar o modo foco não pode acionar o Coach ou gerar snapshot de IA.");

const focusedPersist = section("function persistFocusedSession", "function restoreFocusedSessionFromSnapshot");
assert.ok(focusedPersist.includes("changes: false, force: true"), "Persistência imediata da sessão deve preservar os caches derivados.");
assert.ok(focusedPersist.includes("scheduleAutoSave({ invalidate: false })"), "Persistência debounced do timer não pode invalidar o diagnóstico inteiro.");

const refresh = section("function scheduleContinuePanelRefresh", "function scheduleFocusedStudyCloseWork");
assert.ok(refresh.includes("requestIdleCallback"), "A renderização completa de Continuar deve sair do caminho crítico.");
assert.ok(refresh.includes("renderContinuePanel"), "O painel completo continua sendo atualizado após o caminho rápido.");

const focusSave = section("async function saveFocusedStudy", "function activeFocusSessionMarkup");
assert.ok(focusSave.indexOf("removeFocusedStudyOverlay") < focusSave.indexOf('"yield to browser"'), "Finalizar deve remover o overlay antes dos cálculos derivados.");
assert.ok(focusSave.includes("scheduleFocusedStudyResultRender({ performanceTrace })"), "A atualização do resultado deve continuar adiada após a primeira pintura.");

console.log("OK - o modo foco preserva a resposta visual e mantém trabalho estratégico fora do clique crítico.");
