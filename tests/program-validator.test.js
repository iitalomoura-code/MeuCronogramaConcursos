"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const validator = require("../js/program-validator.js");

function issuesFor(units, extra = {}) {
  return validator.analyze({ units, ...extra }).issues;
}

test("sinaliza possivel materia interpretada como tema", () => {
  const issues = issuesFor([
    { materia: "L\u00edngua Portuguesa", titulo: "L\u00cdNGUA INGLESA", descricao: "", sourceBlockType: "heading" },
    { materia: "L\u00edngua Portuguesa", titulo: "Compreens\u00e3o textual", outlineNumber: "1", descricao: "Leitura e vocabul\u00e1rio." },
  ]);
  assert.ok(issues.some((issue) => issue.type === "possible-subject-as-topic"));
});

test("sinaliza possivel tema interpretado como materia por evidencia estrutural", () => {
  const issues = issuesFor([
    { materia: "Legisla\u00e7\u00e3o Tribut\u00e1ria", titulo: "Tributos", outlineNumber: "1" },
    { materia: "CSLL", titulo: "Contribui\u00e7\u00e3o social", outlineNumber: "1" },
    { materia: "IPI E IOF", titulo: "Impostos", outlineNumber: "1" },
    { materia: "CIDE", titulo: "Contribui\u00e7\u00e3o", outlineNumber: "1" },
    { materia: "PIS/Pasep e COFINS", titulo: "Contribui\u00e7\u00f5es", outlineNumber: "1" },
  ]);
  const candidates = issues.filter((issue) => issue.type === "possible-topic-as-subject").map((issue) => issue.materia);
  ["CSLL", "IPI E IOF", "CIDE", "PIS/Pasep e COFINS"].forEach((name) => assert.ok(candidates.includes(name)));
});

test("sinaliza titulo contaminado e descricao duplicada", () => {
  const issues = issuesFor([
    {
      materia: "Racioc\u00ednio L\u00f3gico",
      titulo: "L\u00f3gica proposicional Conectivos; equival\u00eancias. Conectivos; equival\u00eancias.",
      descricao: "Conectivos; equival\u00eancias. Conectivos; equival\u00eancias.",
    },
  ]);
  assert.ok(issues.some((issue) => issue.type === "title-contains-description"));
  assert.ok(issues.some((issue) => issue.type === "duplicated-description"));
});

test("bloqueia tema sem materia", () => {
  const result = validator.analyze({ units: [{ titulo: "Tema solto", descricao: "Conte\u00fado" }] });
  assert.ok(result.errors.some((issue) => issue.type === "topic-without-subject"));
});

test("sinaliza secao geral usada como materia", () => {
  const issues = issuesFor([{ materia: "CONHECIMENTOS ESPEC\u00cdFICOS", titulo: "Direito Administrativo", descricao: "Atos." }]);
  assert.ok(issues.some((issue) => issue.type === "general-section-as-subject"));
});

test("sinaliza reinicio de outline e comentario editorial", () => {
  const issues = issuesFor([
    { materia: "Legisla\u00e7\u00e3o Tribut\u00e1ria", titulo: "Tributos", outlineNumber: "1" },
    { materia: "Legisla\u00e7\u00e3o Tribut\u00e1ria", titulo: "Aduaneira", outlineNumber: "2" },
    { materia: "Legisla\u00e7\u00e3o Tribut\u00e1ria", titulo: "Novo bloco", outlineNumber: "1", descricao: "Observa\u00e7\u00e3o editorial: revisar." },
  ]);
  assert.ok(issues.some((issue) => issue.type === "unexpected-numbering-restart"));
  assert.ok(issues.some((issue) => issue.type === "editorial-comment"));
});

test("nao sinaliza estrutura correta como problema estrutural", () => {
  const result = validator.analyze({
    units: [
      { materia: "L\u00edngua Portuguesa", titulo: "Interpreta\u00e7\u00e3o de textos", descricao: "Compreens\u00e3o; infer\u00eancia.", outlineNumber: "1" },
      { materia: "L\u00edngua Portuguesa", titulo: "Sem\u00e2ntica", descricao: "Sentido das palavras.", outlineNumber: "2" },
      { materia: "Direito Tribut\u00e1rio e Previdenci\u00e1rio", subarea: "Direito Tribut\u00e1rio", titulo: "Cr\u00e9dito tribut\u00e1rio", descricao: "Lan\u00e7amento.", outlineNumber: "1" },
      { materia: "Direito Tribut\u00e1rio e Previdenci\u00e1rio", subarea: "Direito Previdenci\u00e1rio", titulo: "Benef\u00edcios", descricao: "Presta\u00e7\u00f5es.", outlineNumber: "2" },
    ],
  });
  assert.equal(result.errors.length, 0);
  assert.equal(result.warnings.length, 0);
});

test("aplica apenas correcao automatica segura de descricao duplicada", () => {
  const source = [{ materia: "Direito Administrativo", titulo: "Agentes p\u00fablicos", descricao: "Agentes p\u00fablicos Cargo; emprego; fun\u00e7\u00e3o." }];
  const result = validator.analyze({ units: source });
  const fixed = validator.applySafeCorrections(source, result.issues);
  assert.equal(fixed[0].descricao, "Cargo; emprego; fun\u00e7\u00e3o.");
  assert.equal(fixed[0].manualCorrection, true);
});

test("explica problemas da estrutura explícita antes de confirmar", () => {
  const issues = issuesFor([], {
    parsingProblems: [
      { type: "numbered-before-subject", text: "1. Tema solto" },
      { type: "marker-inside-topic", materia: "Português", text: "use MATÉRIA: apenas no início" },
    ],
  });
  assert.ok(issues.some((issue) => issue.type === "numbered-before-subject"));
  assert.ok(issues.some((issue) => issue.type === "marker-inside-topic"));
});
