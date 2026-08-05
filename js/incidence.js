(function (global) {
  "use strict";

  const SUBJECT_ALIASES = {
    "direito-financeiro-afo": ["direito financeiro", "administracao financeira e orcamentaria", "afo"],
    "lingua-portuguesa": ["lingua portuguesa", "portugues"],
    "administracao-recursos-materiais-logistica": ["administracao de recursos e logistica", "administracao de recursos materiais e logistica", "recursos materiais e logistica", "administracao de materiais e logistica"],
    "administracao-geral-publica": ["administracao geral e publica", "administracao geral", "administracao publica"],
    "controle-externo": ["controle externo", "controle externo e legislacao", "controle externo e legislacao do tce pe"],
    "governanca-publica": ["governanca publica"],
    "legislacao": ["legislacao"],
    "licitacoes-contratos": ["licitacoes e contratos", "licitacoes e contratos administrativos", "licitacao e contratos"],
    "raciocinio-logico-matematico": ["raciocinio logico matematico", "raciocinio logico-matematico", "raciocinio logico", "logica matematica"],
    "estatistica": ["estatistica"],
    "banco-dados-business-intelligence": ["banco de dados e business intelligence", "banco de dados", "business intelligence", "banco de dados e bi"],
  };

  const TOPIC_ALIASES = {
    "direito-financeiro-afo::despesa-publica": ["despesa publica", "estagios da despesa", "empenho", "liquidacao", "pagamento"],
    "direito-financeiro-afo::ppa-ldo-loa": ["ppa", "ldo", "loa", "plano plurianual", "lei de diretrizes orcamentarias", "lei orcamentaria anual"],
    "direito-financeiro-afo::receita-publica": ["receita publica", "estagios da receita", "arrecadacao", "recolhimento"],
    "direito-financeiro-afo::principios-orcamentarios": ["principios orcamentarios"],
    "direito-financeiro-afo::creditos-orcamentarios-adicionais": ["creditos adicionais", "creditos orcamentarios"],
    "direito-financeiro-afo::lrf-receitas-despesas": ["lrf receitas despesas", "lei de responsabilidade fiscal receitas", "lei de responsabilidade fiscal despesas"],
    "direito-financeiro-afo::lrf-introducao": ["lrf", "lei de responsabilidade fiscal"],
    "direito-financeiro-afo::lrf-transparencia": ["transparencia fiscal", "lrf transparencia"],
    "direito-financeiro-afo::ciclo-processo-orcamentario": ["ciclo orcamentario", "processo orcamentario"],
    "lingua-portuguesa::interpretacao-reescrita": ["interpretacao de textos", "interpretacao textual", "reescrita"],
    "lingua-portuguesa::classes-formacao-estrutura-palavras": ["classes de palavras", "morfologia", "formacao de palavras", "estrutura das palavras"],
    "lingua-portuguesa::semantica-regencia": ["semantica", "regencia"],
    "lingua-portuguesa::coordenacao-subordinacao-pontuacao": ["coordenacao", "subordinacao", "pontuacao"],
    "lingua-portuguesa::concordancia-vozes": ["concordancia", "vozes verbais"],
    "lingua-portuguesa::termos-oracao-se-que-como": ["termos da oracao", "particula se", "particula que"],
    "lingua-portuguesa::ortografia-acentuacao-crase": ["ortografia", "acentuacao", "crase"],
    "lingua-portuguesa::tempos-modos-verbais": ["tempos verbais", "modos verbais"],
    "licitacoes-contratos::licitacoes-publicas": ["licitacoes", "licitacao publica", "planejamento das contratacoes", "pca", "etp", "termo de referencia", "projeto basico"],
    "licitacoes-contratos::contratos-administrativos": ["contratos administrativos", "execucao contratual"],
    "legislacao::lai": ["lei de acesso a informacao", "lai"],
    "legislacao::lgpd": ["lei geral de protecao de dados", "lgpd"],
    "legislacao::fiscalizacao-arts-70-75-cf": ["fiscalizacao contabil", "art 70", "artigo 70"],
    "raciocinio-logico-matematico::estruturas-logicas-equivalencias-negacoes": ["estruturas logicas", "equivalencias logicas", "negacoes logicas"],
    "raciocinio-logico-matematico::operacoes-numeros-reais": ["numeros reais"],
    "raciocinio-logico-matematico::fracoes-razao-proporcao-regra-tres": ["fracoes", "razao e proporcao", "regra de tres"],
    "raciocinio-logico-matematico::diagramas-argumentacao-problemas-logica": ["diagramas logicos", "argumentacao logica", "problemas de logica"],
    "banco-dados-business-intelligence::business-intelligence": ["business intelligence", "bi"],
    "banco-dados-business-intelligence::data-warehouse": ["data warehouse", "dw"],
    "banco-dados-business-intelligence::sql": ["sql"],
    "banco-dados-business-intelligence::etl": ["etl"],
    "banco-dados-business-intelligence::sgbd": ["sgbd"],
  };

  const GENERIC_WORDS = new Set(["a", "e", "de", "da", "do", "dos", "das", "em", "na", "no", "para", "por", "com", "sem", "sobre", "geral", "publica", "publico", "conceito", "conceitos", "principio", "principios", "aspecto", "aspectos", "introducao", "aplicacao", "aplicacoes", "nocoes", "nocao", "parte", "outros"]);
  const SHORT_TERMS = new Set(["sql", "etl", "sgbd", "olap", "lai", "lgpd", "ppa", "ldo", "loa", "lrf", "bi", "dw", "etp", "pca"]);

  function normalize(value) {
    return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
  }

  function boardIsFgv(board) {
    const normalized = normalize(board);
    return normalized === "fgv" || normalized.includes("fundacao getulio vargas");
  }

  function sourceData() {
    return global.MeuCronogramaIncidenceData?.fgvV1 || { metadata: {}, datasets: [] };
  }

  function subjectMatches(dataset, subject) {
    const normalizedSubject = normalize(subject);
    if (!normalizedSubject) return false;
    const aliases = [
      ...(SUBJECT_ALIASES[dataset.subjectId] || []),
      dataset.subjectName || "",
      dataset.subjectId || "",
    ].map(normalize).filter(Boolean);
    return aliases.some((alias) => normalizedSubject === alias || normalizedSubject.includes(alias) || alias.includes(normalizedSubject));
  }

  function chooseDataset({ board = "", subject = "", scope = null } = {}) {
    const matching = sourceData().datasets.filter((dataset) => subjectMatches(dataset, subject));
    const boardSpecific = boardIsFgv(board) ? matching.filter((dataset) => dataset.board === "fgv") : [];
    // A base geral e usada somente sem banca definida. Assim, dados sem banca nunca sao rotulados como FGV.
    const general = !normalize(board) ? matching.filter((dataset) => dataset.board === null) : [];
    const candidates = boardSpecific.length ? boardSpecific : general;
    if (!candidates.length) return null;
    return candidates.slice().sort((a, b) => {
      const scopeDifference = Number(Boolean(b.scope?.type && scope && normalize(b.scope.type) === normalize(scope))) - Number(Boolean(a.scope?.type && scope && normalize(a.scope.type) === normalize(scope)));
      if (scopeDifference) return scopeDifference;
      const periodDifference = Number(b.period?.end || 0) - Number(a.period?.end || 0);
      if (periodDifference) return periodDifference;
      return Number(b.questionCount || 0) - Number(a.questionCount || 0);
    })[0];
  }

  function contentText(context = {}) {
    return normalize([context.title, context.details, ...(Array.isArray(context.contents) ? context.contents : [])].filter(Boolean).join(" ; "));
  }

  function usefulTokens(value) {
    return normalize(value).split(" ").filter((token) => token.length >= 3 && !GENERIC_WORDS.has(token));
  }

  function aliasMatches(text, alias) {
    const normalizedAlias = normalize(alias);
    if (!normalizedAlias) return 0;
    if (text.includes(normalizedAlias)) return 100 + normalizedAlias.length;
    const tokens = usefulTokens(normalizedAlias);
    if (!tokens.length) return 0;
    const matches = tokens.filter((token) => text.includes(token));
    const hasShortExact = SHORT_TERMS.has(normalizedAlias) && new RegExp(`(?:^| )${normalizedAlias}(?: |$)`).test(text);
    if (hasShortExact) return 65;
    if (tokens.length === 1 || matches.length < 2) return 0;
    return Math.round((matches.length / tokens.length) * 70);
  }

  function topicAliases(dataset, topic) {
    return [
      topic.name || "",
      topic.topicId || "",
      ...(TOPIC_ALIASES[`${dataset.subjectId}::${topic.topicId}`] || []),
    ];
  }

  function topicCandidates(dataset, context) {
    const text = contentText(context);
    if (!text) return [];
    return (dataset.topics || []).flatMap((topic) => {
      const parentScore = Math.max(...topicAliases(dataset, topic).map((alias) => aliasMatches(text, alias)), 0);
      const parent = parentScore ? [{
        topic,
        parent: null,
        score: parentScore,
        percent: Number(topic.incidencePercent) || 0,
        matchLevel: "topic",
      }] : [];
      const children = (topic.children || []).flatMap((child) => {
        const aliases = [child.name || "", child.topicId || ""];
        const score = Math.max(...aliases.map((alias) => aliasMatches(text, alias)), 0);
        if (!score) return [];
        return [{
          topic: child,
          parent: topic,
          score: score + 2,
          percent: (Number(topic.incidencePercent) || 0) * (Number(child.incidencePercentWithinParent) || 0) / 100,
          matchLevel: "macro-child",
        }];
      });
      return [...parent, ...children];
    });
  }

  function incidenceBand(dataset, percent) {
    const values = (dataset.topics || []).flatMap((topic) => [Number(topic.incidencePercent) || 0, ...(topic.children || []).map((child) => (Number(topic.incidencePercent) || 0) * (Number(child.incidencePercentWithinParent) || 0) / 100)]).filter(Boolean).sort((a, b) => a - b);
    if (!values.length) return { normalized: 0.5, band: "sem dados" };
    const min = values[0];
    const max = values[values.length - 1];
    const normalized = max === min ? 0.5 : Math.max(0, Math.min(1, (percent - min) / (max - min)));
    const band = normalized >= .75 ? "muito alta" : normalized >= .5 ? "alta" : normalized >= .25 ? "media" : "baixa";
    return { normalized, band };
  }

  function resolve(context = {}) {
    const dataset = chooseDataset(context);
    if (!dataset) return { available: false, applied: false, reason: "Sem base historica compativel para esta materia." };
    const best = topicCandidates(dataset, context).sort((a, b) => b.score - a.score || b.percent - a.percent)[0];
    if (!best) {
      return {
        available: false,
        applied: false,
        datasetId: dataset.id,
        kind: dataset.board === "fgv" ? "fgv" : "general",
        reason: "A materia possui base, mas este tema nao foi localizado nela.",
      };
    }
    const rank = incidenceBand(dataset, best.percent);
    const kind = dataset.board === "fgv" ? "fgv" : "general";
    return {
      available: true,
      applied: true,
      kind,
      datasetId: dataset.id,
      subjectId: dataset.subjectId,
      topicId: best.topic.topicId,
      parentTopicId: best.parent?.topicId || "",
      topicName: best.topic.name,
      parentTopicName: best.parent?.name || "",
      percent: Number(best.percent.toFixed(4)),
      normalized: rank.normalized,
      band: rank.band,
      matchLevel: best.matchLevel,
      confidence: best.score >= 100 ? "high" : "medium",
      sourceType: dataset.sourceType || "",
      questionCount: Number(dataset.questionCount) || 0,
      period: dataset.period || null,
      sourceLabel: kind === "fgv" ? "Histórico FGV" : "Incidência geral da matéria",
    };
  }

  const api = { SUBJECT_ALIASES, TOPIC_ALIASES, normalize, boardIsFgv, chooseDataset, resolve, topicCandidates };
  global.StudyIncidence = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
