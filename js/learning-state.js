"use strict";

(function initLearningState(global) {
  const config = global.StrategicPriorityConfig || (typeof module !== "undefined" && module.exports ? require("./strategic-priority-config.js") : {});

  function clamp(value, minimum = 0, maximum = 1) {
    return Math.max(minimum, Math.min(maximum, Number(value) || 0));
  }

  function hasRecurringErrors(signals = {}) {
    return signals.recurrence === "high" || Number(signals.postInterventionErrors) >= 2;
  }

  function hasRecoveryEvidence(diagnosis = {}, intervention = {}, signals = {}) {
    const thresholds = config.thresholds || {};
    const hadStrongHistory = Number(diagnosis.overallAccuracy) >= Number(thresholds.recoveryHistoricalAccuracy || .80);
    const recentAccuracy = Number.isFinite(diagnosis.accuracy) ? Number(diagnosis.accuracy) : null;
    const declinedEnough = diagnosis.trend?.label === "falling"
      && recentAccuracy !== null
      && Number(diagnosis.overallAccuracy) - recentAccuracy >= Number(thresholds.recoveryDrop || .12);
    const reliable = clamp(diagnosis.confidence) >= Number(config.confidence?.recovery || .48);
    const persistent = hasRecurringErrors(signals) || Number(intervention?.ineffectiveInterventions) >= 1 || ["worse", "unchanged"].includes(intervention?.lastResult);
    return hadStrongHistory && declinedEnough && reliable && persistent;
  }

  function derive({ diagnosis = {}, hasContact = false, coverage = 0, intervention = null, errorSignals = null } = {}) {
    const signals = errorSignals || diagnosis.errorSignals || {};
    const questions = Math.max(0, Number(diagnosis.questions) || 0);
    const covered = Math.max(clamp(coverage), hasContact ? .5 : 0);
    const mastery = diagnosis.level || "insufficient";
    const recovery = hasRecoveryEvidence(diagnosis, intervention || {}, signals);
    let key = "practice";

    if (!hasContact && !questions && covered < .1) key = "not-started";
    else if (recovery) key = "recovery";
    else if (mastery === "insufficient" || mastery === "critical") key = "building";
    else if (["deficiency", "attention"].includes(mastery)) key = "consolidating";
    else if (mastery === "strong" && clamp(diagnosis.confidence) >= Number(config.confidence?.maintenance || .55) && diagnosis.trend?.label !== "falling") key = "maintenance";

    const labels = {
      "not-started": "Não iniciado",
      building: "Construção",
      consolidating: "Consolidação",
      practice: "Questões",
      maintenance: "Manutenção",
      recovery: "Recuperação",
    };
    return {
      key,
      label: labels[key],
      mastery,
      hasRecoveryEvidence: recovery,
      covered,
      reasons: recovery
        ? ["queda confirmada após desempenho anterior forte", "erros ou resposta insuficiente ao reforço"]
        : key === "not-started"
          ? ["ainda não há contato suficiente com este assunto"]
          : [],
    };
  }

  const api = { derive, hasRecoveryEvidence };
  global.LearningState = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
