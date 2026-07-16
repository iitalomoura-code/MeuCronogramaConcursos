"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const app = fs.readFileSync(path.resolve(__dirname, "..", "app.js"), "utf8");
const index = fs.readFileSync(path.resolve(__dirname, "..", "index.html"), "utf8");
const styles = fs.readFileSync(path.resolve(__dirname, "..", "styles.css"), "utf8");

[
  "normalizeReviewRecord",
  "reviewStatusInfo",
  "reviewRowsForView",
  "reviewSortRank",
  "reviewHistoryEntries",
  "explainPriority",
  "recordReviewAttempt",
].forEach((name) => assert.ok(app.includes(`function ${name}`), `A função ${name} deve existir.`));

["reviewSearch", "reviewFilter", "reviewSubjectFilter", "reviewSummary", "reviewsBody", "reviewHistoryModal"]
  .forEach((id) => assert.ok(index.includes(`id="${id}"`), `O elemento ${id} deve existir.`));

assert.ok(app.includes('record.adiamentoTipo = type === "ciclo"'), "O adiamento por ciclo deve ser representado sem data inventada.");
assert.ok(app.includes('Dispon\\u00edvel no pr\\u00f3ximo ciclo poss\\u00edvel'), "A disponibilidade por ciclo deve usar texto claro.");
assert.ok(app.includes('data-start-review'), "As revisões devem abrir o modo focado pelo contexto de revisão.");
assert.ok(app.includes('context: "revisao"'), "O modo focado deve receber o contexto de revisão.");
assert.ok(app.includes('data-review-history'), "Cada revisão deve permitir consultar o histórico do tema.");
assert.ok(app.includes('data-cancel-review'), "O cancelamento deve ser explícito e preservar o histórico.");
assert.ok(app.includes("review-card-list"), "As revisões devem ser exibidas em cartões agrupados.");
assert.ok(styles.includes(".review-summary-grid"), "O resumo das revisões deve ter estilo próprio.");
assert.ok(styles.includes(".review-history-modal"), "O histórico deve ter painel/modal próprio.");

console.log("OK - experiência de revisões, histórico e transparência adaptativa presentes.");
