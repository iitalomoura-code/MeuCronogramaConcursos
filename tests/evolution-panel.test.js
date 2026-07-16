"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const app = fs.readFileSync(path.resolve(__dirname, "..", "app.js"), "utf8");
const index = fs.readFileSync(path.resolve(__dirname, "..", "index.html"), "utf8");
const styles = fs.readFileSync(path.resolve(__dirname, "..", "styles.css"), "utf8");

[
  "evolutionTopicCatalog",
  "evolutionEntries",
  "evolutionProgressMetrics",
  "performanceTotalsFromEntries",
  "performanceTrend",
  "deadlineProjection",
  "evaluateSubjectAttention",
  "exportEvolutionSummary",
  "renderEvolution",
].forEach((name) => assert.ok(app.includes(`function ${name}`), `A função ${name} deve existir.`));

["evolutionPeriod", "evolutionSubjectFilter", "evolutionActivityFilter", "evolutionSubjectSort", "exportEvolutionButton", "evolutionTopicModal"]
  .forEach((id) => assert.ok(index.includes(`id=\"${id}\"`), `O elemento ${id} deve existir.`));

assert.ok(app.includes('normalizeForMatch(topic.estudar || "sim") !== "nao"'), "Temas retirados do estudo não podem entrar no denominador do progresso.");
assert.ok(app.includes("totals.acertos"), "O painel deve somar acertos antes de calcular desempenho.");
assert.ok(app.includes("EVOLUTION_TREND_MARGIN = 0.03"), "A tendência deve usar margem mínima de 3 pontos percentuais.");
assert.ok(app.includes("subject.performance.questoes >= EVOLUTION_MIN_SAMPLE_QUESTIONS"), "Atenção por matéria deve exigir amostra mínima quando baseada em acertos.");
assert.ok(app.includes("evolutionView.subject !== \"all\""), "A projeção global deve avisar quando houver filtro de matéria.");
assert.ok(app.includes("resumo-evolucao.txt"), "A exportação de resumo deve gerar arquivo de texto.");
assert.ok(styles.includes(".evolution-overview-grid"), "O painel de evolução deve ter estilos próprios.");
assert.ok(styles.includes(".evolution-topic-modal"), "Os detalhes devem ter modal acessível próprio.");

console.log("OK - painel de evolução consolida progresso, desempenho, projeção e exportação.");
