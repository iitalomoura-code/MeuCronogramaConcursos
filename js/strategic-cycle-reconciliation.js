"use strict";

(function initStrategicCycleReconciliation(global) {
  const DEFAULTS = Object.freeze({ replacementMinScoreDelta: .12, structuralMinScoreDelta: .08, maxReplacementShare: .25, maxChangesPerPass: 3, maxChangesPerSubject: 1, lowCoverageThreshold: .35, lowCoverageExtraDelta: .06 });
  const PROGRAM_UNIT_FIELDS = Object.freeze(["materia", "subarea", "titulo", "assunto", "descricao", "conteudosOriginais", "section", "outlineNumber", "outlineLevel", "structureSource", "sourceBlockType", "origemEdital", "programUnitKey", "metaId", "metaTitulo", "metaConteudos", "metaPartKey", "metaRequiredBlocks", "conteudoBloco", "tamanhoEstimado", "blocosSugeridos", "dificuldadeEstimada"]);

  function normalized(value = "") { return String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase().replace(/\s+/g, " "); }
  function programUnit(item = {}) { return item.programUnit || item.cycleTemplate || item; }
  function topicKey(item = {}) { const unit = programUnit(item); return unit.programUnitKey || [normalized(unit.materia), normalized(unit.subarea), normalized(unit.assunto || unit.titulo)].filter(Boolean).join("::"); }
  function minutes(block = {}) { return Math.max(0, Math.round((Number(block.durationMinutes) || Number(block.duracao) * 60 || 0))); }
  function status(block = {}) { return normalized(block.status); }
  function learningState(item = {}) { return item.strategic?.learningState?.key || item.learningState?.key || item.learningState || ""; }
  function advisorCategory(item = {}) { return item.advisorCategory || item.category || item.strategic?.advisorCategory || ""; }
  function diagnosisLevel(item = {}) { return item.diagnosis?.level || item.diagnosisLevel || ""; }
  function score(item = {}) { return Math.max(0, Math.min(1, Number(item.strategic?.score ?? item.strategicScore ?? item.score) || 0)); }
  function hasRealExecution(block = {}) { return Number(block.tempoEstudado) > 0 || Number(block.questoes) > 0 || Number(block.acertos) > 0 || Boolean(block.sessaoId || block.lastSavedSessionId || block.concluidoEm || block.completedAt); }

  function isProtected(block = {}, activeFocusBlockId = "") {
    const active = String(activeFocusBlockId || "");
    return status(block).includes("conclu") || status(block).includes("em andamento") || hasRealExecution(block)
      || Boolean(block.protected || block.adaptive || block.reviewIntegrated || block.reinforcementIntegrated || block.intervencao || block.interventionOrigin)
      || ["protected", "adaptive"].includes(normalized(block.category))
      || Boolean(active && (String(block.id || "") === active || String(block.bloco || "") === active));
  }

  // Same evidence semantics used by StrategicAdvisor: confidence, questions, or completed sessions.
  function hasLocalEvidence(item = {}) {
    const diagnosis = item.diagnosis || {};
    return Number(diagnosis.confidence ?? item.confidence) >= .45 || Number(diagnosis.questions ?? item.questions) >= 10 || Number(diagnosis.sessionCount ?? diagnosis.sessions ?? item.sessions) >= 2;
  }

  function isStrategicCandidate(item = {}) {
    const state = normalized(learningState(item));
    const category = normalized(advisorCategory(item));
    const level = normalized(diagnosisLevel(item));
    return ["recovery", "building", "consolidating"].includes(state) || ["prioritize", "recovery"].includes(category) || ["critical", "deficiency", "attention"].includes(level);
  }

  function structuralUpgrade(incoming = {}, outgoing = {}) { return ["recovery", "prioritize"].includes(normalized(incoming.category || incoming.learningState)) && ["maintenance", "reduce"].includes(normalized(outgoing.category || outgoing.learningState)); }
  function descriptor(item = {}) {
    const unit = programUnit(item);
    return { materia: unit.materia || item.materia || "", assunto: unit.assunto || unit.titulo || item.assunto || item.titulo || "", subarea: unit.subarea || item.subarea || "", programUnitKey: topicKey(item), strategicScore: score(item), category: advisorCategory(item), learningState: learningState(item), diagnosisLevel: diagnosisLevel(item), durationMinutes: minutes(item), recommendedSession: item.strategic?.recommendedSession || item.recommendedSession || {} };
  }
  function fingerprint(changes = []) { return changes.map((change) => `${change.slotKey}:${change.outgoing.programUnitKey}>${change.incoming.programUnitKey}`).sort().join("|"); }

  function preview({ blocks = [], topics = [], options = {} } = {}) {
    const config = { ...DEFAULTS, ...(options.config || {}) };
    const sourceBlocks = Array.isArray(blocks) ? blocks : [];
    const sourceTopics = Array.isArray(topics) ? topics : [];
    const topicByKey = new Map(sourceTopics.map((topic) => [topicKey(topic), topic]));
    const activeFocusBlockId = options.activeFocusBlockId || "";
    const cycleEntries = sourceBlocks.map((block, sourceIndex) => ({ block, sourceIndex })).filter(({ block }) => !block.strategicPlanSessionOnly);
    const protectedBlocks = cycleEntries.filter(({ block }) => isProtected(block, activeFocusBlockId));
    const flexible = cycleEntries.filter(({ block }) => !isProtected(block, activeFocusBlockId) && status(block).includes("nao iniciado"));
    const occupied = new Set(cycleEntries.map(({ block }) => topicKey(block)));
    const candidates = sourceTopics.filter((topic) => !occupied.has(topicKey(topic))).filter(isStrategicCandidate).sort((left, right) => score(right) - score(left) || topicKey(left).localeCompare(topicKey(right)));
    const capacityMinutes = cycleEntries.reduce((total, { block }) => total + minutes(block), 0);
    const protectedMinutes = protectedBlocks.reduce((total, { block }) => total + minutes(block), 0);
    const coverage = Number(options.coverage ?? options.strategyCoverage ?? 1);
    const conservativeCoverage = Number.isFinite(coverage) && coverage < config.lowCoverageThreshold;
    const maxChanges = flexible.length ? Math.min(config.maxChangesPerPass, Math.max(1, Math.floor(flexible.length * config.maxReplacementShare))) : 0;
    const changes = [];
    const deferred = [];
    const usedSlots = new Set();
    const subjectChanges = new Map();

    for (const incomingTopic of candidates) {
      if (changes.length >= maxChanges) { deferred.push({ incoming: descriptor(incomingTopic), reason: "change-limit" }); continue; }
      const incoming = descriptor(incomingTopic);
      const subjectCount = subjectChanges.get(normalized(incoming.materia)) || 0;
      if (subjectCount >= config.maxChangesPerSubject) { deferred.push({ incoming, reason: "subject-limit" }); continue; }
      const possibleSlots = flexible.filter(({ sourceIndex }) => !usedSlots.has(sourceIndex)).map(({ block, sourceIndex }) => ({ block, sourceIndex, topic: topicByKey.get(topicKey(block)) || block })).sort((left, right) => score(left.topic) - score(right.topic) || left.sourceIndex - right.sourceIndex);
      const target = possibleSlots.find(({ topic }) => {
        const outgoing = descriptor(topic);
        const delta = incoming.strategicScore - outgoing.strategicScore;
        const extraCaution = conservativeCoverage && !hasLocalEvidence(incomingTopic) ? config.lowCoverageExtraDelta : 0;
        const threshold = structuralUpgrade(incoming, outgoing) ? config.structuralMinScoreDelta + extraCaution : config.replacementMinScoreDelta + extraCaution;
        return delta >= threshold;
      });
      if (!target) { deferred.push({ incoming, reason: conservativeCoverage && !hasLocalEvidence(incomingTopic) ? "low-coverage-low-evidence" : "score-delta" }); continue; }
      const outgoing = descriptor(target.topic);
      const delta = incoming.strategicScore - outgoing.strategicScore;
      changes.push({ type: "replace", slotIndex: target.sourceIndex, slotKey: String(target.block.id || target.block.bloco || target.sourceIndex), outgoing: { ...outgoing, durationMinutes: minutes(target.block) }, incoming: { ...incoming, durationMinutes: minutes(target.block) }, scoreDelta: delta, reason: [`conteúdo de entrada está em ${incoming.category || incoming.learningState || "prioridade estratégica maior"}`, "prioridade estratégica atual significativamente maior", "bloco substituído ainda não foi iniciado", "capacidade total do ciclo foi preservada"] });
      usedSlots.add(target.sourceIndex);
      subjectChanges.set(normalized(incoming.materia), subjectCount + 1);
    }
    return { status: changes.length ? "changes" : "coherent", capacityMinutes, protectedMinutes, flexibleMinutes: flexible.reduce((total, { block }) => total + minutes(block), 0), changes, kept: flexible.filter(({ sourceIndex }) => !usedSlots.has(sourceIndex)).map(({ block }) => descriptor(topicByKey.get(topicKey(block)) || block)), deferred, diagnostics: { flexibleSlots: flexible.length, conservativeCoverage, maxChanges, coverage: Number.isFinite(coverage) ? coverage : null }, summary: changes.length ? [`${changes.length} troca${changes.length === 1 ? "" : "s"} sugerida${changes.length === 1 ? "" : "s"}`, "Carga total preservada"] : ["Seu ciclo atual continua coerente com a estratégia.", "Nenhuma troca relevante é necessária agora."], fingerprint: fingerprint(changes) };
  }

  function copyCanonicalProgramUnit(item = {}) {
    const unit = programUnit(item);
    return PROGRAM_UNIT_FIELDS.reduce((copy, field) => {
      const value = unit[field];
      if (value !== undefined && value !== null) copy[field] = Array.isArray(value) ? value.slice() : value && typeof value === "object" ? { ...value } : value;
      return copy;
    }, {});
  }

  function buildReplacementBlock({ slot = {}, incomingTopic = {}, outgoing = {} } = {}) {
    const unit = copyCanonicalProgramUnit(incomingTopic);
    const activity = incomingTopic.strategic?.recommendedSession?.label || incomingTopic.recommendedSession?.label || "Teoria e questões";
    return {
      ...unit,
      id: slot.id, bloco: slot.bloco, ciclo: slot.ciclo, plannedDay: slot.plannedDay, duracao: slot.duracao, durationMinutes: minutes(slot),
      materia: unit.materia || incomingTopic.materia || "", assunto: unit.assunto || unit.titulo || incomingTopic.assunto || incomingTopic.titulo || "", titulo: unit.titulo || unit.assunto || incomingTopic.titulo || incomingTopic.assunto || "", programUnitKey: unit.programUnitKey || topicKey(incomingTopic),
      status: "Não iniciado", questoes: 0, acertos: 0, percentual: 0, tempoEstudado: 0, observacoes: "", pontosRevisar: false, reviewCycles: [],
      tipo: activity, tipoAtividade: activity, atividadeSugerida: activity,
      strategicScore: score(incomingTopic), strategicReconciled: true, strategicReplaced: { materia: outgoing.materia || "", assunto: outgoing.assunto || "", programUnitKey: outgoing.programUnitKey || "" },
    };
  }

  function applyPreview({ blocks = [], preview: reconciliationPreview = {}, topics = [], options = {} } = {}) {
    const source = Array.isArray(blocks) ? blocks : [];
    const fresh = preview({ blocks: source, topics, options });
    if (fresh.fingerprint !== reconciliationPreview.fingerprint) return { applied: false, stale: true, blocks: source.map((block) => ({ ...block })), preview: fresh };
    const next = source.map((block) => ({ ...block }));
    const byKey = new Map((Array.isArray(topics) ? topics : []).map((topic) => [topicKey(topic), topic]));
    for (const change of reconciliationPreview.changes || []) {
      const index = Number(change.slotIndex);
      const slot = next[index];
      if (!slot || isProtected(slot, options.activeFocusBlockId) || topicKey(slot) !== change.outgoing.programUnitKey) return { applied: false, stale: true, blocks: source.map((block) => ({ ...block })), preview: fresh };
      const incomingTopic = byKey.get(change.incoming.programUnitKey);
      if (!incomingTopic || next.some((block, currentIndex) => currentIndex !== index && topicKey(block) === change.incoming.programUnitKey)) return { applied: false, stale: true, blocks: source.map((block) => ({ ...block })), preview: fresh };
      next[index] = buildReplacementBlock({ slot, incomingTopic, outgoing: change.outgoing });
    }
    return { applied: true, stale: false, blocks: next, preview: reconciliationPreview };
  }

  const api = { DEFAULTS, preview, applyPreview, topicKey, isProtected, isStrategicCandidate, hasLocalEvidence, buildReplacementBlock };
  global.StrategicCycleReconciliation = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
