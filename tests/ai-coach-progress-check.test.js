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
assert.ok(request.includes('mode === "progress-check" ? "Analisando sua evolução..."'), "Progress-check precisa confirmar o clique imediatamente.");
assert.ok(request.includes("window.AIStrategicCoachClient.checkProgress(snapshot, context)"), "Progress-check deve usar checkProgress uma única vez.");
assert.ok(request.indexOf("aiCoachUIState.busy = true") < request.indexOf("yieldForInteraction"), "O estado ocupado deve ser aplicado antes de trabalho pesado.");
assert.ok(request.indexOf("yieldForInteraction") < request.indexOf("buildCurrentAIStrategicSnapshot"), "A interface deve pintar antes de montar o snapshot.");
assert.ok(request.includes("aiCoachUIState.lastResponse = response"), "A resposta deve atualizar o estado visível do Coach.");
assert.ok(request.includes("renderAICoachSection({ delta })") && request.includes("scrollAICoachResultIntoView()"), "O resultado precisa atualizar apenas o Coach e ser revelado dentro do modal.");
assert.ok(!request.includes("switchTab(") && !request.includes("closeStrategicAdvisorModal("), "Progress-check não pode trocar de aba ou fechar o Orientador.");

const scroll = section("function scrollAICoachResultIntoView", "async function loadAICoachHistory");
assert.ok(scroll.includes("dialog.scrollTo"), "O resultado deve rolar somente o container do modal.");

const client = fs.readFileSync("js/ai-coach-client.js", "utf8");
assert.ok(client.includes("if (inFlight.has(key)) return inFlight.get(key);"), "O cliente deve deduplicar chamadas simultâneas.");

console.log("OK - progress-check confirma o clique, deduplica a chamada e mantém a resposta dentro do Orientador.");
