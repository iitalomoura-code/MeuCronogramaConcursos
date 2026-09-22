"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

const styles = fs.readFileSync("styles.css", "utf8");
const contentStart = styles.indexOf(".content-area {");
const contentEnd = styles.indexOf("}", contentStart);
const contentArea = styles.slice(contentStart, contentEnd + 1);
const responsiveStart = styles.indexOf("/* Layouts que dependem da largura realmente disponível");
const responsive = styles.slice(responsiveStart);

assert.ok(contentArea.includes("min-width: 0"), "A área principal precisa poder encolher ao lado da navegação.");
assert.ok(contentArea.includes("container: app-content / inline-size"), "Os painéis precisam responder à largura da área de conteúdo, não à viewport inteira.");
assert.ok(responsive.includes("@container app-content (min-width: 960px)"), "Continuar deve ganhar duas colunas apenas quando a coluna de conteúdo comportar ambas.");
assert.ok(responsive.includes("@container app-content (max-width: 959px)"), "Continuar e Evolução precisam ter fallback de uma coluna dentro da área estreita.");
assert.ok(responsive.includes("#tab-evolucao .evolution-subject-card {\n    grid-template-columns: minmax(0, 1fr)"), "Linhas de matéria na Evolução devem empilhar dentro de uma coluna estreita.");
assert.ok(responsive.includes("overflow-wrap: anywhere"), "Nomes longos de matérias precisam quebrar sem ampliar a página.");
assert.ok(responsive.includes("@media (pointer: coarse)"), "Controles principais precisam manter área de toque adequada.");

console.log("OK - Continuar e Evolução respondem à largura útil, preservam textos longos e áreas de toque.");
