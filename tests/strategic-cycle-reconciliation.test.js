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
  const high = { ...topic("B", "Alto", .92, "recovery"), diagnosis: { confidence: .75, questions: 60 } };
  const preview = reconciliation.preview({ blocks: [block(low)], topics: [low, high], options: { coverage: .10 } });
  assert.equal(preview.changes.length, 1, "Baixa cobertura não ignora evidência local muito forte.");
  const staleBlocks = [block(low, { status: "Em andamento" })];
  const stale = reconciliation.applyPreview({ blocks: staleBlocks, preview, topics: [low, high] });
  assert.equal(stale.stale, true, "Preview antigo não substitui bloco que passou a estar em andamento.");
}

{
  const outgoing = topic("RLM", "Proposições", .30, "maintenance");
  const incoming = {
    ...topic("Contabilidade", "Lançamentos", .82, "practice"),
    diagnosis: { level: "deficiency", confidence: .65, questions: 18 },
    advisorCategory: "prioritize",
    programUnit: {
      materia: "Contabilidade",
      assunto: "Lançamentos",
      titulo: "Lançamentos",
      descricao: "Partidas dobradas e registros contábeis.",
      conteudosOriginais: ["Débito", "Crédito"],
      section: "Contabilidade Geral",
      outlineNumber: "3.2",
      outlineLevel: 2,
      structureSource: "edital",
      sourceBlockType: "topic",
      origemEdital: { source: "novo" },
      programUnitKey: "contabilidade::lancamentos",
      metaId: "contab-meta",
      metaTitulo: "Lançamentos contábeis",
      metaConteudos: ["partidas dobradas"],
      metaPartKey: "1",
      metaRequiredBlocks: 2,
      conteudoBloco: "Registros iniciais",
    },
    historyInheritance: { level: "strong" },
    errorSignals: { recurrence: "high" },
    intervention: { active: true },
  };
  const legacy = block(outgoing, {
    descricao: "Descrição de RLM",
    conteudoBloco: "Tabela verdade",
    metaId: "rlm-meta",
    metaTitulo: "Proposições",
    metaConteudos: ["negação", "equivalência"],
    metaPartKey: "2",
    metaRequiredBlocks: 4,
    origemEdital: { source: "antigo" },
    questoes: 9,
    acertos: 4,
    percentual: 44,
    tempoEstudado: 30,
    observacoes: "Rascunho antigo",
    pontosRevisar: true,
    reviewCycles: ["7d"],
    sessaoId: "sessao-antiga",
  });
  // O caso simula uma inconsistência legada: a execução real protege o bloco. Para validar a troca,
  // removemos somente a evidência após validar a regra de proteção separadamente abaixo.
  const cleanSlot = { ...legacy, questoes: 0, acertos: 0, percentual: 0, tempoEstudado: 0, sessaoId: "", observacoes: "", pontosRevisar: false, reviewCycles: [] };
  const preview = reconciliation.preview({ blocks: [cleanSlot], topics: [outgoing, incoming] });
  assert.equal(preview.changes.length, 1, "Practice com deficiência deve ser elegível pela evidência diagnóstica.");
  const beforeTopics = JSON.stringify([outgoing, incoming]);
  const applied = reconciliation.applyPreview({ blocks: [cleanSlot], preview, topics: [outgoing, incoming] });
  const replacement = applied.blocks[0];
  assert.equal(replacement.materia, "Contabilidade");
  assert.equal(replacement.descricao, "Partidas dobradas e registros contábeis.");
  assert.equal(replacement.conteudoBloco, "Registros iniciais");
  assert.equal(replacement.metaId, "contab-meta");
  assert.deepEqual(replacement.metaConteudos, ["partidas dobradas"]);
  assert.deepEqual(replacement.origemEdital, { source: "novo" });
  assert.equal(replacement.questoes, 0);
  assert.equal(replacement.tempoEstudado, 0);
  assert.equal(replacement.sessaoId, undefined, "Evidência do bloco antigo não pode sobreviver à troca.");
  ["diagnosis", "strategic", "historyInheritance", "errorSignals", "intervention"].forEach((field) => assert.equal(replacement[field], undefined, `${field} é derivado e não deve ser persistido no bloco.`));
  assert.equal(JSON.stringify([outgoing, incoming]), beforeTopics, "applyPreview não pode mutar o conteúdo estratégico de entrada.");
  assert.equal(reconciliation.isProtected(legacy), true, "Trabalho real protege o bloco mesmo com status inconsistente.");
}

{
  const outgoing = topic("A", "Manutenção", .30, "maintenance");
  const weakPractice = { ...topic("B", "Prática fraca", .43, "practice"), diagnosis: { level: "deficiency", confidence: .15, questions: 0, sessions: 0 } };
  const strongPractice = { ...topic("C", "Prática comprovada", .90, "practice"), diagnosis: { level: "deficiency", confidence: .75, questions: 60 } };
  assert.equal(reconciliation.isStrategicCandidate(weakPractice), true, "Practice com deficiência é candidato, mas continua sujeito à cautela de cobertura.");
  assert.equal(reconciliation.preview({ blocks: [block(outgoing)], topics: [outgoing, weakPractice], options: { coverage: .10 } }).changes.length, 0, "Score alto sem evidência local não recebe exceção em cobertura baixa.");
  assert.equal(reconciliation.preview({ blocks: [block(outgoing)], topics: [outgoing, strongPractice], options: { coverage: .10 } }).changes.length, 1, "Evidência local real permite uma troca clara mesmo com cobertura baixa.");
  const strongPracticeState = { ...topic("D", "Prática forte", .30, "practice"), diagnosis: { level: "strong", confidence: .8, questions: 50 } };
  assert.equal(reconciliation.isStrategicCandidate(strongPracticeState), false, "Practice forte não entra apenas pelo nome do estado.");
}

{
  const temporary = { strategicPlanSessionOnly: true, materia: "Temporário", assunto: "Hoje", duracao: .5, status: "Não iniciado" };
  const a = topic("A", "A", .50, "maintenance");
  const b = topic("B", "B", .20, "maintenance");
  const incoming = topic("C", "C", .90, "recovery");
  const blocks = [temporary, block(a, { bloco: 1 }), block(b, { bloco: 2 })];
  const preview = reconciliation.preview({ blocks, topics: [a, b, incoming] });
  assert.equal(preview.changes[0].slotIndex, 2, "O índice do preview deve apontar para o array original, mesmo com bloco temporário antes.");
  const applied = reconciliation.applyPreview({ blocks, preview, topics: [a, b, incoming] });
  assert.equal(applied.blocks[0].materia, "Temporário");
  assert.equal(applied.blocks[1].materia, "A");
  assert.equal(applied.blocks[2].materia, "C");
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
