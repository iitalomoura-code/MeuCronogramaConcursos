"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

const app = fs.readFileSync("app.js", "utf8");
const instructions = fs.readFileSync("supabase/functions/ai-strategic-coach/index.ts", "utf8");
const responseMarkup = app.slice(app.indexOf("function aiCoachResponseMarkup"), app.indexOf("function aiCoachMarkup"));
const questionMarkup = responseMarkup.slice(responseMarkup.indexOf('if (mode === "question"'), responseMarkup.indexOf("let modeContent"));
const confidenceMarkup = app.slice(app.indexOf("function aiCoachConfidenceLabel"), app.indexOf("function hasMeaningfulAICoachDelta"));

assert.ok(instructions.includes("orientador experiente conversando diretamente com o aluno"), "o Coach deve receber uma voz conversacional");
assert.ok(instructions.includes("Não escreva como relatório técnico, dashboard, auditoria ou laudo"), "o Coach não deve soar como dashboard");
assert.ok(instructions.includes("nunca exponha termos como delta, rank, override, snapshot"), "o Coach deve traduzir o jargão interno");
assert.ok(instructions.includes("Também não escreva unknown, autoridade estratégica") && instructions.includes("nunca os apresente como linguagem final ao aluno"), "o Coach deve proibir explicitamente jargão de implementação na resposta final");
assert.ok(instructions.includes('prefira "Eu manteria..."') && instructions.includes("Evite construções impessoais, burocráticas ou linguagem de backend"), "o Coach deve manter uma voz conversacional e direta");
assert.ok(instructions.includes("Assuma uma posição quando os dados permitirem"), "o Coach deve recomendar uma ação explícita");
assert.ok(instructions.includes("Se não houver novos estudos ou mudança relevante, seja conciso"), "progress-check sem mudança deve ser conciso");
assert.ok(instructions.includes("primeira análise, crie um baseline em linguagem natural, sem fingir evolução anterior"), "a primeira análise deve criar baseline sem inventar evolução");
assert.ok(instructions.includes("a IA recomenda, o motor local calcula e o usuário decide"), "nenhum cálculo determinístico pode ser transferido para a IA");
assert.ok(app.includes("function hasMeaningfulAICoachDelta") && app.includes("if (!hasMeaningfulAICoachDelta(delta)) return \"\""), "a interface não deve repetir métricas zeradas sem mudança");
assert.ok(responseMarkup.indexOf('section("O que eu faria agora"') < responseMarkup.indexOf("${modeContent}"), "a orientação do Coach deve vir antes dos detalhes do modo");
assert.ok(questionMarkup.includes("Resposta do Coach") && questionMarkup.includes("O que eu evitaria agora"), "o modo question deve priorizar resposta direta, ação e o que evitar");
assert.ok(questionMarkup.includes("answer.recommendation?.length ? answer.recommendation : review.recommendation"), "o modo question deve ter uma única fonte visual de recomendação, com fallback seguro");
assert.ok(!questionMarkup.includes('section("Prioridades"') && !questionMarkup.includes("Conclusão principal"), "o modo question não pode repetir prioridades ou resumo genérico ao lado da resposta direta");
assert.ok(confidenceMarkup.includes('high: "Confiança da análise: alta"') && confidenceMarkup.includes('medium: "Confiança da análise: média"') && confidenceMarkup.includes('low: "Confiança da análise: baixa"'), "a confiança do Coach deve ser traduzida para português claro");
assert.ok(!responseMarkup.includes("escapeHtml(review.periodDiagnosis?.confidence"), "a interface não pode exibir high, medium ou low crus");
assert.ok(responseMarkup.includes('mode === "cycle-review"') && responseMarkup.includes("review.sinceLastReview"), "progress-check e cycle-review devem preservar suas leituras próprias");

console.log("OK - o AI Coach usa voz conversacional, recomenda de forma explícita e evita relatório sem mudança.");
