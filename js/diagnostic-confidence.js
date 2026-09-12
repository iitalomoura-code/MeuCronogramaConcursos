"use strict";

(function initDiagnosticConfidence(global) {
  const DAY = 24 * 60 * 60 * 1000;
  const text = (value = "") => String(value ?? "").trim();
  const clamp = (value, minimum = 0, maximum = 1) => Math.max(minimum, Math.min(maximum, Number(value) || 0));

  function dateValue(value) {
    const raw = text(value);
    if (!raw) return 0;
    const brazilian = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    const date = brazilian
      ? new Date(Number(brazilian[3]), Number(brazilian[2]) - 1, Number(brazilian[1]))
      : new Date(raw);
    return Number.isFinite(date.getTime()) ? date.getTime() : 0;
  }

  function factualSession(entry = {}) {
    const questions = Math.max(0, Number(entry.questions ?? entry.questoes) || 0);
    const studiedMinutes = Math.max(0, Number(entry.studiedMinutes ?? entry.tempoEstudadoMinutes ?? entry.tempoEstudadoMinutos) || 0);
    return {
      questions,
      correctAnswers: Math.min(questions, Math.max(0, Number(entry.correctAnswers ?? entry.acertos) || 0)),
      studiedMinutes,
      date: dateValue(entry.completedAt || entry.observedAt || entry.registradaEm || entry.atualizadoEm || entry.createdAt),
    };
  }

  function normalizeEvidence(evidence = {}, diagnosis = {}) {
    const entries = Array.isArray(evidence.entries)
      ? evidence.entries.map(factualSession)
      : Array.isArray(evidence.sessions)
        ? evidence.sessions.map(factualSession)
        : [];
    const questions = Math.max(0, Number(evidence.questions ?? diagnosis.questions) || entries.reduce((sum, item) => sum + item.questions, 0));
    const sessions = Math.max(0, Number(evidence.sessions ?? evidence.sessionsCount ?? evidence.sessionCount ?? diagnosis.sessionCount) || entries.filter((item) => item.questions > 0 || item.studiedMinutes > 0).length);
    const studiedMinutes = Math.max(0, Number(evidence.studiedMinutes ?? diagnosis.studiedMinutes) || entries.reduce((sum, item) => sum + item.studiedMinutes, 0));
    const dates = entries.map((item) => item.date).filter(Boolean);
    const lastContact = Math.max(0, Number(evidence.lastContact) || Math.max(...dates, 0));
    return { entries, questions, sessions, studiedMinutes, lastContact };
  }

  function stageFor({ questions = 0, sessions = 0 } = {}) {
    if (!questions && !sessions) return "unknown";
    if (questions < 10 || sessions < 2) return "early";
    if (questions >= 50 && sessions >= 4) return "confirmed";
    return "developing";
  }

  function levelFor(value) {
    return value >= .68 ? "high" : value >= .35 ? "medium" : "low";
  }

  function consistencyFor(entries = []) {
    const accuracies = entries.filter((item) => item.questions > 0).map((item) => item.correctAnswers / item.questions);
    if (accuracies.length < 2) return accuracies.length ? .35 : 0;
    const range = Math.max(...accuracies) - Math.min(...accuracies);
    return clamp(1 - range * 1.5);
  }

  function calculate({ diagnosis = {}, evidence = {}, now = null } = {}) {
    const normalized = normalizeEvidence(evidence, diagnosis);
    const stage = stageFor(normalized);
    if (stage === "unknown") {
      return {
        value: 0,
        level: "low",
        label: "Baixa confiança",
        evidenceStage: stage,
        reasons: ["nenhuma evidência factual registrada"],
        limitations: ["ainda não há dados suficientes para confirmar o diagnóstico"],
        questions: 0,
        sessions: 0,
        recent: false,
      };
    }
    const datedEntries = normalized.entries.filter((item) => item.date);
    const distinctDays = new Set(datedEntries.map((item) => Math.floor(item.date / DAY))).size;
    const oldest = datedEntries.length ? Math.min(...datedEntries.map((item) => item.date)) : 0;
    const spanDays = oldest && normalized.lastContact ? Math.max(0, (normalized.lastContact - oldest) / DAY) : 0;
    const referenceTime = now instanceof Date ? now.getTime() : Number(now) || dateValue(now);
    const recent = normalized.lastContact > 0 && referenceTime - normalized.lastContact <= 45 * DAY;
    const volume = clamp(normalized.questions / 60);
    const sessionDiversity = clamp(normalized.sessions / 5);
    const temporalDistribution = datedEntries.length
      ? clamp((distinctDays / 3) * .65 + (spanDays >= 7 ? .35 : spanDays / 7 * .35))
      : normalized.sessions >= 2 ? .25 : 0;
    const recency = normalized.lastContact ? (recent ? 1 : .45) : 0;
    const factualDensity = normalized.entries.length ? clamp(normalized.entries.length / 5) : clamp(normalized.sessions / 5) * .75;
    const consistency = normalized.entries.length ? consistencyFor(normalized.entries) : normalized.sessions >= 2 ? .55 : .35;
    const value = clamp(
      volume * .34
      + sessionDiversity * .24
      + temporalDistribution * .12
      + recency * .10
      + consistency * .10
      + factualDensity * .10,
    );
    const level = levelFor(value);
    const reasons = [];
    if (normalized.questions) reasons.push(`${normalized.questions} questões registradas`);
    if (normalized.sessions) reasons.push(`${normalized.sessions} sessão${normalized.sessions === 1 ? "" : "ões"} independente${normalized.sessions === 1 ? "" : "s"}`);
    if (recent) reasons.push("há evidência recente");
    else if (normalized.lastContact) reasons.push("a evidência mais recente está distante");
    const limitations = [];
    if (normalized.sessions < 3) limitations.push("pouca diversidade de sessões");
    if (normalized.questions < 20) limitations.push("volume factual ainda limitado");
    if (datedEntries.length < 2) limitations.push("distribuição temporal ainda insuficiente");
    return {
      value: Number(value.toFixed(3)),
      level,
      label: `${level === "high" ? "Alta" : level === "medium" ? "Média" : "Baixa"} confiança`,
      evidenceStage: stage,
      reasons: reasons.slice(0, 4),
      limitations: limitations.slice(0, 3),
      questions: normalized.questions,
      sessions: normalized.sessions,
      recent,
    };
  }

  const api = { calculate, normalizeEvidence, stageFor, levelFor };
  global.DiagnosticConfidence = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
