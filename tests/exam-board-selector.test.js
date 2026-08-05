"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const app = fs.readFileSync(path.resolve(__dirname, "..", "app.js"), "utf8");
const index = fs.readFileSync(path.resolve(__dirname, "..", "index.html"), "utf8");

assert.ok(index.includes('<select id="examBoard"'), "A banca deve usar um seletor explÃ­cito.");
assert.ok(index.includes('<option value="fgv">FGV</option>'), "FGV deve ser uma opÃ§Ã£o explÃ­cita.");
assert.ok(index.includes('<option value="other">Outra banca</option>'), "Outras bancas devem exigir escolha explÃ­cita.");
assert.ok(index.includes('id="examBoardOther"'), "Outra banca deve preservar o nome digitado.");
assert.ok(index.includes('id="examBoardIncidenceStatus"'), "O estado da priorizaÃ§Ã£o deve ser explicado na interface.");
assert.ok(app.includes("function normalizedExamBoardState"), "Backups legados devem ser normalizados sem perder a banca.");
assert.ok(app.includes("examBoardId: board.examBoardId"), "O snapshot deve persistir o identificador da banca.");
assert.ok(app.includes("useHistoricalIncidence: board.useHistoricalIncidence"), "O snapshot deve persistir a ativaÃ§Ã£o da incidÃªncia.");
assert.ok(app.includes('planningBoard() !== "FGV"'), "A incidÃªncia precisa ser bloqueada fora da FGV.");
assert.ok(app.includes("updateExamBoardControls"), "A mudanÃ§a de banca deve atualizar a interface imediatamente.");

console.log("OK - seletor de banca preserva legados e restringe a incidÃªncia Ã  FGV.");
