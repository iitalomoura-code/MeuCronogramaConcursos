"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const inheritance = require("../js/history-inheritance.js");
const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const index = fs.readFileSync(path.join(root, "index.html"), "utf8");

const now = new Date("2026-09-11T12:00:00Z").getTime();

function source({ id = "tce-pe", name = "TCE-PE", materia = "Direito Administrativo", assunto = "Atos Administrativos", questions = 60, correct = 50, days = 20, sessions = 3 } = {}) {
  const completed = Array.from({ length: sessions }, (_, index) => ({
    materia,
    assunto,
    questoes: index === 0 ? questions : 0,
    acertos: index === 0 ? correct : 0,
    tempoEstudado: 1,
    status: "Concluído",
    completedAt: new Date(now - (days + index) * 86400000).toISOString(),
  }));
  return { id, name, snapshot: { completedHistory: completed, planningBase: { materias: [{ materia, dominio: 2 }] } } };
}

function derive(target, sources, extras = {}) {
  return inheritance.derive({ target, sources, now, ...extras });
}

// A: assunto idêntico e forte.
const strong = derive({ materia: "Direito Administrativo", assunto: "Atos Administrativos" }, [source()]);
assert.equal(strong.level, "strong");
assert.equal(strong.matchConfidence, "high");
assert.equal(strong.recommendation, "Questões diagnósticas");

// B: desempenho anterior fraco não vira domínio.
const weak = derive({ materia: "Direito Administrativo", assunto: "Atos Administrativos" }, [source({ questions: 22, correct: 10, sessions: 2 })]);
assert.equal(weak.level, "partial");

// C: sem correspondência confiável.
const none = derive({ materia: "Direito Administrativo", assunto: "Poder de polícia" }, [source()]);
assert.equal(none.level, "none");

// Blocos apenas planejados não são evidência de estudo; execução legada inequívoca continua válida.
const generatedOnly = { id: "planejado", name: "Planejado", snapshot: { cycleHistory: [{ generatedBlocks: [{ materia: "Direito Administrativo", assunto: "Atos Administrativos" }] }] } };
assert.equal(inheritance.snapshotBlocks(generatedOnly).length, 0, "Bloco gerado sem status, tempo, questões ou data não pode virar herança.");
const executedLegacy = { id: "legado", name: "Legado", snapshot: { cycleHistory: [{ generatedBlocks: [{ materia: "Direito Administrativo", assunto: "Atos Administrativos", questoes: 8, acertos: 6 }] }] } };
assert.equal(inheritance.snapshotBlocks(executedLegacy).length, 1, "Questões registradas devem preservar uma execução legada inequívoca.");

// O ciclo vivo do planejamento anterior também deve fornecer evidência, sem contar blocos apenas planejados.
const activeCycle = {
  id: "tce-ativo",
  name: "TCE ativo",
  snapshot: {
    generatedBlocks: [
      { materia: "Direito Administrativo", assunto: "Atos Administrativos", questoes: 50, acertos: 41, tempoEstudado: 1.5, status: "Em andamento", sessaoId: "ativo-1" },
      { materia: "Direito Constitucional", assunto: "Direitos Fundamentais", status: "Não iniciado", questoes: 0, tempoEstudado: 0 },
      { materia: "Raciocínio Lógico", assunto: "Proposições", status: "Concluído", questoes: 35, acertos: 30, sessaoId: "ativo-2" },
      { materia: "Administração Pública", assunto: "Governança Pública", status: "Concluído", questoes: 30, acertos: 25, sessaoId: "ativo-3" },
    ],
  },
};
assert.equal(inheritance.snapshotBlocks(activeCycle).length, 3, "Apenas blocos executados do ciclo vivo devem entrar na herança.");
assert.notEqual(derive({ materia: "Direito Administrativo", assunto: "Atos Administrativos" }, [activeCycle]).level, "none");
assert.equal(derive({ materia: "Direito Constitucional", assunto: "Direitos Fundamentais" }, [activeCycle]).level, "none", "Bloco apenas planejado não pode gerar herança.");
assert.notEqual(derive({ materia: "Raciocínio Lógico", assunto: "Proposições" }, [activeCycle]).level, "none");
assert.notEqual(derive({ materia: "Administração Pública", assunto: "Governança Pública" }, [activeCycle]).level, "none");
const activeConstitutional = {
  id: "constitucional-ativo",
  name: "Constitucional ativo",
  snapshot: { generatedBlocks: [{ materia: "Direito Constitucional", assunto: "Direitos Fundamentais", status: "Concluído", questoes: 40, acertos: 33, sessaoId: "constitucional-1" }] },
};
assert.notEqual(derive({ materia: "Direito Constitucional", assunto: "Direitos Fundamentais" }, [activeConstitutional]).level, "none", "Correspondência exata executada do ciclo ativo deve aparecer.");
const sourceAudit = inheritance.inspectSource(activeCycle);
assert.deepEqual(sourceAudit, {
  totalGeneratedBlocks: 4,
  executedGeneratedBlocks: 3,
  completedHistoryBlocks: 0,
  cycleHistoryBlocks: 0,
  cycleResultBlocks: 0,
  interventionBlocks: 0,
  uniqueExecutionBlocks: 3,
});

const duplicatedExecution = {
  id: "duplicado",
  name: "Duplicado",
  snapshot: {
    generatedBlocks: [{ materia: "Direito Administrativo", assunto: "Atos Administrativos", questoes: 40, acertos: 34, tempoEstudado: 1, sessaoId: "same-session" }],
    completedHistory: [{ materia: "Direito Administrativo", assunto: "Atos Administrativos", questoes: 40, acertos: 34, tempoEstudado: 1, sessaoId: "same-session", status: "Concluído" }],
  },
};
assert.equal(inheritance.snapshotBlocks(duplicatedExecution).length, 1, "A mesma sessão em generatedBlocks e completedHistory não pode dobrar a evidência.");
assert.equal(derive({ materia: "Direito Administrativo", assunto: "Atos Administrativos" }, [duplicatedExecution]).metrics.questions, 40);
const targetAudit = inheritance.inspectTarget({ materia: "Direito Administrativo", assunto: "Atos Administrativos" }, [activeCycle]);
assert.equal(targetAudit.examinedExecutionBlocks, 3);
assert.equal(targetAudit.accepted.length, 1);
assert.ok(targetAudit.rejected.some((candidate) => candidate.reason === "subject-mismatch" || candidate.reason === "topic-mismatch"));
assert.ok(inheritance.inspectTarget({ materia: "Direito Constitucional", assunto: "Direitos Fundamentais" }, [activeCycle]).rejected.some((candidate) => candidate.reason === "no-execution-evidence"));

// Os aliases conservadores existentes continuam válidos; esta etapa não amplia o matching.
assert.notEqual(derive({ materia: "Administração Pública", assunto: "Governança Pública" }, [source({ materia: "Administração Geral e Pública", assunto: "Governança Pública" })]).level, "none");
assert.notEqual(derive({ materia: "Direito Financeiro", assunto: "Receita Pública" }, [source({ materia: "Administração Financeira e Orçamentária", assunto: "Receita Pública" })]).level, "none");
assert.notEqual(derive({ materia: "Direito Financeiro", assunto: "Receita Pública" }, [source({ materia: "AFO", assunto: "Receita Pública" })]).level, "none");

// D: equivalência semântica controlada.
const equivalent = derive({ materia: "Administração Geral e Pública", assunto: "Planejamento Estratégico" }, [source({ materia: "Administração Pública", assunto: "Planejamento estratégico, tático e operacional" })]);
assert.ok(["high", "medium"].includes(equivalent.matchConfidence));
assert.notEqual(equivalent.level, "none");

// Inclusão textual é direcional: um tópico amplo não confirma domínio do específico.
const broadToSpecific = derive({ materia: "Direito Tributário", assunto: "IRPJ - Lucro Real" }, [source({ materia: "Direito Tributário", assunto: "IRPJ", questions: 80, correct: 70, sessions: 4 })]);
assert.equal(broadToSpecific.level, "partial", "IRPJ amplo não pode confirmar base forte em Lucro Real.");
assert.equal(broadToSpecific.sources[0].matchDirection, "broad-to-specific");
const specificToBroad = derive({ materia: "Direito Tributário", assunto: "IRPJ" }, [source({ materia: "Direito Tributário", assunto: "IRPJ - Lucro Real", questions: 80, correct: 70, sessions: 4 })]);
assert.equal(specificToBroad.level, "partial", "Lucro Real pode contribuir apenas parcialmente para IRPJ amplo.");
assert.equal(specificToBroad.sources[0].matchDirection, "specific-to-broad");

const compositeTopic = derive({ materia: "Administração Pública", assunto: "Planejamento estratégico, tático e operacional" }, [source({ materia: "Administração Pública", assunto: "Planejamento Estratégico", questions: 80, correct: 70, sessions: 4 })]);
assert.equal(compositeTopic.level, "partial", "Tema composto não deve assumir cobertura completa a partir de um subtópico.");

// E: assuntos apenas relacionados não podem ser fundidos.
const unrelated = derive({ materia: "Administração Pública", assunto: "Governança Pública" }, [source({ materia: "Administração Pública", assunto: "Administração Pública" })]);
assert.equal(unrelated.level, "none");

// F: dados do ciclo novo são separados e tornam a origem mista, sem média artificial.
const currentWeak = derive({ materia: "Direito Administrativo", assunto: "Atos Administrativos" }, [source()], {
  currentEvidence: { questions: 30, sessions: 2, hours: 1.5 },
});
assert.equal(currentWeak.origin, "mixed");
assert.equal(currentWeak.metrics.accuracy, 50 / 60, "A herança deve manter o percentual anterior separado da evidência atual.");

// G: histórico forte recente permanece provisório, não domínio definitivo.
assert.equal(strong.provisional, true);

// H e I: a autopercepção é preservada e a divergência fica auditável.
const advancedWithWeakHistory = derive({ materia: "Direito Administrativo", assunto: "Atos Administrativos" }, [source({ questions: 8, correct: 3, sessions: 1 })], {
  initialProfile: { level: "advanced" },
});
assert.ok(["contact", "partial"].includes(advancedWithWeakHistory.level), "Histórico fraco deve permanecer cauteloso, sem confirmar domínio avançado.");
assert.equal(advancedWithWeakHistory.origin, "mixed");
const neverWithStrongHistory = derive({ materia: "Direito Administrativo", assunto: "Atos Administrativos" }, [source()], {
  initialProfile: { level: "never-studied" },
});
assert.equal(neverWithStrongHistory.profileMismatch, true);

// J: entre fontes, a evidência recente e robusta é preferida a uma fonte antiga.
const latest = derive({ materia: "Direito Administrativo", assunto: "Atos Administrativos" }, [
  source({ id: "old", name: "Concurso antigo", questions: 100, correct: 80, days: 300, sessions: 4 }),
  source({ id: "recent", name: "Concurso recente", questions: 50, correct: 42, days: 15, sessions: 3 }),
]);
assert.equal(latest.sources[0].sourceId, "recent");

assert.equal(inheritance.topicMatch("Receita Pública", "Receitas Públicas").confidence, "high");
assert.equal(inheritance.subjectMatch("Administração Pública", "Governança Pública").score, 0);
assert.ok(app.includes("function refreshHistoryInheritanceSources") && app.includes("function historyInheritanceForTarget"), "O aplicativo deve carregar fontes anteriores de forma derivada.");
assert.ok(app.includes("historyInheritance: target.historyInheritance"), "A prioridade estratégica deve receber a herança sem alterar o diagnóstico atual.");
assert.ok(index.includes("js/history-inheritance.js?v=20260911-history-inheritance-active-blocks"), "O motor de herança deve carregar antes do aplicativo.");

console.log("OK - herança entre ciclos usa correspondência conservadora, recência e evidências separadas.");
