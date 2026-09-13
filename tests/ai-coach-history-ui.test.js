"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

const app = fs.readFileSync("app.js", "utf8");
const coachFunction = app.slice(app.indexOf("function aiCoachHistoryItemMarkup"), app.indexOf("function renderAICoachSection"));
const clickHandler = app.slice(app.indexOf('const historicalCoachReview = event.target.closest("[data-ai-coach-review-id]")'), app.indexOf('const aiCoachModeButton = event.target.closest("[data-ai-coach-mode]")'));
const historyContext = app.slice(app.indexOf("function scheduleStrategicAdvisorCoachContext"), app.indexOf("function renderStrategicAdvisorContent"));
const dialog = app.slice(app.indexOf("function strategicAdvisorDialogMarkup"), app.indexOf("function scheduleStrategicAdvisorCoachContext"));
const instructions = fs.readFileSync("supabase/functions/ai-strategic-coach/index.ts", "utf8");

assert.ok(app.includes("selectedReviewId"), "o Coach deve manter seleção de review apenas em estado de UI");
assert.ok(coachFunction.includes('<button class="ai-coach-history-item"') && coachFunction.includes("data-ai-coach-review-id") && coachFunction.includes('aria-current="${selected ? "true" : "false"}"'), "cada review recente deve ser um botão acessível e selecionável");
assert.ok(coachFunction.includes("aiCoachHistoricalResponse(selectedRecord)") && coachFunction.includes("Voltar para análise atual"), "um review salvo deve ser renderizado sem gerar novo conteúdo");
assert.ok(clickHandler.includes("renderAICoachSection({ historyOnly: true })") && !clickHandler.includes("requestAICoachAnalysis"), "abrir ou fechar um review histórico não pode chamar o provider");
assert.ok(historyContext.indexOf("aiCoachUIState.selectedReviewId") < historyContext.indexOf("buildCurrentAIStrategicSnapshot"), "um review histórico não pode montar snapshot ou delta");
assert.ok(dialog.indexOf("Ver diagnóstico detalhado do sistema") < dialog.indexOf("${coachMarkup}"), "os detalhes do motor devem ficar separados do Coach");
assert.ok(dialog.includes("Não é uma resposta da IA."), "a leitura determinística precisa ser identificada explicitamente");
assert.ok(instructions.includes("Não transforme a resposta em enumeração de estados dos tópicos") && instructions.includes("trade-offs, evolução, retorno esperado do tempo"), "as instruções devem exigir síntese estratégica, não repetição do motor");

console.log("OK - histórico do Coach é navegável localmente e a leitura do sistema permanece separada da IA.");
