"use strict";

(function initKnowledgeMapping(global) {
  const HISTORY = global.HistoryInheritance || (typeof require === "function" ? require("./history-inheritance.js") : null);
  const SEMANTIC = global.KnowledgeSemanticFamily || (typeof require === "function" ? require("./knowledge-semantic-family.js") : null);
  const GENERIC_TITLES = new Set(["introducao", "aspectos gerais", "conceitos gerais", "disposicoes gerais", "generalidades", "controle"]);
  const GENERIC_CORE_TERMS = new Set(["controle", "processo", "politica", "gestao", "sistema", "estrutura", "modelo", "estado", "medidas", "externo", "civil", "dados", "bancos", "planejamento", "avaliacao"]);
  const STOP_WORDS = new Set(["a", "as", "ao", "aos", "de", "do", "dos", "da", "das", "e", "em", "na", "no", "nas", "nos", "por", "para", "com", "um", "uma", "que", "se", "sobre", "geral", "gerais", "conceito", "conceitos", "aspectos", "principios", "direito", "administracao", "administrativo", "administrativos", "administrativa", "administrativas", "publica", "publico", "publicas", "publicos"]);

  const text = (value = "") => String(value ?? "").trim();
  const normalize = (value = "") => HISTORY?.normalize ? HISTORY.normalize(value) : text(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const unique = (values = []) => [...new Set(values.filter(Boolean))];
  const titleParts = (value = "") => {
    const raw = text(value);
    const index = raw.indexOf(":");
    return index >= 0 ? { title: raw.slice(0, index).trim(), details: raw.slice(index + 1).trim() } : { title: raw, details: "" };
  };
  const tokens = (value = "", { content = false } = {}) => unique(normalize(value).split(" ").filter((token) => token.length > 2 && (!content || !STOP_WORDS.has(token))));
  const tokenSet = (value = "", options) => new Set(tokens(value, options));
  const sorted = (values = []) => [...values].sort((a, b) => String(a).localeCompare(String(b)));
  const normalizedKeys = (values = []) => sorted(unique(values.map(normalize).filter(Boolean)));

  function topicDescriptor(input = {}, context = {}) {
    const rawTopic = text(input.assunto || input.topic || input.originalTopic || input.titulo || input.title);
    const parsed = titleParts(rawTopic);
    const title = text(input.titulo || input.title) || parsed.title || rawTopic;
    const details = text(input.descricao || input.details || input.originalDetails)
      || (Array.isArray(input.conteudosOriginais) ? input.conteudosOriginais.filter(Boolean).join("; ") : text(input.conteudosOriginais))
      || parsed.details;
    const planId = text(input.planId || input.studyPlanId || context.planId);
    const topicId = text(input.topicId || input.programUnitId || input.id) || [planId, input.materia || input.subject, title, details].map(normalize).join("|");
    return { planId, topicId, subject: text(input.materia || input.subject || context.subject), title, details, normalizedTitle: normalize(title), normalizedDetails: normalize(details), coreTitleTokens: tokens(title).filter((token) => !STOP_WORDS.has(token)), source: text(input.source || context.source) || "planning-content" };
  }

  function conceptDescriptor(concept = {}, base = {}, index = null) {
    const key = normalize(concept.canonicalKey || concept.canonicalTitle || concept.title);
    const mappings = index?.mappingsByConcept?.get(key) || (base.topicMappings || []).filter((mapping) => (mapping.conceptKeys || [mapping.canonicalKey]).map(normalize).includes(key));
    const evidence = index?.evidenceByConcept?.get(key) || (base.evidence || []).filter((item) => normalize(item.canonicalKey) === key);
    const aliases = index?.aliasesByConcept?.get(key) || (base.aliases || []).filter((alias) => normalize(alias.conceptKey) === key);
    const scoped = index?.trustedDetailsByConcept?.get(key) || [];
    const ignoredBroadDetails = index?.broadDetailsByConcept?.get(key) || [];
    const historicalTitles = unique([...mappings.flatMap((mapping) => [mapping.originalTitle, mapping.originalTopic]), ...evidence.map((item) => item.originalTopic), ...aliases.map((alias) => alias.aliasDisplay)].map(text));
    const details = [...new Set(scoped.map((item) => item.value).filter((value) => normalize(value) !== key))].join("; ");
    const subjects = unique([...mappings.map((item) => item.originalSubject), ...evidence.map((item) => item.originalSubject)].map(text));
    return { key, canonicalTitle: text(concept.canonicalTitle) || text(concept.title) || key, details, trustedDetails: scoped.map((item) => item.value), ignoredBroadDetails: ignoredBroadDetails.map((item) => item.value), detailEvidenceBasis: scoped.map((item) => item.basis), normalizedTitle: key, normalizedDetails: normalize(details), aliases, mappings, evidence, subjects: subjects.map(normalize), sourceFamilies: [...new Set(subjects.map(SEMANTIC.semanticFamilyForSubject).filter((family) => family !== "unknown"))].sort(), coreTitleTokens: tokens(text(concept.canonicalTitle) || text(concept.title)).filter((token) => !STOP_WORDS.has(token)) };
  }

  function detailRecordsForConcept(base = {}, key = "") {
    const mappings = (base.topicMappings || []).filter((item) => normalizedKeys(item.conceptKeys || [item.canonicalKey]).includes(key));
    const evidence = (base.evidence || []).filter((item) => normalize(item.canonicalKey) === key);
    return [
      ...mappings.map((item) => ({ value: text(item.originalDetails), sourcePlanId: text(item.planId || item.sourcePlanId), sourceSubject: text(item.originalSubject), explicit: item.status === "user-confirmed" || item.basis === "user-confirmed" || item.detailScope === "topic-local" || item.detailScope === "trusted" || item.provenance?.topicScope === "local" })),
      ...evidence.map((item) => ({ value: text(item.originalDetails), sourcePlanId: text(item.sourcePlanId || item.planId), sourceSubject: text(item.originalSubject), explicit: item.detailScope === "topic-local" || item.detailScope === "trusted" || item.provenance?.topicScope === "local" })),
    ].filter((item) => item.value);
  }

  function mappingIdentity(topic = {}) {
    const descriptor = topicDescriptor(topic);
    return [descriptor.planId, descriptor.topicId || descriptor.normalizedTitle, descriptor.normalizedTitle, descriptor.normalizedDetails].join("|");
  }

  function buildKnowledgeMappingIndex(base = {}) {
    const index = { conceptByKey: new Map(), evidenceByConcept: new Map(), mappingsByConcept: new Map(), aliasesByConcept: new Map(), rulesByTitle: new Map(), rejectionsByTopicIdentity: new Map(), tokenDocumentFrequencyByFamily: new Map(), titleTokenDocumentFrequencyByFamily: new Map(), trustedDetailTokenDocumentFrequencyByFamily: new Map(), conceptCountByFamily: new Map(), detailFingerprintUsage: new Map(), trustedDetailsByConcept: new Map(), broadDetailsByConcept: new Map() };
    (base.concepts || []).forEach((concept) => { const key = normalize(concept.canonicalKey || concept.canonicalTitle); if (key) index.conceptByKey.set(key, concept); });
    (base.evidence || []).forEach((item) => { const key = normalize(item.canonicalKey); if (!key) return; if (!index.evidenceByConcept.has(key)) index.evidenceByConcept.set(key, []); index.evidenceByConcept.get(key).push(item); });
    (base.topicMappings || []).forEach((item) => normalizedKeys(item.conceptKeys || [item.canonicalKey]).forEach((key) => { if (!index.mappingsByConcept.has(key)) index.mappingsByConcept.set(key, []); index.mappingsByConcept.get(key).push(item); }));
    (base.aliases || []).forEach((item) => { const key = normalize(item.conceptKey); if (!key) return; if (!index.aliasesByConcept.has(key)) index.aliasesByConcept.set(key, []); index.aliasesByConcept.get(key).push(item); });
    (base.mappingRules || []).forEach((item) => index.rulesByTitle.set(`${normalize(item.normalizedTargetTitle)}|${normalize(item.targetSubjectContext)}`, item));
    (base.mappingRejections || []).forEach((item) => index.rejectionsByTopicIdentity.set(`${item.topicIdentity}|${normalizedKeys(item.conceptKeys).join(",")}`, item));
    [...index.conceptByKey.keys()].forEach((key) => detailRecordsForConcept(base, key).forEach((record) => {
      const fingerprint = [record.sourcePlanId || record.sourceSubject || "unknown-source", normalize(record.value)].join("|");
      if (!index.detailFingerprintUsage.has(fingerprint)) index.detailFingerprintUsage.set(fingerprint, new Set());
      index.detailFingerprintUsage.get(fingerprint).add(key);
    }));
    [...index.conceptByKey.keys()].forEach((key) => detailRecordsForConcept(base, key).forEach((record) => {
      const fingerprint = [record.sourcePlanId || record.sourceSubject || "unknown-source", normalize(record.value)].join("|");
      const broad = (index.detailFingerprintUsage.get(fingerprint)?.size || 0) > 1;
      const collection = broad && !record.explicit ? index.broadDetailsByConcept : index.trustedDetailsByConcept;
      if (!collection.has(key)) collection.set(key, []);
      collection.get(key).push({ value: record.value, fingerprint, basis: record.explicit ? "explicit-provenance" : broad ? "exclusive-or-repeated" : "concept-local" });
    }));
    // This is derived once per mapping pass. It intentionally counts concepts,
    // not evidence rows, so common family words cannot dominate candidates.
    [...index.conceptByKey.values()].forEach((concept) => {
      const descriptor = conceptDescriptor(concept, base, index);
      descriptor.sourceFamilies.forEach((family) => {
        index.conceptCountByFamily.set(family, (index.conceptCountByFamily.get(family) || 0) + 1);
        if (!index.titleTokenDocumentFrequencyByFamily.has(family)) index.titleTokenDocumentFrequencyByFamily.set(family, new Map());
        const frequencies = index.titleTokenDocumentFrequencyByFamily.get(family);
        unique(descriptor.coreTitleTokens).forEach((token) => frequencies.set(token, (frequencies.get(token) || 0) + 1));
      });
    });
    index.tokenDocumentFrequencyByFamily = index.titleTokenDocumentFrequencyByFamily;
    [...index.conceptByKey.values()].forEach((concept) => {
      const descriptor = conceptDescriptor(concept, base, index);
      descriptor.sourceFamilies.forEach((family) => {
        if (!index.trustedDetailTokenDocumentFrequencyByFamily.has(family)) index.trustedDetailTokenDocumentFrequencyByFamily.set(family, new Map());
        const frequencies = index.trustedDetailTokenDocumentFrequencyByFamily.get(family);
        unique(tokens(descriptor.details, { content: true })).forEach((token) => frequencies.set(token, (frequencies.get(token) || 0) + 1));
      });
    });
    return index;
  }

  function subjectScore(target, concept) {
    const targetSubject = normalize(target.subject);
    if (!targetSubject || !concept.subjects.length) return { score: 0, kind: "unknown" };
    if (concept.subjects.includes(targetSubject)) return { score: 1, kind: "exact" };
    const targetFamily = /raciocinio logico|rlm/.test(targetSubject);
    const compatible = concept.subjects.some((source) => HISTORY?.subjectCompatibility?.(target.subject, source)?.score >= .45 || (targetFamily && /raciocinio logico|rlm/.test(source)));
    return compatible ? { score: .55, kind: "related" } : { score: 0, kind: "different" };
  }

  function detailCoverage(target, concept) {
    const targetTerms = tokenSet(`${target.title} ${target.details}`, { content: true });
    const sourceTerms = tokenSet(`${concept.canonicalTitle} ${concept.details}`, { content: true });
    if (!targetTerms.size || !sourceTerms.size) return { coverage: 0, sharedTerms: [] };
    const sharedTerms = [...targetTerms].filter((term) => sourceTerms.has(term));
    return { coverage: sharedTerms.length / targetTerms.size, sharedTerms };
  }

  function tokenDistinctiveness(token, family, index, source = "title") {
    const frequencies = (source === "detail" ? index?.trustedDetailTokenDocumentFrequencyByFamily : index?.titleTokenDocumentFrequencyByFamily)?.get(family);
    const count = index?.conceptCountByFamily?.get(family) || 0;
    if (!frequencies || !count || !frequencies.has(token)) return 0;
    const frequency = frequencies.get(token) || 0;
    return Math.max(0, 1 - (Math.max(0, frequency - 1) / count));
  }

  function titleAffinity(target, concept, index) {
    const targetTokens = unique(target.coreTitleTokens || tokens(target.title));
    const sourceTokens = unique(concept.coreTitleTokens || tokens(concept.canonicalTitle));
    const sharedCoreTerms = targetTokens.filter((token) => sourceTokens.includes(token));
    const family = SEMANTIC.semanticFamilyForSubject(target.subject);
    const distinctiveTerms = sharedCoreTerms.filter((token) => tokenDistinctiveness(token, family, index, "title") >= .6 && !GENERIC_CORE_TERMS.has(token));
    const canonicalExact = target.normalizedTitle === concept.normalizedTitle && !GENERIC_TITLES.has(target.normalizedTitle);
    const rawContainment = targetTokens.length > 0 && (targetTokens.every((token) => sourceTokens.includes(token)) || sourceTokens.every((token) => targetTokens.includes(token)));
    const planningAnchor = targetTokens.length === 1 && sharedCoreTerms.length === 1 && sharedCoreTerms[0] === "planejamento";
    const containment = rawContainment && (canonicalExact || distinctiveTerms.length > 0 || sharedCoreTerms.some((token) => !GENERIC_CORE_TERMS.has(token)) || planningAnchor);
    const proportion = sharedCoreTerms.length / Math.max(targetTokens.length, sourceTokens.length, 1);
    const affinity = canonicalExact ? 1 : containment ? .82 : Math.min(1, proportion * .7 + (distinctiveTerms.length ? .3 : 0));
    return { canonicalExact, containment, sharedCoreTerms: sorted(sharedCoreTerms), distinctiveTerms: sorted(distinctiveTerms), titleAffinity: affinity, titleTokenCoverage: sharedCoreTerms.length / Math.max(targetTokens.length, 1) };
  }

  function topicAnchorCompatibility(target, concept, index) {
    const details = detailCoverage(target, concept);
    const title = titleAffinity(target, concept, index);
    const family = SEMANTIC.semanticFamilyForSubject(target.subject);
    const targetTerms = tokenSet(`${target.title} ${target.details}`, { content: true });
    const detailSharedTerms = details.sharedTerms.filter((term) => !GENERIC_CORE_TERMS.has(term));
    const distinctiveDetailTerms = detailSharedTerms.filter((term) => tokenDistinctiveness(term, family, index, "detail") >= .6);
    const strongDetailEvidence = distinctiveDetailTerms.length >= 2 && details.coverage >= .2 && targetTerms.size > 0;
    const allowed = title.canonicalExact || title.containment || title.distinctiveTerms.length > 0 || strongDetailEvidence;
    const basis = title.canonicalExact ? "canonical-title-exact" : title.containment ? "title-containment" : title.distinctiveTerms.length ? "distinctive-title-overlap" : strongDetailEvidence ? "strong-detail-evidence" : "no-topic-anchor";
    return { allowed, basis, sharedCoreTerms: title.sharedCoreTerms, titleDistinctiveTerms: title.distinctiveTerms, distinctiveTerms: sorted(unique([...title.distinctiveTerms, ...distinctiveDetailTerms])), detailSharedTerms: sorted(detailSharedTerms), titleAffinity: title.titleAffinity, strongDetailEvidence, coverage: details.coverage };
  }

  function candidateScore(target, concept, index) {
    const title = target.normalizedTitle;
    const source = concept.normalizedTitle;
    const subject = subjectScore(target, concept);
    const alias = concept.aliases.find((item) => normalize(item.aliasNormalized || item.aliasDisplay) === title && (item.global === true || !item.subjectContext || subjectScore(target, { subjects: [item.subjectContext] }).score >= .45));
    const exact = title === source && !GENERIC_TITLES.has(title);
    const rawSemanticGate = SEMANTIC.semanticCompatibility(target, concept);
    const semanticGate = exact ? { ...rawSemanticGate, allowed: true, basis: "canonical-title-bypass" } : alias ? { ...rawSemanticGate, allowed: true, basis: "confirmed-alias-bypass" } : rawSemanticGate;
    if (!exact && !alias && !semanticGate.allowed) return { accepted: false, score: 0, confidence: "low", basis: "semantic-gate", direction: "none", coverage: 0, sharedTerms: [], semanticGate, subject, topicAnchorGate: { allowed: false, basis: "semantic-gate", sharedCoreTerms: [], distinctiveTerms: [], detailSharedTerms: [], titleAffinity: 0 } };
    const targetTokens = tokenSet(title);
    const sourceTokens = tokenSet(source);
    const containment = targetTokens.size > 0 && ([...targetTokens].every((token) => sourceTokens.has(token)) || [...sourceTokens].every((token) => targetTokens.has(token)));
    const details = detailCoverage(target, concept);
    const titleOverlap = [...targetTokens].filter((token) => sourceTokens.has(token)).length / Math.max(targetTokens.size, sourceTokens.size, 1);
    const topicAnchorGate = exact || alias ? { allowed: true, basis: exact ? "canonical-title-exact" : "confirmed-alias", sharedCoreTerms: [], titleDistinctiveTerms: [], distinctiveTerms: [], detailSharedTerms: details.sharedTerms, titleAffinity: exact ? 1 : .98, coverage: details.coverage } : topicAnchorCompatibility(target, concept, index);
    if (!exact && !alias && !topicAnchorGate.allowed) return { accepted: false, score: 0, confidence: "low", basis: "topic-anchor-gate", direction: "none", coverage: details.coverage, sharedTerms: details.sharedTerms, semanticGate, topicAnchorGate, subject };
    const basis = exact ? "canonical-title-exact" : alias ? "confirmed-alias" : topicAnchorGate.basis === "strong-detail-evidence" ? "detail-coverage" : containment ? "title-containment" : "title-affinity";
    const confidence = exact || alias ? "high" : details.coverage >= .7 && subject.score >= .45 ? "high" : "medium";
    return { accepted: true, score: exact ? 1 : alias ? .98 : Math.min(1, topicAnchorGate.titleAffinity * .45 + details.coverage * .43 + subject.score * .12), confidence, basis, direction: exact || alias ? "equivalent" : "partial", coverage: details.coverage, sharedTerms: details.sharedTerms, semanticGate, topicAnchorGate, subject, coreSharedTerms: topicAnchorGate.sharedCoreTerms };
  }

  function candidateConcepts(base = {}, target = {}, index = buildKnowledgeMappingIndex(base)) {
    const targetDescriptor = topicDescriptor(target);
    return [...index.conceptByKey.values()].map((concept) => {
      const descriptor = conceptDescriptor(concept, base, index);
      return { concept, descriptor, match: candidateScore(targetDescriptor, descriptor, index) };
    }).filter((item) => item.match.accepted).sort((a, b) => b.match.score - a.match.score || a.descriptor.key.localeCompare(b.descriptor.key));
  }

  function compositeCandidates(base, target, candidates) {
    const descriptor = topicDescriptor(target);
    const targetTerms = tokenSet(`${descriptor.title} ${descriptor.details}`, { content: true });
    const selected = [];
    const covered = new Set();
    const accepted = candidates.filter((item) => item.match.accepted);
    const ordered = accepted.length ? [accepted[0], ...candidates.filter((item) => item !== accepted[0])] : candidates;
    ordered.filter((item) => item.match.accepted).forEach((item) => {
      if (selected.length >= 4) return;
      const gate = item.match.topicAnchorGate || {};
      const anchorTerms = (gate.titleDistinctiveTerms || []).filter((term) => !covered.has(term));
      const detailTerms = (gate.detailSharedTerms || item.match.sharedTerms || []).filter((term) => !covered.has(term) && !GENERIC_CORE_TERMS.has(term));
      const isFirstAccepted = selected.length === 0 && item.match.accepted;
      const terms = unique(anchorTerms.length ? anchorTerms : gate.strongDetailEvidence ? detailTerms : isFirstAccepted ? detailTerms : []);
      if (!isFirstAccepted && (!terms.length || (!anchorTerms.length && !gate.strongDetailEvidence) || terms.length / Math.max(targetTerms.size, 1) < .05)) return;
      selected.push(item); terms.forEach((term) => covered.add(term));
    });
    return selected;
  }

  function findRule(base, target) {
    const descriptor = topicDescriptor(target);
    return (base.mappingRules || []).find((rule) => normalize(rule.normalizedTargetTitle) === descriptor.normalizedTitle && (!rule.targetSubjectContext || !descriptor.subject || normalize(rule.targetSubjectContext) === normalize(descriptor.subject)));
  }

  function findRejection(base, target, conceptKeys) {
    const identity = mappingIdentity(target);
    return (base.mappingRejections || []).some((rejection) => rejection.topicIdentity === identity && (!conceptKeys?.length || rejection.conceptKeys?.join("|") === conceptKeys.join("|")));
  }

  function matchTopicToConcepts(target = {}, base = {}, options = {}) {
    const descriptor = topicDescriptor(target);
    const index = options.index || buildKnowledgeMappingIndex(base);
    const rule = index.rulesByTitle.get(`${descriptor.normalizedTitle}|${normalize(descriptor.subject)}`) || findRule(base, descriptor);
    if (rule && !findRejection(base, descriptor, rule.conceptKeys)) return { topic: descriptor, conceptKeys: normalizedKeys(rule.conceptKeys), candidates: [], status: "user-confirmed", confidence: rule.confidence || "high", coverage: rule.coverage ?? (rule.relationship === "equivalent" ? 1 : 0), relationship: rule.relationship || "partial", matchBasis: rule.matchBasis || "user-confirmed-rule", sharedTerms: [...(rule.sharedTerms || [])], confirmed: true, rulesApplied: [rule] };
    const candidates = candidateConcepts(base, descriptor, index);
    const exact = candidates.filter((item) => ["canonical-title-exact", "confirmed-alias"].includes(item.match.basis) && !findRejection(base, descriptor, [item.descriptor.key]));
    const composite = compositeCandidates(base, descriptor, candidates).filter((item) => !findRejection(base, descriptor, [item.descriptor.key]));
    const selected = exact.length ? exact.slice(0, 1) : composite.some((item) => item.match.accepted) ? composite : [];
    const conceptKeys = normalizedKeys(selected.map((item) => item.descriptor.key));
    const completeRejection = (base.mappingRejections || []).some((item) => item.topicIdentity === mappingIdentity(descriptor) && normalizedKeys(item.conceptKeys).join("|") === conceptKeys.join("|"));
    if (completeRejection) return { topic: descriptor, conceptKeys: [], candidates: candidates.map((item) => ({ conceptKey: item.descriptor.key, title: item.descriptor.canonicalTitle, ...item.match })), status: "unmatched", confidence: "low", coverage: 0, matchBasis: "user-rejected", sharedTerms: [], confirmed: false, rulesApplied: [] };
    const coverageTerms = new Set(selected.flatMap((item) => item.match.sharedTerms));
    const rawCoverage = tokenSet(`${descriptor.title} ${descriptor.details}`, { content: true }).size ? coverageTerms.size / tokenSet(`${descriptor.title} ${descriptor.details}`, { content: true }).size : selected.length ? 1 : 0;
    // Composição válida não é sinônimo de equivalência: mesmo que os termos
    // do título tenham sido cobertos, o vínculo continua composto e parcial.
    const coverage = conceptKeys.length > 1 ? Math.min(rawCoverage, .85) : rawCoverage;
    const high = exact.length > 0;
    const matchBasis = high ? exact[0].match.basis : conceptKeys.length > 1 ? "composite-coverage" : candidates[0]?.match.basis || "none";
    return { topic: descriptor, conceptKeys, candidates: candidates.map((item) => ({ conceptKey: item.descriptor.key, title: item.descriptor.canonicalTitle, ...item.match })), status: high ? "auto-confirmed" : conceptKeys.length ? "suggested" : "unmatched", confidence: high ? "high" : conceptKeys.length ? "medium" : "low", coverage, relationship: high ? "equivalent" : conceptKeys.length > 1 ? "composite" : "partial", matchBasis, sharedTerms: [...coverageTerms].sort(), coreSharedTerms: [...new Set(selected.flatMap((item) => item.match.coreSharedTerms || []))].sort(), semanticGate: selected[0]?.match.semanticGate || { allowed: false, targetFamily: SEMANTIC.semanticFamilyForSubject(descriptor.subject), sourceFamilies: [], basis: "none" }, confirmed: high, rulesApplied: [] };
  }

  function matchConceptToTopics(base = {}, topics = [], options = {}) { const index = options.index || buildKnowledgeMappingIndex(base); return topics.map((topic) => matchTopicToConcepts(topic, base, { index })).filter((mapping) => mapping.conceptKeys.length); }
  function suggestMappings(base = {}, topics = [], options = {}) { const index = options.index || buildKnowledgeMappingIndex(base); return (Array.isArray(topics) ? topics : [topics]).map((topic) => matchTopicToConcepts(topic, base, { index })); }

  function applyMappingDecision(base = {}, mapping = {}, decision = "confirm", now = new Date().toISOString()) {
    const next = { ...base, topicMappings: [...(base.topicMappings || [])], aliases: [...(base.aliases || [])], mappingRules: [...(base.mappingRules || [])], mappingRejections: [...(base.mappingRejections || [])] };
    const topic = topicDescriptor(mapping.topic || mapping);
    const conceptKeys = normalizedKeys(mapping.conceptKeys || mapping.confirmedConceptKeys || mapping.suggestedConceptKeys);
    const identity = mappingIdentity(topic);
    next.topicMappings = next.topicMappings.filter((item) => item.topicIdentity !== identity);
    if (decision === "reject") {
      if (!next.mappingRejections.some((item) => item.topicIdentity === identity && item.conceptKeys.join("|") === conceptKeys.join("|"))) next.mappingRejections.push({ topicIdentity: identity, planId: topic.planId, normalizedTitle: topic.normalizedTitle, targetSubjectContext: normalize(topic.subject), conceptKeys, basis: "user-rejected", rejectedAt: now });
      return next;
    }
    const status = decision === "confirm" ? "user-confirmed" : "suggested";
    next.topicMappings.push({ planId: topic.planId, topicId: topic.topicId, originalSubject: topic.subject, originalTopic: topic.title, originalTitle: topic.title, originalDetails: topic.details, conceptKeys, confidence: mapping.confidence || "medium", basis: decision === "confirm" ? "user-confirmed" : mapping.matchBasis || "suggestion", status, relationship: mapping.relationship || (conceptKeys.length > 1 ? "composite" : "partial"), matchBasis: mapping.matchBasis || "suggestion", coverage: mapping.coverage ?? 0, sharedTerms: [...(mapping.sharedTerms || [])], topicIdentity: identity, updatedAt: now });
    if (decision === "confirm") {
      const rule = { normalizedTargetTitle: topic.normalizedTitle, targetSubjectContext: normalize(topic.subject), conceptKeys, relationship: mapping.relationship || (conceptKeys.length > 1 ? "composite" : "partial"), matchBasis: mapping.matchBasis || "user-confirmed", coverage: mapping.coverage ?? 0, sharedTerms: [...(mapping.sharedTerms || [])], confidence: mapping.confidence || "medium", basis: "user-confirmed", createdAt: now, updatedAt: now };
      next.mappingRules = next.mappingRules.filter((item) => !(item.normalizedTargetTitle === rule.normalizedTargetTitle && item.targetSubjectContext === rule.targetSubjectContext));
      next.mappingRules.push(rule);
      if (["canonical-title-exact", "canonical-title-equivalent", "confirmed-equivalent", "controlled-alias"].includes(mapping.matchBasis || mapping.basis) && conceptKeys.length === 1) conceptKeys.forEach((conceptKey) => {
        const concept = (next.concepts || []).find((item) => normalize(item.canonicalKey || item.canonicalTitle) === conceptKey);
        if (!concept || normalize(topic.title) === conceptKey) return;
        const aliasNormalized = topic.normalizedTitle;
        if (!next.aliases.some((item) => normalize(item.aliasNormalized || item.aliasDisplay) === aliasNormalized && normalize(item.conceptKey) === conceptKey)) {
          next.aliases.push({ id: `alias:${aliasNormalized}:${conceptKey}`, aliasNormalized, aliasDisplay: topic.title, conceptKey, subjectContext: normalize(topic.subject), basis: "user-confirmed", confirmedAt: now });
        }
      });
    }
    return next;
  }

  function revokeMappingDecision(base = {}, mapping = {}, options = {}) {
    const mode = options.mode === "reject" ? "reject" : "undo";
    const now = options.now || new Date().toISOString();
    const topic = topicDescriptor(mapping.topic || mapping);
    const conceptKeys = normalizedKeys(mapping.conceptKeys || mapping.confirmedConceptKeys || mapping.suggestedConceptKeys);
    const identity = mapping.topicIdentity || mappingIdentity(topic);
    const targetTitle = topic.normalizedTitle;
    const targetSubject = normalize(topic.subject);
    const sameKeys = (item = {}) => normalizedKeys(item.conceptKeys || [item.canonicalKey]).join("|") === conceptKeys.join("|");
    const isManualDecision = (item = {}) => item.status === "user-confirmed" || item.basis === "user-confirmed";
    const storedMappingDescriptor = (item = {}) => topicDescriptor({
      planId: item.planId,
      topicId: item.topicId,
      materia: item.originalSubject,
      assunto: item.originalTopic,
      titulo: item.originalTitle,
      descricao: item.originalDetails,
    });
    const mappingMatches = (item = {}) => {
      const itemIdentity = item.topicIdentity || mappingIdentity(storedMappingDescriptor(item));
      return isManualDecision(item) && itemIdentity === identity && sameKeys(item);
    };
    const nextMappings = (base.topicMappings || []).filter((item) => !mappingMatches(item)).map((item) => ({ ...item, conceptKeys: normalizedKeys(item.conceptKeys || [item.canonicalKey]) }));
    const anotherDecisionUses = (conceptKey) => nextMappings.some((item) => {
      if (!isManualDecision(item) || !normalizedKeys(item.conceptKeys || [item.canonicalKey]).includes(conceptKey)) return false;
      const descriptor = storedMappingDescriptor(item);
      return descriptor.normalizedTitle === targetTitle && normalize(descriptor.subject) === targetSubject;
    });
    const nextRules = (base.mappingRules || []).filter((rule) => {
      const matches = rule.basis === "user-confirmed"
        && normalize(rule.normalizedTargetTitle) === targetTitle
        && normalize(rule.targetSubjectContext) === targetSubject
        && sameKeys(rule);
      if (!matches) return true;
      return conceptKeys.some((key) => anotherDecisionUses(key));
    }).map((item) => ({ ...item, conceptKeys: normalizedKeys(item.conceptKeys) }));
    const nextAliases = (base.aliases || []).filter((alias) => {
      const conceptKey = normalize(alias.conceptKey);
      const removable = alias.basis === "user-confirmed"
        && normalize(alias.aliasNormalized || alias.aliasDisplay) === targetTitle
        && conceptKeys.includes(conceptKey)
        && normalize(alias.subjectContext) === targetSubject;
      return !removable || anotherDecisionUses(conceptKey);
    }).map((item) => ({ ...item }));
    const nextRejections = (base.mappingRejections || []).map((item) => ({ ...item, conceptKeys: normalizedKeys(item.conceptKeys) }));
    if (mode === "reject" && conceptKeys.length && !nextRejections.some((item) => item.topicIdentity === identity && sameKeys(item))) {
      nextRejections.push({ topicIdentity: identity, planId: topic.planId, normalizedTitle: targetTitle, targetSubjectContext: targetSubject, conceptKeys, basis: "user-rejected", rejectedAt: now });
    }
    return {
      ...base,
      topicMappings: nextMappings,
      mappingRules: nextRules,
      aliases: nextAliases,
      mappingRejections: nextRejections,
    };
  }

  function migrateKnowledgeMappings(base = {}) {
    const mappings = (base.topicMappings || []).map((item) => ({ ...item, conceptKeys: normalizedKeys(item.conceptKeys || [item.canonicalKey || item.conceptId?.replace(/^concept:/, "")]), status: item.status || (item.basis === "user-confirmed" ? "user-confirmed" : "auto-confirmed") }));
    return { ...base, schemaVersion: Math.max(2, Number(base.schemaVersion) || 1), topicMappings: mappings, aliases: Array.isArray(base.aliases) ? base.aliases.map((item) => ({ ...item })) : [], mappingRules: Array.isArray(base.mappingRules) ? base.mappingRules.map((item) => ({ ...item, conceptKeys: normalizedKeys(item.conceptKeys) })) : [], mappingRejections: Array.isArray(base.mappingRejections) ? base.mappingRejections.map((item) => ({ ...item, conceptKeys: normalizedKeys(item.conceptKeys) })) : [] };
  }

  function evidenceSummaryForConceptKeys(base = {}, conceptKeys = []) {
    const keys = new Set(normalizedKeys(conceptKeys));
    const evidence = [...new Map((base.evidence || []).filter((item) => keys.has(normalize(item.canonicalKey))).map((item) => [item.id || `${item.canonicalKey}|${item.completedAt}`, item])).values()];
    const questions = evidence.reduce((sum, item) => sum + (Number(item.questions) || 0), 0);
    const correctAnswers = evidence.reduce((sum, item) => sum + Math.min(Number(item.questions) || 0, Number(item.correctAnswers) || 0), 0);
    const dateValue = (value) => {
      const raw = text(value);
      const brazilian = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if (brazilian) return new Date(Number(brazilian[3]), Number(brazilian[2]) - 1, Number(brazilian[1])).getTime();
      const parsed = new Date(raw).getTime();
      return Number.isFinite(parsed) ? parsed : 0;
    };
    const dates = evidence.map((item) => ({ raw: text(item.completedAt || item.observedAt), value: dateValue(item.completedAt || item.observedAt) })).filter((item) => item.value).sort((a, b) => a.value - b.value);
    return { questions, correctAnswers, accuracy: questions ? correctAnswers / questions : null, sessions: evidence.length, studiedMinutes: evidence.reduce((sum, item) => sum + (Number(item.studiedMinutes) || 0), 0), lastContact: dates.at(-1)?.raw || "", sourcePlans: sorted(unique(evidence.map((item) => text(item.sourcePlanName || item.sourcePlanId)))) };
  }

  function inspectTopicMapping(base = {}, topic = {}) { const mapping = matchTopicToConcepts(topic, base); return { topicId: mapping.topic.topicId, title: mapping.topic.title, subject: mapping.topic.subject, candidates: mapping.candidates, confirmedConceptKeys: mapping.status === "auto-confirmed" || mapping.status === "user-confirmed" ? mapping.conceptKeys : [], suggestedConceptKeys: mapping.status === "suggested" ? mapping.conceptKeys : [], rejectedConceptKeys: (base.mappingRejections || []).filter((item) => item.topicIdentity === mappingIdentity(mapping.topic)).flatMap((item) => item.conceptKeys), coverage: mapping.coverage, matchBasis: mapping.matchBasis, confidence: mapping.confidence, semanticGate: mapping.semanticGate, coreSharedTerms: mapping.coreSharedTerms, detailSharedTerms: mapping.sharedTerms, relationship: mapping.relationship, rulesApplied: mapping.rulesApplied }; }

  const api = { normalize, topicDescriptor, conceptDescriptor, mappingIdentity, buildKnowledgeMappingIndex, tokenDistinctiveness, titleAffinity, topicAnchorCompatibility, candidateConcepts, matchTopicToConcepts, matchConceptToTopics, suggestMappings, applyMappingDecision, revokeMappingDecision, migrateKnowledgeMappings, evidenceSummaryForConceptKeys, inspectTopicMapping };
  global.KnowledgeMapping = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
