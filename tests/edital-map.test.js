const assert = require("assert");
const fs = require("fs");

const app = fs.readFileSync("app.js", "utf8");
const html = fs.readFileSync("index.html", "utf8");
const css = fs.readFileSync("styles.css", "utf8");

assert.ok(html.includes('class="evolution-card evolution-edital-map-card"'), "O Mapa do edital deve ficar integrado ao Painel de Evolução.");
assert.ok(html.includes('id="editalMapBody"'), "O mapa precisa de uma área própria de renderização.");
assert.ok(app.includes("function editalMapTopicState"), "O estado de cada tema deve reutilizar blocos e revisões existentes.");
assert.ok(app.includes("function renderEditalMap"), "O mapa deve ter renderização própria.");
assert.ok(app.includes('if (tabName === "evolucao") safeRender("Mapa do edital", renderEditalMap);'), "O mapa deve ser renderizado ao abrir o Painel de Evolução.");
assert.ok(app.includes("reviewAttentionFor(materia, assunto)"), "Revisões pendentes devem ser consultadas pelo mecanismo existente.");
assert.ok(app.includes("editalMapSubjectPriority"), "As matérias devem ser ordenadas pela prioridade atual.");
assert.ok(app.includes("const open = editalMapOpenSubjects.has(key);"), "As matérias do mapa devem iniciar recolhidas.");
assert.ok(html.includes('data-edital-map-filter="review-pending"'), "O filtro de revisões pendentes deve existir.");
assert.ok(css.includes(".edital-map-subject"), "O CSS precisa incluir o acabamento dos blocos expansíveis.");
assert.ok(css.includes(".edital-map-progress"), "O CSS precisa incluir a barra de cobertura.");
console.log("edital-map.test.js: ok");
