"use strict";

(function initAICoachCheckpoint(global) {
  const text = (value = "") => String(value ?? "").trim();
  const numberOrNull = (value) => {
    if (value === null || value === undefined || value === "" || (typeof value === "string" && !value.trim())) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };
  const topicKey = (topic = {}) => [topic.subject || topic.materia, topic.subarea, topic.topic || topic.assunto].map(text).join("|").toLocaleLowerCase();
  const iso = (value) => {
    const date = new Date(value || "");
    return Number.isFinite(date.getTime()) ? date.toISOString() : null;
  };
  const accuracy = (questions, correct) => questions ? Number((correct / questions).toFixed(4)) : null;
  const sumKnown = (values = []) => {
    let known = false;
    let total = 0;
    values.forEach((value) => {
      const parsed = numberOrNull(value);
      if (parsed === null) return;
      known = true;
      total += parsed;
    });
    return known ? total : null;
  };

  function evidenceFor(topic = {}) {
    const evidence = topic.currentEvidence || topic.current || {};
    const questions = numberOrNull(evidence.questions);
    const correct = numberOrNull(evidence.correctAnswers ?? evidence.correct);
    return {
      questions,
      correctAnswers: correct,
      accuracy: numberOrNull(evidence.accuracy) ?? (questions !== null && correct !== null ? accuracy(questions, correct) : null),
      sessions: numberOrNull(evidence.sessions ?? evidence.sessionCount),
      studiedMinutes: numberOrNull(evidence.studiedMinutes),
      lastContact: iso(evidence.lastContact),
    };
  }

  function fromSnapshot(snapshot = {}, { generatedAt = snapshot.generatedAt } = {}) {
    const topics = (Array.isArray(snapshot.topics) ? snapshot.topics : []).map((topic) => {
      const evidence = evidenceFor(topic);
      const readiness = topic.readiness || {};
      const diagnosis = topic.diagnosis || {};
      const strategic = topic.strategic || {};
      return {
        subject: text(topic.subject || topic.materia),
        topic: text(topic.topic || topic.assunto),
        readinessState: text(readiness.state || topic.readinessState) || null,
        confidence: numberOrNull(topic.confidence?.value ?? topic.diagnosticConfidence ?? diagnosis.confidence),
        learningState: text(strategic.learningState?.key || diagnosis.learningState?.key || topic.learningState?.key || topic.learningState) || null,
        strategicRank: numberOrNull(strategic.rank),
        strategicScore: numberOrNull(strategic.score),
        questions: evidence.questions,
        correctAnswers: evidence.correctAnswers,
        accuracy: evidence.accuracy,
        sessions: evidence.sessions,
        studyMinutes: evidence.studiedMinutes,
        maintenanceDue: Boolean(topic.maintenanceDue),
      };
    }).filter((topic) => topic.subject && topic.topic);

    const grouped = new Map();
    topics.forEach((topic) => {
      const entry = grouped.get(topic.subject) || { subject: topic.subject, topics: [] };
      entry.topics.push(topic);
      grouped.set(topic.subject, entry);
    });
    const subjects = [...grouped.values()].map((group) => {
      const source = (snapshot.subjects || []).find((subject) => text(subject.name || subject.subject) === group.subject) || {};
      const readiness = source.readiness || {};
      const confidence = numberOrNull(source.diagnosticConfidence ?? source.confidence?.value);
      const questions = sumKnown(group.topics.map((topic) => topic.questions));
      const correct = sumKnown(group.topics.map((topic) => topic.correctAnswers !== null
        ? topic.correctAnswers
        : topic.questions !== null && topic.accuracy !== null
          ? topic.questions * topic.accuracy
          : null));
      return {
        subject: group.subject,
        readinessState: text(readiness.state || source.readinessState) || null,
        confidence,
        strategicSummary: text(source.readiness?.summary || source.summary) || null,
        questions,
        correct,
        sessions: sumKnown(group.topics.map((topic) => topic.sessions)),
        accuracy: correct === null || questions === null || !questions ? null : Number((correct / questions).toFixed(4)),
        studyMinutes: sumKnown(group.topics.map((topic) => topic.studyMinutes)),
      };
    });
    const totalQuestions = sumKnown(topics.map((topic) => topic.questions));
    const totalCorrect = sumKnown(topics.map((topic) => topic.correctAnswers !== null
      ? topic.correctAnswers
      : topic.questions !== null && topic.accuracy !== null
        ? topic.questions * topic.accuracy
        : null));
    const totalSessions = sumKnown(topics.map((topic) => topic.sessions));
    return {
      generatedAt: iso(generatedAt),
      snapshotSignature: text(snapshot.signature?.value || snapshot.signature) || null,
      weeklyCycle: {
        cycleId: text(snapshot.weeklyCycle?.cycleId || snapshot.weeklyCycle?.id) || null,
        startedAt: iso(snapshot.weeklyCycle?.startedAt),
        endsAt: iso(snapshot.weeklyCycle?.endsAt),
        closedAt: iso(snapshot.weeklyCycle?.closedAt || snapshot.weeklyCycle?.finalizedAt),
        status: text(snapshot.weeklyCycle?.status) || "active",
        plannedMinutes: numberOrNull(snapshot.weeklyCycle?.plannedMinutes),
        executedMinutes: numberOrNull(snapshot.weeklyCycle?.executedMinutes ?? snapshot.weeklyCycle?.completedMinutes),
        reserveMinutes: numberOrNull(snapshot.weeklyCycle?.reserveMinutes),
        questions: numberOrNull(snapshot.weeklyCycle?.questions),
        accuracy: numberOrNull(snapshot.weeklyCycle?.accuracy),
      },
      totals: {
        studyMinutes: sumKnown(topics.map((topic) => topic.studyMinutes)),
        sessions: totalSessions,
        questions: totalQuestions,
        correct: totalCorrect === null ? null : Number(totalCorrect.toFixed(4)),
      },
      subjects,
      topics: topics.sort((a, b) => topicKey(a).localeCompare(topicKey(b))),
    };
  }

  const api = { fromSnapshot, topicKey, numberOrNull };
  global.AICoachCheckpoint = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
