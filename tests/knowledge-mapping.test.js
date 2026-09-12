"use strict";

const assert = require("node:assert/strict");
const mapping = require("../js/knowledge-mapping.js");
const knowledge = require("../js/knowledge-base.js");

function baseWithConcepts(items) {
  return knowledge.migrateKnowledgeMappings({ schemaVersion: 1, concepts: items.map((title) => ({ canonicalKey: mapping.normalize(title), canonicalTitle: title })), evidence: [], topicMappings: [] });
}
function evidence(base, title, subject, details = "") {
  base.evidence.push({ id: `e-${base.evidence.length}`, canonicalKey: mapping.normalize(title), canonicalTitle: title, originalTopic: title, originalDetails: details, originalSubject: subject, questions: 10, correctAnswers: 8, studiedMinutes: 30 });
  return knowledge.migrateKnowledgeMappings(base);
}

let base = baseWithConcepts(["Atos Administrativos"]);
base = evidence(base, "Atos Administrativos", "ADMINISTRAÇÃO GERAL E PÚBLICA");
let result = mapping.matchTopicToConcepts({ planId: "new", materia: "DIREITO ADMINISTRATIVO", assunto: "Atos Administrativos" }, base);
assert.deepEqual(result.conceptKeys, ["atos administrativos"]);
assert.equal(result.status, "auto-confirmed");
assert.equal(result.matchBasis, "canonical-title-exact");

base = baseWithConcepts(["Contratos Administrativos", "Administração Pública"]);
base = evidence(base, "Contratos Administrativos", "Direito Administrativo");
base = evidence(base, "Administração Pública", "Direito Administrativo");
assert.equal(mapping.matchTopicToConcepts({ materia: "Direito Administrativo", assunto: "Atos Administrativos" }, base).conceptKeys.length, 0);
assert.equal(mapping.matchTopicToConcepts({ materia: "Direito Tributário", assunto: "Administração Tributária" }, base).conceptKeys.length, 0);

base = baseWithConcepts(["Proposições e Conectivos", "Equivalências e Implicações Lógicas"]);
base = evidence(base, "Proposições e Conectivos", "RLM", "proposições conectivos negação conjunção disjunção");
base = evidence(base, "Equivalências e Implicações Lógicas", "RLM", "equivalências implicações equivalência");
result = mapping.matchTopicToConcepts({ materia: "Raciocínio Lógico-Matemático", assunto: "Lógica Proposicional", descricao: "proposições conectivos equivalências implicações quantificadores predicados" }, base);
assert.equal(result.status, "suggested");
assert.deepEqual(result.conceptKeys, ["equivalencias e implicacoes logicas", "proposicoes e conectivos"]);
assert.ok(result.coverage > 0 && result.coverage < 1);

base = baseWithConcepts(["Crase", "Pontuação"]);
base = evidence(base, "Crase", "Língua Portuguesa");
base = evidence(base, "Pontuação", "Língua Portuguesa");
result = mapping.matchTopicToConcepts({ materia: "Língua Portuguesa", assunto: "Crase e Pontuação" }, base);
assert.equal(result.status, "suggested");
assert.deepEqual(result.conceptKeys, ["crase", "pontuacao"]);

base = baseWithConcepts(["Gestão de Processos"]);
base = evidence(base, "Gestão de Processos", "Administração", "processos organizacionais");
result = mapping.matchTopicToConcepts({ materia: "Administração", assunto: "Gestão de Processos e BPM" }, base);
assert.equal(result.status, "suggested");
assert.equal(result.conceptKeys.length, 1);

const originalEvidenceCount = base.evidence.length;
const confirmed = mapping.applyMappingDecision(base, result, "confirm", "2026-09-11T00:00:00.000Z");
assert.equal(confirmed.topicMappings.at(-1).status, "user-confirmed");
assert.equal(confirmed.mappingRules.length, 1);
assert.equal(confirmed.evidence.length, originalEvidenceCount);
assert.equal(mapping.matchTopicToConcepts({ materia: "Administração", assunto: "Gestão de Processos e BPM" }, confirmed).status, "user-confirmed");

const rejected = mapping.applyMappingDecision(base, result, "reject", "2026-09-11T00:00:00.000Z");
assert.equal(rejected.mappingRejections.length, 1);
assert.equal(mapping.matchTopicToConcepts({ materia: "Administração", assunto: "Gestão de Processos e BPM" }, rejected).conceptKeys.length, 0);

const migrated = knowledge.migrateKnowledgeMappings({ schemaVersion: 1, concepts: [{ canonicalKey: "atos administrativos", canonicalTitle: "Atos Administrativos" }], evidence: [{ id: "e1", canonicalKey: "atos administrativos" }], topicMappings: [{ planId: "p", originalTopic: "Atos Administrativos", canonicalKey: "atos administrativos" }] });
assert.equal(migrated.schemaVersion, 2);
assert.deepEqual(migrated.topicMappings[0].conceptKeys, ["atos administrativos"]);
assert.equal(migrated.evidence.length, 1);

const duplicateCollections = knowledge.migrateKnowledgeMappings({ schemaVersion: 2, concepts: [], evidence: [], topicMappings: [],
  aliases: [{ aliasDisplay: "Atos da Administração Pública", aliasNormalized: "atos da administracao publica", conceptKey: "atos administrativos", subjectContext: "direito administrativo" }, { aliasDisplay: "Atos da Administração Pública", aliasNormalized: "atos da administracao publica", conceptKey: "atos administrativos", subjectContext: "direito administrativo" }],
  mappingRules: [{ normalizedTargetTitle: "logica proposicional", targetSubjectContext: "rlm", conceptKeys: ["b", "a"] }, { normalizedTargetTitle: "logica proposicional", targetSubjectContext: "rlm", conceptKeys: ["a", "b"] }],
  mappingRejections: [{ topicIdentity: "topic-1", conceptKeys: ["b", "a"] }, { topicIdentity: "topic-1", conceptKeys: ["a", "b"] }],
});
assert.equal(duplicateCollections.aliases.length, 1);
assert.equal(duplicateCollections.mappingRules.length, 1);
assert.equal(duplicateCollections.mappingRejections.length, 1);
assert.deepEqual(duplicateCollections.mappingRules[0].conceptKeys, ["a", "b"]);

let compositeBase = baseWithConcepts(["Crase", "Pontuação"]);
compositeBase = evidence(compositeBase, "Crase", "Língua Portuguesa");
compositeBase = evidence(compositeBase, "Pontuação", "Língua Portuguesa");
const compositeTopic = { planId: "p", topicId: "t", materia: "Língua Portuguesa", assunto: "Crase e Pontuação" };
const compositeSuggestion = mapping.matchTopicToConcepts(compositeTopic, compositeBase);
const compositeRejected = mapping.applyMappingDecision(compositeBase, compositeSuggestion, "reject");
for (let attempt = 0; attempt < 10; attempt += 1) assert.equal(mapping.matchTopicToConcepts(compositeTopic, compositeRejected).conceptKeys.length, 0);

const compositeConfirmed = mapping.applyMappingDecision(compositeBase, compositeSuggestion, "confirm");
assert.equal(compositeConfirmed.mappingRules.length, 1);
assert.deepEqual(compositeConfirmed.mappingRules[0].conceptKeys, ["crase", "pontuacao"]);
assert.equal(compositeConfirmed.aliases.length, 0);

const partialSuggestion = mapping.matchTopicToConcepts({ materia: "Administração", assunto: "Gestão de Processos e BPM" }, (() => { let value = baseWithConcepts(["Gestão de Processos"]); return evidence(value, "Gestão de Processos", "Administração", "processos organizacionais"); })());
const partialConfirmed = mapping.applyMappingDecision(base, partialSuggestion, "confirm");
assert.equal(partialConfirmed.aliases.length, 0);
const partialRematched = mapping.matchTopicToConcepts(partialSuggestion.topic, partialConfirmed);
assert.equal(partialRematched.status, "user-confirmed");
assert.equal(partialRematched.relationship, "partial");
assert.ok(partialRematched.coverage < 1);

const compositeRematched = mapping.matchTopicToConcepts(compositeTopic, compositeConfirmed);
assert.equal(compositeRematched.status, "user-confirmed");
assert.equal(compositeRematched.relationship, "composite");
assert.ok(compositeRematched.coverage < 1);

const equivalentBase = baseWithConcepts(["Atos Administrativos"]);
const equivalent = mapping.matchTopicToConcepts({ materia: "Direito Administrativo", assunto: "Atos Administrativos" }, equivalentBase);
assert.equal(equivalent.relationship, "equivalent");
assert.equal(equivalent.coverage, 1);

let constitutional = baseWithConcepts(["Direitos e Garantias Fundamentais", "Organização do Estado", "Controle de Constitucionalidade"]);
constitutional = evidence(constitutional, "Direitos e Garantias Fundamentais", "Direito Constitucional", "direitos fundamentais individuais coletivos");
constitutional = evidence(constitutional, "Organização do Estado", "Direito Constitucional", "União Estados Municípios Distrito Federal");
constitutional = evidence(constitutional, "Controle de Constitucionalidade", "Direito Constitucional", "controle constitucionalidade normas");
assert.ok(["suggested", "auto-confirmed"].includes(mapping.matchTopicToConcepts({ materia: "Direito Constitucional", assunto: "Direitos Fundamentais", descricao: "direitos fundamentais individuais coletivos" }, constitutional).status));
assert.equal(mapping.matchTopicToConcepts({ materia: "Direito Constitucional", assunto: "Controle da Administração Pública", descricao: "controle administração pública" }, constitutional).conceptKeys.length, 0);

const staleMerged = knowledge.migrateKnowledgeMappings({ schemaVersion: 2, concepts: [], evidence: [], topicMappings: [], mappingRules: [
  { normalizedTargetTitle: "logica proposicional", targetSubjectContext: "rlm", conceptKeys: ["a"], relationship: "partial", createdAt: "2026-09-01" },
  { normalizedTargetTitle: "logica proposicional", targetSubjectContext: "rlm", conceptKeys: ["a", "b"], relationship: "composite", createdAt: "2026-09-02", updatedAt: "2026-09-02" },
] });
assert.equal(staleMerged.mappingRules.length, 1);
assert.deepEqual(staleMerged.mappingRules[0].conceptKeys, ["a", "b"]);

const dateBase = { schemaVersion: 2, concepts: [], evidence: [
  { id: "date-1", canonicalKey: "x", questions: 1, correctAnswers: 1, completedAt: "31/07/2026", sourcePlanName: "TCE" },
  { id: "date-2", canonicalKey: "x", questions: 1, correctAnswers: 1, completedAt: "2026-08-05T10:00:00Z", sourcePlanName: "TCE" },
  { id: "date-3", canonicalKey: "x", questions: 1, correctAnswers: 1, completedAt: "01/06/2026", sourcePlanName: "TCE" },
] };
assert.equal(mapping.evidenceSummaryForConceptKeys(dateBase, ["x"]).lastContact, "2026-08-05T10:00:00Z");

const globalAliasBase = knowledge.migrateKnowledgeMappings({ schemaVersion: 2, concepts: [{ canonicalKey: "atos administrativos", canonicalTitle: "Atos Administrativos" }], evidence: [], topicMappings: [], aliases: [{ aliasDisplay: "Atos da Administração Pública", aliasNormalized: "atos da administracao publica", conceptKey: "atos administrativos", global: true }] });
assert.equal(mapping.matchTopicToConcepts({ assunto: "Responsabilidade Civil do Estado" }, globalAliasBase).conceptKeys.length, 0);
assert.equal(mapping.matchTopicToConcepts({ assunto: "Atos da Administração Pública" }, globalAliasBase).status, "auto-confirmed");

console.log("OK - matching conceitual determinístico, composição, decisões persistentes e migração v1/v2.");
