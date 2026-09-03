"use strict";

const assert = require("assert");
const path = require("path");
const parser = require(path.resolve(__dirname, "..", "js", "document-structure-parser.js"));

const portuguese = parser.analyze({ text: `
LÍNGUA PORTUGUESA

1. Interpretação, tipologia, gêneros e organização textual
Gêneros literários e não literários; textos narrativos, descritivos e argumentativos; interpretação; organização interna do texto.

2. Semântica e emprego vocabular
Sentido e emprego dos vocábulos; campos semânticos.
` });
assert.equal(portuguese.mode, "structured", "Taxonomia com título e descrição deve preservar a estrutura.");
assert.equal(portuguese.rows.length, 2, "Cada título numerado deve gerar um tema.");
assert.equal(portuguese.rows[0].conteudosOriginais.length, 1, "Ponto e vírgula em descrição estruturada não deve fragmentar o conteúdo.");
assert.ok(portuguese.rows[0].assunto.includes("textos narrativos, descritivos e argumentativos"));
assert.equal(portuguese.rows[0].outlineNumber, "1");

const subareas = parser.analyze({ text: `
DIREITO TRIBUTÁRIO E PREVIDENCIÁRIO

Direito Tributário
1. Sistema Tributário, competência e limitações ao poder de tributar
Competência tributária; princípios; imunidades.

Direito Previdenciário
9. Seguridade Social e RGPS
Fundamentos; evolução; princípios.
` });
assert.equal(subareas.mode, "structured");
assert.equal(new Set(subareas.rows.map((row) => row.materia)).size, 1, "Subáreas não podem virar novas matérias.");
assert.deepEqual(subareas.rows.map((row) => row.subarea), ["Direito Tributário", "Direito Previdenciário"]);

const raw = parser.analyze({ text: "DIREITO ADMINISTRATIVO\nPrincípios administrativos; atos administrativos; poderes administrativos; agentes públicos; processo administrativo; responsabilidade civil do Estado." });
assert.equal(raw.mode, "raw", "Edital bruto deve continuar no fluxo de interpretação pedagógica.");
assert.equal(raw.structureSource, "parser");

const genericSection = parser.analyze({ text: `
CONHECIMENTOS ESPECÍFICOS

DIREITO CONSTITUCIONAL
1. Direitos fundamentais
Direitos individuais; direitos sociais.
2. Organização do Estado
Entes federativos; competências.
` });
assert.equal(genericSection.rows[0].materia, "DIREITO CONSTITUCIONAL", "Seção genérica não pode ser lida como disciplina.");
assert.ok(genericSection.tree.some((node) => node.type === "section" && node.text === "CONHECIMENTOS ESPECÍFICOS"));

const editorial = parser.analyze({ text: `
LÍNGUA PORTUGUESA
1. Semântica
Sentido das palavras.
Para o seu sistema: Estatística e Fluência em Dados devem permanecer como matérias diferentes.
2. Pontuação
Emprego dos sinais de pontuação.
` });
assert.equal(editorial.rows.length, 2, "Comentário editorial não pode virar tema.");
assert.ok(editorial.problems.some((problem) => problem.type === "editorial-note"));

const manualBreak = parser.analyze({ nodes: [
  { kind: "heading", level: 1, text: "LÍNGUA PORTUGUESA", sourceLine: 1 },
  { kind: "paragraph", text: "1. Pontuação", sourceLine: 2 },
  { kind: "paragraph", text: "Emprego dos sinais de pontuação; usos especiais.", sourceLine: 3 },
  { kind: "paragraph", text: "2. Concordância", sourceLine: 4 },
  { kind: "paragraph", text: "Concordância nominal e verbal.", sourceLine: 5 },
] });
assert.equal(manualBreak.rows.length, 2, "Quebra manual deve separar título e descrição sem concatená-los como título.");
assert.equal(manualBreak.rows[0].assunto.split(":")[0], "Pontuação");

const headingSubareas = parser.analyze({ nodes: [
  { kind: "heading", level: 1, text: "DIREITO TRIBUTÁRIO E PREVIDENCIÁRIO", sourceLine: 1 },
  { kind: "heading", level: 2, text: "Direito Tributário", sourceLine: 2 },
  { kind: "paragraph", text: "1. Sistema Tributário", sourceLine: 3 },
  { kind: "paragraph", text: "Competência tributária.", sourceLine: 4 },
  { kind: "heading", level: 2, text: "Direito Previdenciário", sourceLine: 5 },
  { kind: "paragraph", text: "2. Regime Geral de Previdência Social", sourceLine: 6 },
  { kind: "paragraph", text: "Fundamentos e princípios.", sourceLine: 7 },
] });
assert.equal(new Set(headingSubareas.rows.map((row) => row.materia)).size, 1, "Hierarquia de heading do DOCX deve preservar a matéria principal.");
assert.deepEqual(headingSubareas.rows.map((row) => row.subarea), ["Direito Tributário", "Direito Previdenciário"]);

console.log("OK - parser híbrido preserva estrutura, subáreas, notas editoriais e quebras de documento.");
