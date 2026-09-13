"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

const app = fs.readFileSync("app.js", "utf8");
const section = (start, end) => app.slice(app.indexOf(start), app.indexOf(end, app.indexOf(start)));

const markup = section("function aiCoachMarkup", "function renderAICoachSection");
assert.ok(markup.includes('data-ai-coach-mode="cycle-review" ${cycleDisabled ? "disabled" : ""}') && markup.includes('data-ai-coach-mode="progress-check" ${aiCoachUIState.busy ? "disabled" : ""}') && markup.includes("data-ai-coach-focus-question ${aiCoachUIState.busy ? \"disabled\" : \"\"}"), "Os três comandos do Coach precisam ficar indisponíveis durante a consulta.");
assert.ok(markup.includes('role="status" aria-live="polite"') && markup.includes('role="alert"'), "Carregamentos e erros precisam ser anunciados dentro do Coach.");

const request = section("async function requestAICoachAnalysis", "function registerStrategicAdvisorSnapshot");
assert.ok(request.includes("if (aiCoachUIState.busy) return;"), "Um segundo toque não pode iniciar uma segunda consulta.");
assert.ok(request.includes('mode === "question" ? "Preparando o contexto da sua pergunta..."'), "Perguntas precisam informar a preparação local imediatamente.");
assert.ok(request.includes('mode === "cycle-review" ? "Preparando o contexto do seu ciclo..."'), "Cycle-review precisa informar a preparação local imediatamente.");
assert.ok(request.includes("window.AIStrategicCoachClient.checkProgress(providerSnapshot, context)"), "Progress-check deve usar uma única projeção compacta para o provider.");
assert.ok(request.indexOf("aiCoachUIState.busy = true") < request.indexOf("yieldForPaint"), "O estado ocupado deve ser aplicado antes de trabalho pesado.");
assert.ok(request.indexOf("yieldForPaint") < request.indexOf("buildCurrentAIStrategicSnapshotAsync"), "A interface deve pintar antes de montar o snapshot cooperativo.");
assert.ok(!request.includes("buildCurrentAIStrategicSnapshot({"), "Ações interativas do Coach não podem reconstruir o snapshot síncrono.");
assert.ok(request.includes('"compactForProvider"') && request.includes('"AICoachDelta.compare"') && request.includes('"Coach context"'), "Compactação, delta e contexto devem permanecer mensuráveis separadamente.");
assert.ok(request.includes('"timeToProviderRequest"') && request.includes('"Consultando o Coach..."') && request.includes('"Salvando análise..."'), "A interface deve distinguir preparação, espera do provider e persistência.");
assert.ok(request.includes("AI_SNAPSHOT_ENGINE_MISSING") && request.includes("AI_SNAPSHOT_UNAVAILABLE") && request.includes("AI_COACH_CLIENT_MISSING"), "As dependências locais precisam falhar com diagnósticos distintos antes do provider.");
assert.ok(request.includes("aiCoachUIState.lastResponse = response"), "A resposta deve atualizar o estado visível do Coach.");
assert.ok(request.includes("renderAICoachSection({ delta })") && request.includes("scrollAICoachResultIntoView()"), "O resultado precisa atualizar apenas o Coach e ser revelado dentro do modal.");
assert.ok(!request.includes("switchTab(") && !request.includes("closeStrategicAdvisorModal("), "Progress-check não pode trocar de aba ou fechar o Orientador.");

const scroll = section("function scrollAICoachResultIntoView", "async function loadAICoachHistory");
assert.ok(scroll.includes("dialog.scrollTo"), "O resultado deve rolar somente o container do modal.");

const client = fs.readFileSync("js/ai-coach-client.js", "utf8");
assert.ok(client.includes("if (inFlight.has(key)) return inFlight.get(key);"), "O cliente deve deduplicar chamadas simultâneas.");

const asyncSnapshot = section("async function buildCurrentAIStrategicSnapshotAsync", "function strategicAdvisorModel");
assert.ok(asyncSnapshot.includes("strategicPlanningTopicsForModal") && asyncSnapshot.includes("await yieldForPaint()"), "O snapshot interativo deve reutilizar os tópicos cooperativos e ceder pintura entre lotes.");

const planningTopics = section("function strategicPlanningTopics()", "function aiStrategicTopicIdentity");
assert.ok(planningTopics.includes("strategicPlanningTopicsCache") && planningTopics.includes("strategicPlanningTopicsRevision"), "Tópicos estratégicos devem ser reutilizados quando a revisão de evidências for a mesma.");

console.log("OK - progress-check confirma o clique, deduplica a chamada e mantém a resposta dentro do Orientador.");
