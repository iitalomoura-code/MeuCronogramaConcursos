"use strict";

(function initStudyAlertsEngine(global) {
  const DAY_MS = 24 * 60 * 60 * 1000;

  function normalized(value) {
    return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  }

  function severityFor(score) {
    return score >= 5 ? "priority" : "attention";
  }

  function fingerprint(candidate) {
    return [candidate.type, normalized(candidate.subjectName), [...candidate.reasonCodes].sort().join(",")].join("::");
  }

  function createSubjectCandidate(subject, exam = {}) {
    const reasons = [];
    let score = 0;
    const priority = Number(subject.priority) || 0;
    const coverage = Number(subject.coverage);
    const performance = Number(subject.performance);
    const questions = Number(subject.questions) || 0;
    const daysWithoutContact = Number(subject.daysWithoutContact);
    const reviews = Number(subject.openReviews) || 0;
    const reprograms = Number(subject.reprograms) || 0;
    const diagnosis = subject.diagnosis || {};
    const hasDiagnosis = Boolean(diagnosis.level);
    const isImportant = priority >= 60;

    if (["critical", "deficiency"].includes(diagnosis.level)) {
      reasons.push("MASTERY_DEFICIENCY");
      score += diagnosis.level === "critical" ? 5 : 3;
    } else if (diagnosis.level === "attention" && Number(diagnosis.confidence) >= .35) {
      reasons.push("MASTERY_ATTENTION");
      score += 2;
    } else if (!hasDiagnosis && questions >= 10 && performance < .60) {
      reasons.push("LOW_PERFORMANCE");
      score += 3;
    }
    if (diagnosis.trend?.label === "falling" || (!hasDiagnosis && questions >= 30 && subject.performanceTrend === "Queda")) { reasons.push("PERFORMANCE_DROP"); score += 2; }
    if (Number.isFinite(daysWithoutContact) && daysWithoutContact >= (isImportant ? 10 : 14)) { reasons.push("LONG_TIME_NO_CONTACT"); score += isImportant ? 2 : 1; }
    if (reviews >= 2) { reasons.push("REVISION_BACKLOG"); score += 2; }
    if (!hasDiagnosis && reprograms >= 2) { reasons.push("REINFORCEMENT_REQUIRED"); score += 1; }
    if (isImportant && coverage === 0 && Number(exam.weeksToExam) <= 8) { reasons.push("CONTENT_NOT_STARTED"); score += 2; }
    if (isImportant && coverage < .50 && exam.coverageRisk) { reasons.push("COVERAGE_RISK"); score += 1; }
    if (!reasons.length) return null;

    const dominant = reasons.includes("MASTERY_DEFICIENCY") || reasons.includes("MASTERY_ATTENTION") || reasons.includes("LOW_PERFORMANCE") || reasons.includes("PERFORMANCE_DROP") || reasons.includes("COVERAGE_RISK");
    return {
      type: dominant ? "SUBJECT_ATTENTION" : reasons[0],
      subjectName: subject.name,
      severity: severityFor(score),
      score,
      reasonCodes: reasons,
      metrics: { coverage, performance, questions, daysWithoutContact, reviews, reprograms, priority, diagnosisLevel: diagnosis.level || "", diagnosisConfidence: Number(diagnosis.confidence) || 0, diagnosisTrend: diagnosis.trend?.label || "", diagnosisReasons: diagnosis.reasons || [], diagnosisAction: diagnosis.action?.kind || "" },
    };
  }

  function buildCandidates(input = {}) {
    const candidates = [];
    const exam = input.exam || {};
    (input.subjects || []).forEach((subject) => {
      const candidate = createSubjectCandidate(subject, exam);
      if (candidate) candidates.push(candidate);
    });
    const priorityReviews = Number(input.priorityReviews) || 0;
    if (priorityReviews >= 3) {
      candidates.push({
        type: "REVISION_BACKLOG",
        subjectName: "",
        severity: priorityReviews >= 5 ? "priority" : "attention",
        score: priorityReviews >= 5 ? 6 : 4,
        reasonCodes: ["REVISION_BACKLOG"],
        metrics: { reviews: priorityReviews },
      });
    }
    if (exam.confident && exam.coverageRisk) {
      candidates.push({
        type: "COVERAGE_RISK",
        subjectName: "",
        severity: "priority",
        score: 6,
        reasonCodes: ["COVERAGE_RISK"],
        metrics: { weeksToExam: exam.weeksToExam, projectedCoverage: exam.projectedCoverage },
      });
    }
    const concentration = input.concentration || {};
    if (Number(concentration.sessions) >= 6 && Number(concentration.share) >= .65 && concentration.subjectName) {
      candidates.push({
        type: "STUDY_CONCENTRATION",
        subjectName: concentration.subjectName,
        severity: "attention",
        score: 3,
        reasonCodes: ["STUDY_CONCENTRATION"],
        metrics: { share: concentration.share, sessions: concentration.sessions },
      });
    }
    return candidates.sort((a, b) => b.score - a.score || a.subjectName.localeCompare(b.subjectName));
  }

  function merge(candidates = [], existing = [], now = new Date()) {
    const iso = now.toISOString();
    const previous = new Map((existing || []).map((alert) => [`${alert.type}::${normalized(alert.subjectName)}`, alert]));
    const activeKeys = new Set();
    const merged = candidates.map((candidate) => {
      const key = `${candidate.type}::${normalized(candidate.subjectName)}`;
      activeKeys.add(key);
      const old = previous.get(key);
      const nextFingerprint = fingerprint(candidate);
      const unchanged = old?.fingerprint === nextFingerprint;
      return {
        id: old?.id || `alert-${key || candidate.type}`,
        type: candidate.type,
        subjectName: candidate.subjectName || "",
        severity: candidate.severity,
        score: candidate.score,
        reasonCodes: candidate.reasonCodes,
        metrics: candidate.metrics,
        fingerprint: nextFingerprint,
        createdAt: old?.createdAt || iso,
        updatedAt: iso,
        viewedAt: old?.viewedAt || "",
        dismissedAt: unchanged ? (old?.dismissedAt || "") : "",
        resolvedAt: "",
      };
    });
    (existing || []).forEach((old) => {
      const key = `${old.type}::${normalized(old.subjectName)}`;
      if (!activeKeys.has(key) && !old.resolvedAt) merged.push({ ...old, updatedAt: iso, resolvedAt: iso });
    });
    return merged;
  }

  function build(input = {}) {
    return merge(buildCandidates(input), input.existing || [], input.now || new Date());
  }

  global.StudyAlertsEngine = { build, buildCandidates, merge, DAY_MS };
  if (typeof module !== "undefined" && module.exports) module.exports = global.StudyAlertsEngine;
})(typeof window !== "undefined" ? window : globalThis);
