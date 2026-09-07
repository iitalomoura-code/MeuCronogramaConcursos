"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const parser = require("../js/document-structure-parser.js");
const grouping = require("../js/pedagogical-grouping.js");
const {
  canonicalProgramUnit,
  programUnitTitle,
  programUnitDescription,
  programUnitContents,
  programUnitKey,
  validateProgramUnit,
} = require("../js/program-model.js");

test("padroniza título e descrição sem concatená-los", () => {
  const unit = canonicalProgramUnit({
    materia: "Contabilidade",
    assunto: "Apuração do resultado",
    descricao: "Receitas e despesas.",
  });
  assert.equal(unit.titulo, "Apuração do resultado");
  assert.equal(unit.assunto, "Apuração do resultado");
  assert.equal(programUnitDescription(unit), "Receitas e despesas.");
  assert.deepEqual(programUnitContents(unit), ["Receitas e despesas."]);
});

test("mantém compatibilidade com unidade antiga que possui apenas assunto", () => {
  const unit = canonicalProgramUnit({ materia: "Português", assunto: "Semântica" });
  assert.equal(programUnitTitle(unit), "Semântica");
  assert.equal(unit.assunto, "Semântica");
  assert.equal(unit.descricao, "");
  assert.deepEqual(unit.conteudosOriginais, []);
});

test("não altera a identidade quando apenas a descrição muda", () => {
  const first = canonicalProgramUnit({ materia: "Direito Administrativo", assunto: "Agentes públicos", descricao: "Cargo; emprego; função." });
  const revised = canonicalProgramUnit({ materia: "Direito Administrativo", assunto: "Agentes públicos", descricao: "Cargo; emprego; função; PAD." });
  assert.equal(programUnitKey(first), programUnitKey(revised));
});

test("distingue temas iguais em subáreas diferentes", () => {
  const tributary = canonicalProgramUnit({ materia: "Direito Tributário e Previdenciário", subarea: "Direito Tributário", assunto: "Princípios" });
  const socialSecurity = canonicalProgramUnit({ materia: "Direito Tributário e Previdenciário", subarea: "Direito Previdenciário", assunto: "Princípios" });
  assert.notEqual(programUnitKey(tributary), programUnitKey(socialSecurity));
});

test("alinha unidades estruturadas e unidades brutas no mesmo schema", () => {
  const structured = parser.analyze({ text: `CONTABILIDADE GERAL

1. Apuração do resultado
Receitas e despesas; encerramento das contas.

2. Demonstrações contábeis
Balanço patrimonial; DRE.` }).rows[0];
  const raw = canonicalProgramUnit({
    materia: "CONTABILIDADE GERAL",
    assunto: "Apuração do resultado",
    descricao: "Receitas e despesas; encerramento das contas.",
    structureSource: "parser",
  });
  [structured, raw].forEach((unit) => {
    ["section", "materia", "subarea", "titulo", "assunto", "descricao", "conteudosOriginais", "outlineNumber", "outlineLevel", "ordem", "structureSource", "sourceBlockType", "origemEdital"].forEach((field) => {
      assert.ok(Object.hasOwn(unit, field), `A unidade deve possuir ${field}.`);
    });
    assert.equal(unit.titulo, unit.assunto);
  });
});

test("agrupamento pedagógico preserva o modelo canônico e conteúdos internos", () => {
  const rows = grouping.groupRows([
    { materia: "Língua Portuguesa", assunto: "Ortografia", descricao: "Grafia oficial.", conteudosOriginais: ["Grafia oficial."] },
    { materia: "Língua Portuguesa", assunto: "Acentuação", descricao: "Regras de acentuação.", conteudosOriginais: ["Regras de acentuação."] },
    { materia: "Língua Portuguesa", assunto: "Pontuação", descricao: "Sinais de pontuação.", conteudosOriginais: ["Sinais de pontuação."] },
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].titulo, "Ortografia, acentuação e pontuação");
  assert.equal(rows[0].assunto, rows[0].titulo);
  assert.equal(rows[0].descricao, "Grafia oficial.; Regras de acentuação.; Sinais de pontuação.");
  assert.deepEqual(rows[0].conteudosOriginais, ["Grafia oficial.", "Regras de acentuação.", "Sinais de pontuação."]);
});

test("sinaliza título contaminado por descrição e metadados inconsistentes", () => {
  const validation = validateProgramUnit({
    materia: "Raciocínio Lógico",
    titulo: "Lógica proposicional e argumentação Proposições; conectivos; equivalências lógicas; quantificadores.",
    assunto: "Lógica proposicional e argumentação Proposições; conectivos; equivalências lógicas; quantificadores.",
    descricao: "Proposições; conectivos; equivalências lógicas; quantificadores.",
    outlineNumber: "1.2",
    outlineLevel: 1,
    conteudosOriginais: "não é uma lista",
  });
  assert.ok(validation.warnings.some((warning) => warning.code === "title-contains-description"));
  assert.ok(validation.warnings.some((warning) => warning.code === "inconsistent-outline-level"));
  assert.ok(validation.warnings.some((warning) => warning.code === "invalid-original-contents"));
});
