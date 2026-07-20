"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const app = fs.readFileSync(path.resolve(__dirname, "..", "app.js"), "utf8");
const index = fs.readFileSync(path.resolve(__dirname, "..", "index.html"), "utf8");

assert.ok(app.includes("function saveStudyResult"), "O registro central de desempenho deve existir.");
assert.ok(app.includes("function reconstructPdfPageLines"), "A extração de PDF deve reconstruir linhas.");
assert.ok(app.includes("convertToHtml"), "A leitura DOCX deve preservar blocos quando Mammoth oferecer HTML.");
assert.ok(!/\b(?:alert|confirm|prompt)\s*\(/.test(app), "Os fluxos principais não devem usar diálogos nativos.");
assert.ok(index.includes("styles.css?v=20260719-danger-text"), "O CSS deve usar o cache-busting atual.");
assert.ok(index.includes("app.js?v=20260720-cycle-repair"), "O JavaScript deve usar o cache-busting atual.");
assert.ok(app.includes("state.generatedBlocks = [];\n  state.distribution = [];\n  advanceReferenceWeek();"), "O ciclo encerrado deve ser arquivado antes de gerar o próximo.");
assert.ok(app.includes("function pruneTrailingEmptyCycleClosures"), "Fechamentos vazios devem ser removidos do histórico ao restaurar dados.");
assert.ok(app.includes("function reviewDeduplicationKey"), "Revisões duplicadas devem ser consolidadas com uma chave estável.");
assert.ok(app.includes("if (!block.ciclo) block.ciclo = closingCycle;"), "O ciclo de origem deve ser definido antes de arquivar metas concluídas.");
assert.ok(app.includes('snapshot?.dataType === "meu-cronograma-concursos-drive-data"'), "A importação deve reconhecer backups completos de múltiplos planejamentos.");
assert.ok(app.includes("function completedCycleCount"), "A numeração deve ignorar fechamentos sem atividade registrada.");

assert.ok(app.includes("function repairStoredCycleLabels"), "O reparo dos rótulos de ciclos deve estar disponível.");

console.log("OK - estabilização central, extração local e diálogos internos presentes.");
