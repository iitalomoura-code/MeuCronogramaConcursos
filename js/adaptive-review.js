(function (global) {
  "use strict";

  const DAY = 24 * 60 * 60 * 1000;
  const INTENSITIES = {
    curta: { rank: 1, days: 3, questions: 6, impact: 0.045, label: "Curta", suggestion: "Revise as questões erradas, releia o resumo e resolva algumas questões novas." },
    prioritaria: { rank: 2, days: 2, questions: 8, impact: 0.09, label: "Prioritária", suggestion: "Revise pontos frágeis, consulte as anotações e pratique novas questões selecionadas." },
    reforcada: { rank: 3, days: 0, questions: 10, impact: 0.14, label: "Reforçada", suggestion: "Retome os erros, consulte o caderno de resumos e faça uma rodada curta de questões direcionadas." },
  };

  function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
  }

  function formatDate(date) {
    return new Date(date).toLocaleDateString("pt-BR");
  }

  function startOfDay(value) {
    const date = new Date(value);
    date.setHours(0, 0, 0, 0);
    return date;
  }

  // Fallback for plans that predate MasteryDiagnosis or fail to provide it.
  // Normal application flow must use classificationFromDiagnosis below.
  function classification(percentual, totalQuestoes) {
    const total = Math.max(0, Number(totalQuestoes) || 0);
    const percent = clamp(Number(percentual) || 0, 0, 1);
    if (total < 10) return { automatic: false, percent, total, reason: "Amostra insuficiente para criar uma revisão automaticamente." };
    if (percent > 0.8) return { automatic: false, percent, total, reason: "Desempenho acima de 80%; não é necessária uma revisão extraordinária." };
    if (percent >= 0.61) return { automatic: true, percent, total, intensity: "curta" };
    if (percent >= 0.41) return { automatic: true, percent, total, intensity: "prioritaria" };
    return { automatic: true, percent, total, intensity: "reforcada" };
  }

  function classificationFromDiagnosis(diagnosis) {
    const level = String(diagnosis?.level || "").toLowerCase();
    if (!level) return null;

    const confidence = clamp(Number(diagnosis.confidence) || 0, 0, 1);
    const actionText = diagnosis?.action?.text || "";
    const base = {
      diagnosisLevel: level,
      confidence,
      reason: actionText,
    };

    if (level === "strong") {
      return { ...base, automatic: false, resolveExisting: confidence >= .45, reason: actionText || "Domínio forte: mantenha apenas o contato normal com o tema." };
    }
    if (level === "adequate") {
      return { ...base, automatic: false, reason: actionText || "Desempenho adequado: mantenha o ciclo normal." };
    }
    if (level === "attention") {
      return { ...base, automatic: true, intensity: "curta", reason: actionText || "O tema pede uma revisão leve." };
    }
    if (level === "deficiency") {
      return { ...base, automatic: true, intensity: "prioritaria", reason: actionText || "O tema pede reforço direcionado." };
    }
    if (level === "critical") {
      return { ...base, automatic: true, intensity: "reforcada", reason: actionText || "O tema pede uma revisão aprofundada." };
    }
    if (level === "insufficient") {
      return { ...base, automatic: false, insufficient: true, reason: actionText || "Ainda não há dados suficientes; faça uma sessão diagnóstica." };
    }
    return null;
  }

  function diagnosisSnapshot(diagnosis) {
    if (!diagnosis?.level) return null;
    return {
      level: diagnosis.level,
      confidence: clamp(Number(diagnosis.confidence) || 0, 0, 1),
      trend: diagnosis.trend?.label || "",
      action: diagnosis.action?.kind || "",
      reasons: Array.isArray(diagnosis.reasons) ? [...diagnosis.reasons] : [],
    };
  }

  function buildPlan(classificationResult, now = new Date()) {
    if (!classificationResult?.intensity) return null;
    const definition = INTENSITIES[classificationResult.intensity];
    const base = startOfDay(now);
    const availableAt = new Date(base.getTime() + definition.days * DAY);
    return {
      intensity: classificationResult.intensity,
      definition,
      availableAt: availableAt.toISOString(),
      availableDate: formatDate(availableAt),
      flexibleLabel: classificationResult.intensity === "reforcada" ? "Disponível no próximo ciclo possível" : `Revisão disponível a partir de ${formatDate(availableAt)}`,
    };
  }

  function makeAttempt(session, now = new Date()) {
    return {
      registradaEm: new Date(now).toISOString(),
      percentual: clamp(Number(session.percentual) || 0, 0, 1),
      acertos: Math.max(0, Number(session.acertos) || 0),
      totalQuestoes: Math.max(0, Number(session.totalQuestoes) || 0),
      dificuldade: session.dificuldade || "",
      assinatura: `${Number(session.acertos) || 0}/${Number(session.totalQuestoes) || 0}/${session.dificuldade || ""}`,
    };
  }

  function shouldAppendAttempt(record, attempt) {
    const latest = record?.tentativas?.[record.tentativas.length - 1];
    return !latest || latest.assinatura !== attempt.assinatura;
  }

  function statusForPlan(plan, now = new Date()) {
    return new Date(plan.availableAt).getTime() <= startOfDay(now).getTime() ? "Disponível" : "Pendente";
  }

  function interventionUpdate(record, context, session, now) {
    if (!global.LearningIntervention?.update || !session?.diagnosis) return null;
    return global.LearningIntervention.update(record, {
      materia: context.materia,
      assunto: context.assunto,
      diagnosis: session.diagnosis,
      source: context.origem || "desempenho",
      now,
    });
  }

  function mergeReview(existing, context, session, now = new Date(), manual = false) {
    if (!context?.materia || !context?.assunto || !context?.id || !context?.sourceKey) {
      return { record: null, created: false, updated: false, concluded: false, invalid: true, reason: "Matéria e assunto válidos são necessários." };
    }
    const result = classificationFromDiagnosis(session.diagnosis) || classification(session.percentual, session.totalQuestoes);
    const canCreate = manual || result.automatic;
    const attempt = makeAttempt(session, now);
    const base = existing ? { ...existing, tentativas: Array.isArray(existing.tentativas) ? [...existing.tentativas] : [] } : null;
    const intervention = interventionUpdate(base || (context.previousIntervention ? { intervencao: context.previousIntervention } : null), context, session, now);

    if (!canCreate) {
      if (!base) return { record: null, created: false, updated: false, concluded: false, insufficient: Boolean(result.insufficient) || result.total < 10, reason: result.reason, interventionState: intervention?.state || null };
      if (shouldAppendAttempt(base, attempt)) base.tentativas.push(attempt);
      if (result.resolveExisting) {
        base.status = "Concluída";
        base.concluidaEm = new Date(now).toISOString();
      }
      base.atualizadaEm = new Date(now).toISOString();
      base.motivo = { percentual: result.percent ?? attempt.percentual, acertos: attempt.acertos, totalQuestoes: attempt.totalQuestoes };
      base.diagnostico = diagnosisSnapshot(session.diagnosis);
      if (intervention?.state) base.intervencao = intervention.state;
      return { record: base, created: false, updated: true, concluded: base.status === "Concluída", insufficient: Boolean(result.insufficient) || result.total < 10, reason: result.reason, interventionOutcome: intervention?.outcome || null };
    }

    const intensity = intervention?.recommendation?.intensity || result.intensity || "curta";
    const plan = buildPlan({ ...result, intensity }, now);
    if (intervention?.recommendation?.cooldownDays) {
      const availableAt = new Date(startOfDay(now).getTime() + intervention.recommendation.cooldownDays * DAY);
      plan.availableAt = availableAt.toISOString();
      plan.availableDate = formatDate(availableAt);
      plan.flexibleLabel = `Nova reavaliação disponível a partir de ${formatDate(availableAt)}`;
    }
    const record = base || {
      id: context.id,
      sourceKey: context.sourceKey,
      tipo: "adaptativa",
      concursoId: context.concursoId || "",
      materia: context.materia,
      assunto: context.assunto,
      ciclo: context.ciclo || "",
      criadaEm: new Date(now).toISOString(),
      tentativas: [],
    };
    if (shouldAppendAttempt(record, attempt)) record.tentativas.push(attempt);
    const currentRank = INTENSITIES[record.intensidade]?.rank || 0;
    const newRank = INTENSITIES[intensity].rank;
    const improved = currentRank > newRank;
    record.intensidade = intensity;
    record.status = statusForPlan(plan, now);
    record.disponivelEm = plan.availableAt;
    record.dataPrevista = plan.availableDate;
    record.dataBase = formatDate(now);
    record.intervalKey = "adaptativa";
    record.intervalLabel = `Revisão adaptativa · ${plan.definition.label}`;
    record.motivo = { percentual: result.percent ?? attempt.percentual, acertos: attempt.acertos, totalQuestoes: attempt.totalQuestoes };
    record.diagnostico = diagnosisSnapshot(session.diagnosis);
    if (intervention?.state) record.intervencao = intervention.state;
    record.questoesSugeridas = Math.max(1, Number(intervention?.recommendation?.questions) || plan.definition.questions);
    record.sugestao = intervention?.recommendation?.text || plan.definition.suggestion;
    record.disponibilidade = plan.flexibleLabel;
    record.atualizadaEm = new Date(now).toISOString();
    record.canceladaEm = "";
    return { record, created: !base, updated: Boolean(base), concluded: false, improved, insufficient: false, reason: plan.flexibleLabel, interventionOutcome: intervention?.outcome || null };
  }

  global.AdaptiveReviewEngine = {
    classification,
    classificationFromDiagnosis,
    buildPlan,
    mergeReview,
    priorityImpact(intensity) { return Math.min(0.14, INTENSITIES[intensity]?.impact || 0); },
    intensityLabel(intensity) { return INTENSITIES[intensity]?.label || ""; },
    suggestion(intensity) { return INTENSITIES[intensity]?.suggestion || ""; },
    activeStatuses: new Set(["Pendente", "Disponível", "Em revisão"]),
  };
})(window);
