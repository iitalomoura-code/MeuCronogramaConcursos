"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const styles = fs.readFileSync(path.join(root, "styles.css"), "utf8");

assert.ok(app.includes("function historyInheritanceSummaryForSubject"), "O Diagnóstico deve agregar a herança por matéria sem criar outro motor.");
assert.ok(app.includes("function historyInheritanceTopicDetailMarkup"), "Os temas reconhecidos devem reaproveitar as métricas retornadas pelo motor existente.");
assert.ok(app.includes("Verificando seus planejamentos anteriores"), "O carregamento assíncrono deve ser visível, mas discreto.");
assert.ok(/finally\(\(\) => \{\s*\/\/ Limpa o estado antes de redesenhar[\s\S]*?historyInheritanceLoadPromise = null;[\s\S]*?renderInitialDiagnosis\(\)/.test(app), "O rerender final precisa acontecer somente depois de limpar o estado de carregamento.");
assert.ok(app.includes('if (getActiveTabName() === "diagnostico") renderInitialDiagnosis();'), "O Diagnóstico deve atualizar assim que as fontes terminarem de carregar.");
assert.ok(app.includes('if (getActiveTabName() === "pesos") renderPlanningBase();'), "A superfície de Prioridades deve atualizar seu indicador explicativo após a carga.");
assert.ok(app.includes("historyInheritanceSubjectMarkup(histories[index], index)"), "O resumo deve aparecer antes da autoavaliação de cada matéria.");
assert.ok(app.includes("data-toggle-history-subject") && app.includes("aria-expanded"), "Os detalhes históricos devem ter controle acessível e expansível.");
assert.ok(app.includes("Principal:") && app.includes("Também encontrado em:"), "O detalhe deve manter a fonte principal e tornar fontes adicionais auditáveis.");
assert.ok(app.includes("historyRefresh = refreshHistoryInheritanceSources()"), "A busca de histórico deve começar sem bloquear o avanço ao Diagnóstico.");
assert.ok(!app.includes("historicalKnowledgeScore") && !app.includes("crossPlanScore"), "A visualização não pode introduzir um score paralelo de herança.");
assert.ok(styles.includes(".history-inheritance-summary") && styles.includes(".history-inheritance-details"), "O resumo e os detalhes precisam de estilos compactos próprios.");

console.log("OK - herança histórica fica visível e auditável sem alterar a lógica estratégica.");
