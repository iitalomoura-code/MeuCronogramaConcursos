"use strict";

(function initHistoryInheritance(global) {
  const DAY = 24 * 60 * 60 * 1000;
  const GENERIC_TOPICS = new Set(["introducao", "disposicoes gerais", "aspectos gerais", "conceitos gerais", "generalidades"]);
  const SUBJECT_ALIASES = Object.freeze([
    ["administracao publica", "administracao geral e publica"],
    ["direito financeiro", "administracao financeira e orcamentaria"],
    ["direito financeiro", "afo"],
  ]);
  const TOPIC_ALIASES = Object.freeze([
    ["receita publica", "receitas publicas"],
    ["atos administrativos", "atos e principios administrativos"],
    ["planejamento estrategico", "planejamento estrategico tatico e operacional"],
  ]);

  function clamp(value, minimum = 0, maximum = 1) {
    return Math.max(minimum, Math.min(maximum, Number(value) || 0));
  }

  function normalize(value = "") {
    return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  }

  function tokens(value = "") {
    return normalize(value).split(" ").filter((word) => word.length > 2 && !["dos", "das", "para", "com", "por", "nos", "nas", "uma", "uns", "uma", "sobre"].includes(word));
  }

  function sameAlias(left = "", right = "", aliases = []) {
    const a = normalize(left);
    const b = normalize(right);
    return aliases.some(([first, second]) => (a === normalize(first) && b === normalize(second)) || (a === normalize(second) && b === normalize(first)));
  }

  function overlap(left = "", right = "") {
    const a = [...new Set(tokens(left))];
    const b = [...new Set(tokens(right))];
    if (!a.length || !b.length) return 0;
    const shared = a.filter((token) => b.includes(token)).length;
    return shared / Math.max(a.length, b.length);
  }

  function subjectMatch(target = "", source = "") {
    const a = normalize(target);
    const b = normalize(source);
    if (!a || !b) return { score: 0, confidence: "low", kind: "none" };
    if (a === b) return { score: 1, confidence: "high", kind: "exact" };
    if (sameAlias(a, b, SUBJECT_ALIASES)) return { score: .78, confidence: "medium", kind: "alias" };
    const score = overlap(a, b);
    return score >= .66
      ? { score, confidence: "medium", kind: "partial" }
      : { score: 0, confidence: "low", kind: "none" };
  }

  function topicMatch(target = "", source = "") {
    const a = normalize(target);
    const b = normalize(source);
    if (!a || !b || GENERIC_TOPICS.has(a) || GENERIC_TOPICS.has(b)) return { score: 0, confidence: "low", kind: "none" };
    if (a === b) return { score: 1, confidence: "high", kind: "exact" };
    if (sameAlias(a, b, TOPIC_ALIASES)) return { score: .96, confidence: "high", kind: "alias" };
    const shortest = Math.min(a.length, b.length);
    if (shortest >= 8 && (a.includes(b) || b.includes(a))) return { score: .86, confidence: "high", kind: "contained" };
    const score = overlap(a, b);
    return score >= .72
      ? { score, confidence: score >= .86 ? "high" : "medium", kind: "partial" }
      : { score: 0, confidence: "low", kind: "none" };
  }

  function dateValue(entry = {}) {
    const candidates = [entry.completedAt, entry.concluidoEm, entry.savedAt, entry.closedAt, entry.createdAt].filter(Boolean);
    for (const value of candidates) {
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(String(value))) {
        const [day, month, year] = String(value).split("/").map(Number);
        const brazilian = new Date(year, month - 1, day).getTime();
        if (Number.isFinite(brazilian)) return brazilian;
      }
      const parsed = new Date(value).getTime();
      if (Number.isFinite(parsed) && parsed >= new Date(2000, 0, 1).getTime()) return parsed;
    }
    return 0;
  }

  function completed(block = {}) {
    const status = normalize(block.status || "concluido");
    return !status || status.includes("concluido") || Boolean(block.completedAt || block.concluidoEm);
  }

  function snapshotBlocks(source = {}) {
    const snapshot = source.snapshot || source.data || {};
    const blocks = [
      ...(snapshot.completedHistory || []),
      ...(snapshot.cycleHistory || []).flatMap((cycle) => [...(cycle.completedHistory || []), ...(cycle.generatedBlocks || [])]),
      ...(snapshot.cycleResults || []).flatMap((cycle) => cycle.completed || []),
      ...(snapshot.interventionHistory || []),
    ].filter((block) => block?.materia && block?.assunto && completed(block));
    const seen = new Set();
    return blocks.filter((block) => {
      const signature = [normalize(block.materia), normalize(block.assunto), dateValue(block), Number(block.questoes) || 0, Number(block.acertos) || 0, Number(block.tempoEstudado) || 0].join("|");
      if (seen.has(signature)) return false;
      seen.add(signature);
      return true;
    }).map((block) => ({ ...block, sourceId: source.id || "", sourceName: source.name || snapshot.form?.contestName || "Planejamento anterior" }));
  }

  function sourceDifficulty(source = {}, materia = "") {
    const subjects = source.snapshot?.planningBase?.materias || source.data?.planningBase?.materias || [];
    const match = subjects.find((subject) => normalize(subject.materia) === normalize(materia));
    return Number(match?.dominio) || 0;
  }

  function matchingEntries(target = {}, sources = []) {
    const matches = [];
    sources.forEach((source) => snapshotBlocks(source).forEach((entry) => {
      const topic = topicMatch(target.assunto, entry.assunto);
      if (topic.score < .72) return;
      const subject = subjectMatch(target.materia, entry.materia);
      // Um título igual ainda pode ser reaproveitado entre matérias relacionadas,
      // mas uma semelhança ampla nunca é suficiente por si só.
      if (subject.score < .45 && topic.score < .96) return;
      const score = clamp(topic.score * .82 + subject.score * .18);
      matches.push({
        entry,
        source,
        score,
        topic,
        subject,
        difficulty: sourceDifficulty(source, entry.materia),
      });
    }));
    return matches.sort((left, right) => right.score - left.score || dateValue(right.entry) - dateValue(left.entry));
  }

  function confidenceLabel(score) {
    if (score >= .72) return "high";
    if (score >= .42) return "medium";
    return "low";
  }

  function sourceSummary(matches = [], now = Date.now()) {
    const bySource = new Map();
    matches.forEach((match) => {
      const id = match.source.id || match.entry.sourceId || match.entry.sourceName;
      const current = bySource.get(id) || { ...match, entries: [] };
      current.entries.push(match.entry);
      current.score = Math.max(current.score, match.score);
      bySource.set(id, current);
    });
    return [...bySource.values()].map((group) => {
      const entries = group.entries.sort((left, right) => dateValue(left) - dateValue(right));
      const questions = entries.reduce((sum, entry) => sum + Math.max(0, Number(entry.questoes) || 0), 0);
      const correct = entries.reduce((sum, entry) => sum + Math.min(Math.max(0, Number(entry.questoes) || 0), Math.max(0, Number(entry.acertos) || 0)), 0);
      const sessions = entries.filter((entry) => Number(entry.questoes) > 0 || Number(entry.tempoEstudado) > 0).length;
      const hours = entries.reduce((sum, entry) => sum + Math.max(0, Number(entry.tempoEstudado) || 0), 0);
      const lastContact = entries.map(dateValue).reduce((latest, value) => Math.max(latest, value), 0);
      const daysSinceContact = lastContact ? Math.max(0, Math.floor((now - lastContact) / DAY)) : null;
      const recency = lastContact ? Math.exp(-Math.max(0, daysSinceContact) / 210) : .22;
      const volume = clamp(questions / 80) * .48 + clamp(sessions / 4) * .2 + clamp(hours / 5) * .12;
      const accuracy = questions ? correct / questions : null;
      const quality = accuracy === null ? .25 : accuracy >= .8 ? 1 : accuracy >= .7 ? .72 : accuracy >= .55 ? .42 : .18;
      const confidence = clamp((volume + quality * .13 + group.score * .07) * (.45 + recency * .55));
      return {
        sourceId: group.source.id || "",
        sourceName: group.source.name || group.entry.sourceName,
        matchScore: group.score,
        matchConfidence: group.topic.confidence === "high" && group.subject.confidence !== "low" ? "high" : group.topic.confidence,
        matchKind: group.topic.kind,
        matchedSubject: group.entry.materia,
        matchedTopic: group.entry.assunto,
        questions,
        correct,
        accuracy,
        sessions,
        hours,
        difficulty: group.difficulty,
        lastContact,
        daysSinceContact,
        recency,
        confidence,
      };
    }).sort((left, right) => right.confidence - left.confidence || right.lastContact - left.lastContact).slice(0, 3);
  }

  function inheritanceLevel(summary = []) {
    if (!summary.length) return "none";
    const best = summary[0];
    if (best.questions >= 40 && (best.accuracy === null || best.accuracy >= .72) && best.confidence >= .52 && best.matchConfidence !== "low") return "strong";
    if (best.questions >= 10 || best.sessions >= 2 || best.hours >= 1) return "partial";
    return "contact";
  }

  function sourceOrigin({ currentEvidence = {}, initialProfile = {}, level = "none" } = {}) {
    const current = Number(currentEvidence.questions) > 0 || Number(currentEvidence.sessions) > 0 || Number(currentEvidence.hours) > 0;
    const informed = initialProfile.level && initialProfile.level !== "unknown";
    const inherited = level !== "none";
    if (current && (informed || inherited)) return "mixed";
    if (current) return "current-cycle";
    if (inherited && informed) return "mixed";
    if (inherited) return "previous-history";
    if (informed) return "self-assessment";
    return "none";
  }

  function derive({ target = {}, sources = [], currentEvidence = {}, initialProfile = {}, now = Date.now() } = {}) {
    const matches = matchingEntries(target, sources);
    const summaries = sourceSummary(matches, now);
    const level = inheritanceLevel(summaries);
    const primary = summaries[0] || null;
    const confidence = primary?.confidence || 0;
    const matchConfidence = primary?.matchConfidence || "low";
    const profileMismatch = level !== "none" && initialProfile.level === "never-studied";
    const recommendation = level === "strong" || level === "partial"
      ? "Questões diagnósticas"
      : level === "contact"
        ? "Teoria direcionada e questões"
        : "Teoria e questões";
    return {
      level,
      label: { none: "Sem base", contact: "Contato prévio", partial: "Base prévia parcial", strong: "Base prévia forte" }[level],
      confidence,
      confidenceLabel: confidenceLabel(confidence),
      matchConfidence,
      origin: sourceOrigin({ currentEvidence, initialProfile, level }),
      provisional: level !== "none" && !(Number(currentEvidence.questions) > 0 || Number(currentEvidence.sessions) > 0),
      recommendation,
      profileMismatch,
      sources: summaries,
      metrics: primary ? {
        questions: primary.questions,
        accuracy: primary.accuracy,
        sessions: primary.sessions,
        hours: primary.hours,
        difficulty: primary.difficulty,
        lastContact: primary.lastContact,
        daysSinceContact: primary.daysSinceContact,
      } : { questions: 0, accuracy: null, sessions: 0, hours: 0, difficulty: 0, lastContact: 0, daysSinceContact: null },
      reasons: primary
        ? [`estudado em ${primary.sourceName}`, primary.questions ? `${primary.questions} questões anteriores` : `${primary.sessions} sessões anteriores`, primary.accuracy === null ? "sem percentual consolidado" : `${Math.round(primary.accuracy * 100)}% de acerto`, `correspondência ${primary.matchConfidence === "high" ? "alta" : primary.matchConfidence === "medium" ? "média" : "baixa"}`]
        : ["nenhum histórico confiável correspondente"],
    };
  }

  const api = { normalize, subjectMatch, topicMatch, snapshotBlocks, matchingEntries, derive };
  global.HistoryInheritance = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
