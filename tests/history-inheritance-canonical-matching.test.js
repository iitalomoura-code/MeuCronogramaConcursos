"use strict";

const assert = require("assert");
const inheritance = require("../js/history-inheritance.js");

const now = new Date("2026-09-11T12:00:00Z").getTime();

function source(entries, name = "TCE-PE") {
  return {
    id: name.toLowerCase().replace(/\s+/g, "-"),
    name,
    snapshot: { completedHistory: entries.map((entry, index) => ({ status: "Concluído", completedAt: new Date(now - (index + 1) * 86400000).toISOString(), tempoEstudado: .75, ...entry })) },
  };
}

function result(target, entries) {
  return inheritance.derive({ target, sources: [source(entries)], now });
}

const atosHistorico = {
  materia: "ADMINISTRAÇÃO GERAL E PÚBLICA",
  assunto: "Atos Administrativos: Requisitos, Classificação, Motivação, Forma, Objeto",
  metaTitulo: "Atos Administrativos",
  questoes: 17,
  acertos: 15,
};
const atosTarget = {
  materia: "DIREITO ADMINISTRATIVO",
  titulo: "Atos Administrativos",
  assunto: "Atos Administrativos",
  descricao: "conceito, requisitos, atributos, discricionariedade, vinculação, anulação, revogação e convalidação",
};

const canonicalHistorical = inheritance.canonicalHistoricalTopic(atosHistorico);
assert.equal(canonicalHistorical.title, "Atos Administrativos");
assert.ok(canonicalHistorical.details.includes("Requisitos"));
assert.equal(inheritance.canonicalHistoricalTopic({ assunto: "Princípios Administrativos: Legalidade, Moralidade" }).title, "Princípios Administrativos");
assert.equal(inheritance.canonicalTargetTopic(atosTarget).title, "Atos Administrativos");

const atos = result(atosTarget, [atosHistorico]);
assert.equal(atos.level, "partial");
assert.equal(atos.sources[0].matchBasis, "canonical-title-exact");
assert.equal(atos.sources[0].matchDirection, "equivalent");

[
  ["Princípios Administrativos", "DIREITO ADMINISTRATIVO"],
  ["Agentes Públicos", "DIREITO ADMINISTRATIVO"],
  ["Improbidade Administrativa", "DIREITO ADMINISTRATIVO"],
  ["Gestão de Projetos", "ADMINISTRAÇÃO GERAL", "GOVERNANÇA PÚBLICA"],
].forEach(([title, targetSubject, sourceSubject = "ADMINISTRAÇÃO GERAL E PÚBLICA"]) => {
  const inherited = result({ materia: targetSubject, titulo: title, assunto: title }, [{ materia: sourceSubject, assunto: title, metaTitulo: title, questoes: 17, acertos: 14 }]);
  assert.notEqual(inherited.level, "none", `${title} deve sobreviver à reorganização de matéria.`);
  assert.equal(inherited.sources[0].matchBasis, "canonical-title-exact");
});

const processes = result(
  { materia: "ADMINISTRAÇÃO GERAL", titulo: "Gestão de Processos e BPM", assunto: "Gestão de Processos e BPM" },
  [{ materia: "GOVERNANÇA PÚBLICA", assunto: "Gestão de Processos", metaTitulo: "Gestão de Processos", questoes: 18, acertos: 14 }],
);
assert.equal(processes.level, "partial");
assert.equal(processes.sources[0].matchBasis, "title-containment");
assert.equal(processes.sources[0].matchDirection, "broad-to-specific");

const logical = result(
  {
    materia: "RACIOCÍNIO LÓGICO-MATEMÁTICO",
    titulo: "Lógica Proposicional",
    assunto: "Lógica Proposicional",
    descricao: "proposições, conectivos, equivalências lógicas, quantificadores, predicados",
  },
  [
    { materia: "RACIOCÍNIO LÓGICO-MATEMÁTICO", assunto: "Proposições e Conectivos", metaTitulo: "Proposições e Conectivos", conteudoBloco: "proposições simples, proposições compostas, conectivos, negação, conjunção, disjunção", questoes: 17, acertos: 14 },
    { materia: "RACIOCÍNIO LÓGICO-MATEMÁTICO", assunto: "Equivalências e Implicações Lógicas", metaTitulo: "Equivalências e Implicações Lógicas", conteudoBloco: "equivalências lógicas, implicação, contrapositiva", questoes: 20, acertos: 17 },
  ],
);
assert.equal(logical.level, "partial", "Cobertura composta não pode declarar domínio forte de tema mais amplo.");
assert.equal(logical.sources[0].matchDirection, "partial");
assert.equal(logical.sources[0].matchBasis, "composite-coverage");

const portuguese = result(
  { materia: "LÍNGUA PORTUGUESA", titulo: "Crase e Pontuação", assunto: "Crase e Pontuação" },
  [
    { materia: "LÍNGUA PORTUGUESA", assunto: "Crase", questoes: 20, acertos: 17 },
    { materia: "LÍNGUA PORTUGUESA", assunto: "Pontuação", questoes: 20, acertos: 17 },
  ],
);
assert.equal(portuguese.level, "partial");
assert.equal(portuguese.sources[0].matchBasis, "composite-coverage");

const contracts = result(
  { materia: "DIREITO ADMINISTRATIVO", titulo: "Atos Administrativos", assunto: "Atos Administrativos" },
  [{ materia: "DIREITO ADMINISTRATIVO", assunto: "Contratos Administrativos", questoes: 50, acertos: 44 }],
);
assert.equal(contracts.level, "none", "Atos Administrativos não pode coincidir com Contratos Administrativos por substring.");
assert.equal(inheritance.topicMatch("Administração Tributária", "Administração Pública").score, 0, "Compartilhar apenas Administração não é equivalência temática.");

const audit = inheritance.inspectTarget(atosTarget, [source([atosHistorico])]);
assert.equal(audit.accepted.length, 1);
assert.equal(audit.accepted[0].targetCanonicalTitle, "Atos Administrativos");
assert.equal(audit.accepted[0].sourceCanonicalTitle, "Atos Administrativos");
assert.equal(audit.accepted[0].matchBasis, "canonical-title-exact");
assert.equal(audit.accepted[0].reason, "accepted");

console.log("OK - matching canônico preserva reorganizações reais e mantém cobertura composta conservadora.");
