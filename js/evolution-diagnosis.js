"use strict";

(function initEvolutionDiagnosisEngine(global) {
  const LEVEL_WEIGHT = { strong: 0, adequate: 0, insufficient: 1, attention: 2, deficiency: 3, critical: 4 };

  function clamp(value, minimum = 0, maximum = 1) {
    return Math.max(minimum, Math.min(maximum, Number(value) || 0));
  }

  function labelFor(level) {
    return {
      strong: "Domínio forte",
      adequate: "Sob controle",
      attention: "Atenção",
      deficiency: "Deficiência",
      critical: "Crítico",
      insufficient: "Mais dados necessários",
    }[level] || "Em acompanhamento";
  }

  function confidenceLabel(value) {
    const confidence = clamp(value);
    if (confidence >= .65) return "Alta";
    if (confidence >= .35) return "Média";
    return "Baixa";
  }

  function trendLabel(diagnosis = {}) {
    return { improving: "↑", falling: "↓", stable: "→", insufficient: "·" }[diagnosis.trend?.label] || "·";
  }

  function usableTopicDiagnosis(item = {}) {
    const diagnosis = item.diagnosis || {};
    return diagnosis.level && diagnosis.level !== "insufficient" && diagnosis.basis !== "subject" && Number(diagnosis.confidence) >= .35;
  }

  function weakestDiagnosis(subject = {}) {
    const candidates = (subject.topicDiagnoses || []).filter(usableTopicDiagnosis);
    const topic = candidates.sort((left, right) => {
      const level = (LEVEL_WEIGHT[right.diagnosis.level] || 0) - (LEVEL_WEIGHT[left.diagnosis.level] || 0);
      if (level) return level;
      const falling = Number(right.diagnosis.trend?.label === "falling") - Number(left.diagnosis.trend?.label === "falling");
      if (falling) return falling;
      return (Number(right.diagnosis.confidence) || 0) - (Number(left.diagnosis.confidence) || 0);
    })[0];
    return topic ? { ...topic.diagnosis, assunto: topic.assunto, source: "topic" } : { ...(subject.diagnosis || {}), source: "subject" };
  }

  function subjectRisk(subject = {}, context = {}) {
    const diagnosis = weakestDiagnosis(subject);
    const reasons = [];
    let score = 0;
    const level = diagnosis.level || "adequate";
    const coverage = clamp(subject.coverage);
    const priority = clamp(subject.priority);
    const incidence = clamp(subject.incidence);
    const relevance = Math.max(priority, incidence);
    const remainingHours = Math.max(0, Number(subject.remainingHours) || 0);
    const urgent = Number(context.weeksToExam) <= 8;

    if (level === "critical") {
      score += 4;
      reasons.push(diagnosis.assunto ? `${diagnosis.assunto}: diagnóstico crítico` : "diagnóstico crítico");
    } else if (level === "deficiency") {
      score += 3;
      reasons.push(diagnosis.assunto ? `${diagnosis.assunto}: deficiência identificada` : "deficiência identificada");
    } else if (level === "attention") {
      score += 1;
      reasons.push(diagnosis.assunto ? `${diagnosis.assunto}: precisa de atenção` : "desempenho pede atenção");
    } else if (level === "insufficient" && relevance >= .65) {
      score += 1;
      reasons.push(diagnosis.assunto ? `${diagnosis.assunto}: mais dados necessários` : "mais dados necessários");
    }
    if (diagnosis.trend?.label === "falling" && level !== "critical") {
      score += 1;
      reasons.push("queda nas sessões recentes");
    }
    if (coverage < .5) {
      score += 2;
      reasons.push(`${Math.round((1 - coverage) * 100)}% do conteúdo ainda sem contato`);
    } else if (coverage < .75) {
      score += 1;
      reasons.push("cobertura ainda parcial");
    }
    if (urgent && remainingHours > 0 && coverage < .9) {
      score += 1;
      reasons.push("pouco tempo até a prova");
    }
    if (relevance >= .75 && coverage < .75) score += 1;
    if (Number(subject.openReviews) >= 2) {
      score += 1;
      reasons.push(`${subject.openReviews} revisões pendentes`);
    }
    if (priority >= .6 && Number(subject.daysWithoutContact) >= 14 && coverage < .9) {
      score += 1;
      reasons.push(`${subject.daysWithoutContact} dias sem contato`);
    }

    const levelLabel = score >= 5 ? "Prioridade" : score >= 2 ? "Atenção" : "Sob controle";
    return {
      level: levelLabel,
      score,
      reasons: reasons.slice(0, 3),
      diagnosis,
      action: diagnosis.action || null,
    };
  }

  function deficiencyTopics(subjects = []) {
    const rows = [];
    subjects.forEach((subject) => {
      const rendered = new Set();
      (subject.topicDiagnoses || []).forEach((item) => {
        const diagnosis = item.diagnosis || {};
        const confidence = Number(diagnosis.confidence) || 0;
        const relevant = Number(item.relevance ?? subject.relevance) || 0;
        if (diagnosis.basis === "subject") return;
        const shouldShow = ["critical", "deficiency", "attention"].includes(diagnosis.level)
          || (diagnosis.level === "insufficient" && relevant >= .65);
        if (!shouldShow) return;
        const key = String(diagnosis.macro || item.assunto || "").toLowerCase();
        if (rendered.has(key)) return;
        rendered.add(key);
        rows.push({ materia: subject.name || subject.materia || "", assunto: item.assunto || "", diagnosis, relevance: relevant });
      });
      const diagnosis = subject.diagnosis || {};
      const relevance = Number(subject.relevance) || 0;
      const needsSubjectRow = !rendered.size && (["critical", "deficiency", "attention"].includes(diagnosis.level)
        || (diagnosis.level === "insufficient" && relevance >= .65));
      if (needsSubjectRow) rows.push({ materia: subject.name || subject.materia || "", assunto: "Visão geral da matéria", diagnosis, relevance });
    });
    return rows.sort((left, right) => {
      const level = (LEVEL_WEIGHT[right.diagnosis.level] || 0) - (LEVEL_WEIGHT[left.diagnosis.level] || 0);
      if (level) return level;
      const relevance = right.relevance - left.relevance;
      if (relevance) return relevance;
      const falling = Number(right.diagnosis.trend?.label === "falling") - Number(left.diagnosis.trend?.label === "falling");
      if (falling) return falling;
      return (Number(right.diagnosis.confidence) || 0) - (Number(left.diagnosis.confidence) || 0);
    });
  }

  const api = { subjectRisk, weakestDiagnosis, deficiencyTopics, labelFor, confidenceLabel, trendLabel, LEVEL_WEIGHT };
  global.EvolutionDiagnosisEngine = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
