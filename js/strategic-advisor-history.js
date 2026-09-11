"use strict";

(function initStrategicAdvisorHistory(global) {
  const VERSION = 1;
  const MAX_SNAPSHOTS = 20;
  const SCORE_DELTA = .08;
  const coverageRank = { low: 0, partial: 1, broad: 2 };
  const diagnosisRank = { insufficient: 0, critical: 1, deficiency: 2, attention: 3, adequate: 4, strong: 5 };
  const learningStateRank = { "not-started": 0, building: 1, consolidating: 2, practice: 3, maintenance: 4, recovery: -1 };

  function clamp(value) {
    return Math.max(0, Math.min(1, Number(value) || 0));
  }

  function round(value) {
    return Math.round(clamp(value) * 100) / 100;
  }

  function text(value) {
    return String(value || "").trim();
  }

  function topicKey(topic = {}) {
    return [text(topic.materia).toLocaleLowerCase(), text(topic.assunto).toLocaleLowerCase(), text(topic.subarea).toLocaleLowerCase()].join("::");
  }

  function isPriority(category) {
    return ["prioritize", "recovery"].includes(category);
  }

  function normalizeTopic(topic = {}) {
    return {
      materia: text(topic.materia),
      assunto: text(topic.assunto),
      subarea: text(topic.subarea),
      category: text(topic.category) || "building",
      learningState: text(topic.learningState),
      diagnosisLevel: text(topic.diagnosisLevel) || "insufficient",
      strategicScore: round(topic.strategicScore),
      confidence: round(topic.confidence),
      recentAccuracy: Number.isFinite(topic.recentAccuracy) ? round(topic.recentAccuracy) : null,
      overallAccuracy: Number.isFinite(topic.overallAccuracy) ? round(topic.overallAccuracy) : null,
      questions: Math.max(0, Number(topic.questions) || 0),
      trend: text(topic.trend) || "stable",
      errorRecurrence: text(topic.errorRecurrence) || "none",
      evidenceStage: text(topic.evidenceStage) || "initial",
      reasons: Array.isArray(topic.reasons) ? topic.reasons.map(text).filter(Boolean).slice(0, 4) : [],
    };
  }

  function subjectSummary(topics = []) {
    const counts = { strong: 0, adequate: 0, attention: 0, deficiency: 0, insufficient: 0 };
    topics.forEach((topic) => {
      if (Object.prototype.hasOwnProperty.call(counts, topic.diagnosisLevel)) counts[topic.diagnosisLevel] += 1;
    });
    const ranked = [...topics].sort((a, b) => b.strategicScore - a.strategicScore);
    const focusTopics = topics.filter((topic) => isPriority(topic.category) || topic.category === "watch").map((topic) => topic.assunto).filter(Boolean);
    const maintenanceTopics = topics.filter((topic) => ["maintain", "reduce"].includes(topic.category)).map((topic) => topic.assunto).filter(Boolean);
    const categories = new Set(topics.map((topic) => topic.category));
    return {
      materia: topics[0]?.materia || "",
      strategicState: focusTopics.length && maintenanceTopics.length ? "mixed" : (ranked[0]?.category || "building"),
      topCategory: ranked[0]?.category || "building",
      topPriorityScore: ranked[0]?.strategicScore || 0,
      strongCount: counts.strong,
      adequateCount: counts.adequate,
      attentionCount: counts.attention,
      deficiencyCount: counts.deficiency,
      insufficientCount: counts.insufficient,
      focusTopics,
      maintenanceTopics,
      categoryCount: categories.size,
    };
  }

  function subjectsFor(topics = []) {
    const groups = new Map();
    topics.forEach((topic) => {
      const group = groups.get(topic.materia) || [];
      group.push(topic);
      groups.set(topic.materia, group);
    });
    return [...groups.values()].map(subjectSummary).sort((a, b) => a.materia.localeCompare(b.materia, "pt-BR"));
  }

  function fingerprintFor(snapshot = {}) {
    const compact = {
      version: VERSION,
      coverage: {
        level: snapshot.coverage?.level || "low",
      },
      topics: (snapshot.topics || []).map(normalizeTopic).sort((a, b) => topicKey(a).localeCompare(topicKey(b))).map((topic) => ({
        materia: topic.materia,
        assunto: topic.assunto,
        subarea: topic.subarea,
        category: topic.category,
        learningState: topic.learningState,
        diagnosisLevel: topic.diagnosisLevel,
        trend: topic.trend,
        errorRecurrence: topic.errorRecurrence,
        evidenceStage: topic.evidenceStage,
      })),
    };
    return JSON.stringify(compact);
  }

  function deepFreeze(value) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    Object.values(value).forEach(deepFreeze);
    return Object.freeze(value);
  }

  function createSnapshot({ advisor = {}, id = "", createdAt = new Date().toISOString() } = {}) {
    const topics = (advisor.topicStates || []).map(normalizeTopic).sort((a, b) => topicKey(a).localeCompare(topicKey(b)));
    const coverage = advisor.coverage || {};
    const snapshot = {
      version: VERSION,
      id: id || `strategic-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt,
      coverage: {
        level: coverage.level || "low",
        ratio: round(coverage.ratio),
        evidencedTopics: Number(coverage.evidencedTopics) || 0,
        totalTopics: Number(coverage.totalTopics) || topics.length,
      },
      subjects: subjectsFor(topics),
      topics,
      summary: Array.isArray(advisor.summary) ? advisor.summary.map(text).filter(Boolean).slice(0, 4) : [],
      priorities: (advisor.priorities || []).map((item) => text(item.title)).filter(Boolean).slice(0, 3),
      reduceLoad: (advisor.reduceLoad || []).map((item) => text(item.title)).filter(Boolean).slice(0, 3),
      watch: (advisor.watch || []).map((item) => text(item.title)).filter(Boolean).slice(0, 3),
      building: (advisor.building || []).map((item) => text(item.title)).filter(Boolean).slice(0, 3),
      insufficientEvidence: (advisor.insufficientEvidence || []).map((item) => text(item.title)).filter(Boolean).slice(0, 3),
      confidence: round(advisor.confidence),
    };
    snapshot.fingerprint = fingerprintFor(snapshot);
    return deepFreeze(snapshot);
  }

  function rehydrateSnapshot(snapshot = {}) {
    const topics = (snapshot.topics || []).map(normalizeTopic).sort((a, b) => topicKey(a).localeCompare(topicKey(b)));
    const restored = {
      ...snapshot,
      version: Number(snapshot.version) || VERSION,
      coverage: {
        level: snapshot.coverage?.level || "low",
        ratio: round(snapshot.coverage?.ratio),
        evidencedTopics: Number(snapshot.coverage?.evidencedTopics) || 0,
        totalTopics: Number(snapshot.coverage?.totalTopics) || topics.length,
      },
      subjects: Array.isArray(snapshot.subjects) ? snapshot.subjects.map((subject) => ({ ...subject })) : subjectsFor(topics),
      topics,
      summary: Array.isArray(snapshot.summary) ? [...snapshot.summary] : [],
      priorities: Array.isArray(snapshot.priorities) ? [...snapshot.priorities] : [],
      reduceLoad: Array.isArray(snapshot.reduceLoad) ? [...snapshot.reduceLoad] : [],
      watch: Array.isArray(snapshot.watch) ? [...snapshot.watch] : [],
      building: Array.isArray(snapshot.building) ? [...snapshot.building] : [],
      insufficientEvidence: Array.isArray(snapshot.insufficientEvidence) ? [...snapshot.insufficientEvidence] : [],
      fingerprint: snapshot.fingerprint || fingerprintFor({ ...snapshot, topics }),
    };
    return deepFreeze(restored);
  }

  function rehydrateSnapshots(history = []) {
    return (Array.isArray(history) ? history : []).slice(-MAX_SNAPSHOTS).map(rehydrateSnapshot);
  }

  function provenance(type, previous, current, explanation, cautious = false) {
    return {
      materia: current.materia,
      assunto: current.assunto,
      subarea: current.subarea,
      type,
      title: current.assunto ? `${current.materia} — ${current.assunto}` : current.materia,
      previous: { category: previous.category, learningState: previous.learningState, level: previous.diagnosisLevel, score: previous.strategicScore },
      current: { category: current.category, learningState: current.learningState, level: current.diagnosisLevel, score: current.strategicScore },
      reasons: [...current.reasons],
      explanation: cautious ? `Há um sinal inicial: ${explanation}` : explanation,
      cautious,
    };
  }

  function levelLabel(level) {
    return ({ insufficient: "em construção", critical: "crítico", deficiency: "deficiência", attention: "atenção", adequate: "adequado", strong: "forte" })[level] || level;
  }

  function changeExplanation(previous, current, direction) {
    const title = current.assunto || current.materia;
    if (isPriority(current.category) && !isPriority(previous.category)) return `${title} entrou como ponto prioritário porque ${current.reasons[0] || "os sinais atuais pedem atenção"}.`;
    if (isPriority(previous.category) && !isPriority(current.category)) return `${title} deixou de ser prioridade principal e passou para ${levelLabel(current.diagnosisLevel)}.`;
    if (previous.trend !== "falling" && current.trend === "falling") return `${title} passou a exigir observação por queda consistente no desempenho recente.`;
    if (previous.errorRecurrence !== "high" && current.errorRecurrence === "high") return `${title} passou a apresentar erros recorrentes.`;
    return `${title} passou de ${levelLabel(previous.diagnosisLevel)} para ${levelLabel(current.diagnosisLevel)}.`;
  }

  function learningStateDirection(previous = "", current = "") {
    if (!previous || !current || previous === current) return "";
    if (current === "recovery") return "decline";
    if (previous === "recovery" && current !== "recovery") return "improvement";
    const previousRank = learningStateRank[previous];
    const currentRank = learningStateRank[current];
    if (!Number.isFinite(previousRank) || !Number.isFinite(currentRank)) return "";
    return currentRank > previousRank ? "improvement" : currentRank < previousRank ? "decline" : "";
  }

  function learningStateLabel(state) {
    return ({ "not-started": "não iniciado", building: "construção", consolidating: "consolidação", practice: "questões", maintenance: "manutenção", recovery: "recuperação" })[state] || state;
  }

  function hasMeaningfulStrategicChange(previousSnapshot, currentSnapshot) {
    if (!previousSnapshot || !currentSnapshot) return true;
    if ((previousSnapshot.coverage?.level || "low") !== (currentSnapshot.coverage?.level || "low")) return true;
    const previous = (previousSnapshot.topics || []).map(normalizeTopic);
    const current = (currentSnapshot.topics || []).map(normalizeTopic);
    if (previous.length !== current.length) return true;
    const previousByKey = new Map(previous.map((topic) => [topicKey(topic), topic]));
    return current.some((topic) => {
      const before = previousByKey.get(topicKey(topic));
      if (!before) return true;
      return ["category", "learningState", "diagnosisLevel", "trend", "errorRecurrence", "evidenceStage"].some((field) => before[field] !== topic[field])
        || Math.abs(topic.strategicScore - before.strategicScore) >= SCORE_DELTA;
    });
  }

  function groupChangesBySubject(items = []) {
    const groups = new Map();
    items.forEach((item) => {
      const group = groups.get(item.materia) || [];
      group.push(item);
      groups.set(item.materia, group);
    });
    return [...groups.entries()].map(([materia, changes]) => {
      if (changes.length === 1) return changes[0];
      const topics = changes.map((item) => item.assunto).filter(Boolean);
      const type = changes[0].type;
      const label = type === "improvement" ? "melhoraram" : type === "decline" ? "merecem atenção" : "se consolidaram";
      return {
        materia,
        assunto: "",
        type,
        title: materia,
        changes,
        explanation: `${topics.join(", ")} ${label} nesta análise.`,
        reasons: [],
      };
    });
  }

  function compare(previousSnapshot, currentSnapshot) {
    if (!previousSnapshot || !currentSnapshot) {
      return { improvements: [], declines: [], stabilized: [], newPriorities: [], resolvedPriorities: [], stateChanges: [], learningStateChanges: [], priorityChanges: [], coverageChanges: [], grouped: { improvements: [], declines: [], stabilized: [] }, notableChanges: [], summary: "Este é o primeiro marco estratégico registrado. A partir das próximas análises, o sistema mostrará o que mudou.", initial: true };
    }
    const previous = (previousSnapshot.topics || []).map(normalizeTopic);
    const current = (currentSnapshot.topics || []).map(normalizeTopic);
    const previousByKey = new Map(previous.map((topic) => [topicKey(topic), topic]));
    const improvements = [];
    const declines = [];
    const stabilized = [];
    const newPriorities = [];
    const resolvedPriorities = [];
    const stateChanges = [];
    const learningStateChanges = [];
    const priorityChanges = [];

    current.forEach((topic) => {
      const before = previousByKey.get(topicKey(topic));
      if (!before) return;
      const cautious = topic.confidence < .45 || topic.questions < 10;
      const levelDelta = (diagnosisRank[topic.diagnosisLevel] ?? 0) - (diagnosisRank[before.diagnosisLevel] ?? 0);
      const stateDirection = learningStateDirection(before.learningState, topic.learningState);
      const becamePriority = !isPriority(before.category) && isPriority(topic.category);
      const resolvedPriority = isPriority(before.category) && !isPriority(topic.category);
      const worsened = levelDelta < 0 || stateDirection === "decline" || becamePriority || (before.trend !== "falling" && topic.trend === "falling") || (before.errorRecurrence !== "high" && topic.errorRecurrence === "high");
      const improved = levelDelta > 0 || stateDirection === "improvement" || resolvedPriority || (before.trend === "falling" && ["stable", "improving"].includes(topic.trend)) || (before.errorRecurrence === "high" && topic.errorRecurrence !== "high");
      if (improved || worsened) {
        const type = improved && !worsened ? "improvement" : "decline";
        const explanation = stateDirection
          ? `${topic.assunto || topic.materia} ${stateDirection === "improvement" ? "avançou" : "passou"} de ${learningStateLabel(before.learningState)} para ${learningStateLabel(topic.learningState)}${levelDelta > 0 ? ` e deixou o nível de ${levelLabel(before.diagnosisLevel)}.` : "."}`
          : changeExplanation(before, topic, type);
        const item = provenance(type, before, topic, explanation, cautious);
        stateChanges.push(item);
        (type === "improvement" ? improvements : declines).push(item);
        if (becamePriority) newPriorities.push(item);
        if (resolvedPriority) resolvedPriorities.push(item);
      } else if (before.category === topic.category && before.diagnosisLevel === topic.diagnosisLevel && ["stable", "improving"].includes(topic.trend) && (before.trend === "falling" || topic.confidence - before.confidence >= .12)) {
        stabilized.push(provenance("stabilized", before, topic, `${topic.assunto || topic.materia} manteve desempenho consistente e permanece em ${levelLabel(topic.diagnosisLevel)}.`, cautious));
      }
      if (Math.abs(topic.strategicScore - before.strategicScore) >= SCORE_DELTA) {
        const direction = topic.strategicScore > before.strategicScore ? "increased" : "reduced";
        priorityChanges.push(provenance("priority-change", before, topic, `${topic.assunto || topic.materia} ${direction === "increased" ? "ganhou" : "perdeu"} importância operacional na estratégia atual.`, cautious));
      }
      if (stateDirection) {
        learningStateChanges.push({
          materia: topic.materia,
          assunto: topic.assunto,
          subarea: topic.subarea,
          direction: stateDirection,
          previous: { learningState: before.learningState },
          current: { learningState: topic.learningState },
        });
      }
    });

    const previousCoverage = previousSnapshot.coverage?.level || "low";
    const currentCoverage = currentSnapshot.coverage?.level || "low";
    const coverageChanges = previousCoverage === currentCoverage ? [] : [{
      type: coverageRank[currentCoverage] > coverageRank[previousCoverage] ? "improvement" : "decline",
      previous: previousCoverage,
      current: currentCoverage,
      title: "Cobertura da preparação",
      explanation: coverageRank[currentCoverage] > coverageRank[previousCoverage]
        ? currentCoverage === "broad" ? "Agora já existe cobertura suficiente para conclusões mais amplas sobre a preparação." : "A visão da sua preparação ficou mais confiável porque mais conteúdos passaram a ter evidência própria."
        : "A cobertura disponível para conclusões globais ficou mais limitada neste marco.",
    }];
    const changedTopicKeys = new Set(stateChanges.map((item) => `${item.materia || ""}:${item.assunto || ""}:${item.title}`));
    const independentPriorityChanges = priorityChanges.filter((item) => !changedTopicKeys.has(`${item.materia || ""}:${item.assunto || ""}:${item.title}`));
    const notableChanges = [...declines, ...newPriorities, ...improvements, ...resolvedPriorities, ...independentPriorityChanges, ...coverageChanges, ...stabilized]
      .filter((item, index, list) => list.findIndex((candidate) => `${candidate.materia || ""}:${candidate.assunto || ""}:${candidate.title}` === `${item.materia || ""}:${item.assunto || ""}:${item.title}`) === index)
      .slice(0, 5);
    const uniqueTopics = (items) => new Set(items.map((item) => `${item.materia || ""}:${item.assunto || ""}:${item.title}`)).size;
    const improvementCount = uniqueTopics([...improvements, ...resolvedPriorities]);
    const attentionCount = uniqueTopics([...declines, ...newPriorities]);
    const summary = !notableChanges.length
      ? "Nenhuma mudança estratégica relevante desde o último marco estratégico."
      : improvementCount || attentionCount
        ? `Desde o último marco: ${improvementCount} ${improvementCount === 1 ? "avanço" : "avanços"} e ${attentionCount} ${attentionCount === 1 ? "novo ponto de atenção" : "novos pontos de atenção"}.`
        : coverageChanges[0]?.explanation || "Nenhuma mudança estratégica relevante desde o último marco estratégico.";
    return {
      improvements,
      declines,
      stabilized,
      newPriorities,
      resolvedPriorities,
      stateChanges,
      learningStateChanges,
      priorityChanges,
      independentPriorityChanges,
      coverageChanges,
      grouped: {
        improvements: groupChangesBySubject(improvements),
        declines: groupChangesBySubject(declines),
        stabilized: groupChangesBySubject(stabilized),
      },
      notableChanges,
      summary,
      initial: false,
    };
  }

  function appendSnapshot(history = [], snapshot) {
    const snapshots = rehydrateSnapshots(history);
    const previous = snapshots.at(-1) || null;
    if (previous && !hasMeaningfulStrategicChange(previous, snapshot)) {
      return { snapshots, added: false, comparison: compare(previous, snapshot), message: "Não houve mudança estratégica relevante desde o último marco." };
    }
    const comparison = compare(previous, snapshot);
    return {
      snapshots: [...snapshots, snapshot].slice(-MAX_SNAPSHOTS),
      added: true,
      comparison,
      message: previous ? "Marco estratégico atualizado." : "Marco estratégico inicial registrado.",
    };
  }

  const api = { VERSION, MAX_SNAPSHOTS, SCORE_DELTA, createSnapshot, appendSnapshot, compare, fingerprintFor, hasMeaningfulStrategicChange, rehydrateSnapshot, rehydrateSnapshots };
  global.StrategicAdvisorHistory = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
