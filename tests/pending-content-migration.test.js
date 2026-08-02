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
assert.ok(app.includes("function normalizeManualThemeText"), "A edição manual precisa limpar pontuação repetida antes de salvar.");
assert.ok(app.includes("conteudosOriginais: details ? topicAtoms(details) : []"), "A edição manual não pode restaurar o conteúdo agrupado antigo.");
assert.ok(app.includes('renderRows({ preserveState: true });\n    void saveAppStateNow("Tema atualizado")'), "Salvar tema manualmente precisa preservar o ciclo e persistir a alteração.");
assert.ok(app.includes('article.querySelector("[data-save-topic-edit]")?.addEventListener("click"'), "O botão de salvar precisa de listener direto no card dinâmico.");
assert.ok(app.includes("function pendingMigrationSubjectSummary"), "A prévia deve informar também as matérias pendentes que não terão alteração.");
assert.ok(app.includes("Outros temas pendentes"), "A prévia deve deixar claro que temas não reorganizados permanecem no planejamento.");
assert.ok(app.includes("if (!titleInput) {\n      // Temas fora da prévia não foram revisados manualmente e devem ficar intactos."), "A migração não pode desmarcar temas que não aparecem na prévia.");
assert.ok(app.includes("planningBase: state.planningBase ? JSON.parse(JSON.stringify(state.planningBase)) : null"), "O backup da migração deve preservar pesos e dificuldades.");
assert.ok(app.includes("function pruneHistoricalDuplicatesFromCurrentCycle"), "Blocos pendentes já concluídos em ciclos anteriores não podem voltar ao ciclo atual.");
assert.ok(app.includes("...(state.cycleHistory || []).flatMap"), "A geração deve consultar o histórico de ciclos encerrados.");
assert.ok(app.includes("function historicalCompletionMatches"), "Temas reorganizados devem ser relacionados ao conteúdo concluído nos ciclos anteriores.");
assert.ok(app.includes('let evolutionView = { period: "all"'), "O painel deve abrir mostrando o histórico consolidado, não apenas o ciclo vazio atual.");
assert.ok(app.includes("const wasCompleted = (topic)"), "A cobertura do painel deve reconhecer temas reorganizados a partir do histórico.");
console.log("pending-content-migration.test.js: ok");
