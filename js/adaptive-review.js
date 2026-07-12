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

  function classification(percentual, totalQuestoes) {
    const total = Math.max(0, Number(totalQuestoes) || 0);
    const percent = clamp(Number(percentual) || 0, 0, 1);
    if (total < 10) return { automatic: false, percent, total, reason: "Amostra insuficiente para criar uma revisão automaticamente." };
    if (percent > 0.8) return { automatic: false, percent, total, reason: "Desempenho acima de 80%; não é necessária uma revisão extraordinária." };
    if (percent >= 0.61) return { automatic: true, percent, total, intensity: "curta" };
    if (percent >= 0.41) return { automatic: true, percent, total, intensity: "prioritaria" };
    return { automatic: true, percent, total, intensity: "reforcada" };
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

  function mergeReview(existing, context, session, now = new Date(), manual = false) {
    if (!context?.materia || !context?.assunto || !context?.id || !context?.sourceKey) {
      return { record: null, created: false, updated: false, concluded: false, invalid: true, reason: "Matéria e assunto válidos são necessários." };
    }
    const result = classification(session.percentual, session.totalQuestoes);
    const canCreate = manual || result.automatic;
    const attempt = makeAttempt(session, now);
    const base = existing ? { ...existing, tentativas: Array.isArray(existing.tentativas) ? [...existing.tentativas] : [] } : null;

    if (!canCreate) {
      if (!base) return { record: null, created: false, updated: false, concluded: false, insufficient: result.total < 10, reason: result.reason };
      if (shouldAppendAttempt(base, attempt)) base.tentativas.push(attempt);
      if (result.total >= 10 && result.percent > 0.8) {
        base.status = "Concluída";
        base.concluidaEm = new Date(now).toISOString();
      }
      base.atualizadaEm = new Date(now).toISOString();
      base.motivo = { percentual: result.percent, acertos: attempt.acertos, totalQuestoes: attempt.totalQuestoes };
      return { record: base, created: false, updated: true, concluded: base.status === "Concluída", insufficient: result.total < 10, reason: result.reason };
    }

    const intensity = result.intensity || "curta";
    const plan = buildPlan({ ...result, intensity }, now);
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
    record.motivo = { percentual: result.percent, acertos: attempt.acertos, totalQuestoes: attempt.totalQuestoes };
    record.questoesSugeridas = Math.max(1, Number(record.questoesSugeridas) || plan.definition.questions);
    record.sugestao = plan.definition.suggestion;
    record.disponibilidade = plan.flexibleLabel;
    record.atualizadaEm = new Date(now).toISOString();
    record.canceladaEm = "";
    return { record, created: !base, updated: Boolean(base), concluded: false, improved, insufficient: false, reason: plan.flexibleLabel };
  }

  global.AdaptiveReviewEngine = {
    classification,
    buildPlan,
    mergeReview,
    priorityImpact(intensity) { return Math.min(0.14, INTENSITIES[intensity]?.impact || 0); },
    intensityLabel(intensity) { return INTENSITIES[intensity]?.label || ""; },
    suggestion(intensity) { return INTENSITIES[intensity]?.suggestion || ""; },
    activeStatuses: new Set(["Pendente", "Disponível", "Em revisão"]),
  };
})(window);
