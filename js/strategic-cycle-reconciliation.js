"use strict";

(function initStrategicCycleReconciliation(global) {
  const DEFAULTS = Object.freeze({
    replacementMinScoreDelta: .12,
    structuralMinScoreDelta: .08,
    maxReplacementShare: .25,
    maxChangesPerPass: 3,
    maxChangesPerSubject: 1,
    lowCoverageThreshold: .35,
    lowCoverageExtraDelta: .06,
    strongLocalEvidenceScore: .86,
  });

  function normalized(value = "") {
    return String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase().replace(/\s+/g, " ");
  }

  function topicKey(item = {}) {
    return item.programUnitKey || [normalized(item.materia), normalized(item.subarea), normalized(item.assunto || item.titulo)].filter(Boolean).join("::");
  }

  function minutes(block = {}) {
    return Math.max(0, Math.round((Number(block.durationMinutes) || Number(block.duracao) * 60 || 0)));
  }

  function status(block = {}) {
    return normalized(block.status);
  }

  function learningState(item = {}) {
    return item.strategic?.learningState?.key || item.learningState?.key || item.learningState || item.category || "";
  }

  function score(item = {}) {
    return Math.max(0, Math.min(1, Number(item.strategic?.score ?? item.strategicScore ?? item.score) || 0));
  }

  function isProtected(block = {}, activeFocusBlockId = "") {
    const active = String(activeFocusBlockId || "");
    return status(block).includes("conclu")
      || status(block).includes("em andamento")
      || Boolean(block.protected || block.adaptive || block.reviewIntegrated || block.reinforcementIntegrated || block.intervencao || block.interventionOrigin)
      || ["protected", "adaptive"].includes(normalized(block.category))
      || Boolean(active && (String(block.id || "") === active || String(block.bloco || "") === active));
  }

  function isCandidateState(value = "") {
    return ["recovery", "prioritize", "building", "consolidating", "attention", "deficiency", "critical"].includes(normalized(value));
  }

  function structuralUpgrade(incoming = "", outgoing = "") {
    return normalized(incoming) === "recovery" && ["maintenance", "reduce"].includes(normalized(outgoing));
  }

  function descriptor(item = {}) {
    return {
      materia: item.materia || "",
      assunto: item.assunto || item.titulo || "",
      subarea: item.subarea || "",
      programUnitKey: topicKey(item),
      strategicScore: score(item),
      category: item.category || item.strategic?.category || "",
      learningState: learningState(item),
      durationMinutes: minutes(item),
      recommendedSession: item.strategic?.recommendedSession || item.recommendedSession || {},
    };
  }

  function fingerprint(changes = []) {
    return changes.map((change) => `${change.slotKey}:${change.outgoing.programUnitKey}>${change.incoming.programUnitKey}`).sort().join("|");
  }

  function preview({ blocks = [], topics = [], options = {} } = {}) {
    const config = { ...DEFAULTS, ...(options.config || {}) };
    const sourceBlocks = Array.isArray(blocks) ? blocks : [];
    const sourceTopics = Array.isArray(topics) ? topics : [];
    const topicByKey = new Map(sourceTopics.map((topic) => [topicKey(topic), topic]));
    const activeFocusBlockId = options.activeFocusBlockId || "";
    const cycleBlocks = sourceBlocks.filter((block) => !block.strategicPlanSessionOnly);
    const protectedBlocks = cycleBlocks.filter((block) => isProtected(block, activeFocusBlockId));
    const flexible = cycleBlocks.map((block, index) => ({ block, index })).filter(({ block }) => !isProtected(block, activeFocusBlockId) && status(block).includes("nao iniciado"));
    const occupied = new Set(cycleBlocks.map(topicKey));
    const candidates = sourceTopics
      .filter((topic) => !occupied.has(topicKey(topic)))
      .filter((topic) => isCandidateState(learningState(topic)))
      .sort((left, right) => score(right) - score(left) || topicKey(left).localeCompare(topicKey(right)));
    const capacityMinutes = cycleBlocks.reduce((total, block) => total + minutes(block), 0);
    const protectedMinutes = protectedBlocks.reduce((total, block) => total + minutes(block), 0);
    const coverage = Number(options.coverage ?? options.strategyCoverage ?? 1);
    const conservativeCoverage = Number.isFinite(coverage) && coverage < config.lowCoverageThreshold;
    const maxChanges = flexible.length
      ? Math.min(config.maxChangesPerPass, Math.max(1, Math.floor(flexible.length * config.maxReplacementShare)))
      : 0;
    const changes = [];
    const deferred = [];
    const usedSlots = new Set();
    const subjectChanges = new Map();

    for (const incomingTopic of candidates) {
      if (changes.length >= maxChanges) {
        deferred.push({ incoming: descriptor(incomingTopic), reason: "change-limit" });
        continue;
      }
      const incoming = descriptor(incomingTopic);
      const subjectCount = subjectChanges.get(normalized(incoming.materia)) || 0;
      if (subjectCount >= config.maxChangesPerSubject) {
        deferred.push({ incoming, reason: "subject-limit" });
        continue;
      }
      const possibleSlots = flexible
        .filter(({ index }) => !usedSlots.has(index))
        .map(({ block, index }) => ({ block, index, topic: topicByKey.get(topicKey(block)) || block }))
        .sort((left, right) => score(left.topic) - score(right.topic) || left.index - right.index);
      const target = possibleSlots.find(({ topic }) => {
        const outgoing = descriptor(topic);
        const delta = incoming.strategicScore - outgoing.strategicScore;
        const threshold = structuralUpgrade(incoming.learningState, outgoing.learningState)
          ? config.structuralMinScoreDelta
          : config.replacementMinScoreDelta + (conservativeCoverage && incoming.strategicScore < config.strongLocalEvidenceScore ? config.lowCoverageExtraDelta : 0);
        return delta >= threshold;
      });
      if (!target) {
        deferred.push({ incoming, reason: conservativeCoverage ? "low-coverage" : "score-delta" });
        continue;
      }
      const outgoing = descriptor(target.topic);
      const delta = incoming.strategicScore - outgoing.strategicScore;
      changes.push({
        type: "replace",
        slotIndex: target.index,
        slotKey: String(target.block.id || target.block.bloco || target.index),
        outgoing: { ...outgoing, durationMinutes: minutes(target.block) },
        incoming: { ...incoming, durationMinutes: minutes(target.block) },
        scoreDelta: delta,
        reason: [
          `conteúdo de entrada está em ${incoming.learningState || "prioridade estratégica maior"}`,
          "prioridade estratégica atual significativamente maior",
          "bloco substituído ainda não foi iniciado",
          "capacidade total do ciclo foi preservada",
        ],
      });
      usedSlots.add(target.index);
      subjectChanges.set(normalized(incoming.materia), subjectCount + 1);
    }

    return {
      status: changes.length ? "changes" : "coherent",
      capacityMinutes,
      protectedMinutes,
      flexibleMinutes: flexible.reduce((total, entry) => total + minutes(entry.block), 0),
      changes,
      kept: flexible.filter(({ index }) => !usedSlots.has(index)).map(({ block }) => descriptor(topicByKey.get(topicKey(block)) || block)),
      deferred,
      diagnostics: { flexibleSlots: flexible.length, conservativeCoverage, maxChanges, coverage: Number.isFinite(coverage) ? coverage : null },
      summary: changes.length
        ? [`${changes.length} troca${changes.length === 1 ? "" : "s"} sugerida${changes.length === 1 ? "" : "s"}`, "Carga total preservada"]
        : ["Seu ciclo atual continua coerente com a estratégia.", "Nenhuma troca relevante é necessária agora."],
      fingerprint: fingerprint(changes),
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
      const duration = slot.duracao;
      const preservedSlot = {
        id: slot.id,
        bloco: slot.bloco,
        ciclo: slot.ciclo,
        plannedDay: slot.plannedDay,
        duracao: duration,
        status: slot.status,
      };
      next[index] = {
        ...slot,
        ...incomingTopic,
        ...preservedSlot,
        materia: incomingTopic.materia,
        assunto: incomingTopic.assunto || incomingTopic.titulo,
        titulo: incomingTopic.titulo || incomingTopic.assunto,
        programUnitKey: topicKey(incomingTopic),
        duracao: duration,
        durationMinutes: minutes(slot),
        tipo: incomingTopic.strategic?.recommendedSession?.label || slot.tipo,
        tipoAtividade: incomingTopic.strategic?.recommendedSession?.label || slot.tipoAtividade,
        atividadeSugerida: incomingTopic.strategic?.recommendedSession?.label || slot.atividadeSugerida,
        strategicScore: score(incomingTopic),
        strategicReconciled: true,
        strategicReplaced: { materia: change.outgoing.materia, assunto: change.outgoing.assunto, programUnitKey: change.outgoing.programUnitKey },
      };
    }
    return { applied: true, stale: false, blocks: next, preview: reconciliationPreview };
  }

  const api = { DEFAULTS, preview, applyPreview, topicKey, isProtected };
  global.StrategicCycleReconciliation = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
