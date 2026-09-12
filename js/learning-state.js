"use strict";

(function initLearningState(global) {
  const config = global.StrategicPriorityConfig || (typeof module !== "undefined" && module.exports ? require("./strategic-priority-config.js") : {});

  function clamp(value, minimum = 0, maximum = 1) {
    return Math.max(minimum, Math.min(maximum, Number(value) || 0));
  }

  function hasRecurringErrors(signals = {}) {
    return signals.recurrence === "high" || Number(signals.postInterventionErrors) >= 2;
  }

  function hasRecoveryEvidence(diagnosis = {}, intervention = {}, signals = {}, historyInheritance = {}) {
    const thresholds = config.thresholds || {};
    const inheritedConfidence = clamp(historyInheritance.confidence);
    const inheritedAccuracy = Number.isFinite(historyInheritance.metrics?.accuracy)
      ? Number(historyInheritance.metrics.accuracy)
      : Number.isFinite(historyInheritance.evidence?.accuracy) ? Number(historyInheritance.evidence.accuracy) : null;
    const reliableInheritedReference = historyInheritance.level === "strong"
      && inheritedConfidence >= Number(config.confidence?.recovery || .48)
      && inheritedAccuracy !== null;
    const historicalReferenceAccuracy = reliableInheritedReference ? inheritedAccuracy : Number(diagnosis.overallAccuracy);
    const hadStrongHistory = historicalReferenceAccuracy >= Number(thresholds.recoveryHistoricalAccuracy || .80);
    const recentAccuracy = Number.isFinite(diagnosis.accuracy) ? Number(diagnosis.accuracy) : null;
    const currentSampleIsUsable = Number(diagnosis.questions) >= 10 && diagnosis.needsDiagnostic !== true;
    const declinedEnough = diagnosis.trend?.label === "falling"
      && currentSampleIsUsable
      && recentAccuracy !== null
      && historicalReferenceAccuracy - recentAccuracy >= Number(thresholds.recoveryDrop || .12);
    const reliable = clamp(diagnosis.confidence) >= Number(config.confidence?.recovery || .48);
    const persistent = hasRecurringErrors(signals) || Number(intervention?.ineffectiveInterventions) >= 1 || ["worse", "unchanged"].includes(intervention?.lastResult);
    return hadStrongHistory && declinedEnough && reliable && persistent;
  }

  function derive({ diagnosis = {}, hasContact = false, coverage = 0, intervention = null, errorSignals = null, initialProfile = null, historyInheritance = null } = {}) {
    const signals = errorSignals || diagnosis.errorSignals || {};
    const questions = Math.max(0, Number(diagnosis.questions) || 0);
    const covered = Math.max(clamp(coverage), hasContact ? .5 : 0);
    const mastery = diagnosis.level || "insufficient";
    const recovery = hasRecoveryEvidence(diagnosis, intervention || {}, signals, historyInheritance || {});
    const profileLevel = initialProfile?.level || "unknown";
    const profileIsActive = Boolean(initialProfile?.active);
    const inheritedLevel = historyInheritance?.level || "none";
    const inheritedDiagnostic = !hasContact && !questions && covered < .1 && ["strong", "partial"].includes(inheritedLevel);
    const awaitingDiagnostic = !hasContact && !questions && covered < .1
      && profileIsActive
      && ["intermediate", "advanced"].includes(profileLevel);
    let key = "practice";

    if (inheritedDiagnostic && inheritedLevel === "strong") key = "practice";
    else if (inheritedDiagnostic) key = "consolidating";
    else if (!hasContact && !questions && covered < .1 && inheritedLevel === "contact") key = "building";
    else if (awaitingDiagnostic) key = "practice";
    else if (!hasContact && !questions && covered < .1 && profileIsActive && profileLevel === "basic") key = "building";
    else if (!hasContact && !questions && covered < .1) key = "not-started";
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
      initialProfile: profileLevel,
      historyInheritance: inheritedLevel,
      awaitingDiagnostic: awaitingDiagnostic || inheritedDiagnostic,
      hasRecoveryEvidence: recovery,
      covered,
      reasons: recovery
        ? ["queda confirmada após desempenho anterior forte", "erros ou resposta insuficiente ao reforço"]
        : inheritedDiagnostic
          ? ["há base anterior; confirme o ponto atual com questões diagnósticas"]
        : awaitingDiagnostic
          ? ["a base inicial informada será confirmada com questões diagnósticas"]
        : key === "not-started"
          ? ["ainda não há contato suficiente com este assunto"]
          : [],
    };
  }

  const api = { derive, hasRecoveryEvidence };
  global.LearningState = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
