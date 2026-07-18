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
assert.ok(index.includes("styles.css?v=20260718-adaptive-cycle"), "O CSS deve usar o cache-busting atual.");
assert.ok(index.includes("app.js?v=20260718-adaptive-cycle"), "O JavaScript deve usar o cache-busting atual.");
assert.ok(app.includes('snapshot?.dataType === "meu-cronograma-concursos-drive-data"'), "A importação deve reconhecer backups completos de múltiplos planejamentos.");

console.log("OK - estabilização central, extração local e diálogos internos presentes.");
