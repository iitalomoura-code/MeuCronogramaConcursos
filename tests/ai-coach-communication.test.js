"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

const app = fs.readFileSync("app.js", "utf8");
const instructions = fs.readFileSync("supabase/functions/ai-strategic-coach/index.ts", "utf8");
const responseMarkup = app.slice(app.indexOf("function aiCoachResponseMarkup"), app.indexOf("function aiCoachMarkup"));

assert.ok(instructions.includes("orientador experiente conversando diretamente com o aluno"), "o Coach deve receber uma voz conversacional");
assert.ok(instructions.includes("Não escreva como relatório técnico, dashboard, auditoria ou laudo"), "o Coach não deve soar como dashboard");
assert.ok(instructions.includes("nunca exponha termos como delta, rank, override, snapshot"), "o Coach deve traduzir o jargão interno");
assert.ok(instructions.includes("Assuma uma posição quando os dados permitirem"), "o Coach deve recomendar uma ação explícita");
assert.ok(instructions.includes("Se não houver novos estudos ou mudança relevante, seja conciso"), "progress-check sem mudança deve ser conciso");
assert.ok(instructions.includes("primeira análise, crie um baseline em linguagem natural, sem fingir evolução anterior"), "a primeira análise deve criar baseline sem inventar evolução");
assert.ok(instructions.includes("a IA recomenda, o motor local calcula e o usuário decide"), "nenhum cálculo determinístico pode ser transferido para a IA");
assert.ok(app.includes("function hasMeaningfulAICoachDelta") && app.includes("if (!hasMeaningfulAICoachDelta(delta)) return \"\""), "a interface não deve repetir métricas zeradas sem mudança");
assert.ok(responseMarkup.indexOf('section("O que eu faria agora"') < responseMarkup.indexOf("${modeContent}"), "a orientação do Coach deve vir antes dos detalhes do modo");

console.log("OK - o AI Coach usa voz conversacional, recomenda de forma explícita e evita relatório sem mudança.");
