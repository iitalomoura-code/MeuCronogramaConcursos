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
  ]);
  const SUBJECT_RELATION_GROUPS = Object.freeze([
    ["administracao geral e publica", "administracao geral", "administracao publica", "direito administrativo"],
    ["governanca publica", "administracao geral", "administracao publica"],
  ]);
  const CONTENT_STOP_WORDS = new Set(["administracao", "administracoes", "administrativo", "administrativos", "administrativa", "administrativas", "direito", "publica", "publico", "geral", "gerais", "conceito", "conceitos", "introducao", "aspectos", "parte", "principais", "tema", "temas"]);

  function clamp(value, minimum = 0, maximum = 1) {
    return Math.max(minimum, Math.min(maximum, Number(value) || 0));
  }

  function normalize(value = "") {
    return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  }

  function tokens(value = "") {
    return normalize(value).split(" ").filter((word) => word.length > 2 && !["dos", "das", "para", "com", "por", "nos", "nas", "uma", "uns", "uma", "sobre"].includes(word));
  }

  function contentTokens(value = "") {
    return [...new Set(tokens(value).filter((word) => !CONTENT_STOP_WORDS.has(word)))];
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

  function subjectCompatibility(target = "", source = "") {
    const direct = subjectMatch(target, source);
    if (direct.score) return direct;
    const a = normalize(target);
    const b = normalize(source);
    if (SUBJECT_RELATION_GROUPS.some((group) => group.includes(a) && group.includes(b))) {
      return { score: .55, confidence: "medium", kind: "related" };
    }
    return direct;
  }

  function splitTopic(value = "") {
    const raw = String(value || "").trim();
    const separator = raw.indexOf(":");
    return separator >= 0
      ? { title: raw.slice(0, separator).trim(), details: raw.slice(separator + 1).trim() }
      : { title: raw, details: "" };
  }

  function textFrom(value) {
    return Array.isArray(value) ? value.filter(Boolean).join("; ") : String(value || "").trim();
  }

  function canonicalHistoricalTopic(entry = {}) {
    const parsed = splitTopic(entry.assunto);
    const title = String(entry.metaTitulo || parsed.title || entry.assunto || "").trim();
    const details = textFrom(entry.conteudoBloco) || textFrom(entry.metaConteudos) || parsed.details || textFrom(entry.conteudosOriginais);
    return { title, details, subject: String(entry.materia || ""), rawTopic: String(entry.assunto || "") };
  }

  function canonicalTargetTopic(target = {}) {
    const parsed = splitTopic(target.assunto);
    const title = String(target.titulo || parsed.title || target.assunto || "").trim();
    const details = textFrom(target.descricao) || textFrom(target.conteudosOriginais) || parsed.details;
    return { title, details, subject: String(target.materia || ""), rawTopic: String(target.assunto || title) };
  }

  function topicMatch(target = "", source = "") {
    const a = normalize(target);
    const b = normalize(source);
    if (!a || !b || GENERIC_TOPICS.has(a) || GENERIC_TOPICS.has(b)) return { score: 0, confidence: "low", kind: "none" };
    if (a === b) return { score: 1, confidence: "high", kind: "exact", direction: "equivalent" };
    if (sameAlias(a, b, TOPIC_ALIASES)) return { score: .96, confidence: "high", kind: "alias", direction: "equivalent" };
    const targetTokens = [...new Set(tokens(a))];
    const sourceTokens = [...new Set(tokens(b))];
    const containsAll = (container, contained) => contained.length && contained.every((token) => container.includes(token));
    if (containsAll(targetTokens, sourceTokens)) return { score: .78, confidence: "medium", kind: "contained", direction: "broad-to-specific" };
    if (containsAll(sourceTokens, targetTokens)) return { score: .84, confidence: "medium", kind: "contained", direction: "specific-to-broad" };
    const score = overlap(a, b);
    return score >= .72
      ? { score, confidence: score >= .86 ? "high" : "medium", kind: "partial", direction: "partial" }
      : { score: 0, confidence: "low", kind: "none", direction: "none" };
  }

  function detailCoverage(target = {}, source = {}) {
    const targetTerms = contentTokens(`${target.title} ${target.details}`);
    const sourceTerms = contentTokens(`${source.title} ${source.details}`);
    if (!targetTerms.length || !sourceTerms.length) return 0;
    return targetTerms.filter((term) => sourceTerms.includes(term)).length / targetTerms.length;
  }

  function hasStructuralCoverage(target = {}, source = {}) {
    const targetTerms = contentTokens(`${target.title} ${target.details}`);
    const sourceTerms = contentTokens(`${source.title} ${source.details}`);
    const shared = targetTerms.filter((term) => sourceTerms.includes(term)).length;
    if (!targetTerms.length || !sourceTerms.length) return false;
    const coverage = shared / targetTerms.length;
    return targetTerms.length <= 2 ? coverage >= .5 && shared >= 1 : coverage >= .25 && shared >= 2;
  }

  function candidateMatch(target = {}, entry = {}) {
    const targetTopic = canonicalTargetTopic(target);
    const sourceTopic = canonicalHistoricalTopic(entry);
    const title = topicMatch(targetTopic.title, sourceTopic.title);
    const coverage = detailCoverage(targetTopic, sourceTopic);
    const subject = subjectCompatibility(targetTopic.subject, sourceTopic.subject);
    const exactCanonicalTitle = title.kind === "exact" || title.kind === "alias";
    const titleContained = title.kind === "contained" && subject.score >= .45;
    const structuralCoverage = hasStructuralCoverage(targetTopic, sourceTopic) && subject.score >= .55;
    const accepted = exactCanonicalTitle || titleContained || (title.score >= .72 && subject.score >= .45) || structuralCoverage;
    const matchBasis = exactCanonicalTitle
      ? title.kind === "alias" ? "controlled-alias" : "canonical-title-exact"
      : titleContained ? "title-containment"
        : structuralCoverage ? "detail-coverage"
          : title.score >= .72 ? "title-overlap" : "none";
    const direction = exactCanonicalTitle ? "equivalent" : title.direction && title.direction !== "none" ? title.direction : "partial";
    return {
      target: targetTopic,
      source: sourceTopic,
      title,
      detailCoverage: coverage,
      subject,
      accepted,
      matchBasis,
      direction,
    };
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

  function hasExecutionEvidence(block = {}, explicitCompletionHistory = false) {
    const status = normalize(block.status || "");
    return explicitCompletionHistory
      || status.includes("concluido")
      || Boolean(block.completedAt || block.concluidoEm)
      || Number(block.questoes) > 0
      || Number(block.tempoEstudado) > 0;
  }

  function snapshotBlockCandidates(source = {}) {
    const snapshot = source.snapshot || source.data || {};
    return [
      ...(snapshot.completedHistory || []).map((block) => ({ block, explicitCompletionHistory: true, collection: "completedHistory" })),
      ...(snapshot.generatedBlocks || []).map((block) => ({ block, explicitCompletionHistory: false, collection: "generatedBlocks" })),
      ...(snapshot.cycleHistory || []).flatMap((cycle) => [
        ...(cycle.completedHistory || []).map((block) => ({ block, explicitCompletionHistory: true, collection: "cycleHistory" })),
        ...(cycle.generatedBlocks || []).map((block) => ({ block, explicitCompletionHistory: false, collection: "cycleHistory" })),
      ]),
      ...(snapshot.cycleResults || []).flatMap((cycle) => (cycle.completed || []).map((block) => ({ block, explicitCompletionHistory: true, collection: "cycleResults" }))),
      ...(snapshot.interventionHistory || []).map((block) => ({ block, explicitCompletionHistory: true, collection: "interventionHistory" })),
    ];
  }

  function executionIdentity(block = {}) {
    const value = block.sessaoId || block.sessionId || block.lastSavedSessionId || block.eventId || block.executionId;
    return value ? String(value) : "";
  }

  function structuralExecutionSignature(block = {}) {
    return [normalize(block.materia), normalize(block.assunto), dateValue(block), Number(block.questoes) || 0, Number(block.acertos) || 0, Number(block.tempoEstudado) || 0].join("|");
  }

  function uniqueExecutionCandidates(candidates = []) {
    const identities = new Set();
    const structural = new Map();
    return candidates.filter(({ block }) => {
      const identity = executionIdentity(block);
      const signature = structuralExecutionSignature(block);
      const record = structural.get(signature) || { anonymous: false };
      if (identity) {
        if (identities.has(identity) || record.anonymous) return false;
        identities.add(identity);
        record.hasIdentifiedExecution = true;
        structural.set(signature, record);
        return true;
      }
      if (record.anonymous || record.hasIdentifiedExecution) return false;
      record.anonymous = true;
      structural.set(signature, record);
      return true;
    });
  }

  function snapshotBlocks(source = {}) {
    const snapshot = source.snapshot || source.data || {};
    const blocks = snapshotBlockCandidates(source)
      .filter(({ block, explicitCompletionHistory }) => block?.materia && block?.assunto && hasExecutionEvidence(block, explicitCompletionHistory));
    return uniqueExecutionCandidates(blocks)
      .map(({ block }) => ({ ...block, sourceId: source.id || "", sourceName: source.name || snapshot.form?.contestName || "Planejamento anterior" }));
  }

  function inspectSource(source = {}) {
    const candidates = snapshotBlockCandidates(source);
    const count = (collection) => candidates.filter(({ collection: current, block, explicitCompletionHistory }) =>
      current === collection && block?.materia && block?.assunto && hasExecutionEvidence(block, explicitCompletionHistory)
    ).length;
    return {
      totalGeneratedBlocks: candidates.filter(({ collection }) => collection === "generatedBlocks").length,
      executedGeneratedBlocks: count("generatedBlocks"),
      completedHistoryBlocks: count("completedHistory"),
      cycleHistoryBlocks: count("cycleHistory"),
      cycleResultBlocks: count("cycleResults"),
      interventionBlocks: count("interventionHistory"),
      uniqueExecutionBlocks: snapshotBlocks(source).length,
    };
  }

  function sourceDifficulty(source = {}, materia = "") {
    const subjects = source.snapshot?.planningBase?.materias || source.data?.planningBase?.materias || [];
    const match = subjects.find((subject) => normalize(subject.materia) === normalize(materia));
    return Number(match?.dominio) || 0;
  }

  function matchingEntries(target = {}, sources = []) {
    const matches = [];
    sources.forEach((source) => snapshotBlocks(source).forEach((entry) => {
      const candidate = candidateMatch(target, entry);
      if (!candidate.accepted) return;
      const score = clamp(candidate.title.score * .68 + candidate.detailCoverage * .2 + candidate.subject.score * .12);
      matches.push({
        entry,
        source,
        score,
        topic: { ...candidate.title, direction: candidate.direction },
        subject: candidate.subject,
        canonicalTarget: candidate.target,
        canonicalSource: candidate.source,
        detailCoverage: candidate.detailCoverage,
        matchBasis: candidate.matchBasis,
        difficulty: sourceDifficulty(source, entry.materia),
      });
    }));
    return matches.sort((left, right) => right.score - left.score || dateValue(right.entry) - dateValue(left.entry));
  }

  function inspectTarget(target = {}, sources = []) {
    const examined = sources.flatMap((source) => snapshotBlocks(source).map((entry) => ({ source, entry })));
    const rejected = [];
    const accepted = [];
    sources.forEach((source) => snapshotBlockCandidates(source).forEach(({ block, explicitCompletionHistory }) => {
      if (!block?.materia || !block?.assunto || !hasExecutionEvidence(block, explicitCompletionHistory)) {
        if (block?.materia || block?.assunto) rejected.push({ source, entry: block, reason: "no-execution-evidence", subject: { score: 0 }, topic: { score: 0 } });
      }
    }));
    examined.forEach(({ source, entry }) => {
      const match = candidateMatch(target, entry);
      const reason = match.accepted ? "accepted" : match.subject.score < .45 ? "subject-mismatch" : "topic-mismatch";
      const candidate = {
        source,
        entry,
        targetCanonicalTitle: match.target.title,
        sourceCanonicalTitle: match.source.title,
        targetSubject: match.target.subject,
        sourceSubject: match.source.subject,
        titleScore: match.title.score,
        detailCoverage: match.detailCoverage,
        subjectScore: match.subject.score,
        matchBasis: match.matchBasis,
        direction: match.direction,
        subject: match.subject,
        topic: match.title,
        reason,
      };
      if (match.accepted) accepted.push(candidate);
      else rejected.push(candidate);
    });
    const bestRejected = rejected
      .filter((candidate) => candidate.reason !== "no-execution-evidence")
      .sort((left, right) => (right.titleScore + right.detailCoverage + right.subjectScore) - (left.titleScore + left.detailCoverage + left.subjectScore))[0] || null;
    return {
      examinedExecutionBlocks: examined.length,
      subjectMatches: examined.filter(({ entry }) => candidateMatch(target, entry).subject.score >= .45).length,
      topicMatches: examined.filter(({ entry }) => candidateMatch(target, entry).title.score >= .72 || candidateMatch(target, entry).detailCoverage >= .3).length,
      accepted,
      rejected,
      bestRejected,
    };
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
      const current = bySource.get(id) || { ...match, entries: [], matchBases: new Set(), canonicalTitles: new Set() };
      current.entries.push(match.entry);
      current.matchBases.add(match.matchBasis);
      current.canonicalTitles.add(normalize(match.canonicalSource.title));
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
        matchBasis: group.canonicalTitles.size > 1 && ![...group.matchBases].some((basis) => basis === "canonical-title-exact" || basis === "controlled-alias")
          ? "composite-coverage"
          : group.matchBasis,
        detailCoverage: group.detailCoverage,
        matchDirection: group.topic.direction || "partial",
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
    if (best.matchDirection === "equivalent" && best.questions >= 40 && (best.accuracy === null || best.accuracy >= .72) && best.confidence >= .52 && best.matchConfidence !== "low") return "strong";
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

  const api = {
    normalize,
    subjectMatch,
    subjectCompatibility,
    topicMatch,
    canonicalHistoricalTopic,
    canonicalTargetTopic,
    detailCoverage,
    snapshotBlocks,
    matchingEntries,
    inspectSource,
    inspectTarget,
    derive,
  };
  global.HistoryInheritance = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
