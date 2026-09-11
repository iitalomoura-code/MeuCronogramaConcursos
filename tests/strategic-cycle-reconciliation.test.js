"use strict";

const assert = require("assert");
const reconciliation = require("../js/strategic-cycle-reconciliation.js");

function topic(materia, assunto, strategicScore, learningState = "building") {
  return {
    materia,
    assunto,
    titulo: assunto,
    programUnitKey: `${materia.toLowerCase()}::${assunto.toLowerCase()}`,
    strategic: { score: strategicScore, learningState: { key: learningState }, recommendedSession: { label: "Questões", minutes: 45 } },
  };
}

function block(entry, extra = {}) {
  return {
    ...entry,
    id: extra.id || entry.programUnitKey,
    bloco: extra.bloco || 1,
    duracao: extra.duracao || .75,
    status: extra.status || "Não iniciado",
    plannedDay: extra.plannedDay || "segunda",
    ...extra,
  };
}

{
  const a = topic("A", "Tema A", .60, "building");
  const b = topic("B", "Tema B", .55, "building");
  const c = topic("C", "Tema C", .64, "building");
  const before = JSON.stringify({ blocks: [block(a), block(b)], topics: [a, b, c] });
  const preview = reconciliation.preview({ blocks: [block(a), block(b)], topics: [a, b, c] });
  assert.equal(preview.changes.length, 0, "Delta pequeno não deve causar churn.");
  assert.equal(JSON.stringify({ blocks: [block(a), block(b)], topics: [a, b, c] }), before, "Preview não pode mutar entradas.");
}

{
  const rlm = topic("RLM", "Proposições", .25, "maintenance");
  const accounting = topic("Contabilidade", "Lançamentos", .85, "recovery");
  const preview = reconciliation.preview({ blocks: [block(rlm)], topics: [rlm, accounting] });
  assert.equal(preview.changes.length, 1, "Recuperação com oportunidade claramente maior deve ocupar um slot flexível.");
  const applied = reconciliation.applyPreview({ blocks: [block(rlm)], preview, topics: [rlm, accounting] });
  assert.equal(applied.applied, true);
  assert.equal(applied.blocks[0].materia, "Contabilidade");
  assert.equal(applied.blocks[0].id, rlm.programUnitKey, "A troca preserva a identidade estrutural do slot.");
  assert.equal(applied.blocks[0].plannedDay, "segunda", "A troca preserva o dia do slot.");
  assert.equal(applied.blocks[0].duracao, .75, "A troca preserva a capacidade do slot.");
}

{
  const low = topic("A", "Baixo", .10, "maintenance");
  const high = topic("B", "Alto", .90, "recovery");
  const protectedBlocks = [
    block(low, { status: "Concluído" }),
    block(low, { id: "progress", bloco: 2, status: "Em andamento" }),
    block(low, { id: "adaptive", bloco: 3, category: "adaptive" }),
    block(low, { id: "review", bloco: 4, reviewIntegrated: true }),
  ];
  const preview = reconciliation.preview({ blocks: protectedBlocks, topics: [low, high], options: { activeFocusBlockId: "progress" } });
  assert.equal(preview.changes.length, 0, "Concluídos, em andamento, adaptativos e revisões integradas nunca saem.");
}

{
  const outgoing = Array.from({ length: 12 }, (_, index) => topic(`Saída ${index}`, `Tema ${index}`, .15 + index * .01, "maintenance"));
  const incoming = Array.from({ length: 8 }, (_, index) => topic(`Entrada ${index}`, `Tema ${index}`, .9 - index * .01, "recovery"));
  const preview = reconciliation.preview({ blocks: outgoing.map((item, index) => block(item, { bloco: index + 1 })), topics: [...outgoing, ...incoming] });
  assert.equal(preview.changes.length, 3, "O limite por rodada preserva a estabilidade do ciclo.");
}

{
  const outgoing = Array.from({ length: 4 }, (_, index) => topic(`Saída ${index}`, `Tema ${index}`, .15, "maintenance"));
  const incoming = Array.from({ length: 3 }, (_, index) => topic("Contabilidade", `Entrada ${index}`, .9 - index * .01, "recovery"));
  const preview = reconciliation.preview({ blocks: outgoing.map((item, index) => block(item, { bloco: index + 1 })), topics: [...outgoing, ...incoming] });
  assert.equal(preview.changes.filter((change) => change.incoming.materia === "Contabilidade").length, 1, "Uma matéria não domina a rodada inteira.");
}

{
  const existing = topic("A", "Existente", .2, "maintenance");
  const duplicate = topic("B", "Duplicado", .9, "recovery");
  const flexible = topic("C", "Flexível", .2, "maintenance");
  const preview = reconciliation.preview({ blocks: [block(existing), block(duplicate, { bloco: 2 }), block(flexible, { bloco: 3 })], topics: [existing, duplicate, flexible] });
  assert.equal(preview.changes.length, 0, "Assunto já presente no ciclo não pode ser duplicado.");
}

{
  const low = topic("A", "Baixo", .20, "maintenance");
  const high = topic("B", "Alto", .92, "recovery");
  const preview = reconciliation.preview({ blocks: [block(low)], topics: [low, high], options: { coverage: .10 } });
  assert.equal(preview.changes.length, 1, "Baixa cobertura não ignora evidência local muito forte.");
  const staleBlocks = [block(low, { status: "Em andamento" })];
  const stale = reconciliation.applyPreview({ blocks: staleBlocks, preview, topics: [low, high] });
  assert.equal(stale.stale, true, "Preview antigo não substitui bloco que passou a estar em andamento.");
}

{
  const low = topic("A", "Baixo", .20, "maintenance");
  const high = topic("B", "Alto", .90, "recovery");
  const blocks = [block(low, { duracao: .5 })];
  const preview = reconciliation.preview({ blocks, topics: [low, high] });
  const result = reconciliation.applyPreview({ blocks, preview, topics: [low, high] });
  const beforeMinutes = blocks.reduce((total, item) => total + item.duracao * 60, 0);
  const afterMinutes = result.blocks.reduce((total, item) => total + item.duracao * 60, 0);
  assert.equal(afterMinutes, beforeMinutes, "Reconciliação não aumenta a carga do ciclo.");
  assert.equal(result.blocks[0].status, "Não iniciado", "A saída não é convertida em conclusão ou falha.");
}

console.log("OK - reconciliação estratégica preserva capacidade, proteção, diversidade e estabilidade do ciclo.");
