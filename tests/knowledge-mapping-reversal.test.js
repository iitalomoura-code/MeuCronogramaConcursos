"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const mapping = require("../js/knowledge-mapping.js");
const knowledge = require("../js/knowledge-base.js");

function fixture(titles = []) {
  return knowledge.migrateKnowledgeMappings({
    schemaVersion: 2,
    concepts: titles.map((title) => ({ canonicalKey: mapping.normalize(title), canonicalTitle: title })),
    evidence: titles.map((title, index) => ({ id: `e-${index}`, canonicalKey: mapping.normalize(title), canonicalTitle: title, originalTopic: title, originalSubject: "Administração", questions: 20, correctAnswers: 16, studiedMinutes: 45 })),
    topicMappings: [],
  });
}

function decision(topicId, title, conceptKeys, options = {}) {
  return {
    topic: { planId: options.planId || "current", topicId, materia: options.subject || "Administração", assunto: title },
    conceptKeys,
    confidence: "high",
    coverage: options.coverage ?? 1,
    relationship: options.relationship || (conceptKeys.length > 1 ? "composite" : "equivalent"),
    matchBasis: options.matchBasis || "controlled-alias",
  };
}

let base = fixture(["Atos Administrativos"]);
const aliasDecision = decision("topic-atos", "Atos da Administração Pública", ["atos administrativos"]);
const evidenceBefore = structuredClone(base.evidence);
const confirmed = mapping.applyMappingDecision(base, aliasDecision, "confirm", "2026-09-12T10:00:00.000Z");
assert.equal(confirmed.topicMappings.at(-1).status, "user-confirmed");
assert.equal(confirmed.mappingRules.length, 1);
assert.equal(confirmed.aliases.length, 1);

const confirmedBeforeUndo = structuredClone(confirmed);
const undone = mapping.revokeMappingDecision(confirmed, aliasDecision, { mode: "undo", now: "2026-09-12T11:00:00.000Z" });
assert.equal(undone.topicMappings.some((item) => item.status === "user-confirmed"), false);
assert.equal(undone.mappingRules.length, 0);
assert.equal(undone.aliases.length, 0);
assert.equal(undone.mappingRejections.length, 0);
assert.notEqual(mapping.matchTopicToConcepts(aliasDecision.topic, undone).status, "user-confirmed");
assert.deepEqual(undone.evidence, evidenceBefore);
assert.deepEqual(confirmed, confirmedBeforeUndo, "A reversão não pode mutar a base recebida.");

const rejected = mapping.revokeMappingDecision(confirmed, aliasDecision, { mode: "reject", now: "2026-09-12T12:00:00.000Z" });
assert.equal(rejected.topicMappings.some((item) => item.status === "user-confirmed"), false);
assert.equal(rejected.mappingRules.length, 0);
assert.equal(rejected.mappingRejections.length, 1);
assert.equal(mapping.matchTopicToConcepts(aliasDecision.topic, rejected).status, "unmatched");
assert.deepEqual(rejected.evidence, evidenceBefore);

base = fixture(["Crase", "Pontuação"]);
const compositeDecision = decision("topic-composite", "Crase e Pontuação", ["crase", "pontuacao"], { subject: "Língua Portuguesa", relationship: "composite", matchBasis: "composite-coverage", coverage: .8 });
const independentDecision = decision("topic-crase", "Uso da Crase", ["crase"], { subject: "Língua Portuguesa" });
const compositeConfirmed = mapping.applyMappingDecision(mapping.applyMappingDecision(base, independentDecision, "confirm"), compositeDecision, "confirm");
const compositeUndone = mapping.revokeMappingDecision(compositeConfirmed, compositeDecision, { mode: "undo" });
assert.equal(compositeUndone.topicMappings.some((item) => item.topicIdentity === mapping.mappingIdentity(independentDecision.topic)), true, "Relação independente deve permanecer.");
assert.equal(compositeUndone.topicMappings.some((item) => item.topicIdentity === mapping.mappingIdentity(compositeDecision.topic)), false, "A composição revertida deve sair por inteiro.");

base = fixture(["Atos Administrativos"]);
const sharedOne = decision("shared-1", "Atos da Administração Pública", ["atos administrativos"], { planId: "p1" });
const sharedTwo = decision("shared-2", "Atos da Administração Pública", ["atos administrativos"], { planId: "p2" });
const sharedConfirmed = mapping.applyMappingDecision(mapping.applyMappingDecision(base, sharedOne, "confirm"), sharedTwo, "confirm");
const oneUndone = mapping.revokeMappingDecision(sharedConfirmed, sharedOne, { mode: "undo" });
assert.equal(oneUndone.aliases.length, 1, "Alias compartilhado deve permanecer enquanto outra decisão ativa depender dele.");
assert.equal(oneUndone.mappingRules.length, 1, "Regra compartilhada não pode ser removida da outra decisão ativa.");

base = fixture(["Atos Administrativos"]);
const automaticTopic = { planId: "current", topicId: "auto-topic", materia: "Administração", assunto: "Atos Administrativos" };
const automatic = mapping.matchTopicToConcepts(automaticTopic, base);
assert.equal(automatic.status, "auto-confirmed");
const autoRejected = mapping.revokeMappingDecision(base, automatic, { mode: "reject" });
assert.equal(mapping.matchTopicToConcepts(automaticTopic, autoRejected).status, "unmatched");
assert.deepEqual(autoRejected.concepts, base.concepts);
assert.deepEqual(autoRejected.evidence, base.evidence);

const restored = knowledge.migrateKnowledgeMappings(JSON.parse(JSON.stringify(rejected)));
assert.equal(restored.mappingRejections.length, 1, "Exportação e importação devem preservar a rejeição.");
assert.equal(restored.mappingRules.length, 0);
assert.deepEqual(restored.evidence, evidenceBefore);

const app = fs.readFileSync(path.resolve(__dirname, "..", "app.js"), "utf8");
assert.ok(app.includes("Para revisar") && app.includes("Confirmadas"), "O gerenciador deve manter as duas visualizações acessíveis.");
assert.ok(app.includes("Desfazer confirmação") && app.includes("Marcar como incorreta"), "As ações de reversão devem estar disponíveis na interface.");
assert.ok(app.includes("Seu histórico de estudo não será apagado."), "A confirmação de rejeição deve explicar a preservação do histórico.");
assert.ok(app.includes("revokeTopicMapping") && app.includes("commitKnowledgeBaseDecision"), "Reversões devem usar a operação canônica e a persistência existente.");

console.log("OK - decisões de correspondência podem ser desfeitas ou rejeitadas sem alterar evidências.");
