const assert = require("assert");
const fs = require("fs");
const migration = require("../js/pending-content-migration.js");
const grouping = require("../js/pedagogical-grouping.js");
const app = fs.readFileSync("app.js", "utf8");

const rows = [
  { materia: "Administração Financeira e Orçamentária", assunto: "Despesa pública: Conceito; Classificações; Estágios da despesa; Empenho; Liquidação; Pagamento; Restos a pagar; Despesas de exercícios anteriores; Suprimento de fundos", conteudosOriginais: ["Conceito", "Classificações", "Estágios da despesa", "Empenho", "Liquidação", "Pagamento", "Restos a pagar", "Despesas de exercícios anteriores", "Suprimento de fundos"] },
  { materia: "Língua Portuguesa", assunto: "Interpretação de textos" },
  { materia: "Língua Portuguesa", assunto: "Ortografia" },
  { materia: "Língua Portuguesa", assunto: "Acentuação" },
];

const plan = migration.buildPlan(rows, (row) => row.assunto === "Interpretação de textos" ? "completed" : "not-started", grouping.groupRows);
assert.equal(plan.preserved.length, 1, "Tema concluído precisa permanecer fora da reorganização.");
assert.ok(plan.replacements.some((row) => row.metaTitulo === "Despesa pública"), "Tema amplo deve manter uma meta temática estável.");
assert.ok(plan.replacements.some((row) => row.assunto.startsWith("Restos a pagar")), "Restos a pagar deve virar uma unidade própria.");
assert.ok(plan.replacements.some((row) => row.assunto.startsWith("Ortografia, acentuação e pontuação") || row.assunto.startsWith("Ortografia, acentuaÃ§Ã£o e pontuaÃ§Ã£o")), "Conteúdos pendentes correlatos devem continuar usando a taxonomia.");
assert.ok(plan.replacements.filter((row) => row.metaTitulo === "Despesa pública").every((row) => row.metaRequiredBlocks >= 2), "Unidades do tema amplo precisam permanecer vinculadas à mesma meta.");
assert.ok(app.includes("function refreshPlanningBaseFromRows"), "A migração precisa atualizar somente os temas futuros da base de planejamento.");
assert.ok(app.includes("renumberRows({ sync: false, preserveState: true })"), "Confirmar conteúdo não pode limpar ciclos ao apenas renumerar temas.");
console.log("pending-content-migration.test.js: ok");
