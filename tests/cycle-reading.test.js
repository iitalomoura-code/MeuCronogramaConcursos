"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const app = fs.readFileSync(path.resolve(__dirname, "..", "app.js"), "utf8");
const styles = fs.readFileSync(path.resolve(__dirname, "..", "styles.css"), "utf8");

assert.ok(app.includes("function cycleBlockDisplayInfo"), "A leitura do bloco deve ser centralizada em um helper visual.");
assert.ok(app.includes("Ajustes adaptativos"), "A lista deve separar ajustes ativos do ciclo-base.");
assert.ok(app.includes("data-start-cycle"), "Cada bloco pendente deve oferecer início direto pelo Modo Foco.");
assert.ok(app.includes("openFocusedStudy(index, { context: cycleBlockDisplayInfo(block).focusContext })"), "O início direto deve reutilizar o Modo Foco existente.");
assert.ok(!app.includes('const panel = document.querySelector("#tab-continuar");\n  if (!panel || !panel.classList.contains("active")) return;'), "O Modo Foco deve abrir também quando o bloco for iniciado no Ciclo Atual.");
assert.ok(app.includes("Por que entrou agora?"), "A explicação deve usar linguagem humana, sem score técnico.");
assert.ok(app.includes("collapsible: true"), "Os concluídos devem permanecer recolhidos por padrão.");
assert.ok(styles.includes(".cycle-type-badge"), "Os tipos de bloco devem ter identificação visual discreta.");
assert.ok(styles.includes(".cycle-goal-card.has-adaptive-adjustment"), "Ajustes adaptativos devem ser distinguíveis sem cores agressivas.");

console.log("OK - Ciclo Atual apresenta tipos, ajustes adaptativos e concluídos recolhidos.");
