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
assert.equal(portuguese.rows[0].assunto, "Interpretação, tipologia, gêneros e organização textual", "O título não pode receber a descrição do parágrafo seguinte.");
assert.ok(portuguese.rows[0].descricao.includes("textos narrativos, descritivos e argumentativos"));
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

const sequentialDocxSubjects = parser.analyze({ nodes: [
  { type: "paragraph", text: "LÍNGUA PORTUGUESA", sourceOrder: 0 },
  { type: "gap", text: "", sourceOrder: 1 },
  { type: "numbered-item", text: "Interpretação, tipologia e organização textual", outlineNumber: "1", outlineLevel: 1, sourceBlockType: "docx-numbered", sourceOrder: 2 },
  { type: "paragraph", text: "Gêneros literários e não literários; textos narrativos, descritivos e argumentativos.", sourceOrder: 3 },
  { type: "numbered-item", text: "Reescrita e norma culta", outlineNumber: "7", outlineLevel: 1, sourceBlockType: "docx-numbered", sourceOrder: 4 },
  { type: "paragraph", text: "Substituição, deslocamento e adequação gramatical.", sourceOrder: 5 },
  { type: "gap", text: "", sourceOrder: 6 },
  { type: "paragraph", text: "LÍNGUA INGLESA", sourceOrder: 7 },
  { type: "gap", text: "", sourceOrder: 8 },
  { type: "numbered-item", text: "Compreensão e interpretação de textos em inglês", outlineNumber: "1", outlineLevel: 1, sourceBlockType: "docx-numbered", sourceOrder: 9 },
  { type: "paragraph", text: "Ideias principais e secundárias; inferência e contexto.", sourceOrder: 10 },
  { type: "numbered-item", text: "Vocabulário e relações semânticas", outlineNumber: "2", outlineLevel: 1, sourceBlockType: "docx-numbered", sourceOrder: 11 },
  { type: "paragraph", text: "Vocabulário contextual e relações de sentido.", sourceOrder: 12 },
  { type: "gap", text: "", sourceOrder: 13 },
  { type: "paragraph", text: "RACIOCÍNIO LÓGICO-MATEMÁTICO E ESTATÍSTICA", sourceOrder: 14 },
  { type: "numbered-item", text: "Lógica proposicional e argumentação", outlineNumber: "1", outlineLevel: 1, sourceBlockType: "docx-numbered", sourceOrder: 15 },
  { type: "paragraph", text: "Proposições; conectivos; equivalências lógicas e argumentos.", sourceOrder: 16 },
] });
assert.equal(sequentialDocxSubjects.mode, "structured", "Sequência de matérias e listas do DOCX deve usar o modo estruturado.");
assert.deepEqual([...new Set(sequentialDocxSubjects.rows.map((row) => row.materia))], ["LÍNGUA PORTUGUESA", "LÍNGUA INGLESA", "RACIOCÍNIO LÓGICO-MATEMÁTICO E ESTATÍSTICA"], "A reinicialização da lista deve delimitar matérias consecutivas.");
assert.equal(sequentialDocxSubjects.rows.find((row) => row.materia === "LÍNGUA INGLESA" && row.outlineNumber === "1").sourceBlockType, "docx-numbered", "A lista automática do Word deve chegar ao row final com sua origem.");
assert.ok(!sequentialDocxSubjects.rows.find((row) => row.materia === "LÍNGUA INGLESA").descricao.includes("Proposições"), "Conteúdo de Raciocínio Lógico não pode ser incorporado ao Inglês.");
assert.ok(sequentialDocxSubjects.rows.find((row) => row.materia.startsWith("RACIOCÍNIO") && row.descricao.includes("Proposições; conectivos")), "A descrição deve permanecer no tema da matéria correta.");

const acronymTopicsInDocx = parser.analyze({ nodes: [
  { type: "paragraph", text: "LEGISLAÇÃO TRIBUTÁRIA", sourceOrder: 0 },
  { type: "numbered-item", text: "CSLL", outlineNumber: "1", outlineLevel: 1, sourceBlockType: "docx-numbered", sourceOrder: 1 },
  { type: "paragraph", text: "Princípios; fato gerador; contribuinte e base de cálculo.", sourceOrder: 2 },
  { type: "numbered-item", text: "IPI E IOF", outlineNumber: "2", outlineLevel: 1, sourceBlockType: "docx-numbered", sourceOrder: 3 },
  { type: "paragraph", text: "Princípios constitucionais e apuração.", sourceOrder: 4 },
] });
assert.deepEqual([...new Set(acronymTopicsInDocx.rows.map((row) => row.materia))], ["LEGISLAÇÃO TRIBUTÁRIA"], "Siglas em itens numerados devem permanecer na matéria aberta.");
assert.deepEqual(acronymTopicsInDocx.rows.map((row) => row.assunto.split(":")[0]), ["CSLL", "IPI E IOF"]);

const separatedStructuredFields = parser.analyze({ nodes: [
  { type: "paragraph", text: "CONTABILIDADE GERAL", sourceOrder: 0 },
  { type: "numbered-item", text: "Fundamentos, princípios e patrimônio", outlineNumber: "1", outlineLevel: 1, sourceBlockType: "docx-numbered", sourceOrder: 1 },
  { type: "paragraph", text: "Conceito, objeto, objetivos e usuários da Contabilidade; princípios e normas brasileiras.", sourceOrder: 2 },
  { type: "numbered-item", text: "Demonstrações contábeis", outlineNumber: "2", outlineLevel: 1, sourceBlockType: "docx-numbered", sourceOrder: 3 },
  { type: "paragraph", text: "Balanço Patrimonial; DRE; DFC e notas explicativas.", sourceOrder: 4 },
] });
assert.equal(separatedStructuredFields.rows[0].assunto, "Fundamentos, princípios e patrimônio");
assert.equal(separatedStructuredFields.rows[0].descricao, "Conceito, objeto, objetivos e usuários da Contabilidade; princípios e normas brasileiras.");
assert.equal(separatedStructuredFields.rows[0].conteudosOriginais.length, 1, "Uma descrição estruturada continua sendo conteúdo interno de uma única meta.");

console.log("OK - parser híbrido preserva estrutura, subáreas, notas editoriais e quebras de documento.");
