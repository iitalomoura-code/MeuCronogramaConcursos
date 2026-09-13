"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

const app = fs.readFileSync("app.js", "utf8");
const styles = fs.readFileSync("styles.css", "utf8");

assert.ok(app.includes("items.slice(0, 2)") && app.includes("shortText(item.title, 72)"), "O resumo compacto do Orientador deve limitar títulos longos fora da análise completa.");
assert.ok(/\.continue-primary-column,\s*\.continue-context-column\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\)/.test(styles), "As colunas do Continuar devem ter uma trilha que possa encolher.");
assert.ok(/\.continue-primary-column > \*,\s*\.continue-context-column > \*\s*\{[\s\S]*?min-width:\s*0[\s\S]*?width:\s*100%/.test(styles), "Os cards do Continuar devem respeitar a largura disponível.");
assert.ok(/\.strategic-advisor-glance\s*\{[\s\S]*?grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/.test(styles), "O resumo do Orientador deve distribuir seus blocos sem expandir a página.");
assert.ok(/@media \(max-width: 700px\) \{[\s\S]*?\.strategic-advisor-glance\s*\{\s*grid-template-columns:\s*1fr/.test(styles), "O resumo do Orientador deve empilhar no celular.");
assert.ok(/\.strategic-advisor-glance strong\s*\{[\s\S]*?-webkit-line-clamp:\s*2/.test(styles), "Títulos longos do resumo devem permanecer compactos.");
assert.ok(styles.includes("#tab-evolucao .evolution-chart svg { width: 100%; height: auto; min-width: 0; }"), "O gráfico de evolução deve usar a largura real disponível.");

console.log("OK - cards, resumo estratégico e gráfico mantêm contenção responsiva.");
