"use strict";

const assert = require("assert");
const fs = require("fs");

const app = fs.readFileSync("app.js", "utf8");

assert.ok(app.includes("const fallbackHours = Number(block.tempoEstudado) || Number(block.duracao) || 0;"), "Saved study results must fall back to the selected block duration.");
assert.ok(app.includes("typedHours || sessionHours || Number(block.duracao) || 0"), "Focused study must use the selected duration when manual time is empty.");
assert.ok(app.includes("horas: blockDurationValue(block)"), "Evolution entries must retain fallback time for historical blocks.");
assert.ok(app.includes("tempoEstudado: blockDurationValue(block)"), "Completed history must retain fallback time for future records.");

console.log("study-time-fallback.test.js: ok");
