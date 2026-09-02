"use strict";

(function initLearningIntervention(global) {
  const LEVEL_RANK = { insufficient: 0, critical: 1, deficiency: 2, attention: 3, adequate: 4, strong: 5 };
  const INTENSITY_RANK = { curta: 1, prioritaria: 2, reforcada: 3 };
  const DAY = 24 * 60 * 60 * 1000;

  function clamp(value, minimum = 0, maximum = 1) {
    return Math.max(minimum, Math.min(maximum, Number(value) || 0));
  }

  function snapshot(diagnosis = {}) {
    return {
      level: diagnosis.level || "insufficient",
      confidence: clamp(diagnosis.confidence),
      accuracy: Number.isFinite(diagnosis.accuracy) ? Number(diagnosis.accuracy) : null,
      questions: Math.max(0, Number(diagnosis.questions) || 0),
      trend: diagnosis.trend?.label || "insufficient",
      action: diagnosis.action?.kind || "",
      intensity: diagnosis.action?.label || "",
      recordedAt: new Date().toISOString(),
    };
  }

  function sameEvidence(before = {}, after = {}) {
    return before.level === after.level && before.questions === after.questions && before.accuracy === after.accuracy && before.trend === after.trend;
  }

  function compare(before = {}, after = {}) {
    const questionsAdded = Math.max(0, Number(after.questions) - Number(before.questions));
    const accuracyDelta = before.accuracy === null || after.accuracy === null ? null : after.accuracy - before.accuracy;
    const levelDelta = (LEVEL_RANK[after.level] ?? 0) - (LEVEL_RANK[before.level] ?? 0);
    const enoughNewEvidence = questionsAdded >= 10 && after.confidence >= .35;
    const strongEvidence = questionsAdded >= 15 && after.confidence >= .45;
    let status = "unchanged";
    let message = "O desempenho permaneceu semelhante; mantenha o reforço direcionado.";

    if (["adequate", "strong"].includes(after.level) && strongEvidence) {
      status = "resolved";
      message = "O tema recuperou um nível adequado com evidência suficiente.";
    } else if ((levelDelta >= 1 && enoughNewEvidence) || (accuracyDelta !== null && accuracyDelta >= .08 && enoughNewEvidence)) {
      status = "improved";
      message = strongEvidence ? "O desempenho melhorou após o reforço." : "Há sinais de melhora, mas ainda precisamos de mais questões para confirmar.";
    } else if ((levelDelta <= -1 && enoughNewEvidence) || (accuracyDelta !== null && accuracyDelta <= -.06 && enoughNewEvidence) || after.trend === "falling" && before.trend !== "falling" && enoughNewEvidence) {
      status = "worse";
      message = "O desempenho caiu após o último contato; a abordagem precisa ser reforçada.";
    } else if (accuracyDelta !== null && accuracyDelta >= .08 && questionsAdded > 0) {
      status = "improving-signal";
      message = "Há sinais de melhora, mas ainda precisamos de mais questões para confirmar.";
    }
    return { status, message, questionsAdded, accuracyDelta, levelDelta, enoughNewEvidence, strongEvidence };
  }

  function baseIntensity(diagnosis = {}) {
    if (diagnosis.level === "critical") return "reforcada";
    if (diagnosis.level === "deficiency") return "prioritaria";
    return "curta";
  }

  function nextIntensity(base, ineffectiveCount) {
    const rank = Math.min(3, Math.max(INTENSITY_RANK[base] || 1, 1 + Math.min(2, ineffectiveCount)));
    return Object.keys(INTENSITY_RANK).find((key) => INTENSITY_RANK[key] === rank) || "reforcada";
  }

  function recommendationFor({ diagnosis = {}, intensity = "curta", ineffectiveCount = 0, outcome = null } = {}) {
    if (outcome?.status === "resolved") return { intensity: "", questions: 0, mode: "maintenance", text: "Seu desempenho melhorou após o reforço. Mantenha contato normal pelo ciclo." };
    if (ineffectiveCount >= 3) return {
      intensity: "reforcada",
      questions: Math.max(15, Number(diagnosis.action?.questions) || 0),
      mode: "recovery-sequence",
      text: "Este tema continua abaixo do esperado após vários reforços. Retome a teoria ou o resumo, faça questões e reavalie depois.",
      cooldownDays: 7,
    };
    if (ineffectiveCount >= 2) return {
      intensity: "reforcada",
      questions: Math.max(15, Number(diagnosis.action?.questions) || 0),
      mode: "deep-recovery",
      text: "O reforço anterior não foi suficiente. Retome a teoria ou o resumo antes de uma nova bateria de questões.",
    };
    if (ineffectiveCount >= 1) return {
      intensity: nextIntensity(intensity, ineffectiveCount),
      questions: Math.max(15, Number(diagnosis.action?.questions) || 0),
      mode: "targeted-reinforcement",
      text: "O reforço anterior não foi suficiente. Faça uma revisão de 25 min e 15 questões direcionadas.",
    };
    return {
      intensity,
      questions: Math.max(1, Number(diagnosis.action?.questions) || (intensity === "reforcada" ? 15 : intensity === "prioritaria" ? 15 : 10)),
      mode: diagnosis.action?.kind || "light-reinforcement",
      text: diagnosis.action?.text || "Faça questões direcionadas e revise os erros antes do próximo contato.",
    };
  }

  function update(existing = null, { materia = "", assunto = "", diagnosis = {}, source = "desempenho", now = new Date() } = {}) {
    const current = snapshot(diagnosis);
    const previous = existing?.intervencao || null;
    if (!previous?.lastDiagnosis) {
      const recommendation = recommendationFor({ diagnosis, intensity: baseIntensity(diagnosis) });
      return {
        state: {
          version: 1,
          materia,
          assunto,
          origin: source,
          createdAt: new Date(now).toISOString(),
          initialDiagnosis: current,
          lastDiagnosis: current,
          interventions: 1,
          ineffectiveInterventions: 0,
          lastResult: "pending",
          history: [],
          recommendation,
        },
        outcome: null,
        recommendation,
      };
    }
    const before = previous.lastDiagnosis;
    if (sameEvidence(before, current)) return { state: previous, outcome: null, recommendation: previous.recommendation || recommendationFor({ diagnosis, intensity: existing?.intensidade || baseIntensity(diagnosis) }) };

    const outcome = compare(before, current);
    const ineffective = outcome.status === "worse" || outcome.status === "unchanged"
      ? Math.min(3, (Number(previous.ineffectiveInterventions) || 0) + 1)
      : outcome.status === "resolved" ? 0 : Math.max(0, (Number(previous.ineffectiveInterventions) || 0) - 1);
    const recommendation = recommendationFor({
      diagnosis,
      intensity: nextIntensity(existing?.intensidade || baseIntensity(diagnosis), ineffective),
      ineffectiveCount: ineffective,
      outcome,
    });
    const history = [...(previous.history || []), {
      before,
      after: current,
      status: outcome.status,
      message: outcome.message,
      questionsAdded: outcome.questionsAdded,
      accuracyDelta: outcome.accuracyDelta,
      recordedAt: new Date(now).toISOString(),
    }].slice(-8);
    return {
      state: {
        ...previous,
        lastDiagnosis: current,
        interventions: (Number(previous.interventions) || 1) + 1,
        ineffectiveInterventions: ineffective,
        lastResult: outcome.status,
        lastResultMessage: outcome.message,
        history,
        recommendation,
        updatedAt: new Date(now).toISOString(),
        cooldownUntil: recommendation.cooldownDays ? new Date(new Date(now).getTime() + recommendation.cooldownDays * DAY).toISOString() : "",
      },
      outcome,
      recommendation,
    };
  }

  function insights(records = []) {
    return records
      .map((record) => ({ record, intervention: record?.intervencao }))
      .filter(({ intervention }) => intervention?.lastResult && intervention.lastResult !== "pending")
      .sort((a, b) => String(b.intervention.updatedAt || "").localeCompare(String(a.intervention.updatedAt || "")))
      .slice(0, 3)
      .map(({ record, intervention }) => ({
        materia: record.materia,
        assunto: record.assunto,
        result: intervention.lastResult,
        detail: intervention.lastResultMessage || "A intervenção foi reavaliada.",
      }));
  }

  const api = { snapshot, compare, update, insights, LEVEL_RANK };
  global.LearningIntervention = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
