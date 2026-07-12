const STORAGE_KEY = "conteudoProgramaticoHistorico";
const APP_STATE_KEY = "planejaConcursosEstado";
const PLANS_INDEX_KEY = "planejaConcursosPlanos";
const ACTIVE_PLAN_KEY = "planejaConcursosPlanoAtivo";
const LEGACY_APP_STATE_KEY = APP_STATE_KEY;
const APP_THEME_KEY = "meu-cronograma-theme";
const BACKUP_META_KEY = "meuCronogramaUltimoBackup";
const BACKUP_REMINDER_DAYS = 7;
const STATUS_OPTIONS = ["N\u00e3o iniciado", "Em andamento", "Conclu\u00eddo", "Reprogramar"];
const REVIEW_INTERVALS = [
  { key: "24h", label: "24h", days: 1 },
  { key: "7d", label: "7 dias", days: 7 },
  { key: "15d", label: "15 dias", days: 15 },
  { key: "30d", label: "30 dias", days: 30 },
];
const DAYS = [
  ["segunda", "Segunda"],
  ["terca", "Ter\u00e7a"],
  ["quarta", "Quarta"],
  ["quinta", "Quinta"],
  ["sexta", "Sexta"],
  ["sabado", "S\u00e1bado"],
  ["domingo", "Domingo"],
];
const STOP_WORDS = new Set([
  "a", "ao", "aos", "as", "com", "como", "da", "das", "de", "do", "dos", "e", "em", "entre", "na", "nas", "no", "nos", "o", "os", "ou", "para", "por", "se", "sua", "suas", "seu", "seus", "um", "uma",
  "administracao", "administrativo", "administrativa", "conceito", "conceitos", "direito", "estado", "geral", "gerais", "introducao", "aspectos", "nocao", "nocoes", "parte", "principais", "publica", "publico", "teoria", "tipos",
]);
const THEME_GROUPS = [
  ["texto", ["interpretacao", "texto", "tipologia", "genero textual", "coesao", "coerencia", "semantica", "inferencia"]],
  ["gramatica", ["ortografia", "acentuacao", "crase", "pontuacao", "morfologia", "sintaxe", "concordancia", "regencia", "pronome", "verbo"]],
  ["redacao", ["redacao", "redacao oficial", "manual de redacao", "comunicacao oficial", "expediente", "documentos oficiais"]],
  ["principios", ["principio", "principios", "legalidade", "impessoalidade", "moralidade", "publicidade", "eficiencia", "razoabilidade", "proporcionalidade", "contraditorio", "ampla defesa"]],
  ["processo administrativo", ["processo administrativo", "procedimento", "processual", "requisitos", "motivacao", "forma", "objeto", "finalidade", "prazo", "prescricao", "formalizacao"]],
  ["atos administrativos", ["ato administrativo", "atos administrativos", "atributo", "elemento", "merito", "vinculado", "discricionario", "anulacao", "revogacao", "convalidacao"]],
  ["poderes administrativos", ["poder", "poderes", "hierarquico", "disciplinar", "regulamentar", "policia", "abuso de poder"]],
  ["organizacao administrativa", ["organizacao administrativa", "centralizacao", "descentralizacao", "desconcentracao", "administracao direta", "administracao indireta", "autarquia", "fundacao", "empresa publica", "sociedade de economia mista"]],
  ["administracao publica", ["administracao publica", "gestao publica", "modelos", "patrimonialista", "burocratico", "gerencial", "pos-burocratico", "governanca"]],
  ["controle", ["controle", "controle externo", "controle interno", "fiscalizacao", "accountability", "prestacao de contas", "tomada de contas"]],
  ["tribunais de contas", ["tribunal de contas", "tribunais de contas", "tce", "tcu", "conselheiro", "auditor", "ministerio publico de contas"]],
  ["competencia e jurisdicao", ["competencia", "jurisdicao", "atribuicao", "legitimidade", "partes", "interessados"]],
  ["decisoes e recursos", ["decisao", "decisoes", "recurso", "recursos", "pedido de reconsideracao", "embargos", "sancao", "sancoes"]],
  ["provas e julgamento", ["prova", "provas", "instrucao", "julgamento", "sumula", "incidente", "uniformizacao"]],
  ["orcamento e financas", ["orcamento", "receita", "despesa", "financeira", "financas", "lrf", "lei de responsabilidade fiscal", "credito publico"]],
  ["licitacoes e contratos", ["licitacao", "licitacoes", "contrato", "contratos", "pregao", "dispensa", "inexigibilidade", "termo de referencia"]],
  ["constitucional", ["constituicao", "constitucional", "direitos fundamentais", "organizacao do estado", "poder legislativo", "poder executivo", "poder judiciario"]],
  ["etica", ["etica", "codigo de etica", "conduta", "integridade", "probidade"]],
  ["informatica", ["informatica", "software", "hardware", "internet", "seguranca da informacao", "planilha", "editor de texto"]],
];

const state = {
  rows: [],
  currentPlanId: "",
  plans: [],
  confirmed: false,
  originalHistory: JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"),
  planningBase: null,
  distribution: [],
  generatedBlocks: [],
  completedHistory: [],
  cycleHistory: [],
  cycleResults: [],
  reviews: [],
  errors: [],
  notebook: {},
  locked: false,
};

let notebookSelection = { materia: "", assunto: "" };
let notebookSavedRange = null;
let notebookHistory = [];
let isUndoingNotebook = false;

let isRestoring = false;
let saveTimer = 0;
let dataFileSaveTimer = 0;
let dataFileHandle = null;
let isWritingDataFile = false;
let priorityEditIndex = -1;
let performanceEditIndex = -1;
let unitDetailIndex = -1;
let recentTopicFeedback = null;
let showPendingOnly = false;
let continueSuggestionOffset = 0;
let animatedMetricPanels = new Set();
let goalTimerInterval = null;

const DATA_FILE_DB = "meuCronogramaFileHandles";
const DATA_FILE_STORE = "handles";
const DATA_FILE_KEY = "driveDataFile";

const els = {
  tabs: document.querySelectorAll("[data-tab-target]"),
  panels: document.querySelectorAll(".tab-panel"),
  confirmationStatus: document.querySelector("#confirmationStatus"),
  themeToggleButton: document.querySelector("#themeToggleButton"),
  settingsToggleButton: document.querySelector("#settingsToggleButton"),
  settingsMenu: document.querySelector("#settingsMenu"),
  planSelect: document.querySelector("#planSelect"),
  newPlanButton: document.querySelector("#newPlanButton"),
  planMenuButton: document.querySelector("#planMenuButton"),
  planMenu: document.querySelector("#planMenu"),
  deletePlanModal: document.querySelector("#deletePlanModal"),
  deletePlanQuestion: document.querySelector("#deletePlanQuestion"),
  cancelDeletePlanButton: document.querySelector("#cancelDeletePlanButton"),
  cancelDeletePlanBackdrop: document.querySelector("#cancelDeletePlanBackdrop"),
  confirmDeletePlanButton: document.querySelector("#confirmDeletePlanButton"),
  contestName: document.querySelector("#contestName"),
  examBoard: document.querySelector("#examBoard"),
  jobRole: document.querySelector("#jobRole"),
  examDate: document.querySelector("#examDate"),
  planStartDate: document.querySelector("#planStartDate"),
  weeklyHours: document.querySelector("#weeklyHours"),
  blockDuration: document.querySelector("#blockDuration"),
  blockEstimate: document.querySelector("#blockEstimate"),
  contestSummary: document.querySelector("#contestSummary"),
  contestAutoSummary: document.querySelector("#contestAutoSummary"),
  saveContestButton: document.querySelector("#saveContestButton"),
  goContentButton: document.querySelector("#goContentButton"),
  programText: document.querySelector("#programText"),
  fileInput: document.querySelector("#fileInput"),
  assistedFileInput: document.querySelector("#assistedFileInput"),
  fileName: document.querySelector("#fileName"),
  assistedImportButton: document.querySelector("#assistedImportButton"),
  processButton: document.querySelector("#processButton"),
  clearButton: document.querySelector("#clearButton"),
  contentSummary: document.querySelector("#contentSummary"),
  historySelect: document.querySelector("#historySelect"),
  topicsBody: document.querySelector("#topicsBody"),
  emptyState: document.querySelector("#emptyState"),
  rowTemplate: document.querySelector("#rowTemplate"),
  selectAll: document.querySelector("#selectAll"),
  selectAllTopicsButton: document.querySelector("#selectAllTopicsButton"),
  organizeThemesButton: document.querySelector("#organizeThemesButton"),
  addRowButton: document.querySelector("#addRowButton"),
  splitButton: document.querySelector("#splitButton"),
  deleteButton: document.querySelector("#deleteButton"),
  confirmButton: document.querySelector("#confirmButton"),
  backToContestButton: document.querySelector("#backToContestButton"),
  saveContentButton: document.querySelector("#saveContentButton"),
  planningGrid: document.querySelector("#planningGrid"),
  prioritySummary: document.querySelector("#prioritySummary"),
  downloadButton: document.querySelector("#downloadButton"),
  backToContentFromPriorityButton: document.querySelector("#backToContentFromPriorityButton"),
  referenceWeek: document.querySelector("#referenceWeek"),
  registeredWeeklyHours: document.querySelector("#registeredWeeklyHours"),
  registeredBlockDuration: document.querySelector("#registeredBlockDuration"),
  overrideWeeklyHours: document.querySelector("#overrideWeeklyHours"),
  overrideCycleToggle: document.querySelector("#overrideCycleToggle"),
  overrideWeeklyField: document.querySelector("#overrideWeeklyField"),
  allowResidualBlock: document.querySelector("#allowResidualBlock"),
  cycleLabel: document.querySelector("#cycleLabel"),
  dailyHoursGrid: document.querySelector("#dailyHoursGrid"),
  generationSummary: document.querySelector("#generationSummary"),
  generationDeadline: document.querySelector("#generationDeadline"),
  generateScheduleButton: document.querySelector("#generateScheduleButton"),
  saveCycleAdjustmentsButton: document.querySelector("#saveCycleAdjustmentsButton"),
  scheduleStatus: document.querySelector("#scheduleStatus"),
  continuePanel: document.querySelector("#continuePanel"),
  pendingOnlyToggle: document.querySelector("#pendingOnlyToggle"),
  summaryGrid: document.querySelector("#summaryGrid"),
  scheduleWrap: document.querySelector("#scheduleWrap"),
  cycleClosurePanel: document.querySelector("#cycleClosurePanel"),
  scheduleActions: document.querySelector("#scheduleActions"),
  backToGenerateFromScheduleButton: document.querySelector("#backToGenerateFromScheduleButton"),
  saveTrackingButton: document.querySelector("#saveTrackingButton"),
  finishCycleButton: document.querySelector("#finishCycleButton"),
  weeklyResultGrid: document.querySelector("#weeklyResultGrid"),
  weeklySubjectBody: document.querySelector("#weeklySubjectBody"),
  reviewFilter: document.querySelector("#reviewFilter"),
  completedBody: document.querySelector("#completedBody"),
  reviewsBody: document.querySelector("#reviewsBody"),
  notebookSubjects: document.querySelector("#notebookSubjects"),
  notebookThemes: document.querySelector("#notebookThemes"),
  notebookText: document.querySelector("#notebookText"),
  notebookEditorHeader: document.querySelector("#notebookEditorHeader"),
  notebookStatus: document.querySelector("#notebookStatus"),
  evolutionGrid: document.querySelector("#evolutionGrid"),
  evolutionEmpty: document.querySelector("#evolutionEmpty"),
  evolutionSections: document.querySelector("#evolutionSections"),
  evolutionCycleBody: document.querySelector("#evolutionCycleBody"),
  evolutionSubjectBody: document.querySelector("#evolutionSubjectBody"),
  evolutionSubjectChart: document.querySelector("#evolutionSubjectChart"),
  attentionSubjects: document.querySelector("#attentionSubjects"),
  evolutionCompletedBody: document.querySelector("#evolutionCompletedBody"),
  saveNowButton: document.querySelector("#saveNowButton"),
  restoreCycleButton: document.querySelector("#restoreCycleButton"),
  resetCyclesButton: document.querySelector("#resetCyclesButton"),
  connectDataFileButton: document.querySelector("#connectDataFileButton"),
  createDataFileButton: document.querySelector("#createDataFileButton"),
  loadDataFileButton: document.querySelector("#loadDataFileButton"),
  saveDataFileButton: document.querySelector("#saveDataFileButton"),
  exportBackupButton: document.querySelector("#exportBackupButton"),
  backupNowButton: document.querySelector("#backupNowButton"),
  backupReminderStatus: document.querySelector("#backupReminderStatus"),
  backupReminderNotice: document.querySelector("#backupReminderNotice"),
  importBackupInput: document.querySelector("#importBackupInput"),
  saveStatus: document.querySelector("#saveStatus"),
};

function normalizeForMatch(value) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function cleanText(value) {
  return value.replace(/\u00a0/g, " ").replace(/[ \t]+/g, " ").replace(/[ \t]+\r?\n/g, "\n").trim();
}

function stripEnumerator(value) {
  return value
    .replace(/^\s*(?:\d+(?:\.\d+)*|[IVXLCDM]+|[A-Z])[\).\-\s]+/i, "")
    .replace(/^\s*[-\u2022*]\s+/, "")
    .trim();
}

function normalizeTopic(value) {
  return value.trim().replace(/\s*[.;]$/, "");
}

function parseThemeLine(value) {
  const clean = normalizeTopic(String(value || "").replace(/\s+/g, " "));
  const match = clean.match(/^Tema\s*\d*\s*(?:[-\u2013\u2014.:)]\s*)?(.+)$/i);
  if (!match) return null;
  const body = match[1].trim();
  const colonIndex = body.indexOf(":");
  if (colonIndex > 0) {
    const title = body.slice(0, colonIndex).trim();
    const details = body.slice(colonIndex + 1).trim();
    return details ? `${title}: ${details}` : title;
  }
  return body;
}

function parseNumberedLine(value) {
  const clean = String(value || "")
    .replace(/\s+/g, " ")
    .replace(/\s+([:;,.])/g, "$1")
    .trim();
  const match = clean.match(/^(\d+(?:\.\d+)*)(?:[.)])?\s+(.+)$/);
  if (!match) return null;
  const marker = match[1].replace(/\.$/, "");
  const body = normalizeTopic(match[2] || "");
  if (!body) return null;
  const parts = marker.split(".").filter(Boolean);
  return {
    marker,
    root: parts[0],
    level: parts.length,
    body,
  };
}

function hasHierarchicalNumbering(lines) {
  let topLevel = 0;
  let subLevel = 0;
  lines.forEach((line) => {
    const numbered = parseNumberedLine(line);
    if (!numbered) return;
    if (numbered.level === 1) topLevel += 1;
    if (numbered.level > 1) subLevel += 1;
  });
  return subLevel > 0 || topLevel > 1;
}

function hierarchicalTopics(lines) {
  const groups = [];
  const byRoot = new Map();
  let lastGroup = null;

  const ensureGroup = (root, titleFromLevel1) => {
    if (byRoot.has(root)) {
      const existing = byRoot.get(root);
      if (titleFromLevel1 && !existing.titleExplicit) {
        existing.title = titleFromLevel1;
        existing.titleExplicit = true;
      }
      return existing;
    }
    const group = {
      root,
      title: titleFromLevel1 || null,
      titleExplicit: Boolean(titleFromLevel1),
      details: [],
    };
    byRoot.set(root, group);
    groups.push(group);
    return group;
  };

  lines.forEach((line) => {
    const numbered = parseNumberedLine(line);
    if (numbered) {
      if (numbered.level === 1) {
        lastGroup = ensureGroup(numbered.root, numbered.body);
      } else {
        const group = ensureGroup(numbered.root, null);
        group.details.push(numbered.body);
        lastGroup = group;
      }
      return;
    }

    const clean = tidyProgramLine(line);
    if (!clean) return;
    if (lastGroup) {
      lastGroup.details.push(clean);
      return;
    }
    const freeGroup = ensureGroup(`__free_${groups.length}`, clean);
    freeGroup.titleExplicit = true;
    lastGroup = freeGroup;
  });

  return groups.map((group) => {
    const details = group.details.map(normalizeTopic).filter(Boolean);
    let title = group.title;
    let rest = details;
    if (!title) {
      if (group.root.startsWith("__free_")) {
        if (details.length) {
          title = details[0];
          rest = details.slice(1);
        } else {
          return null;
        }
      } else if (details.length) {
        title = `Tema ${group.root}`;
        rest = details;
      } else {
        return null;
      }
    }
    return rest.length ? `${title}: ${rest.join("; ")}` : title;
  }).filter(Boolean);
}

function sentenceAwareParts(text) {
  return cleanText(text)
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((item) => normalizeTopic(stripEnumerator(item)))
    .filter(Boolean);
}

function splitTopics(text) {
  if (text.includes("\n")) {
    return text.split(/\n+/).map((item) => parseThemeLine(item) || normalizeTopic(stripEnumerator(item))).filter(Boolean);
  }
  const themeLine = parseThemeLine(text);
  if (themeLine) return [themeLine];
  return sentenceAwareParts(text).flatMap((sentence) => {
    const parsedTheme = parseThemeLine(sentence);
    if (parsedTheme) return [parsedTheme];
    if (sentence.includes(":")) return [sentence];
    return sentence.split(/\s*;\s*|\n+/).map((item) => normalizeTopic(stripEnumerator(item))).filter(Boolean);
  });
}

function wordCount(value) {
  return normalizeForMatch(value).split(/\s+/).filter(Boolean).length;
}

function topicAtoms(value) {
  return String(value || "")
    .split(/\s*;\s*|\s*,\s*/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function themeTitle(value) {
  const text = normalizeTopic(String(value || ""));
  const colonIndex = text.indexOf(":");
  if (colonIndex > 4 && colonIndex < 90) return text.slice(0, colonIndex).trim();
  const words = text.split(/\s+/).filter(Boolean);
  return words.length > 11 ? `${words.slice(0, 11).join(" ")}...` : text;
}

function themeDetails(value) {
  const text = normalizeTopic(String(value || ""));
  const colonIndex = text.indexOf(":");
  return colonIndex > 4 && colonIndex < 90 ? text.slice(colonIndex + 1).trim() : text;
}

function estimateThemeSize(value) {
  const words = wordCount(value);
  const atoms = topicAtoms(value).length;
  if (words > 52 || atoms > 7) return "Longo";
  if (words > 24 || atoms > 3) return "M\u00e9dio";
  return "Curto";
}

function estimateThemeBlocks(value) {
  const size = estimateThemeSize(value);
  if (size === "Longo") return 2;
  return 1;
}

function estimateThemeDifficulty(value) {
  const normalized = normalizeForMatch(value);
  const hardTerms = ["jurisprudencia", "competencia", "orcamento", "execucao", "equivalencia", "probabilidade", "contabilidade", "constitucional", "controle externo"];
  if (estimateThemeSize(value) === "Longo" || hardTerms.some((term) => normalized.includes(term))) return "Alta";
  if (wordCount(value) < 14) return "Baixa";
  return "M\u00e9dia";
}

function enrichThemeRow(row) {
  const resumoTema = row.resumoTema && typeof row.resumoTema === "object" ? row.resumoTema : {};
  return {
    ...row,
    estudar: row.estudar || "Sim",
    resumoTema: {
      focoPrincipal: resumoTema.focoPrincipal || "",
      pontosAtencao: resumoTema.pontosAtencao || "",
      checklistRevisao: resumoTema.checklistRevisao || "",
      sugestaoPratica: resumoTema.sugestaoPratica || "",
    },
    tamanhoEstimado: row.tamanhoEstimado || estimateThemeSize(row.assunto),
    blocosSugeridos: Number(row.blocosSugeridos) || estimateThemeBlocks(row.assunto),
    dificuldadeEstimada: row.dificuldadeEstimada || estimateThemeDifficulty(row.assunto),
  };
}

function canonicalToken(token) {
  let clean = normalizeForMatch(token).replace(/[^a-z0-9]/g, "");
  if (clean.length > 5 && clean.endsWith("oes")) clean = `${clean.slice(0, -3)}ao`;
  if (clean.length > 4 && clean.endsWith("s")) clean = clean.slice(0, -1);
  return clean;
}

function meaningfulTokens(value) {
  return normalizeForMatch(value)
    .split(/[^a-z0-9]+/i)
    .map(canonicalToken)
    .filter((token) => token.length > 3 && !STOP_WORDS.has(token));
}

function themeForTopic(topic) {
  const normalized = normalizeForMatch(topic);
  let bestTheme = "";
  let bestScore = 0;
  THEME_GROUPS.forEach(([theme, terms]) => {
    const score = terms.reduce((sum, term) => {
      const cleanTerm = normalizeForMatch(term);
      return normalized.includes(cleanTerm) ? sum + cleanTerm.split(/\s+/).length : sum;
    }, 0);
    if (score > bestScore) {
      bestTheme = theme;
      bestScore = score;
    }
  });
  return bestTheme;
}

function topicProfile(topic) {
  return {
    text: normalizeTopic(topic),
    theme: themeForTopic(topic),
    tokens: meaningfulTokens(topic),
    index: 0,
  };
}

function sharesThemeOrToken(profile, cluster) {
  if (profile.theme && cluster.theme && profile.theme === cluster.theme) return true;
  const clusterTokens = new Set(cluster.tokens);
  const overlap = profile.tokens.filter((token) => clusterTokens.has(token));
  return overlap.length >= 2;
}

function chunkProfiles(profiles, maxAtoms, maxWords) {
  const chunks = [];
  let current = [];
  let currentWords = 0;

  profiles.forEach((profile) => {
    if (profile.text.includes(":")) {
      if (current.length) {
        chunks.push(current.map((item) => item.text).join("; "));
        current = [];
        currentWords = 0;
      }
      chunks.push(profile.text);
      return;
    }
    const nextWords = wordCount(profile.text);
    const shouldBreak = current.length && (current.length >= maxAtoms || currentWords + nextWords > maxWords);
    if (shouldBreak) {
      chunks.push(current.map((item) => item.text).join("; "));
      current = [];
      currentWords = 0;
    }
    current.push(profile);
    currentWords += nextWords;
  });

  if (current.length) chunks.push(current.map((item) => item.text).join("; "));
  return chunks;
}

function chunkSequentialTopics(topics, options = {}) {
  const maxAtoms = options.maxAtoms || 6;
  const maxWords = options.maxWords || 42;
  const profiles = topics.flatMap(splitLongTopic).map(topicProfile).filter((profile) => profile.text);
  return chunkProfiles(profiles, maxAtoms, maxWords);
}

function groupTopicsByTheme(topics, analysis, options = {}) {
  const policy = topicChunkPolicy(analysis);
  if (options.preserveOrder) {
    return chunkSequentialTopics(topics, options);
  }
  const maxAtoms = options.maxAtoms || Math.max(2, policy.maxAtoms + 1);
  const maxWords = options.maxWords || Math.max(20, policy.maxWords + 6);
  const profiles = topics
    .flatMap(splitLongTopic)
    .map(topicProfile)
    .filter((profile) => profile.text)
    .map((profile, index) => ({ ...profile, index }));
  if (!profiles.length) return [];

  const clusters = [];
  profiles.forEach((profile) => {
    const cluster = clusters.find((item) => sharesThemeOrToken(profile, item));
    if (cluster) {
      cluster.items.push(profile);
      cluster.tokens.push(...profile.tokens);
      if (!cluster.theme && profile.theme) cluster.theme = profile.theme;
      return;
    }
    clusters.push({ theme: profile.theme, tokens: [...profile.tokens], items: [profile] });
  });

  return clusters
    .sort((a, b) => Math.min(...a.items.map((item) => item.index)) - Math.min(...b.items.map((item) => item.index)))
    .flatMap((cluster) => chunkProfiles(cluster.items.sort((a, b) => a.index - b.index), maxAtoms, maxWords));
}

function splitLongTopic(topic) {
  const cleaned = normalizeTopic(topic);
  if (!cleaned) return [];
  if (cleaned.includes(":")) return [cleaned];

  const sentenceParts = cleaned
    .split(/(?<=[.!?])\s+(?=[A-Z\u00c0-\u00dc])/)
    .map(normalizeTopic)
    .filter(Boolean);
  const primaryParts = sentenceParts.length > 1 ? sentenceParts : [cleaned];

  return primaryParts.flatMap((part) => {
    if (wordCount(part) <= 18) return [part];

    const colonIndex = part.indexOf(":");
    const prefix = colonIndex > 0 && colonIndex < 70 ? part.slice(0, colonIndex + 1).trim() : "";
    const rest = prefix ? part.slice(colonIndex + 1).trim() : part;
    const commaParts = rest.split(/\s*,\s+/).map(normalizeTopic).filter(Boolean);
    if (commaParts.length < 2) return [part];

    const chunks = [];
    let current = "";
    commaParts.forEach((piece) => {
      const candidate = current ? `${current}, ${piece}` : piece;
      if (wordCount(candidate) > 14 && current) {
        chunks.push(prefix ? `${prefix} ${current}` : current);
        current = piece;
      } else {
        current = candidate;
      }
    });
    if (current) chunks.push(prefix ? `${prefix} ${current}` : current);
    return chunks;
  });
}

function topicChunkPolicy(analysis) {
  if (analysis.status === "comfortable") return { maxAtoms: 2, maxWords: 20 };
  if (analysis.status === "tight") return { maxAtoms: 3, maxWords: 24 };
  return { maxAtoms: 3, maxWords: 28 };
}

function buildStudyUnits(topics, analysis) {
  const units = groupTopicsByTheme(topics, analysis);
  return units.length ? units : ["Selecionar tema"];
}

function topicKey(materia, assunto) {
  return `${normalizeForMatch(String(materia || ""))}::${normalizeForMatch(String(assunto || ""))}`;
}

function completedUnitKeys() {
  const keys = new Set();
  state.completedHistory.forEach((item) => keys.add(topicKey(item.materia, item.assunto)));
  state.generatedBlocks
    .filter((block) => normalizeStatus(block.status) === "Conclu\u00eddo")
    .forEach((block) => keys.add(topicKey(block.materia, block.assunto)));
  return keys;
}

function availableStudyUnits(item, analysis) {
  const units = item.assuntos?.length ? item.assuntos : buildStudyUnits(item.assuntos || [], analysis);
  const completed = completedUnitKeys();
  const reviewUnits = reviewAttentionUnitsForSubject(item.materia);
  const pending = units.filter((unit) => !completed.has(topicKey(item.materia, unit)));
  const merged = [...reviewUnits, ...pending].filter((unit, index, list) => list.findIndex((candidate) => topicKey(item.materia, candidate) === topicKey(item.materia, unit)) === index);
  return merged.length ? merged : ["Revis\u00e3o geral e quest\u00f5es da mat\u00e9ria"];
}

function reviewAttentionUnitsForSubject(materia = "") {
  ensureReviewsArray();
  return state.reviews
    .filter((record) => !["Concluída", "Cancelada"].includes(record.status) && normalizeForMatch(record.materia || "") === normalizeForMatch(materia))
    .map((record) => ({ ...record, statusInfo: reviewStatusInfo(record) }))
    .filter((record) => record.statusInfo.group === "overdue" || record.statusInfo.group === "today")
    .sort((a, b) => a.statusInfo.remaining - b.statusInfo.remaining)
    .map((record) => record.assunto)
    .filter(Boolean);
}

function uppercaseRatio(value) {
  const letters = value.replace(/[^A-Za-z\u00c0-\u00ff]/g, "");
  if (!letters) return 0;
  const uppercase = letters.replace(/[^A-Z\u00c0-\u00de]/g, "");
  return uppercase.length / letters.length;
}

function isExplicitSubjectText(value) {
  const clean = stripEnumerator(value).replace(/[:;.]$/, "").trim();
  if (!clean || clean.includes(";")) return false;
  const words = clean.split(/\s+/).filter(Boolean);
  return words.length <= 14 && uppercaseRatio(clean) > 0.72;
}

function isIgnoredProgramModule(line) {
  const normalized = normalizeForMatch(stripEnumerator(line).replace(/[:;.]$/, "").trim());
  return /^(modulo|modulo\s+[ivxlcdm]+|conhecimentos gerais|conhecimentos especificos|conhecimentos basicos|prova objetiva|conteudo programatico|programa|anexo|parte\s+[ivxlcdm]+|grupo\s+\d+)$/i.test(normalized);
}

function looksLikeSubjectLine(line) {
  const clean = stripEnumerator(line).replace(/[:;.]$/, "").trim();
  if (!clean || clean.includes(";") || clean.includes(":")) return false;
  if (isIgnoredProgramModule(clean)) return false;
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length > 14) return false;

  const normalized = normalizeForMatch(clean);
  const knownSubject =
    /\b(portugues|lingua portuguesa|direito|administracao|constitucional|administrativo|controle externo|contabilidade|matematica|raciocinio|informatica|tecnologia|tecnologia da informacao|legislacao|etica|auditoria|orcamento|financas|economia|estatistica|governanca|licitacoes|contratos|discursiva|recursos|logistica)\b/.test(normalized);

  return knownSubject || isExplicitSubjectText(clean);
}

function splitInlineSubject(line) {
  const clean = stripEnumerator(line).trim();
  const colonIndex = clean.indexOf(":");
  if (colonIndex < 3 || colonIndex > 55) return null;

  const subject = clean.slice(0, colonIndex).replace(/[:;.]$/, "").trim();
  const topic = clean.slice(colonIndex + 1).trim();
  if (!subject || !topic) return null;
  if (subject.split(/\s+/).length > 8) return null;
  return { subject, topic };
}

function tidyProgramLine(value) {
  const raw = String(value || "")
    .replace(/\s+/g, " ")
    .trim();
  if (parseNumberedLine(raw)) return raw;
  const cleaned = stripEnumerator(raw)
    .replace(/\s+([:;,.])/g, "$1")
    .replace(/([:;,.])(?=\S)/g, "$1 ")
    .trim();
  return parseThemeLine(cleaned) || cleaned;
}

function formatImportedProgramText(rawText) {
  const lines = cleanText(rawText)
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map(tidyProgramLine)
    .filter(Boolean);
  if (!lines.length) return "";

  const sections = [];
  let currentSubject = "";
  let topicBuffer = [];

  const flushSection = () => {
    if (!currentSubject && !topicBuffer.length) return;
    const subject = (currentSubject || "Conte\u00fado program\u00e1tico").replace(/[:;.]$/, "").trim();
    const groupedTopics = hasHierarchicalNumbering(topicBuffer)
      ? topicBuffer.map(tidyProgramLine).filter(Boolean)
      : chunkSequentialTopics(topicBuffer, { maxAtoms: 6, maxWords: 44 });
    sections.push([
      subject.toLocaleUpperCase("pt-BR"),
      ...groupedTopics,
    ].filter(Boolean).join("\n"));
    topicBuffer = [];
  };

  lines.forEach((line) => {
    const numbered = parseNumberedLine(line);
    if (isIgnoredProgramModule(line)) return;

    const inline = splitInlineSubject(line);
    if (inline && isExplicitSubjectText(inline.subject)) {
      flushSection();
      currentSubject = inline.subject;
      topicBuffer.push(inline.topic);
      return;
    }

    if (!currentSubject && inline) {
      currentSubject = inline.subject;
      topicBuffer.push(inline.topic);
      return;
    }

    if (!numbered && looksLikeSubjectLine(line)) {
      flushSection();
      currentSubject = line.replace(/[:;.]$/, "").trim();
      return;
    }

    if (!currentSubject && inline) {
      currentSubject = inline.subject;
      topicBuffer.push(inline.topic);
      return;
    }

    topicBuffer.push(line);
  });

  flushSection();
  return sections.join("\n\n");
}

function parseProgramContent(rawText) {
  const normalized = cleanText(rawText).replace(/\r\n/g, "\n");
  if (!normalized) return [];

  const lines = normalized.split("\n").map((line) => line.trim()).filter(Boolean);
  const rows = [];
  let currentSubject = "";
  let topicBuffer = [];

  const flushTopics = () => {
    if (!currentSubject || !topicBuffer.length) return;
    const topics = hasHierarchicalNumbering(topicBuffer) ? hierarchicalTopics(topicBuffer) : splitTopics(topicBuffer.join("\n"));
    const start = rows.filter((row) => row.materia === currentSubject).length;
    topics.forEach((assunto, index) => {
      rows.push(enrichThemeRow({ materia: currentSubject, assunto, ordem: start + index + 1, estudar: "Sim", observacoes: "" }));
    });
    topicBuffer = [];
  };

  lines.forEach((line) => {
    const numbered = parseNumberedLine(line);
    const clean = numbered ? line : stripEnumerator(line);
    if (!clean) return;
    if (isIgnoredProgramModule(clean)) return;

    const inline = splitInlineSubject(clean);
    if (inline && isExplicitSubjectText(inline.subject)) {
      flushTopics();
      currentSubject = inline.subject;
      topicBuffer.push(inline.topic);
      return;
    }

    if (!currentSubject && inline) {
      currentSubject = inline.subject;
      topicBuffer.push(inline.topic);
      return;
    }

    if (!numbered && looksLikeSubjectLine(clean)) {
      flushTopics();
      currentSubject = clean.replace(/[:;.]$/, "").trim();
      return;
    }

    if (!currentSubject && inline) {
      currentSubject = inline.subject;
      topicBuffer.push(inline.topic);
      return;
    }

    if (!currentSubject) {
      currentSubject = "Conte\u00fado program\u00e1tico";
    }
    topicBuffer.push(clean);
  });

  flushTopics();

  if (!rows.length && currentSubject) {
    rows.push(enrichThemeRow({ materia: currentSubject, assunto: "", ordem: 1, estudar: "Sim", observacoes: "Inclua os assuntos desta mat\u00e9ria." }));
  }

  return rows;
}

function prefersReducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
}

function updateSidebarActiveIndicator(activeButton = document.querySelector(".tab-button.active")) {
  const nav = document.querySelector(".sidebar-flow");
  if (!nav || !activeButton) return;
  const navRect = nav.getBoundingClientRect();
  const buttonRect = activeButton.getBoundingClientRect();
  nav.style.setProperty("--active-indicator-y", `${buttonRect.top - navRect.top + nav.scrollTop}px`);
  nav.style.setProperty("--active-indicator-height", `${buttonRect.height}px`);
  nav.classList.add("has-active-indicator");
}

function animatePanelNumbers(tabName) {
  if (prefersReducedMotion() || animatedMetricPanels.has(tabName)) return;
  const panel = document.querySelector(`#tab-${tabName}`);
  if (!panel) return;
  animatedMetricPanels.add(tabName);
  const numberEls = [...panel.querySelectorAll(".summary-grid strong, .priority-summary strong, .continue-progress strong")];
  numberEls.forEach((node) => {
    const original = node.textContent.trim();
    const match = original.match(/^(\d+)(%)?$/);
    if (!match) return;
    const target = Number(match[1]);
    const suffix = match[2] || "";
    const startedAt = performance.now();
    const duration = 520;
    const step = (now) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      node.textContent = `${Math.round(target * eased)}${suffix}`;
      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        node.textContent = original;
      }
    };
    requestAnimationFrame(step);
  });
}

function activateTab(tabName, activeButton = null) {
  const firstMatch = document.querySelector(`[data-tab-target="${tabName}"]`);
  els.tabs.forEach((button) => {
    const isActive = activeButton ? button === activeButton : button === firstMatch;
    button.classList.toggle("active", isActive);
  });
  els.panels.forEach((panel) => panel.classList.toggle("active", panel.id === `tab-${tabName}`));
  if (tabName === "erros") renderErrors();
  if (tabName === "continuar") renderContinuePanel();
  requestAnimationFrame(() => {
    updateSidebarActiveIndicator(document.querySelector(`[data-tab-target="${tabName}"]`));
    animatePanelNumbers(tabName);
  });
}

function switchTab(tabName, activeButton = null) {
  const run = () => activateTab(tabName, activeButton);
  if (!prefersReducedMotion() && document.startViewTransition) {
    document.startViewTransition(run);
    return;
  }
  run();
}

function setTabEnabled(tabName, enabled) {
  const button = document.querySelector(`[data-tab-target="${tabName}"]`);
  if (!button) return;
  button.disabled = !enabled;
  button.classList.toggle("locked", !enabled);
}

function applyThemePreference(theme = localStorage.getItem(APP_THEME_KEY) || "day") {
  const selected = theme === "night" ? "night" : "day";
  document.documentElement.dataset.theme = selected;
  localStorage.setItem(APP_THEME_KEY, selected);
  if (!els.themeToggleButton) return;
  const isNight = selected === "night";
  els.themeToggleButton.setAttribute("aria-label", isNight ? "Usar modo dia" : "Usar modo noite");
  els.themeToggleButton.innerHTML = `<i data-lucide="${isNight ? "sun" : "moon"}"></i>`;
  if (window.lucide) window.lucide.createIcons();
}

function closeSettingsMenu() {
  if (!els.settingsMenu) return;
  els.settingsMenu.hidden = true;
  els.settingsToggleButton?.setAttribute("aria-expanded", "false");
}

function toggleSettingsMenu() {
  if (!els.settingsMenu) return;
  const nextOpen = els.settingsMenu.hidden;
  els.settingsMenu.hidden = !nextOpen;
  els.settingsToggleButton?.setAttribute("aria-expanded", nextOpen ? "true" : "false");
}

function rowFromInputs(container) {
  const row = {};
  container.querySelectorAll("[data-field]").forEach((input) => {
    row[input.dataset.field] = input.type === "checkbox" ? (input.checked ? "Sim" : "Nao") : input.value.trim();
  });
  const resumoTema = {};
  container.querySelectorAll("[data-summary-field]").forEach((input) => {
    resumoTema[input.dataset.summaryField] = input.value.trim();
  });
  if (Object.keys(resumoTema).length) row.resumoTema = resumoTema;
  const themeName = container.querySelector("[data-theme-title]")?.value.trim();
  const themeSubjects = container.querySelector("[data-theme-details]")?.value.trim();
  if (themeName || themeSubjects) {
    row.assunto = themeName && themeSubjects ? `${themeName}: ${themeSubjects}` : themeName || themeSubjects;
  }
  row.ordem = Number(row.ordem) || 0;
  row.blocosSugeridos = Number(row.blocosSugeridos) || estimateThemeBlocks(row.assunto);
  const origin = container.dataset.editalOrigin;
  if (origin) {
    try {
      row.origemEdital = JSON.parse(decodeURIComponent(origin));
    } catch {
      row.origemEdital = null;
    }
  }
  return enrichThemeRow(row);
}

function syncRowsFromTable() {
  const items = [...els.topicsBody.querySelectorAll(".topic-item")];
  state.rows = (items.length ? items : [...els.topicsBody.querySelectorAll("tr")]).map(rowFromInputs);
}

function subjectGroups(rows = state.rows) {
  const groups = new Map();
  rows.forEach((row) => {
    const materia = row.materia || "Sem mat\u00e9ria";
    const key = normalizeForMatch(materia);
    if (!groups.has(key)) groups.set(key, { materia, rows: [] });
    groups.get(key).rows.push(row);
  });
  return [...groups.values()];
}

function renderContentSummary() {
  if (!els.contentSummary) return;
  const total = state.rows.filter((row) => row.assunto).length;
  const includedSubjects = state.rows.reduce((sum, row) => sum + topicAtoms(themeDetails(row.assunto)).length, 0);
  const study = state.rows.filter((row) => row.assunto && row.estudar !== "Nao").length;
  const ignored = state.rows.filter((row) => row.assunto && row.estudar === "Nao").length;
  els.contentSummary.innerHTML = state.rows.length ? summaryItems([
    ["Mat\u00e9rias encontradas", subjectGroups().length],
    ["Temas criados", total],
    ["Assuntos inclu\u00eddos", includedSubjects],
    ["Temas ignorados", ignored],
  ]) : "";
}

function updateSubjectStudyCounts() {
  els.topicsBody.querySelectorAll(".subject-group").forEach((group) => {
    const total = group.querySelectorAll(".topic-item").length;
    const checked = group.querySelectorAll(".topic-item .row-check:checked").length;
    const counter = group.querySelector(".subject-study-count");
    if (counter) counter.textContent = `${total} tema${total === 1 ? "" : "s"} \u00b7 ${checked} para estudo`;
  });
  updateSelectAllControl();
}

function allTopicsSelected() {
  const checks = [...els.topicsBody.querySelectorAll(".row-check")];
  return checks.length > 0 && checks.every((checkbox) => checkbox.checked);
}

function setAllTopicChecks(checked) {
  els.topicsBody.querySelectorAll(".row-check").forEach((checkbox) => {
    checkbox.checked = checked;
  });
  if (els.selectAll) els.selectAll.checked = checked;
}

function updateSelectAllControl() {
  if (!els.selectAllTopicsButton) return;
  const total = els.topicsBody.querySelectorAll(".row-check").length;
  const allSelected = allTopicsSelected();
  els.selectAllTopicsButton.classList.toggle("is-active", allSelected);
  els.selectAllTopicsButton.disabled = total === 0;
  els.selectAllTopicsButton.setAttribute("aria-pressed", allSelected ? "true" : "false");
  els.selectAllTopicsButton.innerHTML = allSelected
    ? `<i data-lucide="check-square"></i><span>Tudo selecionado</span>`
    : `<i data-lucide="square"></i><span>Selecionar tudo</span>`;
  if (els.selectAll) els.selectAll.checked = allSelected;
  if (window.lucide) window.lucide.createIcons();
}

function contentFeedbackElement() {
  let feedback = document.querySelector("#contentFeedback");
  if (feedback) return feedback;
  feedback = document.createElement("div");
  feedback.id = "contentFeedback";
  feedback.className = "content-feedback";
  feedback.setAttribute("role", "status");
  feedback.setAttribute("aria-live", "polite");
  const panel = document.querySelector("#tab-conteudo .content-flow-steps");
  panel?.insertAdjacentElement("afterend", feedback);
  return feedback;
}

function notifyContent(message, type = "success") {
  const feedback = contentFeedbackElement();
  if (!feedback) {
    alert(message);
    return;
  }
  feedback.textContent = message;
  feedback.className = `content-feedback ${type}`;
  feedback.hidden = false;
  clearTimeout(notifyContent.timer);
  notifyContent.timer = setTimeout(() => {
    feedback.hidden = true;
  }, 3600);
}

function updateContentFlowSteps() {
  const steps = [...document.querySelectorAll("[data-content-step]")];
  if (!steps.length) return;
  const currentStep = state.confirmed ? 3 : state.rows.length ? 2 : 1;
  steps.forEach((step) => {
    const number = Number(step.dataset.contentStep);
    step.classList.toggle("is-active", number === currentStep);
    step.classList.toggle("is-complete", number < currentStep);
  });
}

function topicSplitSuggestion(row) {
  const details = themeDetails(row.assunto || "");
  const source = details || row.assunto || "";
  const parts = splitTopics(source);
  const suggested = parts.length > 1 ? parts : topicAtoms(source);
  return suggested.length > 1 ? suggested.map((part, index) => `Tema ${index + 1}: ${part}`).join("\n") : source;
}

function splitItemsFromManualValue(value) {
  return String(value || "")
    .split(/\n+/)
    .map((line) => normalizeTopic(parseThemeLine(line) || stripEnumerator(line)))
    .filter(Boolean);
}

function splitPreviewText(value) {
  const count = splitItemsFromManualValue(value).length;
  if (count < 2) return "Separe em pelo menos 2 linhas para criar novos temas.";
  return `${count} temas ser\u00e3o criados ao confirmar a separa\u00e7\u00e3o.`;
}

function rowsFromManualSplit(row, value) {
  return splitItemsFromManualValue(value)
    .map((assunto, index) => enrichThemeRow({
      ...row,
      assunto,
      ordem: (Number(row.ordem) || 1) + index,
      observacoes: index === 0 ? row.observacoes || "" : "",
    }));
}

function selectedTopicItemsForMerge(group) {
  return [...group.querySelectorAll(".topic-item.is-merge-selected")];
}

function updateMergeSelectionState(group) {
  if (!group) return;
  const selected = selectedTopicItemsForMerge(group).length;
  const button = group.querySelector("[data-merge-selected]");
  const hint = group.querySelector("[data-merge-hint]");
  if (button) {
    button.disabled = selected < 2;
    button.textContent = selected >= 2 ? `Juntar ${selected} temas` : "Juntar temas";
  }
  if (hint) {
    hint.textContent = selected
      ? `${selected} selecionado${selected === 1 ? "" : "s"} para jun\u00e7\u00e3o`
      : "Use o menu dos temas para selecionar o que deseja juntar";
  }
}

function topicFeedbackClass(row) {
  const key = topicKey(row.materia, row.assunto);
  if (!recentTopicFeedback?.keys?.includes(key)) return "";
  return ` is-${recentTopicFeedback.type}`;
}

function topicFeedbackBadge(row) {
  const key = topicKey(row.materia, row.assunto);
  if (!recentTopicFeedback?.keys?.includes(key)) return "";
  const label = recentTopicFeedback.type === "split" ? "Criado pela separa\u00e7\u00e3o" : "Tema juntado";
  return `<span class="topic-result-badge">${label}</span>`;
}

function renderRows() {
  els.topicsBody.innerHTML = "";
  subjectGroups().forEach((group, groupIndex) => {
    const subjectRows = group.rows.map(enrichThemeRow);
    const studyCount = subjectRows.filter((row) => row.estudar !== "Nao").length;
    const details = document.createElement("details");
    details.className = "subject-group";
    details.open = true;
    details.dataset.subjectIndex = String(groupIndex);
    details.dataset.subjectName = group.materia;
    details.innerHTML = `
      <summary class="subject-group-header">
        <div>
          <strong>${escapeHtml(group.materia)}</strong>
          <span class="subject-study-count">${subjectRows.length} tema${subjectRows.length === 1 ? "" : "s"} &middot; ${studyCount} para estudo</span>
        </div>
        <div class="subject-group-actions">
          <div class="merge-action-group">
            <button class="ghost-button compact-button" type="button" data-merge-selected disabled>Juntar temas</button>
            <span data-merge-hint>Use o menu dos temas para selecionar o que deseja juntar</span>
          </div>
          <details class="more-actions subject-more">
            <summary aria-label="Mais a\u00e7\u00f5es da mat\u00e9ria"><i data-lucide="more-horizontal"></i></summary>
            <div class="more-menu">
              <button class="more-menu-item" type="button" data-edit-subject="${escapeHtml(group.materia)}">Editar mat\u00e9ria</button>
            </div>
          </details>
          <span class="chevron" aria-hidden="true">âŒ„</span>
        </div>
      </summary>
      <div class="topic-list">
        ${subjectRows.map((row) => {
          const feedbackClass = topicFeedbackClass(row);
          const splitSuggestion = topicSplitSuggestion(row);
          return `
          <article class="topic-item theme-card${feedbackClass}"${row.origemEdital ? ` data-edital-origin="${escapeHtml(encodeURIComponent(JSON.stringify(row.origemEdital)))}"` : ""}>
            <input data-field="materia" type="hidden" value="${escapeHtml(group.materia)}" />
            <label class="topic-study-check" title="Incluir este tema no ciclo">
              <input class="row-check" data-field="estudar" type="checkbox" ${row.estudar === "Nao" ? "" : "checked"} aria-label="Incluir tema no ciclo" />
            </label>
            <input class="topic-order" data-field="ordem" type="number" min="1" value="${Number(row.ordem) || 1}" />
            <div class="theme-card-main">
              ${topicFeedbackBadge(row)}
              <strong class="theme-title-text">${escapeHtml(themeTitle(row.assunto || ""))}</strong>
              <p class="theme-details-text">${escapeHtml(shortText(themeDetails(row.assunto || ""), 180))}</p>
            </div>
            <details class="topic-actions-menu">
              <summary aria-label="A\u00e7\u00f5es do tema">...</summary>
              <div>
                <button class="text-action" type="button" data-toggle-merge-select>Selecionar para juntar</button>
                <button class="text-action" type="button" data-toggle-observation>Editar tema</button>
                <button class="text-action" type="button" data-toggle-topic-summary>Resumo do tema</button>
                <button class="text-action" type="button" data-split-topic>Separar tema</button>
                <button class="text-action danger" type="button" data-delete-topic>Excluir tema</button>
              </div>
            </details>
            <div class="topic-observation theme-edit-panel" hidden>
              <label>Nome do tema
                <input class="topic-title-input theme-name-input" data-theme-title value="${escapeHtml(themeTitle(row.assunto || ""))}" aria-label="Nome do tema" />
              </label>
              <label>Assuntos inclu\u00eddos
                <textarea data-theme-details placeholder="Assuntos inclu\u00eddos neste tema">${escapeHtml(themeDetails(row.assunto || ""))}</textarea>
              </label>
              <label class="theme-notes-field">Observa\u00e7\u00f5es
                <textarea data-field="observacoes" placeholder="Observa\u00e7\u00f5es sobre este tema">${escapeHtml(row.observacoes || "")}</textarea>
              </label>
            </div>
            <div class="topic-summary-panel" hidden>
              <div class="topic-summary-header">
                <strong>Resumo do tema</strong>
                <span>Use estes campos para orientar revis\u00f5es e pr\u00e1tica.</span>
              </div>
              <div class="topic-summary-grid">
                <label>Foco principal
                  <textarea data-summary-field="focoPrincipal" placeholder="Qual \u00e9 a ideia central deste tema?">${escapeHtml(row.resumoTema?.focoPrincipal || "")}</textarea>
                </label>
                <label>Pontos de aten\u00e7\u00e3o
                  <textarea data-summary-field="pontosAtencao" placeholder="Pegadinhas, detalhes ou artigos importantes.">${escapeHtml(row.resumoTema?.pontosAtencao || "")}</textarea>
                </label>
                <label>Checklist de revis\u00e3o
                  <textarea data-summary-field="checklistRevisao" placeholder="Itens para conferir antes de considerar revisado.">${escapeHtml(row.resumoTema?.checklistRevisao || "")}</textarea>
                </label>
                <label>Sugest\u00e3o de pr\u00e1tica
                  <textarea data-summary-field="sugestaoPratica" placeholder="Quest\u00f5es, lei seca, resumo, mapa mental ou reda\u00e7\u00e3o.">${escapeHtml(row.resumoTema?.sugestaoPratica || "")}</textarea>
                </label>
              </div>
            </div>
            <div class="topic-split-panel" hidden>
              <div class="split-panel-header">
                <div>
                  <strong>Separar este tema</strong>
                  <p>Revise a sugest\u00e3o abaixo. Cada linha confirmada vira um novo tema independente.</p>
                </div>
                <span data-split-preview>${escapeHtml(splitPreviewText(splitSuggestion))}</span>
              </div>
              <textarea data-split-input placeholder="Tema 1: Atos administrativos e requisitos&#10;Tema 2: Poderes administrativos e abuso de poder&#10;Tema 3: Responsabilidade civil do Estado">${escapeHtml(splitSuggestion)}</textarea>
              <div class="split-panel-actions">
                <button class="ghost-button compact-button" type="button" data-cancel-split>Cancelar</button>
                <button class="primary-button compact-button" type="button" data-confirm-split>Confirmar separa\u00e7\u00e3o</button>
              </div>
            </div>
          </article>
        `;
        }).join("")}
      </div>
    `;
    els.topicsBody.appendChild(details);
    updateMergeSelectionState(details);
  });
  const hasRows = state.rows.length > 0;
  els.emptyState.hidden = true;
  els.topicsBody.hidden = !hasRows;
  els.topicsBody.closest(".content-organizer-card")?.toggleAttribute("hidden", !hasRows);
  if (!hasRows) els.topicsBody.innerHTML = "";
  updateSelectAllControl();
  renderContentSummary();
  updateContentFlowSteps();
  if (window.lucide) window.lucide.createIcons();
  if (isRestoring) return;
  markUnconfirmed();
}

function clearImportedContent() {
  els.programText.value = "";
  els.fileInput.value = "";
  els.fileName.textContent = "Nenhum arquivo selecionado";
  state.rows = [];
  markUnconfirmed();
  renderRows();
  renderContentSummary();
  notifyContent("Edital importado limpo.");
}

function importedTopicKey(row) {
  return `${normalizeForMatch(row?.materia || "")}::${normalizeForMatch(row?.assunto || "")}`;
}

function applyAssistedImportRows(importedRows, context = {}) {
  const incoming = (importedRows || [])
    .filter((row) => row?.materia && row?.assunto)
    .map((row) => enrichThemeRow({ ...row, estudar: row.estudar || "Sim" }));
  const existing = context.mode === "replace" ? [] : state.rows.map((row) => enrichThemeRow({ ...row }));
  const seen = new Set(existing.map(importedTopicKey));
  const added = incoming.filter((row) => {
    const key = importedTopicKey(row);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  if (!added.length) {
    notifyContent("Nenhum tema novo foi adicionado. Itens iguais já estavam na prévia.", "warning");
    return;
  }

  state.rows = [...existing, ...added].map((row, index) => enrichThemeRow({ ...row, ordem: Number(row.ordem) || index + 1 }));
  els.fileName.textContent = context.fileName ? `${context.fileName} · revisão assistida` : "Edital revisado";
  markUnconfirmed();
  renderRows();
  scheduleAutoSave();
  notifyContent(`${added.length} tema${added.length === 1 ? "" : "s"} importado${added.length === 1 ? "" : "s"} para conferência. Confirme o conteúdo quando terminar a revisão.`);
}

function markUnconfirmed() {
  state.confirmed = false;
  state.planningBase = null;
  state.distribution = [];
  state.generatedBlocks = [];
  els.confirmationStatus.textContent = "Aguardando revis\u00e3o";
  els.confirmationStatus.classList.remove("confirmed");
  ["pesos", "disponibilidade", "cronograma"].forEach((tab) => setTabEnabled(tab, false));
  updateContentFlowSteps();
  renderGeneratedSchedule();
}

function selectedRows() {
  const active = document.activeElement?.closest?.(".topic-item");
  if (active) return [active];
  return [...els.topicsBody.querySelectorAll("tr")].filter((tr) => tr.querySelector(".row-check")?.checked);
}

function renumberRows(options = {}) {
  if (options.sync !== false) syncRowsFromTable();
  const counters = new Map();
  state.rows.forEach((row) => {
    const key = normalizeForMatch(row.materia || "");
    counters.set(key, (counters.get(key) || 0) + 1);
    row.ordem = counters.get(key);
  });
  renderRows();
}

function mergeSelectedTopicItems(items) {
  if (items.length < 2) {
    notifyContent("Selecione pelo menos dois temas para juntar.", "warning");
    return;
  }

  syncRowsFromTable();
  const allItems = [...els.topicsBody.querySelectorAll(".topic-item")];
  const selectedIndexes = items
    .map((item) => allItems.indexOf(item))
    .filter((index) => index >= 0)
    .sort((a, b) => a - b);
  const selectedRowsForMerge = selectedIndexes.map((index) => state.rows[index]).filter(Boolean);
  const subjects = new Set(selectedRowsForMerge.map((row) => normalizeForMatch(row.materia || "")));
  if (subjects.size !== 1) {
    notifyContent("S\u00f3 \u00e9 poss\u00edvel juntar temas da mesma mat\u00e9ria.", "warning");
    return;
  }

  const titles = [...new Set(selectedRowsForMerge.map((row) => themeTitle(row.assunto)).filter(Boolean))];
  const details = selectedRowsForMerge.map((row) => themeDetails(row.assunto)).filter(Boolean);
  const notes = selectedRowsForMerge.map((row) => row.observacoes).filter(Boolean);
  const firstIndex = selectedIndexes[0];
  const base = selectedRowsForMerge[0];
  const mergedTitle = titles.join(" + ");
  const mergedDetails = details.join("; ");
  const confirmed = confirm(`Juntar ${selectedRowsForMerge.length} temas em um unico tema?\n\nNovo tema:\n${mergedTitle}\n\nOs assuntos serao reunidos em uma unica linha.`);
  if (!confirmed) return;

  const mergedRow = enrichThemeRow({
    ...base,
    assunto: mergedDetails ? `${mergedTitle}: ${mergedDetails}` : mergedTitle,
    observacoes: notes.join("\n"),
  });
  state.rows[firstIndex] = mergedRow;
  selectedIndexes.slice(1).reverse().forEach((index) => state.rows.splice(index, 1));
  recentTopicFeedback = { type: "merged", keys: [topicKey(mergedRow.materia, mergedRow.assunto)] };
  renumberRows({ sync: false });
  notifyContent(`${selectedRowsForMerge.length} temas juntados em "${themeTitle(mergedRow.assunto)}".`);
}

function organizeRowsByTheme(rows) {
  const subjects = new Map();
  const looseRows = [];

  rows.forEach((row) => {
    if (!row.materia) {
      looseRows.push(row);
      return;
    }
    const key = normalizeForMatch(row.materia);
    if (!subjects.has(key)) subjects.set(key, { materia: row.materia, rows: [] });
    subjects.get(key).rows.push(row);
  });

  const organized = [];
  subjects.forEach(({ materia, rows: subjectRows }) => {
    const studyRows = subjectRows.filter((row) => row.assunto && row.estudar !== "Nao");
    const otherRows = subjectRows.filter((row) => !row.assunto || row.estudar === "Nao");
    const baseRow = studyRows[0] || subjectRows[0] || { materia, estudar: "Sim" };
    const groupedTopics = groupTopicsByTheme(studyRows.map((row) => row.assunto), { status: "tight" }, { maxAtoms: 6, maxWords: 44, preserveOrder: true });

    groupedTopics.forEach((assunto, index) => {
      organized.push(enrichThemeRow({
        materia,
        assunto,
        ordem: index + 1,
        estudar: "Sim",
        observacoes: "",
      }));
    });

    otherRows.forEach((row) => organized.push(enrichThemeRow({ ...row })));
  });

  return [...organized, ...looseRows];
}

function organizeThemesFromTable() {
  syncRowsFromTable();
  if (!state.rows.some((row) => row.materia && row.assunto)) {
    alert("Processar ou inserir temas antes de organizar por pertin\u00eancia.");
    return;
  }
  const before = state.rows.filter((row) => row.assunto && row.estudar !== "Nao").length;
  state.rows = organizeRowsByTheme(state.rows);
  renderRows();
  const after = state.rows.filter((row) => row.assunto && row.estudar !== "Nao").length;
  els.confirmationStatus.textContent = `Temas organizados por pertin\u00eancia tem\u00e1tica (${before} para ${after} temas)`;
  els.confirmationStatus.classList.remove("confirmed");
}

function addHistory(source, text) {
  if (!text.trim()) return;
  const entry = { id: crypto.randomUUID(), source, importedAt: new Date().toISOString(), text };
  state.originalHistory.unshift(entry);
  state.originalHistory = state.originalHistory.slice(0, 20);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.originalHistory));
  renderHistory();
}

function renderHistory() {
  if (!els.historySelect) return;
  els.historySelect.innerHTML = "";
  els.historySelect.add(new Option("Importa\u00e7\u00f5es recentes", ""));
  state.originalHistory.forEach((entry) => {
    const date = new Date(entry.importedAt).toLocaleString("pt-BR");
    els.historySelect.add(new Option(`${date} - ${entry.source}`, entry.id));
  });
}

async function readTxt(file) {
  return file.text();
}

async function readDocx(file) {
  if (!window.mammoth) throw new Error("Leitor DOCX indispon\u00edvel no navegador.");
  const arrayBuffer = await file.arrayBuffer();
  const result = await window.mammoth.extractRawText({ arrayBuffer });
  return result.value;
}

async function readPdf(file) {
  const pdfjs = await import("./vendor/pdf.min.mjs");
  if (pdfjs.GlobalWorkerOptions) {
    pdfjs.GlobalWorkerOptions.workerSrc = "./vendor/pdf.worker.min.mjs";
  }
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  const pages = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    pages.push(content.items.map((item) => item.str).join(" "));
  }
  return pages.join("\n");
}

async function readFile(file) {
  const name = file.name.toLowerCase();
  if (name.endsWith(".txt") || file.type === "text/plain") return readTxt(file);
  if (name.endsWith(".docx")) return readDocx(file);
  if (name.endsWith(".pdf") || file.type === "application/pdf") return readPdf(file);
  throw new Error("Formato n\u00e3o suportado.");
}

function getContestConfig() {
  return {
    concurso: els.contestName.value.trim(),
    banca: els.examBoard.value.trim(),
    cargo: els.jobRole.value.trim(),
    dataProva: els.examDate.value,
    dataInicial: els.planStartDate.value,
    horasSemana: Number(els.weeklyHours.value) || 0,
    duracaoBloco: Number(els.blockDuration.value) || 1.5,
    horasPorDia: Object.fromEntries(DAYS.map(([key]) => [key, Number(document.querySelector(`[data-day="${key}"]`)?.value) || 0])),
  };
}

function updateContestSummary() {
  const config = getContestConfig();
  const fullBlocks = Math.floor(config.horasSemana / config.duracaoBloco);
  const residual = Math.max(0, config.horasSemana - fullBlocks * config.duracaoBloco);
  if (els.blockEstimate) els.blockEstimate.textContent = fullBlocks;
  const start = parseLocalDate(config.dataInicial) || new Date();
  const exam = parseLocalDate(config.dataProva);
  const daysToExam = exam ? Math.max(0, daysBetween(start, exam)) : 0;
  const weeksToExam = exam ? Math.max(1, Math.ceil(daysToExam / 7)) : 0;
  els.contestSummary.innerHTML = summaryItems([
    ["Carga do ciclo", formatHours(config.horasSemana)],
    ["Bloco padr\u00e3o", formatDuration(config.duracaoBloco)],
    ["Blocos por ciclo", fullBlocks],
    ["Saldo do ciclo", formatHours(residual)],
    ["Dias at\u00e9 a prova", exam ? daysToExam : "Definir"],
    ["Ciclos estimados", exam ? weeksToExam : "Definir"],
  ]);
  if (els.contestAutoSummary) els.contestAutoSummary.innerHTML = "";
  setOutputValue(els.registeredWeeklyHours, formatHours(config.horasSemana));
  setOutputValue(els.registeredBlockDuration, formatDuration(config.duracaoBloco));
  renderCycleLabel();
  updateGenerationSummary();
}

function setOutputValue(element, value) {
  if (!element) return;
  element.value = value;
  element.textContent = value;
}

function parseLocalDate(value) {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function daysBetween(start, end) {
  const startDate = new Date(start);
  const endDate = new Date(end);
  startDate.setHours(0, 0, 0, 0);
  endDate.setHours(0, 0, 0, 0);
  return Math.ceil((endDate - startDate) / (24 * 60 * 60 * 1000));
}

function progressCounts() {
  const counts = Object.fromEntries(STATUS_OPTIONS.map((status) => [status, 0]));
  state.generatedBlocks.forEach((block) => {
    const status = normalizeStatus(block.status);
    counts[status] = (counts[status] || 0) + 1;
  });
  return counts;
}

function plannedUnitCount(status = "tight") {
  if (state.planningBase?.materias?.length) {
    return state.planningBase.materias.reduce((sum, materia) => sum + materia.assuntos.length, 0);
  }
  return state.rows
    .filter((row) => row.materia && row.assunto && row.estudar !== "Nao")
    .length;
}

function deadlineAnalysis(config = scheduleConfig()) {
  const start = parseLocalDate(config.dataInicial) || new Date();
  const exam = parseLocalDate(config.dataProva);
  const allSubjects = plannedUnitCount("tight");
  const counts = progressCounts();
  const concluded = completedEntries().length;
  const carryForward = (counts["Em andamento"] || 0) + (counts["Reprogramar"] || 0);
  const pendingSubjects = Math.max(0, allSubjects - concluded) + carryForward;
  const daysToExam = exam ? Math.max(0, daysBetween(start, exam)) : 0;
  const weeksToExam = exam ? Math.max(1, Math.ceil(daysToExam / 7)) : 1;
  const weeklyHours = Number(config.horasSemanaCronograma || config.horasSemana) || 0;
  const blockDuration = Number(config.duracaoBloco) || 1.5;
  const totalHours = weeksToExam * weeklyHours;
  const totalBlocks = Math.floor(totalHours / blockDuration);
  const weeklyBlocks = Math.floor(weeklyHours / blockDuration);
  const residualHours = Number((totalHours - totalBlocks * blockDuration).toFixed(2));
  const weeklyPace = weeksToExam ? pendingSubjects / weeksToExam : pendingSubjects;
  const status =
    !exam ? "missing-date" :
    totalBlocks < pendingSubjects ? "insufficient" :
    totalBlocks < Math.ceil(pendingSubjects * 1.25) ? "tight" :
    "comfortable";

  return {
    allSubjects,
    carryForward,
    concluded,
    daysToExam,
    pendingSubjects,
    residualHours,
    status,
    totalBlocks,
    totalHours,
    weeklyBlocks,
    weeklyPace,
    weeksToExam,
  };
}

function renderDeadlinePanel(target, analysis) {
  if (!target) return;
  const messages = {
    "missing-date": ["Informe a data da prova", "Informe a data da prova para calcular o prazo real."],
    insufficient: ["Prazo insuficiente", "O ciclo deve priorizar maior import\u00e2ncia, maior dificuldade, pend\u00eancias, revis\u00f5es e caderno de erros."],
    tight: ["Prazo apertado", "O conte\u00fado cabe, mas com pouca margem para revis\u00f5es e imprevistos nos pr\u00f3ximos ciclos."],
    comfortable: ["Prazo vi\u00e1vel", "H\u00e1 margem para distribuir o conte\u00fado, incluir revis\u00f5es e ajustar os pr\u00f3ximos ciclos."],
  };
  const residualText = analysis.residualHours > 0 ? ` + ${formatHours(analysis.residualHours)} residuais` : "";
  const message = messages[analysis.status];
  target.className = `deadline-panel ${analysis.status}`;
  target.innerHTML = `
    <div class="deadline-message">
      <strong>${message[0]}</strong>
      <span>${message[1]}</span>
      <span>Ritmo necess\u00e1rio: ${formatDecimal(analysis.weeklyPace)} temas por ciclo at\u00e9 a prova.</span>
    </div>
    <div class="deadline-metrics">
      <span><strong>${analysis.weeksToExam}</strong> ciclos estimados at\u00e9 a prova</span>
      <span><strong>${formatHours(analysis.totalHours)}</strong> horas totais dispon\u00edveis</span>
      <span><strong>${analysis.totalBlocks}</strong> blocos totais${residualText}</span>
      <span><strong>${analysis.pendingSubjects}</strong> temas pendentes</span>
      <span><strong>${analysis.concluded}</strong> temas conclu\u00eddos</span>
      <span><strong>${analysis.carryForward}</strong> temas que retornam ao plano</span>
    </div>
  `;
}

function updateDeadlineDisplays(config = scheduleConfig()) {
  const analysis = deadlineAnalysis(config);
  renderDeadlinePanel(els.generationDeadline, analysis);
  return analysis;
}

function summaryItems(items) {
  return items.map(([label, value]) => `<div><strong>${value}</strong><span>${label}</span></div>`).join("");
}

function uniqueSubjects(rows) {
  const map = new Map();
  rows.filter((row) => row.estudar !== "Nao" && row.materia).forEach((row) => {
    const key = normalizeForMatch(row.materia);
    if (!map.has(key)) {
      map.set(key, { materia: row.materia, assuntos: [], peso: 3, dominio: 3, prioridade: 0 });
    }
    if (row.assunto) map.get(key).assuntos.push(row.assunto);
  });
  return [...map.values()];
}

function confirmRows() {
  syncRowsFromTable();
  renumberRows();
  const validRows = state.rows.filter((row) => row.materia && row.assunto && row.estudar !== "Nao");
  if (!validRows.length) {
    alert("Confirme pelo menos uma mat\u00e9ria com tema antes de continuar.");
    return;
  }

  state.planningBase = {
    confirmedAt: new Date().toISOString(),
    cadastro: getContestConfig(),
    conteudoOriginal: state.originalHistory[0] || null,
    tabela: state.rows,
    materias: uniqueSubjects(validRows),
  };
  state.confirmed = true;
  els.confirmationStatus.textContent = "\u2713 Conte\u00fado confirmado";
  els.confirmationStatus.classList.add("confirmed");
  ["pesos", "disponibilidade"].forEach((tab) => setTabEnabled(tab, true));
  renderPlanningBase();
  updateContentFlowSteps();
  switchTab("pesos");
}

function renderPlanningBase() {
  if (!state.planningBase) return;
  syncPlanningSliders();
  const subjects = state.planningBase.materias;
  if (priorityEditIndex >= subjects.length) priorityEditIndex = -1;
  renderPrioritySummary(subjects);
  els.planningGrid.innerHTML = subjects.map((subject, index) => {
    const priority = priorityInfo(subject.prioridade);
    const isOpen = index === priorityEditIndex;
    return `
      <article class="priority-row ${isOpen ? "is-open" : ""}">
        <div class="priority-row-main">
          <div class="priority-subject">
            <strong>${escapeHtml(subject.materia)}</strong>
            <span>${subject.assuntos.length} tema${subject.assuntos.length === 1 ? "" : "s"}</span>
          </div>
          <div class="priority-cell">
            <span>Import\u00e2ncia na prova</span>
            <strong>${Number(subject.peso) || 3}</strong>
          </div>
          <div class="priority-cell">
            <span>Dificuldade pessoal</span>
            <strong>${Number(subject.dominio) || 3}</strong>
          </div>
          <div class="priority-cell priority-result">
            <span>Prioridade de estudo</span>
            <strong class="priority-badge ${priority.className}" data-priority="${index}">${priority.label} &middot; ${priority.percent}%</strong>
          </div>
          <button class="priority-toggle" type="button" data-edit-priority="${index}" aria-label="Editar ${escapeHtml(subject.materia)}" aria-expanded="${isOpen ? "true" : "false"}">
            <i data-lucide="chevron-down"></i>
          </button>
        </div>
        ${isOpen ? priorityEditPanel(subject, index, priority) : ""}
      </article>
    `;
  }).join("");
  if (window.lucide) window.lucide.createIcons();
  updateGenerationSummary();
}

function renderPrioritySummary(subjects) {
  if (!els.prioritySummary) return;
  const totalSubjects = subjects.length;
  const totalTopics = subjects.reduce((sum, subject) => sum + subject.assuntos.length, 0);
  const highPriority = subjects.filter((subject) => priorityInfo(subject.prioridade).percent >= 60).length;
  const lowPriority = subjects.filter((subject) => priorityInfo(subject.prioridade).percent < 40).length;
  els.prioritySummary.innerHTML = summaryItems([
    ["Total de mat\u00e9rias", totalSubjects],
    ["Total de temas", totalTopics],
    ["Alta prioridade", highPriority],
    ["Baixa prioridade", lowPriority],
  ]);
}

function priorityReason(subject) {
  const weight = Number(subject.peso) || 3;
  const difficulty = Number(subject.dominio) || 3;
  if (weight >= 4 && difficulty >= 4) return "peso alto + dificuldade alta";
  if (weight >= 4 && difficulty >= 3) return "peso alto na prova";
  if (difficulty >= 4 && weight >= 3) return "dificuldade pessoal alta";
  if (weight <= 2 && difficulty <= 2) return "menor peso + baixa dificuldade";
  if (weight <= 2) return "menor peso relativo";
  if (difficulty <= 2) return "boa familiaridade com a mat\u00e9ria";
  return "prioridade equilibrada";
}

function renderPriorityXray(subjects) {
  return "";
  if (!subjects.length) return "";
  const ranked = subjects
    .map((subject) => ({
      ...subject,
      priority: priorityInfo(subject.prioridade),
      reason: priorityReason(subject),
    }))
    .sort((a, b) =>
      b.priority.percent - a.priority.percent ||
      b.assuntos.length - a.assuntos.length ||
      a.materia.localeCompare(b.materia)
    );
  const focus = ranked.filter((subject) => subject.priority.percent >= 60).slice(0, 3);
  const focusText = focus.length
    ? focus.map((subject) => escapeHtml(subject.materia)).join(", ")
    : "Nenhuma mat\u00e9ria em prioridade alta no momento.";

  return `
    <div class="priority-xray-header">
      <div>
        <span class="step-label">Raio-X do Edital</span>
        <h3>Ordem sugerida de aten\u00e7\u00e3o</h3>
        <p>Ranking calculado pela import\u00e2ncia na prova, dificuldade pessoal e quantidade de temas.</p>
      </div>
      <div class="priority-xray-focus">
        <span>Foco inicial</span>
        <strong>${focusText}</strong>
      </div>
    </div>
    <div class="priority-xray-list">
      ${ranked.map((subject, index) => `
        <article class="priority-xray-item">
          <span class="xray-rank">${index + 1}</span>
          <div>
            <strong>${escapeHtml(subject.materia)}</strong>
            <p>${subject.assuntos.length} tema${subject.assuntos.length === 1 ? "" : "s"} &middot; ${subject.reason}</p>
          </div>
          <span class="priority-badge ${subject.priority.className}">${subject.priority.label} &middot; ${subject.priority.percent}%</span>
        </article>
      `).join("")}
    </div>
  `;
}

function priorityEditPanel(subject, index, priority) {
  return `
    <div class="priority-edit-panel">
      <div class="priority-edit-toolbar">
        <span>Ajuste os crit\u00e9rios desta mat\u00e9ria</span>
        <span class="priority-badge ${priority.className}">Prioridade de estudo: ${priority.label} &middot; ${priority.percent}%</span>
      </div>
      <div class="priority-scale-grid">
        ${scaleMarkup(index, "peso", "Import\u00e2ncia na prova", "Quanto essa mat\u00e9ria pesa no resultado.", subject.peso)}
        ${scaleMarkup(index, "dominio", "Dificuldade pessoal", "Quanto voc\u00ea sente dificuldade nessa mat\u00e9ria.", subject.dominio)}
      </div>
    </div>
  `;
}

function scaleMarkup(index, field, label, help, value) {
  const selected = Number(value) || 3;
  const buttons = [1, 2, 3, 4, 5].map((number) => `
    <button class="scale-button ${number === selected ? "active" : ""}" type="button" data-scale-index="${index}" data-scale-field="${field}" data-scale-value="${number}">${number}</button>
  `).join("");
  return `
    <div class="scale-group">
      <div>
        <strong>${label}</strong>
        <span>${help}</span>
      </div>
      <div class="scale-buttons" aria-label="${label}">${buttons}</div>
    </div>
  `;
}

function updateSliderOutput(input) {
  const min = Number(input.min) || 0;
  const max = Number(input.max) || 100;
  const value = Number(input.value) || min;
  const percent = ((value - min) / (max - min)) * 100;
  input.style.setProperty("--value", `${percent}%`);
  input.closest(".slider-field").querySelector("output").value = input.value;
}

function syncPlanningSliders() {
  if (!state.planningBase) return;
  document.querySelectorAll("[data-plan]").forEach((input) => {
    const index = Number(input.dataset.plan);
    state.planningBase.materias[index][input.dataset.field] = Number(input.value);
  });
  state.planningBase.materias.forEach((subject, index) => {
    subject.prioridade = priorityScore(subject);
    const el = document.querySelector(`[data-priority="${index}"]`);
    if (el) {
      const priority = priorityInfo(subject.prioridade);
      el.innerHTML = `${priority.label} &middot; ${priority.percent}%`;
      el.className = `priority-badge ${priority.className}`;
    }
  });
}

function priorityScore(subject) {
  const pesoNormalizado = (Number(subject.peso) || 3) / 5;
  const dificuldadeNormalizada = (Number(subject.dominio) || 3) / 5;
  return 0.6 * pesoNormalizado + 0.4 * dificuldadeNormalizada;
}

function priorityInfo(score) {
  const percent = Math.round((Number(score) || 0) * 100);
  if (percent < 40) return { label: "Baixa", className: "low", percent };
  if (percent < 60) return { label: "M\u00e9dia", className: "medium", percent };
  if (percent < 80) return { label: "Alta", className: "high", percent };
  return { label: "Muito alta", className: "very-high", percent };
}

function entryDateValue(entry = {}) {
  const candidates = [
    entry.completedAt,
    entry.savedAt,
    entry.concluidoEm ? parseBrazilianDate(entry.concluidoEm) : null,
    entry.createdAt,
  ].filter(Boolean);
  for (const value of candidates) {
    const date = value instanceof Date ? value : new Date(value);
    if (!Number.isNaN(date.getTime())) return date.getTime();
  }
  return 0;
}

function adaptiveHistoryEntries() {
  const entries = [];
  const pushBlock = (block = {}, source = "") => {
    if (!block || !block.materia) return;
    const questoes = Number(block.questoes) || 0;
    const acertos = Math.min(Number(block.acertos) || 0, questoes);
    entries.push({
      source,
      materia: block.materia,
      assunto: block.assunto || "",
      questoes,
      acertos,
      percentual: questoes ? acertos / questoes : Number(block.percentual) || 0,
      dificuldade: block.dificuldade || "",
      status: normalizeStatus(block.status),
      concluidoEm: block.concluidoEm || "",
      completedAt: block.completedAt || block.savedAt || "",
      savedAt: block.savedAt || "",
      createdAt: block.createdAt || "",
    });
  };

  state.completedHistory.forEach((block) => pushBlock(block, "completedHistory"));
  state.generatedBlocks.forEach((block) => pushBlock(block, "generatedBlocks"));
  state.cycleHistory.forEach((cycle) => {
    (cycle.generatedBlocks || []).forEach((block) => pushBlock(block, "cycleHistory"));
    (cycle.completedHistory || []).forEach((block) => pushBlock(block, "cycleHistory"));
  });
  state.cycleResults.forEach((result) => {
    (result.completed || []).forEach((block) => pushBlock({ ...block, savedAt: result.savedAt || result.closedAt || "" }, "cycleResults"));
  });

  return entries.sort((a, b) => entryDateValue(a) - entryDateValue(b));
}

function topicMatches(entry = {}, materia = "", assunto = "") {
  if (normalizeForMatch(entry.materia || "") !== normalizeForMatch(materia || "")) return false;
  if (!assunto) return true;
  const entryTopic = normalizeForMatch(entry.assunto || "");
  const targetTopic = normalizeForMatch(assunto || "");
  return entryTopic === targetTopic || entryTopic.includes(targetTopic) || targetTopic.includes(entryTopic);
}

function accuracyFromEntries(entries = []) {
  const totals = entries.reduce((sum, entry) => {
    sum.questoes += Number(entry.questoes) || 0;
    sum.acertos += Number(entry.acertos) || 0;
    return sum;
  }, { questoes: 0, acertos: 0 });
  return totals.questoes ? totals.acertos / totals.questoes : null;
}

function recentPerformanceDrop(entries = []) {
  const answered = entries.filter((entry) => Number(entry.questoes) > 0);
  if (answered.length < 4) return false;
  const recent = answered.slice(-2);
  const previous = answered.slice(-6, -2);
  const recentAccuracy = accuracyFromEntries(recent);
  const previousAccuracy = accuracyFromEntries(previous);
  return previousAccuracy !== null && recentAccuracy !== null && previousAccuracy - recentAccuracy >= 0.15 && recentAccuracy < 0.75;
}

function reviewAttentionFor(materia = "", assunto = "") {
  ensureReviewsArray();
  const related = state.reviews
    .filter((record) => !["Concluída", "Cancelada"].includes(record.status) && topicMatches(record, materia, assunto))
    .map((record) => ({ ...record, statusInfo: reviewStatusInfo(record) }));
  const overdue = related.filter((record) => record.statusInfo.group === "overdue");
  const today = related.filter((record) => record.statusInfo.group === "today");
  return { related, overdue, today, hasAttention: overdue.length > 0 || today.length > 0 };
}

function adaptivePerformanceForSubject(materia = "") {
  return adaptiveHistoryEntries().filter((entry) => topicMatches(entry, materia));
}

function isAdaptiveReview(record = {}) {
  return record.tipo === "adaptativa";
}

function normalizeAdaptiveReviewRecord(record = {}) {
  if (!isAdaptiveReview(record)) return { ...record, status: normalizeReviewStatus(record.status) };
  const available = record.disponivelEm || record.availableAt || "";
  const dueDate = record.dataPrevista || (available ? formatDateBR(new Date(available)) : "");
  return {
    ...record,
    tipo: "adaptativa",
    status: normalizeReviewStatus(record.status),
    intensidade: record.intensidade || "curta",
    tentativas: Array.isArray(record.tentativas) ? record.tentativas : [],
    motivo: record.motivo && typeof record.motivo === "object" ? record.motivo : {},
    dataPrevista: dueDate,
    disponivelEm: available || "",
    questoesSugeridas: Math.max(1, Number(record.questoesSugeridas) || 6),
    sugestao: record.sugestao || "Revise as questões erradas e consulte suas anotações.",
  };
}

function adaptiveReviewFor(materia = "", assunto = "") {
  ensureReviewsArray();
  const records = state.reviews
    .filter((record) => isAdaptiveReview(record) && !["Concluída", "Cancelada"].includes(record.status) && topicMatches(record, materia, assunto))
    .map((record) => ({ ...record, statusInfo: reviewStatusInfo(record) }))
    .sort((a, b) => new Date(b.atualizadaEm || b.criadaEm || 0) - new Date(a.atualizadaEm || a.criadaEm || 0));
  const record = records[0] || null;
  const engine = window.AdaptiveReviewEngine;
  return {
    record,
    records,
    impact: record && engine ? engine.priorityImpact(record.intensidade) : 0,
  };
}

function adaptivePerformanceForTopic(materia = "", assunto = "") {
  return adaptiveHistoryEntries().filter((entry) => topicMatches(entry, materia, assunto));
}

function adaptivePriorityAdjustment(target = {}) {
  const materia = target.materia || "";
  const assunto = target.assunto || "";
  const subjectEntries = adaptivePerformanceForSubject(materia);
  const topicEntries = assunto ? adaptivePerformanceForTopic(materia, assunto) : [];
  const entries = topicEntries.length >= 2 || topicEntries.reduce((sum, entry) => sum + (Number(entry.questoes) || 0), 0) >= 10 ? topicEntries : subjectEntries;
  const recentAnswered = entries.filter((entry) => Number(entry.questoes) > 0).slice(-6);
  const recentAccuracy = accuracyFromEntries(recentAnswered);
  const highDifficulty = entries.slice(-6).filter((entry) => entry.dificuldade === "Alta").length;
  const reprograms = entries.filter((entry) => normalizeStatus(entry.status) === "Reprogramar").length;
  const reviewAttention = reviewAttentionFor(materia, assunto);
  const standardReviewAttention = {
    overdue: reviewAttention.overdue.filter((record) => !isAdaptiveReview(record)),
    today: reviewAttention.today.filter((record) => !isAdaptiveReview(record)),
  };
  const adaptiveReview = adaptiveReviewFor(materia, assunto);
  let adjustment = 0;
  const reasons = [];

  if (recentAccuracy !== null && recentAnswered.reduce((sum, entry) => sum + Number(entry.questoes), 0) >= 5) {
    if (recentAccuracy < 0.6) {
      adjustment += 0.18;
      reasons.push(`acerto recente de ${Math.round(recentAccuracy * 100)}%`);
    } else if (recentAccuracy < 0.75) {
      adjustment += 0.1;
      reasons.push(`acerto recente de ${Math.round(recentAccuracy * 100)}%`);
    }
  }

  if (highDifficulty >= 1) {
    adjustment += 0.08;
    reasons.push("dificuldade sentida alta");
  }

  if (reprograms >= 2) {
    adjustment += 0.09;
    reasons.push("duas ou mais reprograma\u00e7\u00f5es");
  }

  if (standardReviewAttention.overdue.length) {
    adjustment += 0.12;
    reasons.unshift("revisão merece atenção");
  } else if (standardReviewAttention.today.length) {
    adjustment += 0.07;
    reasons.unshift("revisão merece atenção");
  }

  if (adaptiveReview.record) {
    adjustment += adaptiveReview.impact;
    reasons.unshift("revisão adaptativa " + String(adaptiveReview.record.intensidade || "").replace("prioritaria", "prioritária"));
  }

  if (recentPerformanceDrop(entries)) {
    adjustment += 0.08;
    reasons.push("queda de desempenho recente");
  }

  const cap = assunto ? 0.35 : 0.3;
  return {
    adjustment: Math.min(cap, adjustment),
    reasons: [...new Set(reasons)],
    accuracy: recentAccuracy,
    reviewAttention,
    adaptiveReview,
    basis: entries === topicEntries ? "topic" : "subject",
  };
}

function adaptivePriorityReason(target = {}) {
  const data = adaptivePriorityAdjustment(target);
  if (data.adaptiveReview?.record) {
    return data.adaptiveReview.record.statusInfo?.group === "upcoming"
      ? data.adaptiveReview.record.disponibilidade || "Revisão adaptativa planejada para este tema."
      : "Revisão adaptativa merece atenção antes de avançar.";
  }
  if (data.reviewAttention.overdue.length || data.reviewAttention.today.length) {
    return "Revis\u00e3o merece aten\u00e7\u00e3o antes de avan\u00e7ar.";
  }
  if (!data.adjustment) return "";
  const accuracyReason = data.reasons.find((reason) => reason.includes("acerto recente"));
  if (accuracyReason) return `Prioridade refor\u00e7ada: ${accuracyReason}.`;
  return "Refor\u00e7o sugerido pelo seu desempenho recente.";
}

function adaptivePriorityForTarget(target = {}) {
  const base = Number(target.prioridadeBase ?? target.prioridade ?? priorityScore(target)) || 0;
  const adjustment = adaptivePriorityAdjustment(target);
  return {
    base,
    adjusted: Math.min(1, base + adjustment.adjustment),
    adjustment: adjustment.adjustment,
    reason: adaptivePriorityReason(target),
    reasons: adjustment.reasons,
    reviewAttention: adjustment.reviewAttention,
  };
}

function scheduleConfig() {
  const base = getContestConfig();
  const override = Number(els.overrideWeeklyHours.value);
  const useOverride = Boolean(els.overrideCycleToggle?.checked);
  const weeklyHours = useOverride && override > 0 ? override : base.horasSemana;
  const fullBlocks = Math.floor(weeklyHours / base.duracaoBloco);
  const residualHours = Number((weeklyHours - fullBlocks * base.duracaoBloco).toFixed(2));
  return {
    ...base,
    semanaReferencia: els.referenceWeek.value,
    horasSemanaCronograma: weeklyHours,
    blocosCompletos: fullBlocks,
    horasResiduais: residualHours,
    usarResidual: els.allowResidualBlock.checked,
  };
}

function currentCycleLabel() {
  return `Ciclo ${state.cycleHistory.length + 1}`;
}

function renderCycleLabel() {
  if (els.cycleLabel) els.cycleLabel.textContent = currentCycleLabel();
}

function showToast(message) {
  if (!message) return;
  let container = document.querySelector(".toast-region");
  if (!container) {
    container = document.createElement("div");
    container.className = "toast-region";
    container.setAttribute("aria-live", "polite");
    document.body.appendChild(container);
  }
  const toast = document.createElement("div");
  toast.className = "app-toast";
  toast.textContent = message;
  container.appendChild(toast);
  window.setTimeout(() => toast.classList.add("is-leaving"), 2600);
  window.setTimeout(() => toast.remove(), 3050);
}

function closePerformancePanelAnimated(afterClose = null) {
  const modal = document.querySelector(".performance-modal");
  const finish = () => {
    performanceEditIndex = -1;
    renderGeneratedSchedule();
    if (typeof afterClose === "function") afterClose();
  };
  if (!modal || prefersReducedMotion()) {
    finish();
    return;
  }
  modal.classList.add("is-closing");
  window.setTimeout(finish, 190);
}

function updateOverrideVisibility() {
  if (!els.overrideCycleToggle || !els.overrideWeeklyField) return;
  els.overrideWeeklyField.hidden = !els.overrideCycleToggle.checked;
  if (!els.overrideCycleToggle.checked && document.activeElement !== els.overrideWeeklyHours) {
    els.overrideWeeklyHours.value = "";
  }
  updateGenerationSummary();
}

function updateGenerationSummary() {
  const config = scheduleConfig();
  renderCycleLabel();
  const residualText = config.horasResiduais > 0 && config.usarResidual ? `${formatHours(config.horasResiduais)} dispon\u00edvel` : formatHours(0);
  els.generationSummary.innerHTML = summaryItems([
    ["Ciclo atual", currentCycleLabel()],
    ["Carga do ciclo", formatHours(config.horasSemanaCronograma)],
    ["Blocos principais", config.blocosCompletos],
    ["Revis\u00e3o curta", residualText],
  ]);
  updateDeadlineDisplays(config);
}

function distributeBlocks(materias, totalBlocks, options = {}) {
  if (!materias.length || totalBlocks <= 0) return [];
  const scored = materias.map((materia) => {
    const basePriority = priorityScore(materia);
    const adaptive = options.adaptive ? adaptivePriorityForTarget({ ...materia, prioridade: basePriority, prioridadeBase: basePriority }) : null;
    return {
      ...materia,
      prioridadeBase: basePriority,
      prioridade: adaptive ? adaptive.adjusted : basePriority,
      adaptiveAdjustment: adaptive?.adjustment || 0,
      adaptiveReason: adaptive?.reason || "",
    };
  });
  const totalPriority = scored.reduce((sum, item) => sum + item.prioridade, 0) || scored.length || 1;
  const minimum = totalBlocks >= scored.length ? 1 : 0;
  let used = minimum * scored.length;
  const distribution = scored.map((item) => {
    const raw = ((totalBlocks - used) * item.prioridade) / totalPriority;
    return { ...item, blocos: minimum + Math.floor(raw), sobra: raw - Math.floor(raw) };
  });

  used = distribution.reduce((sum, item) => sum + item.blocos, 0);
  distribution.sort((a, b) => b.sobra - a.sobra || a.materia.localeCompare(b.materia)).slice(0, Math.max(0, totalBlocks - used)).forEach((item) => {
    item.blocos += 1;
  });

  return distribution.map(({ sobra, ...item }) => item).sort((a, b) => b.prioridade - a.prioridade || a.materia.localeCompare(b.materia));
}

function buildAlternatingQueue(distribution, analysis) {
  const pool = distribution.map((item) => ({
    ...item,
    remaining: item.blocos,
    topicCursor: 0,
    studyUnits: rankStudyUnitsByAdaptivePriority(item, availableStudyUnits(item, analysis)),
  }));
  const queue = [];
  let previous = "";

  while (pool.some((item) => item.remaining > 0)) {
    const candidates = pool
      .filter((item) => item.remaining > 0 && item.materia !== previous)
      .sort((a, b) => b.remaining - a.remaining || b.prioridade - a.prioridade || a.materia.localeCompare(b.materia));
    const fallback = pool.filter((item) => item.remaining > 0).sort((a, b) => b.remaining - a.remaining || b.prioridade - a.prioridade || a.materia.localeCompare(b.materia));
    const chosen = candidates[0] || fallback[0];
    const topic = chooseTopicForBlock(chosen);
    const topicAdaptive = adaptivePriorityForTarget({
      materia: chosen.materia,
      assunto: topic.assunto,
      prioridade: chosen.prioridade,
      prioridadeBase: chosen.prioridadeBase,
    });
    queue.push({
      materia: chosen.materia,
      assunto: topic.assunto,
      prioridade: Math.max(chosen.prioridade, topicAdaptive.adjusted),
      prioridadeBase: chosen.prioridadeBase,
      adaptiveAdjustment: Math.max(chosen.adaptiveAdjustment || 0, topicAdaptive.adjustment || 0),
      adaptiveReason: topicAdaptive.reason || chosen.adaptiveReason || "",
    });
    chosen.remaining -= 1;
    previous = chosen.materia;
  }

  return queue;
}

function chooseTopicForBlock(subject) {
  const topics = subject.studyUnits || subject.assuntos || [];
  if (!topics.length) return { assunto: "Selecionar tema" };
  const current = topics[subject.topicCursor % topics.length];
  subject.topicCursor += 1;
  return typeof current === "string" ? { assunto: current } : current;
}

function rankStudyUnitsByAdaptivePriority(subject, units = []) {
  return units
    .map((assunto, index) => {
      const adaptive = adaptivePriorityForTarget({
        materia: subject.materia,
        assunto,
        prioridade: subject.prioridade,
        prioridadeBase: subject.prioridadeBase,
      });
      return {
        assunto,
        originalIndex: index,
        adaptiveScore: adaptive.adjusted,
        adaptiveAdjustment: adaptive.adjustment,
        adaptiveReason: adaptive.reason,
      };
    })
    .sort((a, b) =>
      b.adaptiveAdjustment - a.adaptiveAdjustment ||
      b.adaptiveScore - a.adaptiveScore ||
      a.originalIndex - b.originalIndex
    );
}

function createWeeklySlots(config) {
  const slots = [];
  let blockNumber = 1;
  let remaining = Number(config.horasSemanaCronograma) || 0;

  while (remaining >= config.duracaoBloco) {
    slots.push({ bloco: blockNumber++, duracao: config.duracaoBloco, tipo: "Teoria + quest\u00f5es" });
    remaining = Number((remaining - config.duracaoBloco).toFixed(2));
  }

  if (config.usarResidual && remaining > 0) {
    slots.push({ bloco: blockNumber++, duracao: remaining, tipo: "Revis\u00e3o" });
  }

  return slots;
}

function distributeAcrossSlots(queue, slots) {
  return slots.map((slot, index) => blockRow(slot.bloco, slot.duracao, queue[index], slot.tipo));
}

function rebalanceGoalDurations(blocks, weeklyHours, baseDuration) {
  if (!blocks.length) return blocks;
  const totalHours = Number(weeklyHours) || blocks.reduce((sum, block) => sum + block.duracao, 0);
  const base = Number(baseDuration) || 1.5;
  const maxDuration = Math.max(base * 1.6, 2);
  const minDuration = Math.min(1, base);
  const weights = blocks.map((block) => 0.65 + (Number(block.prioridade) || 0));
  const weightTotal = weights.reduce((sum, value) => sum + value, 0);

  let used = 0;
  blocks.forEach((block, index) => {
    const raw = (totalHours * weights[index]) / weightTotal;
    const rounded = Math.round(raw * 4) / 4;
    block.duracao = Math.max(minDuration, Math.min(maxDuration, rounded));
    used += block.duracao;
  });

  let diff = Math.round((totalHours - used) * 4) / 4;
  let cursor = 0;
  while (Math.abs(diff) >= 0.25 && cursor < blocks.length * 8) {
    const block = blocks[cursor % blocks.length];
    if (diff > 0 && block.duracao + 0.25 <= maxDuration) {
      block.duracao += 0.25;
      diff -= 0.25;
    } else if (diff < 0 && block.duracao - 0.25 >= minDuration) {
      block.duracao -= 0.25;
      diff += 0.25;
    }
    diff = Math.round(diff * 4) / 4;
    cursor += 1;
  }

  return blocks;
}

function blockRow(number, duration, item, type) {
  return {
    bloco: number,
    duracao: duration,
    materia: item.materia,
    assunto: item.assunto,
    prioridade: item.prioridade,
    prioridadeBase: item.prioridadeBase ?? item.prioridade,
    adaptiveAdjustment: item.adaptiveAdjustment || 0,
    adaptiveReason: item.adaptiveReason || "",
    tipo: type,
    meta: type === "Revis\u00e3o" ? "Revisar este tema + 8 quest\u00f5es" : "Estudar este tema + 10 quest\u00f5es",
    status: "N\u00e3o iniciado",
    questoes: 0,
    acertos: 0,
    percentual: 0,
    dificuldade: "M\u00e9dia",
    reviewCycle: "",
    reviewCycles: [],
    concluidoEm: "",
    observacoes: "",
  };
}

function balancedDailyHours(weeklyHours) {
  const base = Math.floor((Number(weeklyHours) || 0) / 7);
  let remaining = Number((Number(weeklyHours || 0) - base * 7).toFixed(2));
  return Object.fromEntries(DAYS.map(([key]) => {
    const extra = remaining > 0 ? Math.min(1, remaining) : 0;
    remaining = Number((remaining - extra).toFixed(2));
    return [key, base + extra];
  }));
}

function applyLockState() {
  const locked = Boolean(state.locked);
  ["tab-concurso", "tab-conteudo", "tab-pesos"].forEach((panelId) => {
    const panel = document.getElementById(panelId);
    if (!panel) return;
    panel.classList.toggle("is-locked", locked);
    panel.querySelectorAll("input, select, textarea, button").forEach((field) => {
      if (field.hasAttribute("data-lock-exempt")) return;
      field.disabled = locked;
    });
    let banner = panel.querySelector(".lock-banner");
    if (locked && !banner) {
      banner = document.createElement("div");
      banner.className = "lock-banner";
      banner.innerHTML = `
        <div>
          <strong>Dados travados</strong>
          <span>Estas informa\u00e7\u00f5es est\u00e3o protegidas para o ciclo n\u00e3o mudar sozinho.</span>
        </div>
        <button type="button" class="primary-button" data-unlock data-lock-exempt><i data-lucide="pencil"></i><span>Deseja alterar algum dado? Editar</span></button>
      `;
      panel.insertBefore(banner, panel.firstChild.nextSibling);
    }
    if (banner) banner.hidden = !locked;
  });
  if (window.lucide) window.lucide.createIcons();
}

function lockCycle() {
  state.locked = true;
  applyLockState();
  scheduleAutoSave();
}

function unlockCycle() {
  state.locked = false;
  applyLockState();
  scheduleAutoSave();
}

function generateSchedule() {
  if (!state.planningBase) {
    alert("Confirme as mat\u00e9rias e temas antes de gerar o ciclo.");
    return;
  }
  if (state.generatedBlocks.length && liveCycleHasProgress()) {
    alert("J\u00e1 existe um ciclo em andamento com desempenho, metas conclu\u00eddas, revis\u00f5es ou quest\u00f5es registradas. Para criar outro ciclo, use \"Finalizar ciclo\" ou \"Reiniciar ciclos\". Assim seus dados n\u00e3o s\u00e3o substitu\u00eddos sem querer.");
    switchTab("cronograma");
    return;
  }
  if (state.generatedBlocks.length) {
    const replace = confirm("J\u00e1 existe um ciclo gerado. Se continuar, as metas atuais ser\u00e3o substitu\u00eddas. Deseja gerar um novo ciclo mesmo assim?");
    if (!replace) {
      switchTab("cronograma");
      return;
    }
  }
  syncPlanningSliders();
  const config = scheduleConfig();
  const analysis = updateDeadlineDisplays(config);
  const slots = createWeeklySlots(config);
  const totalBlocks = Math.max(1, slots.length);
  state.distribution = distributeBlocks(state.planningBase.materias, totalBlocks, { adaptive: true });
  const queue = buildAlternatingQueue(state.distribution, analysis);
  state.generatedBlocks = rebalanceGoalDurations(distributeAcrossSlots(queue, slots), config.horasSemanaCronograma, config.duracaoBloco);
  setTabEnabled("cronograma", true);
  renderGeneratedSchedule();
  lockCycle();
  switchTab("cronograma");
  if (analysis.status === "insufficient") {
    els.scheduleStatus.textContent = `${state.generatedBlocks.length} metas geradas com prazo insuficiente`;
  }
}

function renderGeneratedSchedule() {
  if (els.cycleClosurePanel) els.cycleClosurePanel.hidden = true;
  renderWeeklyResult();
  renderCompleted();
  renderReviews();
  renderErrors();
  renderEvolution();
  renderContinuePanel();

  if (!state.generatedBlocks.length) {
    if (els.scheduleStatus) els.scheduleStatus.textContent = "Nenhum ciclo gerado";
    syncPendingFilterControl();
    els.summaryGrid.innerHTML = "";
    if (els.scheduleActions) els.scheduleActions.hidden = true;
    els.scheduleWrap.innerHTML = `<div class="empty-panel">Gere um ciclo para ver as pr\u00f3ximas metas de estudo.</div>`;
    return;
  }

  const config = scheduleConfig();
  updateDeadlineDisplays(config);
  if (els.scheduleStatus) els.scheduleStatus.textContent = `${state.generatedBlocks.length} metas geradas`;
  syncPendingFilterControl();
  const totals = performanceTotals();
  const completedCount = state.generatedBlocks.filter((block) => normalizeStatus(block.status) === "Conclu\u00eddo").length;
  const scheduledReviews = state.generatedBlocks.reduce((sum, block) => sum + reviewCyclesFromBlock(block).length, 0);
  const accuracy = totals.questoes ? totals.acertos / totals.questoes : 0;
  els.summaryGrid.innerHTML = summaryItems([
    ["Metas geradas", state.generatedBlocks.length],
    ["Carga do ciclo", formatHours(config.horasSemanaCronograma)],
    ["Horas estudadas", formatHours(studiedCycleHours())],
    ["Metas conclu\u00eddas", completedCount],
    ["Revis\u00f5es agendadas", scheduledReviews],
    ["Aproveitamento geral", formatPercent(accuracy)],
  ]);
  if (els.scheduleActions) els.scheduleActions.hidden = false;
  const visibleBlocks = state.generatedBlocks
    .map((block, index) => ({ block, index }))
    .filter(({ block, index }) => !showPendingOnly || isPendingBlock(block) || index === performanceEditIndex);
  const visiblePerformancePanel = performanceEditIndex >= 0
    && state.generatedBlocks[performanceEditIndex]
    && (!showPendingOnly || isPendingBlock(state.generatedBlocks[performanceEditIndex]) || visibleBlocks.some((item) => item.index === performanceEditIndex));
  els.scheduleWrap.innerHTML = `
    ${visibleBlocks.length ? `
      <div class="cycle-goals-list">
        ${visibleBlocks.map(({ block, index }) => {
        const isPerformanceOpen = index === performanceEditIndex;
        const isDetailOpen = index === unitDetailIndex;
        const isCompleted = normalizeStatus(block.status) === "Conclu\u00eddo";
        return `
          <article class="cycle-goal-card ${isCompleted ? "is-completed" : ""}">
            <div class="goal-card-index">
              <span>Meta</span>
              <strong>${block.bloco}</strong>
            </div>
            <div class="goal-card-main">
              <div class="goal-card-top">
                <div class="goal-card-title">
                  <span>${escapeHtml(block.materia)}</span>
                  <strong>${escapeHtml(shortText(block.assunto, 110))}</strong>
                </div>
                ${goalTimerMarkup(block, index)}
              </div>
              <div class="goal-card-meta">
                <label class="goal-duration-field">Dura\u00e7\u00e3o
                  <input class="goal-duration-input" data-duration-index="${index}" value="${formatDuration(block.duracao)}" aria-label="Dura\u00e7\u00e3o real da meta ${block.bloco}" />
                </label>
                <div>
                  <span>Prioridade</span>
                  ${priorityDots(block.prioridade)}
                </div>
                <div>
                  <span>Status</span>
                  ${statusBadge(block.status)}
                </div>
                <div>
                  <span>Revis\u00e3o</span>
                  ${reviewBadge(block)}
                </div>
              </div>
              <div class="goal-card-actions">
                <button class="text-action" type="button" data-toggle-unit="${index}">${isDetailOpen ? "Ocultar detalhes" : "Ver detalhes"}</button>
                <button class="ghost-button compact-button" type="button" data-toggle-performance="${index}">
                  <i data-lucide="${isPerformanceOpen ? "chevron-right" : "activity"}"></i><span>Atualizar desempenho</span>
                </button>
              </div>
              ${isDetailOpen ? unitDetailCard(block) : ""}
            </div>
          </article>
        `;
        }).join("")}
      </div>
    ` : `<div class="empty-panel">Nenhuma meta pendente no ciclo atual.</div>`}
    ${visiblePerformancePanel ? performancePanel(state.generatedBlocks[performanceEditIndex], performanceEditIndex) : ""}
  `;
  if (window.lucide) window.lucide.createIcons();
}

function pendingCycleEntries() {
  return state.generatedBlocks
    .map((block, index) => ({ block, index }))
    .filter(({ block }) => isPendingBlock(block));
}

function continueSuggestionScore(entry) {
  const block = entry.block || {};
  const adaptive = adaptivePriorityForTarget(block);
  const review = reviewAttentionFor(block.materia, block.assunto);
  const status = normalizeStatus(block.status);
  let score = 0;
  if (review.overdue.length) score += 120;
  else if (review.today.length) score += 90;
  if (status === "Em andamento") score += 45;
  score += (adaptive.adjustment || 0) * 100;
  score += (Number(block.prioridade) || 0) * 30;
  return { score, adaptive, review };
}

function rankedContinueEntries() {
  return pendingCycleEntries()
    .map((entry) => ({ ...entry, suggestion: continueSuggestionScore(entry) }))
    .sort((a, b) =>
      b.suggestion.score - a.suggestion.score ||
      a.index - b.index
    );
}

function splitPerformanceGroups(entries = []) {
  const answered = entries.filter((entry) => Number(entry.questoes) > 0);
  if (answered.length < 4) return null;
  const midpoint = Math.floor(answered.length / 2);
  const previous = answered.slice(0, midpoint);
  const recent = answered.slice(midpoint);
  const previousAccuracy = accuracyFromEntries(previous);
  const recentAccuracy = accuracyFromEntries(recent);
  if (previousAccuracy === null || recentAccuracy === null) return null;
  return { previousAccuracy, recentAccuracy, previous, recent };
}

function subjectNamesForInsights() {
  const names = new Set();
  if (state.planningBase?.materias) state.planningBase.materias.forEach((subject) => names.add(subject.materia));
  adaptiveHistoryEntries().forEach((entry) => names.add(entry.materia));
  state.generatedBlocks.forEach((block) => names.add(block.materia));
  state.reviews.forEach((record) => names.add(record.materia));
  return [...names].filter(Boolean);
}

function buildPerformanceInsights(skipReason = "") {
  const insights = [];
  const skip = normalizeForMatch(skipReason || "");
  const addInsight = (insight) => {
    if (!insight?.title || !insight?.detail) return;
    const fingerprint = `${normalizeForMatch(insight.title)}::${normalizeForMatch(insight.detail)}`;
    if (skip && normalizeForMatch(insight.detail).includes(skip)) return;
    if (insights.some((item) => item.fingerprint === fingerprint || item.type === insight.type && item.subject === insight.subject && item.topic === insight.topic)) return;
    insights.push({ ...insight, fingerprint });
  };

  const attentionReviews = reviewScheduleRows("all").filter((record) => record.status !== "Conclu\u00edda" && (record.statusInfo.group === "overdue" || record.statusInfo.group === "today"));
  if (attentionReviews.length) {
    addInsight({
      type: "review",
      rank: 100,
      title: `${attentionReviews.length} revis\u00e3o${attentionReviews.length === 1 ? "" : "es"} merece${attentionReviews.length === 1 ? "" : "m"} aten\u00e7\u00e3o`,
      detail: `A mais antiga est\u00e1 relacionada a ${attentionReviews[0].assunto || attentionReviews[0].materia}.`,
      subject: attentionReviews[0].materia,
      topic: attentionReviews[0].assunto,
    });
  }

  subjectNamesForInsights().forEach((materia) => {
    const entries = adaptivePerformanceForSubject(materia);
    const answered = entries.filter((entry) => Number(entry.questoes) > 0);
    const recent = answered.slice(-6);
    const recentAccuracy = accuracyFromEntries(recent);
    const highDifficulty = entries.slice(-6).filter((entry) => entry.dificuldade === "Alta").length;
    const reprograms = entries.filter((entry) => normalizeStatus(entry.status) === "Reprogramar").length;
    const adaptive = adaptivePriorityAdjustment({ materia });
    const trend = splitPerformanceGroups(answered);

    if (recentAccuracy !== null && (recentAccuracy < 0.6 || highDifficulty > 0 || adaptive.adjustment >= 0.18)) {
      const details = [];
      if (recentAccuracy !== null) details.push(`${Math.round(recentAccuracy * 100)}% de acerto recente`);
      if (highDifficulty > 0) details.push("dificuldade alta");
      addInsight({
        type: "reinforcement",
        rank: 90 + (adaptive.adjustment * 100),
        title: `${materia} precisa de refor\u00e7o`,
        detail: `${details.join(" e ")}.`,
        subject: materia,
      });
    }

    if (trend && trend.recentAccuracy - trend.previousAccuracy >= 0.12 && trend.recentAccuracy >= 0.75) {
      addInsight({
        type: "evolving",
        rank: 74 + ((trend.recentAccuracy - trend.previousAccuracy) * 100),
        title: `${materia} est\u00e1 evoluindo`,
        detail: `Seu acerto passou de ${Math.round(trend.previousAccuracy * 100)}% para ${Math.round(trend.recentAccuracy * 100)}%.`,
        subject: materia,
      });
    }

    if (recentAccuracy !== null && recentAccuracy >= 0.75 && recent.length >= 3 && !recentPerformanceDrop(entries)) {
      addInsight({
        type: "stable",
        rank: 40 + recentAccuracy * 10,
        title: `${materia} est\u00e1 est\u00e1vel`,
        detail: `${Math.round(recentAccuracy * 100)}% de acerto recente.`,
        subject: materia,
      });
    }

    if (reprograms >= 2) {
      const topicCounts = new Map();
      entries
        .filter((entry) => normalizeStatus(entry.status) === "Reprogramar" && entry.assunto)
        .forEach((entry) => topicCounts.set(entry.assunto, (topicCounts.get(entry.assunto) || 0) + 1));
      const [topic, count] = [...topicCounts.entries()].sort((a, b) => b[1] - a[1])[0] || [materia, reprograms];
      addInsight({
        type: "reprogrammed",
        rank: 82 + count,
        title: `${themeTitle(topic)} est\u00e1 dif\u00edcil de encaixar`,
        detail: `O tema foi reprogramado ${count} vezes.`,
        subject: materia,
        topic,
      });
    }
  });

  return insights
    .sort((a, b) => b.rank - a.rank)
    .slice(0, 4);
}

function continueReviewItems() {
  return reviewScheduleRows("all")
    .filter((item) => item.status !== "Conclu\u00edda")
    .slice(0, 2);
}

function renderContinuePanel() {
  if (!els.continuePanel) return;
  if (!state.generatedBlocks.length) {
    els.continuePanel.innerHTML = `
      <section class="continue-empty-card">
        <div>
          <span class="section-kicker">Continue seu ciclo</span>
          <h3>Seu pr\u00f3ximo ciclo ainda n\u00e3o foi gerado.</h3>
          <p>Defina as prioridades e gere um ciclo para receber uma sugest\u00e3o de pr\u00f3ximo estudo.</p>
        </div>
        <button class="primary-button" type="button" data-continue-generate><i data-lucide="calendar-plus"></i><span>Gerar ciclo</span></button>
      </section>
    `;
    if (window.lucide) window.lucide.createIcons();
    return;
  }

  const pending = rankedContinueEntries();
  const total = state.generatedBlocks.length;
  const completed = total - pending.length;
  const progress = total ? Math.round((completed / total) * 100) : 0;
  if (continueSuggestionOffset >= pending.length) continueSuggestionOffset = 0;
  const suggested = pending.length ? pending[continueSuggestionOffset % pending.length] : null;
  const suggestionReason = suggested?.suggestion?.adaptive?.reason || suggested?.block?.adaptiveReason || "";
  const performanceInsights = buildPerformanceInsights(suggestionReason);
  const reviews = continueReviewItems();
  const pendingReviewCount = reviewScheduleRows("all").filter((item) => item.status !== "Conclu\u00edda").length;
  const reviewCountText = pendingReviewCount === 1 ? "1 revis\u00e3o pendente" : `${pendingReviewCount} revis\u00f5es pendentes`;

  els.continuePanel.innerHTML = `
    <section class="continue-main-card">
      <div class="continue-card-header">
        <div>
          <span class="section-kicker">Pr\u00f3ximo passo sugerido</span>
          <h3>${suggested ? escapeHtml(suggested.block.materia) : "Ciclo conclu\u00eddo"}</h3>
          <p>${suggested ? escapeHtml(shortText(suggested.block.assunto, 150)) : "Todas as metas deste ciclo foram conclu\u00eddas."}</p>
          ${suggestionReason ? `<span class="continue-adaptive-reason">${escapeHtml(suggestionReason)}</span>` : ""}
        </div>
        ${suggested ? `<span class="continue-duration">${formatDuration(suggested.block.duracao)}</span>` : ""}
      </div>
      ${suggested ? `
        <div class="continue-meta-grid">
          <div>
            <span>Mat\u00e9ria</span>
            <strong>${escapeHtml(suggested.block.materia)}</strong>
          </div>
          <div>
            <span>Dura\u00e7\u00e3o</span>
            <strong>${formatDuration(suggested.block.duracao)}</strong>
          </div>
          <div>
            <span>Prioridade</span>
            ${priorityDots(suggested.block.prioridade)}
          </div>
        </div>
        <div class="continue-actions">
          <button class="primary-button" type="button" data-start-continue="${suggested.index}"><i data-lucide="play"></i><span>Iniciar estudo</span></button>
          <button class="ghost-button" type="button" data-next-continue ${pending.length < 2 ? "disabled" : ""}><i data-lucide="shuffle"></i><span>Ver outra meta</span></button>
          <button class="text-action" type="button" data-open-cycle-goals>Escolher outra meta do ciclo</button>
        </div>
      ` : `
        <div class="continue-actions">
          <button class="primary-button" type="button" data-open-cycle-goals><i data-lucide="check-circle-2"></i><span>Ver metas do ciclo</span></button>
        </div>
      `}
    </section>

    <section class="continue-insights-card">
      <div class="continue-card-header compact">
        <div>
          <h3>Leitura do seu desempenho</h3>
          <p>Uma leitura curta dos sinais mais recentes do seu estudo.</p>
        </div>
      </div>
      <div class="continue-insight-list">
        ${performanceInsights.length ? performanceInsights.map((insight) => `
          <article class="continue-insight ${escapeHtml(insight.type)}">
            <span>${escapeHtml(insight.title)}</span>
            <strong>${escapeHtml(insight.detail)}</strong>
          </article>
        `).join("") : `<p class="muted-note">Registre quest\u00f5es, dificuldade e revis\u00f5es para gerar uma leitura mais precisa.</p>`}
      </div>
      <button class="text-action" type="button" data-open-evolution>Ver an\u00e1lise completa</button>
    </section>

    <section class="continue-side-card">
      <div class="continue-card-header compact">
        <div>
          <h3>Revis\u00f5es que merecem aten\u00e7\u00e3o</h3>
          <p>${reviewCountText}</p>
        </div>
      </div>
      <div class="continue-review-list">
        ${reviews.length ? reviews.map((item) => `
          <article>
            <strong>${escapeHtml(item.materia)}</strong>
            <span>${escapeHtml(shortText(item.assunto, 82))}</span>
            <em>${escapeHtml(item.intervalLabel || item.intervalKey)} &middot; ${escapeHtml(item.dataPrevista || "")}</em>
          </article>
        `).join("") : `<p class="muted-note">Nenhuma revis\u00e3o pendente no momento.</p>`}
      </div>
      <button class="ghost-button compact-button" type="button" data-open-reviews><i data-lucide="repeat-2"></i><span>Ver todas</span></button>
    </section>

    <section class="continue-progress-card">
      <div>
        <span class="section-kicker">Progresso do ciclo</span>
        <h3>${completed} / ${total} metas conclu\u00eddas</h3>
        <p>Continue no seu ritmo.</p>
      </div>
      <div class="continue-progress">
        <div class="continue-progress-track"><span style="width: ${progress}%"></span></div>
        <strong>${progress}%</strong>
      </div>
    </section>
  `;
  if (window.lucide) window.lucide.createIcons();
}

function shortText(value, maxLength = 90) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).trim()}...`;
}

function normalizeStatus(status) {
  const raw = String(status || "").trim();
  const comparable = normalizeForMatch(raw)
    .replace(/[?]+/g, "i")
    .replace(/\s+/g, " ");
  if (raw === "N\u00e3o realizado" || raw === "Revisar novamente") return "Reprogramar";
  if (STATUS_OPTIONS.includes(raw)) return raw;
  if (comparable.includes("conclu") || raw.includes("Conclu")) return "Conclu\u00eddo";
  if (comparable.includes("andamento")) return "Em andamento";
  if (comparable.includes("reprogramar")) return "Reprogramar";
  return "N\u00e3o iniciado";
}

function normalizeReviewStatus(status) {
  const raw = String(status || "").trim();
  const comparable = normalizeForMatch(raw)
    .replace(/[?]+/g, "i")
    .replace(/\s+/g, " ");
  if (comparable.includes("conclu") || raw.includes("Conclu")) return "Conclu\u00edda";
  return raw || "Pendente";
}

function isPendingBlock(block) {
  return normalizeStatus(block?.status) !== "Conclu\u00eddo";
}

function syncPendingFilterControl() {
  if (!els.pendingOnlyToggle) return;
  els.pendingOnlyToggle.disabled = !state.generatedBlocks.length;
  els.pendingOnlyToggle.classList.toggle("is-active", showPendingOnly);
  els.pendingOnlyToggle.setAttribute("aria-pressed", showPendingOnly ? "true" : "false");
}

function statusBadge(status) {
  const normalized = normalizeStatus(status);
  const className = normalizeForMatch(normalized).replace(/\s+/g, "-");
  return `<span class="status-badge ${className}">${normalized}</span>`;
}

function validReviewKeys() {
  return new Set(REVIEW_INTERVALS.map((item) => item.key));
}

function reviewInterval(key) {
  return REVIEW_INTERVALS.find((item) => item.key === key);
}

function reviewShortLabel(key) {
  const labels = { "24h": "24h", "7d": "7d", "15d": "15d", "30d": "30d" };
  return labels[key] || key;
}

function reviewCyclesFromBlock(block = {}) {
  const valid = validReviewKeys();
  const values = Array.isArray(block.reviewCycles) ? block.reviewCycles : block.reviewCycle ? [block.reviewCycle] : [];
  return [...new Set(values.filter((key) => valid.has(key)))];
}

function setBlockReviewCycles(block, cycles = []) {
  const valid = validReviewKeys();
  const next = [...new Set(cycles.filter((key) => valid.has(key)))];
  block.reviewCycles = next;
  block.reviewCycle = next[0] || "";
}

function reviewBadge(block) {
  const cycles = reviewCyclesFromBlock(block);
  if (!cycles.length) return `<span class="review-badge muted">Sem revis\u00e3o</span>`;
  return `<span class="review-badge">${cycles.map(reviewShortLabel).join(" + ")}</span>`;
}

function unitDetailCard(block) {
  return `
    <div class="goal-detail-panel">
      <strong>Tema completo</strong>
      <p>${escapeHtml(block.assunto)}</p>
    </div>
  `;
}

function statusOptionsMarkup(selected) {
  const normalized = normalizeStatus(selected);
  return STATUS_OPTIONS.map((status) => `<option ${status === normalized ? "selected" : ""}>${status}</option>`).join("");
}

function reviewOptionsMarkup(block, index) {
  const selected = new Set(reviewCyclesFromBlock(block));
  return `
    <div class="review-chip-group" role="group" aria-label="Agendar revis\u00f5es">
      ${REVIEW_INTERVALS.map((item) => `
        <label class="review-chip">
          <input type="checkbox" data-review-index="${index}" value="${item.key}" ${selected.has(item.key) ? "checked" : ""} />
          <span>${item.label}</span>
        </label>
      `).join("")}
    </div>
    ${normalizeStatus(block.status) !== "Conclu\u00eddo" && selected.size ? `<span class="review-pending-note">As revis\u00f5es ser\u00e3o efetivadas quando a meta for marcada como Conclu\u00eddo.</span>` : ""}
  `;
}

function performancePanel(block, index) {
  return `
    <div class="performance-modal" role="dialog" aria-modal="true" aria-label="Atualizar desempenho">
      <button class="performance-modal-backdrop" type="button" data-close-performance aria-label="Fechar painel"></button>
      <aside class="performance-drawer">
        <div class="performance-drawer-header">
          <div>
            <span>Meta ${block.bloco}</span>
            <h3>Atualizar desempenho</h3>
          </div>
          <button class="icon-button" type="button" data-close-performance aria-label="Fechar painel"><i data-lucide="x"></i></button>
        </div>
        <div class="performance-context">
          <div>
            <span>Mat\u00e9ria</span>
            <strong>${escapeHtml(block.materia)}</strong>
          </div>
          <div>
            <span>Tema</span>
            <strong>${escapeHtml(block.assunto)}</strong>
          </div>
        </div>
        <div class="goal-performance-panel">
          <section class="performance-group performance-score-group">
            <h4>Desempenho</h4>
            <div class="performance-fields performance-score-fields">
              <label>Dura\u00e7\u00e3o
                <input class="metric-input metric-input-small" data-duration-index="${index}" value="${formatDuration(block.duracao)}" />
              </label>
              <label>Quest\u00f5es feitas
                <input class="metric-input metric-input-small" data-score-index="${index}" data-score-field="questoes" type="number" min="0" value="${block.questoes || 0}" />
              </label>
              <label>Acertos
                <input class="metric-input metric-input-small" data-score-index="${index}" data-score-field="acertos" type="number" min="0" value="${block.acertos || 0}" />
              </label>
              <label class="accuracy-result">Aproveitamento
                <output data-accuracy-index="${index}">${formatPercent(block.percentual || 0)}</output>
              </label>
              <label>Dificuldade sentida
                <select data-score-index="${index}" data-score-field="dificuldade">
                  ${["Baixa", "M\u00e9dia", "Alta"].map((value) => `<option ${value === block.dificuldade ? "selected" : ""}>${value}</option>`).join("")}
                </select>
              </label>
            </div>
          </section>
          <section class="performance-group performance-follow-group">
            <h4>Acompanhamento</h4>
            <div class="performance-fields performance-follow-fields">
              <label>Status
                <select data-status-index="${index}">${statusOptionsMarkup(block.status)}</select>
              </label>
              <div class="review-field">
                <span>Agendar revis\u00e3o</span>
                ${reviewOptionsMarkup(block, index)}
                ${adaptiveReviewManualActionMarkup(block, index)}
              </div>
            </div>
          </section>
          <label class="goal-notes-field">Observa\u00e7\u00f5es opcionais
            <textarea data-score-index="${index}" data-score-field="observacoes" placeholder="Anote dificuldades, pontos de aten\u00e7\u00e3o ou pr\u00f3ximos passos.">${escapeHtml(block.observacoes || "")}</textarea>
          </label>
        </div>
        <div class="performance-drawer-actions">
          <button class="ghost-button" type="button" data-close-performance>Cancelar</button>
          <button class="primary-button" type="button" data-save-performance>Salvar desempenho</button>
        </div>
      </aside>
    </div>
  `;
}

function priorityDots(priority) {
  const level = Math.max(1, Math.min(5, Math.ceil((Number(priority) || 0) * 5)));
  return `<span class="priority-dots" aria-label="Prioridade ${level} de 5">${Array.from({ length: 5 }, (_, index) => `<span class="dot ${index < level ? "filled" : ""}"></span>`).join("")}</span>`;
}

function formatPercent(value) {
  return `${Math.round((Number(value) || 0) * 100)}%`;
}

function updateBlockAccuracy(block) {
  const questions = Number(block.questoes) || 0;
  const correct = Math.min(Number(block.acertos) || 0, questions);
  block.acertos = correct;
  block.percentual = questions > 0 ? correct / questions : 0;
}

function alternationScore() {
  let repeats = 0;
  for (let index = 1; index < state.generatedBlocks.length; index += 1) {
    if (state.generatedBlocks[index].materia === state.generatedBlocks[index - 1].materia) repeats += 1;
  }
  return repeats ? `${repeats} repeti\u00e7\u00f5es` : "sem repeti\u00e7\u00f5es";
}

function renderWeeklyResult() {
  const counts = Object.fromEntries(STATUS_OPTIONS.map((status) => [status, 0]));
  const totals = { questoes: 0, acertos: 0 };
  const bySubject = new Map();

  state.generatedBlocks.forEach((block) => {
    const status = normalizeStatus(block.status);
    counts[status] = (counts[status] || 0) + 1;
    updateBlockAccuracy(block);
    const questoes = Number(block.questoes) || 0;
    const acertos = Number(block.acertos) || 0;
    totals.questoes += questoes;
    totals.acertos += acertos;

    if (!bySubject.has(block.materia)) {
      bySubject.set(block.materia, { materia: block.materia, questoes: 0, acertos: 0 });
    }
    const subject = bySubject.get(block.materia);
    subject.questoes += questoes;
    subject.acertos += acertos;
  });

  const totalErrors = Math.max(0, totals.questoes - totals.acertos);
  const totalPercent = totals.questoes ? totals.acertos / totals.questoes : 0;
  if (els.weeklyResultGrid) {
    els.weeklyResultGrid.innerHTML = summaryItems([
      ["Quest\u00f5es feitas", totals.questoes],
      ["Acertos", totals.acertos],
      ["Erros", totalErrors],
      ["% geral", formatPercent(totalPercent)],
      ...STATUS_OPTIONS.map((status) => [status, counts[status]]),
    ]);
  }

  if (!els.weeklySubjectBody) return;
  const rows = Array.from(bySubject.values()).sort((a, b) => b.questoes - a.questoes || a.materia.localeCompare(b.materia));
  els.weeklySubjectBody.innerHTML = rows.length ? rows.map((item) => {
    const errors = Math.max(0, item.questoes - item.acertos);
    const percent = item.questoes ? item.acertos / item.questoes : 0;
    return `
      <tr>
        <td>${escapeHtml(item.materia)}</td>
        <td>${item.questoes}</td>
        <td>${item.acertos}</td>
        <td>${errors}</td>
        <td>${formatPercent(percent)}</td>
      </tr>
    `;
  }).join("") : `<tr><td colspan="5">Preencha as quest\u00f5es feitas e acertos nas metas do ciclo.</td></tr>`;
}

function renderCompleted() {
  const completed = completedEntries();
  if (!els.completedBody) return;
  els.completedBody.innerHTML = completed.length ? completed.map((block) => `
    <tr>
      <td>${block.concluidoEm || ""}</td>
      <td>${escapeHtml(block.materia)}</td>
      <td>${escapeHtml(block.assunto)}</td>
      <td>${formatDuration(block.duracao)}</td>
      <td>${block.questoes || 0}</td>
      <td>${formatPercent(block.percentual || 0)}</td>
    </tr>
  `).join("") : `<tr><td colspan="6">Os temas conclu\u00eddos aparecem aqui quando voc\u00ea mudar o status para Conclu\u00eddo.</td></tr>`;
}

function blockDurationValue(block) {
  return Number(block.duracao) || 0;
}

function studiedCycleHours(blocks = state.generatedBlocks) {
  return blocks
    .filter((block) => normalizeStatus(block.status) === "Conclu\u00eddo")
    .reduce((sum, block) => sum + blockDurationValue(block), 0);
}

function performanceTotals(blocks = state.generatedBlocks) {
  return blocks.reduce((total, block) => {
    updateBlockAccuracy(block);
    total.questoes += Number(block.questoes) || 0;
    total.acertos += Number(block.acertos) || 0;
    if (normalizeStatus(block.status) === "Conclu\u00eddo") total.horas += blockDurationValue(block);
    return total;
  }, { questoes: 0, acertos: 0, horas: 0 });
}

function difficultyScore(value) {
  return { Baixa: 1, "M\u00e9dia": 2, Alta: 3 }[value] || 2;
}

function difficultyLabelFromScore(value) {
  if (value >= 2.55) return "Alta";
  if (value <= 1.45) return "Baixa";
  return "M\u00e9dia";
}

function subjectPerformance(blocks = state.generatedBlocks) {
  const bySubject = new Map();
  blocks.forEach((block) => {
    if (!bySubject.has(block.materia)) {
      bySubject.set(block.materia, {
        materia: block.materia,
        concluidos: 0,
        horas: 0,
        questoes: 0,
        acertos: 0,
        reprogramadas: 0,
        difficultyTotal: 0,
        difficultyCount: 0,
      });
    }
    const item = bySubject.get(block.materia);
    updateBlockAccuracy(block);
    const isCompleted = normalizeStatus(block.status) === "Conclu\u00eddo";
    item.questoes += Number(block.questoes) || 0;
    item.acertos += Number(block.acertos) || 0;
    item.horas = (Number(item.horas) || 0) + (isCompleted ? blockDurationValue(block) : 0);
    item.concluidos += isCompleted ? 1 : 0;
    item.reprogramadas += normalizeStatus(block.status) === "Reprogramar" ? 1 : 0;
    item.difficultyTotal += difficultyScore(block.dificuldade);
    item.difficultyCount += 1;
  });

  return Array.from(bySubject.values()).map((item) => {
    const erros = Math.max(0, item.questoes - item.acertos);
    const percentual = item.questoes ? item.acertos / item.questoes : 0;
    const dificuldadeMedia = item.difficultyCount ? item.difficultyTotal / item.difficultyCount : 2;
    const situacao =
      item.questoes > 0 && percentual < 0.6 ? "Refor\u00e7o" :
      dificuldadeMedia >= 2.55 || item.reprogramadas >= 2 ? "Aten\u00e7\u00e3o" :
      item.concluidos > 0 ? "Em evolu\u00e7\u00e3o" :
      "Acompanhar";
    return { ...item, erros, percentual, dificuldadeMedia, situacao };
  }).sort((a, b) => a.percentual - b.percentual || b.reprogramadas - a.reprogramadas || a.materia.localeCompare(b.materia));
}

function cycleSummary(blocks = state.generatedBlocks, label = currentCycleLabel()) {
  const counts = Object.fromEntries(STATUS_OPTIONS.map((status) => [status, 0]));
  blocks.forEach((block) => {
    const status = normalizeStatus(block.status);
    counts[status] = (counts[status] || 0) + 1;
    updateBlockAccuracy(block);
  });
  const totals = performanceTotals(blocks);
  const errors = Math.max(0, totals.questoes - totals.acertos);
  const percent = totals.questoes ? totals.acertos / totals.questoes : 0;
  const reviewsCreated = blocks.reduce((total, block) => total + reviewCyclesFromBlock(block).length, 0);
  const subjects = subjectPerformance(blocks);
  const bestSubjects = subjects.filter((item) => item.questoes > 0).sort((a, b) => b.percentual - a.percentual).slice(0, 3);
  const attentionSubjects = subjects
    .filter((item) => item.situacao === "Refor\u00e7o" || item.situacao === "Aten\u00e7\u00e3o" || item.reprogramadas > 0)
    .slice(0, 4);
  const completed = blocks
    .filter((block) => normalizeStatus(block.status) === "Conclu\u00eddo")
    .map((block) => ({ ...completedEntryFromBlock(block), ciclo: label }));
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    label,
    finalizedAt: new Date().toISOString(),
    metasGeradas: blocks.length,
    metasConcluidas: counts["Conclu\u00eddo"] || 0,
    horasEstudadas: totals.horas,
    questoes: totals.questoes,
    acertos: totals.acertos,
    erros: errors,
    percentual: percent,
    counts,
    reviewsCreated,
    subjects,
    bestSubjects,
    attentionSubjects,
    completed,
  };
}

function renderCycleClosureSummary() {
  if (!els.cycleClosurePanel) return;
  if (!state.generatedBlocks.length) {
    els.cycleClosurePanel.hidden = false;
    els.cycleClosurePanel.innerHTML = `<div class="empty-panel">Gere metas antes de finalizar o ciclo.</div>`;
    return;
  }
  const summary = cycleSummary();
  const subjectList = (items, emptyText) => items.length ? items.map((item) => `
    <li><strong>${escapeHtml(item.materia)}</strong><span>${formatPercent(item.percentual)} de acerto &middot; ${item.questoes} quest\u00f5es</span></li>
  `).join("") : `<li><span>${emptyText}</span></li>`;

  els.cycleClosurePanel.hidden = false;
  els.cycleClosurePanel.innerHTML = `
    <div class="cycle-closure-card">
      <div class="cycle-closure-header">
        <div>
          <h3>Fechamento do ${summary.label}</h3>
          <p>Revise o desempenho do ciclo atual antes de salvar no Painel de Evolu\u00e7\u00e3o.</p>
        </div>
      </div>
      <div class="cycle-closure-grid">
        ${summaryItems([
          ["Quest\u00f5es feitas", summary.questoes],
          ["Horas estudadas", formatHours(summary.horasEstudadas)],
          ["Acertos", summary.acertos],
          ["Erros", summary.erros],
          ["% de acerto", formatPercent(summary.percentual)],
          ["Metas conclu\u00eddas", summary.counts["Conclu\u00eddo"] || 0],
          ["Em andamento", summary.counts["Em andamento"] || 0],
          ["N\u00e3o iniciadas", summary.counts["N\u00e3o iniciado"] || 0],
          ["Reprogramadas", summary.counts["Reprogramar"] || 0],
          ["Revis\u00f5es agendadas", summary.reviewsCreated],
        ])}
      </div>
      <div class="cycle-closure-lists">
        <div>
          <h4>Mat\u00e9rias com melhor desempenho</h4>
          <ul>${subjectList(summary.bestSubjects, "Ainda n\u00e3o h\u00e1 quest\u00f5es registradas.")}</ul>
        </div>
        <div>
          <h4>Mat\u00e9rias que precisam de refor\u00e7o</h4>
          <ul>${subjectList(summary.attentionSubjects, "Nenhuma mat\u00e9ria em aten\u00e7\u00e3o neste ciclo.")}</ul>
        </div>
      </div>
      <div class="cycle-closure-actions">
        <button class="ghost-button" type="button" data-cancel-cycle-close><i data-lucide="x"></i><span>Cancelar</span></button>
        <button class="primary-button" type="button" data-confirm-cycle-close><i data-lucide="check-circle-2"></i><span>Confirmar fechamento do ciclo</span></button>
      </div>
    </div>
  `;
  if (window.lucide) window.lucide.createIcons();
}

function confirmCycleClosure() {
  if (!state.generatedBlocks.length) return;
  const result = cycleSummary();
  state.cycleResults.push(result);
  state.cycleResults = state.cycleResults.slice(-60);
  if (els.cycleClosurePanel) els.cycleClosurePanel.hidden = true;
  completeCurrentWeekAndGenerateNext();
  renderEvolution();
  saveAppStateNow("Ciclo finalizado");
}

function aggregateHistoricalSubjects(results = state.cycleResults) {
  const map = new Map();
  results.flatMap((result) => result.subjects || []).forEach((subject) => {
    if (!map.has(subject.materia)) {
      map.set(subject.materia, {
        materia: subject.materia,
        concluidos: 0,
        questoes: 0,
        acertos: 0,
        reprogramadas: 0,
        difficultyTotal: 0,
        difficultyCount: 0,
      });
    }
    const item = map.get(subject.materia);
    item.concluidos += Number(subject.concluidos) || 0;
    item.questoes += Number(subject.questoes) || 0;
    item.acertos += Number(subject.acertos) || 0;
    item.reprogramadas += Number(subject.reprogramadas) || 0;
    item.difficultyTotal += (Number(subject.dificuldadeMedia) || 2) * (Number(subject.difficultyCount) || 1);
    item.difficultyCount += Number(subject.difficultyCount) || 1;
  });

  return Array.from(map.values()).map((item) => {
    const erros = Math.max(0, item.questoes - item.acertos);
    const percentual = item.questoes ? item.acertos / item.questoes : 0;
    const dificuldadeMedia = item.difficultyCount ? item.difficultyTotal / item.difficultyCount : 2;
    const situacao =
      item.questoes > 0 && percentual < 0.6 ? "Refor\u00e7o" :
      dificuldadeMedia >= 2.55 || item.reprogramadas >= 2 ? "Aten\u00e7\u00e3o" :
      item.concluidos > 0 ? "Em evolu\u00e7\u00e3o" :
      "Acompanhar";
    return { ...item, erros, percentual, dificuldadeMedia, situacao };
  }).sort((a, b) => a.materia.localeCompare(b.materia));
}

function liveCycleHasProgress() {
  return state.generatedBlocks.some((block) =>
    normalizeStatus(block.status) === "Conclu\u00eddo" ||
    Number(block.questoes) > 0 ||
    Number(block.acertos) > 0 ||
    reviewCyclesFromBlock(block).length > 0
  );
}

function liveCycleResult() {
  if (!state.generatedBlocks.length || !liveCycleHasProgress()) return null;
  return {
    ...cycleSummary(state.generatedBlocks, `${currentCycleLabel()} em andamento`),
    id: "current-live-cycle",
    finalizedAt: "",
    isLive: true,
  };
}

function dedupeCompletedEntries(entries = []) {
  const byEntry = new Map();
  entries.forEach((entry) => {
    const key = `${entry.ciclo || ""}::${topicKey(entry.materia, entry.assunto)}`;
    if (!byEntry.has(key)) {
      byEntry.set(key, entry);
      return;
    }
    const previous = byEntry.get(key);
    byEntry.set(key, {
      ...previous,
      ...entry,
      concluidoEm: previous.concluidoEm || entry.concluidoEm,
    });
  });
  return Array.from(byEntry.values());
}

function subjectPerformanceColor(percentual, questoes) {
  if (!questoes) return "#C7CDD6";
  if (percentual >= 0.75) return "#2E9E44";
  if (percentual >= 0.6) return "#D4A80C";
  if (percentual >= 0.4) return "#EA8C0B";
  return "#DC2626";
}

function renderSubjectChart(subjects) {
  if (!els.evolutionSubjectChart) return;
  const data = (subjects || []).filter((item) => item.concluidos > 0 || item.questoes > 0);
  if (!data.length) {
    els.evolutionSubjectChart.innerHTML = `<div class="empty-panel">Conclua metas com quest\u00f5es registradas para ver o desempenho por mat\u00e9ria.</div>`;
    return;
  }

  const rowHeight = 44;
  const labelWidth = 150;
  const barMaxWidth = 300;
  const paddingRight = 60;
  const width = labelWidth + barMaxWidth + paddingRight;
  const height = data.length * rowHeight + 12;

  const rows = data.map((item, index) => {
    const y = index * rowHeight + 6;
    const percentual = Number(item.percentual) || 0;
    const color = subjectPerformanceColor(percentual, item.questoes);
    const barWidth = item.questoes ? Math.max(4, percentual * barMaxWidth) : 0;
    const labelPct = item.questoes ? formatPercent(percentual) : "sem dados";
    const name = escapeHtml(shortText(item.materia, 24));
    return `
      <g>
        <text x="0" y="${y + rowHeight / 2}" dominant-baseline="middle" class="subject-chart-label">${name}</text>
        <rect x="${labelWidth}" y="${y + 8}" width="${barMaxWidth}" height="18" rx="9" fill="#EDF0F5"></rect>
        ${item.questoes ? `<rect x="${labelWidth}" y="${y + 8}" width="${barWidth}" height="18" rx="9" fill="${color}"></rect>` : ""}
        <text x="${labelWidth + (item.questoes ? barWidth : 0) + 8}" y="${y + 17}" dominant-baseline="middle" class="subject-chart-value">${labelPct}</text>
      </g>
    `;
  }).join("");

  els.evolutionSubjectChart.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" width="100%" role="img" aria-label="Desempenho por mat\u00e9ria: percentual de acerto">
      ${rows}
    </svg>
    <div class="subject-chart-legend">
      <span><i style="background:#2E9E44"></i>75%+</span>
      <span><i style="background:#D4A80C"></i>60-74%</span>
      <span><i style="background:#EA8C0B"></i>40-59%</span>
      <span><i style="background:#DC2626"></i>abaixo de 40%</span>
      <span><i style="background:#C7CDD6"></i>sem dados</span>
    </div>
  `;
}

function renderEvolution() {
  if (!els.evolutionGrid) return;
  const finalizedResults = state.cycleResults || [];
  const currentResult = liveCycleResult();
  const results = currentResult ? [...finalizedResults, currentResult] : finalizedResults;
  const hasResults = results.length > 0;
  if (els.evolutionEmpty) {
    els.evolutionEmpty.hidden = hasResults;
    els.evolutionEmpty.textContent = "Conclua uma meta ou finalize o primeiro ciclo para visualizar sua evolu\u00e7\u00e3o.";
  }
  if (els.evolutionSections) els.evolutionSections.hidden = !hasResults;

  const completed = dedupeCompletedEntries(results.flatMap((result) => result.completed || []));
  const totals = results.reduce((total, result) => {
    total.questoes += Number(result.questoes) || 0;
    total.acertos += Number(result.acertos) || 0;
    total.reviews += Number(result.reviewsCreated) || 0;
    total.horas += Number(result.horasEstudadas) || (result.completed || []).reduce((sum, block) => sum + (Number(block.duracao) || 0), 0);
    return total;
  }, { questoes: 0, acertos: 0, reviews: 0, horas: 0 });
  const percent = totals.questoes ? totals.acertos / totals.questoes : 0;
  const totalPlanned = plannedUnitCount("tight") || completed.length;
  const editalPercent = totalPlanned ? completed.length / totalPlanned : 0;
  const reviewRows = reviewScheduleRows("all");

  els.evolutionGrid.innerHTML = summaryItems([
    ["% do edital conclu\u00eddo", formatPercent(editalPercent)],
    ["Ciclos finalizados", finalizedResults.length],
    ["Temas conclu\u00eddos", completed.length],
    ["Horas estudadas", formatHours(totals.horas)],
    ["Quest\u00f5es feitas", totals.questoes],
    ["% geral de acerto", formatPercent(percent)],
    ["Revis\u00f5es pendentes", reviewRows.length],
  ]);

  if (!hasResults) return;

  if (els.evolutionCycleBody) {
    els.evolutionCycleBody.innerHTML = results.map((result) => `
      <tr>
        <td>${escapeHtml(result.label)}</td>
        <td>${result.metasGeradas || 0}</td>
        <td>${result.metasConcluidas || 0}</td>
        <td>${formatHours(result.horasEstudadas || (result.completed || []).reduce((sum, block) => sum + (Number(block.duracao) || 0), 0))}</td>
        <td>${result.questoes || 0}</td>
        <td>${formatPercent(result.percentual || 0)}</td>
        <td>${result.reviewsCreated || 0}</td>
      </tr>
    `).join("");
  }

  const subjects = aggregateHistoricalSubjects(results);
  if (els.evolutionSubjectBody) {
    els.evolutionSubjectBody.innerHTML = subjects.map((item) => `
      <tr>
        <td>${escapeHtml(item.materia)}</td>
        <td>${item.concluidos}</td>
        <td>${item.questoes}</td>
        <td>${item.acertos}</td>
        <td>${item.erros}</td>
        <td>${formatPercent(item.percentual)}</td>
        <td>${difficultyLabelFromScore(item.dificuldadeMedia)}</td>
        <td>${item.situacao}</td>
      </tr>
    `).join("");
  }

  const attention = subjects.filter((item) => item.situacao === "Refor\u00e7o" || item.situacao === "Aten\u00e7\u00e3o" || item.reprogramadas > 0);
  if (els.attentionSubjects) {
    els.attentionSubjects.innerHTML = attention.length ? attention.map((item) => `
      <article>
        <strong>${escapeHtml(item.materia)}</strong>
        <span>${formatPercent(item.percentual)} de acerto &middot; ${difficultyLabelFromScore(item.dificuldadeMedia)} dificuldade &middot; ${item.reprogramadas} reprograma\u00e7\u00f5es</span>
      </article>
    `).join("") : `<div class="empty-panel">Nenhuma mat\u00e9ria de aten\u00e7\u00e3o no hist\u00f3rico finalizado.</div>`;
  }

  if (els.evolutionCompletedBody) {
    els.evolutionCompletedBody.innerHTML = completed.length ? completed.map((block) => `
      <tr>
        <td>${block.concluidoEm || ""}</td>
        <td>${escapeHtml(block.ciclo || "")}</td>
        <td>${escapeHtml(block.materia)}</td>
        <td>${escapeHtml(block.assunto)}</td>
        <td>${formatDuration(block.duracao)}</td>
        <td>${block.questoes || 0}</td>
        <td>${formatPercent(block.percentual || 0)}</td>
      </tr>
    `).join("") : `<tr><td colspan="7">Nenhum conte\u00fado conclu\u00eddo em ciclos finalizados.</td></tr>`;
  }
}

function completedEntryFromBlock(block, weekLabel = els.referenceWeek.value) {
  return {
    concluidoEm: block.concluidoEm || new Date().toLocaleDateString("pt-BR"),
    semana: weekLabel || "",
    ciclo: block.ciclo || currentCycleLabel(),
    materia: block.materia,
    assunto: block.assunto,
    duracao: block.duracao,
    questoes: block.questoes || 0,
    acertos: block.acertos || 0,
    percentual: block.percentual || 0,
    dificuldade: block.dificuldade || "M\u00e9dia",
    reviewCycle: block.reviewCycle || "",
    reviewCycles: reviewCyclesFromBlock(block),
  };
}

function completedEntries() {
  const byTopic = new Map();
  [...state.completedHistory, ...state.generatedBlocks.filter((block) => normalizeStatus(block.status) === "Conclu\u00eddo").map((block) => completedEntryFromBlock(block))]
    .forEach((item) => {
      const key = topicKey(item.materia, item.assunto);
      if (!byTopic.has(key)) {
        byTopic.set(key, item);
        return;
      }
      const previous = byTopic.get(key);
      byTopic.set(key, {
        ...previous,
        ...item,
        concluidoEm: previous.concluidoEm || item.concluidoEm,
      });
    });
  return Array.from(byTopic.values());
}

function archiveCompletedFromCurrentWeek() {
  const weekLabel = els.referenceWeek.value;
  const existing = new Map(state.completedHistory.map((item) => [topicKey(item.materia, item.assunto), item]));
  state.generatedBlocks
    .filter((block) => normalizeStatus(block.status) === "Conclu\u00eddo")
    .forEach((block) => {
      if (!block.concluidoEm) block.concluidoEm = new Date().toLocaleDateString("pt-BR");
      const entry = completedEntryFromBlock(block, weekLabel);
      const key = topicKey(entry.materia, entry.assunto);
      existing.set(key, existing.has(key) ? { ...existing.get(key), ...entry, concluidoEm: existing.get(key).concluidoEm || entry.concluidoEm } : entry);
      syncReviewSource(entry, true);
    });
  state.completedHistory = Array.from(existing.values());
  return state.generatedBlocks.filter((block) => normalizeStatus(block.status) === "Conclu\u00eddo").length;
}

function syncCompletedHistoryForBlock(block) {
  if (!block || normalizeStatus(block.status) !== "Conclu\u00eddo") return;
  const weekLabel = els.referenceWeek.value;
  if (!block.concluidoEm) block.concluidoEm = new Date().toLocaleDateString("pt-BR");
  const entry = completedEntryFromBlock(block, weekLabel);
  const key = topicKey(entry.materia, entry.assunto);
  const existingIndex = state.completedHistory.findIndex((item) => topicKey(item.materia, item.assunto) === key);
  if (existingIndex >= 0) {
    const previous = state.completedHistory[existingIndex];
    state.completedHistory[existingIndex] = {
      ...previous,
      ...entry,
      concluidoEm: previous.concluidoEm || entry.concluidoEm,
    };
  } else {
    state.completedHistory.push(entry);
  }
  syncReviewSource(entry, true);
}

function dateToWeekInput(date) {
  const current = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = current.getUTCDay() || 7;
  current.setUTCDate(current.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(current.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((current - yearStart) / 86400000) + 1) / 7);
  return `${current.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function weekInputToDate(value) {
  const match = String(value || "").match(/^(\d{4})-W(\d{2})$/);
  if (!match) return new Date();
  const year = Number(match[1]);
  const week = Number(match[2]);
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const day = jan4.getUTCDay() || 7;
  jan4.setUTCDate(jan4.getUTCDate() - day + 1 + (week - 1) * 7);
  return new Date(jan4.getUTCFullYear(), jan4.getUTCMonth(), jan4.getUTCDate());
}

function advanceReferenceWeek() {
  const monday = weekInputToDate(els.referenceWeek.value);
  monday.setDate(monday.getDate() + 7);
  els.referenceWeek.value = dateToWeekInput(monday);
  updateGenerationSummary();
}

function snapshotCurrentCycle() {
  return {
    savedAt: new Date().toISOString(),
    referenceWeek: els.referenceWeek.value,
    distribution: structuredClone(state.distribution),
    generatedBlocks: structuredClone(state.generatedBlocks),
    completedHistory: structuredClone(state.completedHistory),
    reviews: structuredClone(state.reviews),
  };
}

function completeCurrentWeekAndGenerateNext() {
  if (!state.generatedBlocks.length) {
    generateSchedule();
    return;
  }
  state.cycleHistory.push(snapshotCurrentCycle());
  state.cycleHistory = state.cycleHistory.slice(-12);
  const completedCount = archiveCompletedFromCurrentWeek();
  advanceReferenceWeek();
  generateSchedule();
  els.scheduleStatus.textContent = `Novo ciclo gerado. ${completedCount} tema${completedCount === 1 ? "" : "s"} conclu\u00eddo${completedCount === 1 ? "" : "s"} arquivado${completedCount === 1 ? "" : "s"}.`;
  renderCompleted();
  saveAppStateNow("Novo ciclo salvo");
}

function restorePreviousCycle() {
  if (!state.cycleHistory.length) {
    alert("N\u00e3o h\u00e1 ciclo anterior salvo para restaurar.");
    return;
  }
  const previous = state.cycleHistory.pop();
  els.referenceWeek.value = previous.referenceWeek || els.referenceWeek.value;
  state.distribution = Array.isArray(previous.distribution) ? previous.distribution : [];
  state.generatedBlocks = Array.isArray(previous.generatedBlocks)
    ? previous.generatedBlocks.map((block) => ({ ...block, status: normalizeStatus(block.status) }))
    : [];
  state.completedHistory = Array.isArray(previous.completedHistory)
    ? previous.completedHistory.map((block) => ({ ...block, status: normalizeStatus(block.status || "Conclu\u00eddo") }))
    : [];
  state.reviews = Array.isArray(previous.reviews)
    ? previous.reviews.map((record) => normalizeAdaptiveReviewRecord(record))
    : state.reviews;
  if (state.generatedBlocks.length) setTabEnabled("cronograma", true);
  updateContestSummary();
  renderGeneratedSchedule();
  switchTab("cronograma");
  saveAppStateNow("Ciclo anterior restaurado");
}

function resetCycles() {
  const confirmed = confirm("Isso vai limpar metas geradas, temas conclu\u00eddos e hist\u00f3rico de ciclos, mantendo seu cadastro e conte\u00fado program\u00e1tico. Deseja reiniciar?");
  if (!confirmed) return;
  state.distribution = [];
  state.generatedBlocks = [];
  state.completedHistory = [];
  state.cycleHistory = [];
  state.cycleResults = [];
  state.reviews = [];
  setTabEnabled("cronograma", false);
  renderGeneratedSchedule();
  updateContestSummary();
  if (state.planningBase) switchTab("pesos");
  saveAppStateNow("Ciclos reiniciados");
}

function parseBrazilianDate(value) {
  const match = String(value || "").match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const [, day, month, year] = match.map(Number);
  return new Date(year, month - 1, day);
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function formatDateBR(date) {
  return date.toLocaleDateString("pt-BR");
}

function daysUntil(date) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target - today) / 86400000);
}

function reviewSourceKey(item) {
  return `${item.ciclo || currentCycleLabel()}::${topicKey(item.materia, item.assunto)}`;
}

function reviewRecordId(item, intervalKey) {
  return `${reviewSourceKey(item)}::${intervalKey}`;
}

function ensureReviewsArray() {
  if (!Array.isArray(state.reviews)) state.reviews = [];
  state.reviews = state.reviews.map((record) => normalizeAdaptiveReviewRecord(record));
}

function adaptiveReviewSourceKey(item = {}) {
  return "adaptive::" + (state.currentPlanId || "plan") + "::" + topicKey(item.materia, item.assunto);
}

function syncAdaptiveReviewForBlock(block, options = {}) {
  const engine = window.AdaptiveReviewEngine;
  if (!engine || !block?.materia?.trim() || !block?.assunto?.trim()) return null;
  const totalQuestoes = Math.max(0, Number(block.questoes) || 0);
  const acertos = Math.min(Math.max(0, Number(block.acertos) || 0), totalQuestoes);
  const sourceKey = adaptiveReviewSourceKey(block);
  const existing = state.reviews.find((record) => record.id === sourceKey);
  const outcome = engine.mergeReview(existing, {
    id: sourceKey,
    sourceKey,
    concursoId: state.currentPlanId || "",
    materia: block.materia,
    assunto: block.assunto,
    ciclo: block.ciclo || currentCycleLabel(),
  }, {
    percentual: totalQuestoes ? acertos / totalQuestoes : 0,
    acertos,
    totalQuestoes,
    dificuldade: block.dificuldade || "",
  }, new Date(), Boolean(options.manual));

  if (!outcome.record) return outcome;
  const index = state.reviews.findIndex((record) => record.id === sourceKey);
  if (index >= 0) state.reviews[index] = normalizeAdaptiveReviewRecord(outcome.record);
  else state.reviews.push(normalizeAdaptiveReviewRecord(outcome.record));
  return outcome;
}

function removePendingReviewRecords(sourceKey, selectedCycles = []) {
  const selected = new Set(selectedCycles);
  state.reviews = state.reviews.filter((record) => {
    if (record.sourceKey !== sourceKey) return true;
    if (record.status === "Conclu\u00edda") return true;
    return selected.has(record.intervalKey);
  });
}

function hasCompletedReviewSource(sourceKey, currentItem) {
  const historyHasSource = state.completedHistory.some((item) =>
    item !== currentItem &&
    reviewSourceKey(item) === sourceKey &&
    reviewCyclesFromBlock(item).length > 0
  );
  if (historyHasSource) return true;
  return state.generatedBlocks.some((block) =>
    block !== currentItem &&
    reviewSourceKey(block) === sourceKey &&
    normalizeStatus(block.status) === "Conclu\u00eddo" &&
    reviewCyclesFromBlock(block).length > 0
  );
}

function syncReviewSource(item, isCompleted = false) {
  ensureReviewsArray();
  const sourceKey = reviewSourceKey(item);
  const cycles = reviewCyclesFromBlock(item);
  if (!isCompleted && hasCompletedReviewSource(sourceKey, item)) return;
  removePendingReviewRecords(sourceKey, isCompleted ? cycles : []);
  if (!isCompleted || !cycles.length) return;

  const baseDate = parseBrazilianDate(item.concluidoEm) || new Date();
  const baseDateText = formatDateBR(baseDate);
  cycles.forEach((intervalKey) => {
    const interval = reviewInterval(intervalKey);
    if (!interval) return;
    const id = reviewRecordId(item, intervalKey);
    const dueDate = addDays(baseDate, interval.days);
    const existing = state.reviews.find((record) => record.id === id);
    if (existing) {
      if (existing.status !== "Conclu\u00edda") {
        existing.materia = item.materia;
        existing.assunto = item.assunto;
        existing.ciclo = item.ciclo || currentCycleLabel();
        existing.intervalKey = interval.key;
        existing.intervalLabel = interval.label;
        existing.dataBase = baseDateText;
        existing.dataPrevista = formatDateBR(dueDate);
      }
      return;
    }
    state.reviews.push({
      id,
      sourceKey,
      materia: item.materia,
      assunto: item.assunto,
      ciclo: item.ciclo || currentCycleLabel(),
      intervalKey: interval.key,
      intervalLabel: interval.label,
      dataBase: baseDateText,
      dataPrevista: formatDateBR(dueDate),
      status: "Pendente",
      createdAt: new Date().toISOString(),
    });
  });
}

function syncBlockReviewRecords(block) {
  syncReviewSource(block, normalizeStatus(block.status) === "Conclu\u00eddo");
}

function syncAllReviewRecords() {
  ensureReviewsArray();
  state.completedHistory.forEach((item) => syncReviewSource(item, true));
  state.generatedBlocks.forEach((block) => syncBlockReviewRecords(block));
}

function reviewStatusInfo(record) {
  const normalizedStatus = normalizeReviewStatus(record.status);
  if (normalizedStatus === "Cancelada") {
    return { label: "Cancelada", remaining: 0, group: "cancelled" };
  }
  if (isAdaptiveReview(record)) {
    if (normalizedStatus === "Concluída") {
      return { label: "Concluída", remaining: 0, group: "done" };
    }
    if (normalizedStatus === "Em revisão") {
      return { label: "Em revisão", remaining: 0, group: "today" };
    }
    const dueDate = parseBrazilianDate(record.dataPrevista) || new Date(record.disponivelEm || Date.now());
    const remaining = daysUntil(dueDate);
    if (remaining <= 0) return { label: "Disponível para revisão", remaining, group: "today" };
    return {
      label: record.disponibilidade || "Revisão disponível a partir de " + formatDateBR(dueDate),
      remaining,
      group: "upcoming",
    };
  }
  if (normalizedStatus === "Concluída") {
    return { label: "Conclu\u00edda", remaining: 0, group: "done" };
  }
  const dueDate = parseBrazilianDate(record.dataPrevista) || new Date();
  const remaining = daysUntil(dueDate);
  const label =
    remaining < 0 ? `${Math.abs(remaining)} dia${Math.abs(remaining) === 1 ? "" : "s"} em atraso` :
    remaining === 0 ? "Revisar hoje" :
    `Programada em ${remaining} dia${remaining === 1 ? "" : "s"}`;
  const group = remaining < 0 ? "overdue" : remaining === 0 ? "today" : "upcoming";
  return { label, remaining, group };
}

function reviewScheduleRows(filterValue = "") {
  syncAllReviewRecords();
  const selected = filterValue || els.reviewFilter?.value || "all";
  return state.reviews
    .map((record) => {
      const dueDate = parseBrazilianDate(record.dataPrevista) || new Date();
      return { ...record, dueDate, statusInfo: reviewStatusInfo(record) };
    })
    .filter((record) => {
      if (selected === "done") return record.status === "Concluída";
      if (["Concluída", "Cancelada"].includes(record.status)) return false;
      if (selected === "all") return true;
      return record.statusInfo.group === selected;
    })
    .sort((a, b) => a.dueDate - b.dueDate || a.materia.localeCompare(b.materia));
}

function adaptiveReviewManualActionMarkup(block, index) {
  if (!window.AdaptiveReviewEngine || !block?.materia || !block?.assunto) return "";
  const total = Number(block.questoes) || 0;
  const message = total < 10
    ? "Amostra menor que 10 questões: você pode criar uma revisão manualmente."
    : "A revisão adaptativa será atualizada ao salvar o desempenho.";
  return '<div class="adaptive-review-inline"><span>' + escapeHtml(message) + '</span><button class="ghost-button compact-button" type="button" data-create-adaptive-review="' + index + '">Criar revisão manual</button></div>';
}

function adaptiveReviewDetailsElement(record) {
  const wrapper = document.createElement("div");
  wrapper.className = "adaptive-review-details";
  const motive = record.motivo || {};
  const headline = document.createElement("p");
  headline.textContent = (record.intervalLabel || "Revisão adaptativa") + " · " + formatPercent(motive.percentual || 0) + " em " + (Number(motive.totalQuestoes) || 0) + " questões";
  wrapper.append(headline);
  const availability = document.createElement("p");
  availability.textContent = record.disponibilidade || "Revisão disponível a partir de " + (record.dataPrevista || "");
  wrapper.append(availability);
  const suggestion = document.createElement("p");
  suggestion.textContent = record.sugestao || "";
  wrapper.append(suggestion);
  const history = document.createElement("details");
  const summary = document.createElement("summary");
  summary.textContent = "Histórico de tentativas (" + (record.tentativas || []).length + ")";
  history.append(summary);
  const list = document.createElement("ul");
  (record.tentativas || []).slice(-6).reverse().forEach((attempt) => {
    const item = document.createElement("li");
    item.textContent = formatPercent(attempt.percentual || 0) + " · " + (Number(attempt.acertos) || 0) + "/" + (Number(attempt.totalQuestoes) || 0) + " questões";
    list.append(item);
  });
  history.append(list);
  wrapper.append(history);
  return wrapper;
}

function adaptiveReviewActionButton(label, action, id) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = action === "cancel" ? "ghost-button compact-button danger-button" : "ghost-button compact-button";
  button.dataset.adaptiveReviewAction = action;
  button.dataset.adaptiveReviewId = id;
  button.textContent = label;
  return button;
}

function renderAdaptiveReviewControls(reviewRows) {
  const tableRows = Array.from(els.reviewsBody?.querySelectorAll("tr") || []);
  reviewRows.forEach((record, index) => {
    if (!isAdaptiveReview(record)) return;
    const row = tableRows[index];
    const statusCell = row?.lastElementChild;
    if (!statusCell) return;
    statusCell.querySelector("[data-toggle-review-status]")?.setAttribute("hidden", "");
    statusCell.append(adaptiveReviewDetailsElement(record));
    const actions = document.createElement("div");
    actions.className = "adaptive-review-actions";
    if (record.status !== "Concluída" && record.status !== "Cancelada") {
      if (record.status !== "Em revisão") actions.append(adaptiveReviewActionButton("Iniciar", "start", record.id));
      actions.append(adaptiveReviewActionButton("Adiar", "postpone", record.id));
      actions.append(adaptiveReviewActionButton("Concluir", "complete", record.id));
      actions.append(adaptiveReviewActionButton("Questões", "questions", record.id));
      actions.append(adaptiveReviewActionButton("Cancelar", "cancel", record.id));
    }
    statusCell.append(actions);
  });
}

function updateAdaptiveReviewAction(id, action) {
  ensureReviewsArray();
  const record = state.reviews.find((item) => item.id === id && isAdaptiveReview(item));
  if (!record) return;
  if (action === "start") record.status = "Em revisão";
  if (action === "complete") {
    record.status = "Concluída";
    record.concluidaEm = new Date().toISOString();
  }
  if (action === "cancel") {
    record.status = "Cancelada";
    record.canceladaEm = new Date().toISOString();
  }
  if (action === "postpone") {
    const base = parseBrazilianDate(record.dataPrevista) || new Date();
    const next = addDays(base, 2);
    record.status = "Pendente";
    record.disponivelEm = next.toISOString();
    record.dataPrevista = formatDateBR(next);
    record.disponibilidade = "Revisão disponível a partir de " + record.dataPrevista;
  }
  if (action === "questions") {
    const value = Number(globalThis.prompt("Quantidade sugerida de questões para esta revisão:", String(record.questoesSugeridas || 6)));
    if (Number.isFinite(value) && value > 0) record.questoesSugeridas = Math.round(value);
  }
  record.atualizadaEm = new Date().toISOString();
  renderReviews();
  renderContinuePanel();
  renderEvolution();
  saveAppStateNow("Revisão adaptativa atualizada");
}

function renderReviews() {
  const reviewRows = reviewScheduleRows();
  const selected = els.reviewFilter?.selectedOptions?.[0]?.textContent || "revis\u00f5es";
  els.reviewsBody.innerHTML = reviewRows.length ? reviewRows.map((item) => {
    const isDone = item.status === "Conclu\u00edda";
    return `
      <tr>
        <td>${escapeHtml(item.intervalLabel || item.intervalKey)}</td>
        <td>${escapeHtml(item.materia)}</td>
        <td>${escapeHtml(item.assunto)}</td>
        <td>${escapeHtml(item.ciclo || "")}</td>
        <td>${escapeHtml(item.dataBase || "")}</td>
        <td>${escapeHtml(item.dataPrevista || "")}</td>
        <td>
          <span class="review-badge ${isDone ? "" : "muted"}">${item.statusInfo.label}</span>
          <button class="ghost-button compact-button" type="button" data-toggle-review-status="${escapeHtml(item.id)}">${isDone ? "Reabrir" : "Concluir"}</button>
        </td>
      </tr>
    `;
  }).join("") : `<tr><td colspan="7">Nenhum tema para ${selected}.</td></tr>`;
  renderAdaptiveReviewControls(reviewRows);
  if (window.lucide) window.lucide.createIcons();
}

function notebookKey(materia, assunto) {
  return `${String(materia || "").trim()}::${String(themeTitle(assunto) || "").trim()}`;
}

function plainTextToNotebookHtml(text) {
  const lines = String(text || "").replace(/\r\n/g, "\n").split("\n");
  return lines.map((line) => line.trim()
    ? `<p>${escapeHtml(line)}</p>`
    : `<p><br></p>`
  ).join("");
}

const NOTEBOOK_SAFE_CLASSES = new Set([
  "note-color-black",
  "note-color-muted",
  "note-color-blue",
  "note-color-red",
  "note-highlight",
  "note-size-normal",
  "note-size-large",
  "note-size-xlarge",
]);

function notebookSafeClassName(node) {
  if (!node?.classList) return "";
  return [...node.classList].filter((name) => NOTEBOOK_SAFE_CLASSES.has(name)).join(" ");
}

function notebookClassAttribute(node) {
  const className = notebookSafeClassName(node);
  return className ? ` class="${className}"` : "";
}

function notebookSafeImageSrc(node) {
  const src = (node.getAttribute("src") || "").trim();
  if (/^https?:\/\//i.test(src)) return src;
  return "";
}

function sanitizeNotebookHtml(value) {
  const raw = String(value || "");
  const source = /<\/?(p|br|strong|b|em|i|h[1-4]|ul|ol|li|div|span|mark|img|table|thead|tbody|tr|th|td)\b/i.test(raw) ? raw : plainTextToNotebookHtml(raw);
  const template = document.createElement("template");
  template.innerHTML = source;
  const allowed = new Set(["P", "BR", "STRONG", "B", "EM", "I", "H1", "H2", "H3", "H4", "UL", "OL", "LI", "SPAN", "MARK", "IMG", "TABLE", "THEAD", "TBODY", "TR", "TH", "TD"]);
  const walk = (node) => {
    if (node.nodeType === Node.TEXT_NODE) return escapeHtml(node.textContent || "");
    if (node.nodeType !== Node.ELEMENT_NODE) return "";
    if (node.tagName === "IMG") {
      const src = notebookSafeImageSrc(node);
      return src ? `<img src="${escapeHtml(src)}" alt="${escapeHtml(node.getAttribute("alt") || "")}" loading="lazy">` : "";
    }
    if (!allowed.has(node.tagName)) return [...node.childNodes].map(walk).join("");
    const children = [...node.childNodes].map(walk).join("");
    if (node.tagName === "BR") return "<br>";
    if (["B", "STRONG"].includes(node.tagName)) return `<strong>${children}</strong>`;
    if (["I", "EM"].includes(node.tagName)) return `<em>${children}</em>`;
    if (["H1", "H2", "H3", "H4"].includes(node.tagName)) return `<h3${notebookClassAttribute(node)}>${children}</h3>`;
    if (node.tagName === "UL") return `<ul>${children}</ul>`;
    if (node.tagName === "OL") return `<ul>${children}</ul>`;
    if (node.tagName === "LI") return `<li${notebookClassAttribute(node)}>${children}</li>`;
    if (node.tagName === "MARK") return `<span class="note-highlight">${children}</span>`;
    if (node.tagName === "TABLE") return `<table>${children}</table>`;
    if (node.tagName === "THEAD") return `<thead>${children}</thead>`;
    if (node.tagName === "TBODY") return `<tbody>${children}</tbody>`;
    if (node.tagName === "TR") return `<tr>${children}</tr>`;
    if (node.tagName === "TH") return `<th>${children || "<br>"}</th>`;
    if (node.tagName === "TD") return `<td>${children || "<br>"}</td>`;
    if (node.tagName === "SPAN") {
      const style = (node.getAttribute("style") || "").toLowerCase();
      const weight = style.match(/font-weight:\s*(\d+|bold)/);
      const isBold = Boolean(weight && (weight[1] === "bold" || Number(weight[1]) >= 600));
      const isItalic = /font-style:\s*italic/.test(style);
      const className = notebookSafeClassName(node);
      let inner = children;
      if (className) inner = `<span class="${className}">${inner}</span>`;
      if (isItalic) inner = `<em>${inner}</em>`;
      if (isBold) inner = `<strong>${inner}</strong>`;
      return inner;
    }
    return `<p${notebookClassAttribute(node)}>${children || "<br>"}</p>`;
  };
  return [...template.content.childNodes].map(walk).join("").trim();
}

function notebookHasContent(value) {
  const template = document.createElement("template");
  template.innerHTML = sanitizeNotebookHtml(value);
  return Boolean(template.content.textContent.trim());
}

function setNotebookEditorEnabled(enabled) {
  if (!els.notebookText) return;
  els.notebookText.contentEditable = enabled ? "true" : "false";
  els.notebookText.classList.toggle("is-disabled", !enabled);
}

function saveNotebookEditor() {
  if (!notebookSelection.assunto) return;
  const key = notebookKey(notebookSelection.materia, notebookSelection.assunto);
  state.notebook[key] = sanitizeNotebookHtml(els.notebookText.innerHTML);
  els.notebookStatus.textContent = "Salvo automaticamente";
  scheduleAutoSave();
}

function rememberNotebookHistory() {
  if (!els.notebookText || isUndoingNotebook) return;
  const current = sanitizeNotebookHtml(els.notebookText.innerHTML);
  if (notebookHistory[notebookHistory.length - 1] === current) return;
  notebookHistory.push(current);
  if (notebookHistory.length > 40) notebookHistory.shift();
}

function undoNotebookChange() {
  if (!els.notebookText || notebookHistory.length < 2) {
    document.execCommand("undo");
    saveNotebookEditor();
    return;
  }
  notebookHistory.pop();
  const previous = notebookHistory[notebookHistory.length - 1] || "";
  isUndoingNotebook = true;
  els.notebookText.innerHTML = previous;
  isUndoingNotebook = false;
  notebookSavedRange = null;
  saveNotebookEditor();
}

function notebookSelectionRange() {
  const selection = window.getSelection();
  if (selection && selection.rangeCount && !selection.isCollapsed) {
    const range = selection.getRangeAt(0);
    if (els.notebookText.contains(range.commonAncestorContainer)) {
      notebookSavedRange = range.cloneRange();
      return range;
    }
  }
  if (notebookSavedRange && els.notebookText.contains(notebookSavedRange.commonAncestorContainer)) {
    return notebookSavedRange.cloneRange();
  }
  return null;
}

function rememberNotebookSelection() {
  const selection = window.getSelection();
  if (!selection || !selection.rangeCount || selection.isCollapsed) return;
  const range = selection.getRangeAt(0);
  if (els.notebookText?.contains(range.commonAncestorContainer)) {
    notebookSavedRange = range.cloneRange();
  }
}

function restoreNotebookSelection() {
  if (!notebookSavedRange || !els.notebookText) return false;
  if (!els.notebookText.contains(notebookSavedRange.commonAncestorContainer)) return false;
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(notebookSavedRange.cloneRange());
  return true;
}

function nearestNotebookTextContainer(node) {
  const element = node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
  return element?.closest?.("p, li, h3, span, strong, em") || null;
}

function applyClassToTextNode(node, className) {
  if (!node.textContent) return null;
  const parent = node.parentElement;
  if (parent?.tagName === "SPAN") {
    parent.classList.add(className);
    return parent;
  }
  const span = document.createElement("span");
  span.className = className;
  node.replaceWith(span);
  span.appendChild(node);
  return span;
}

function applyNotebookClass(className) {
  const range = notebookSelectionRange();
  if (!range || !NOTEBOOK_SAFE_CLASSES.has(className)) return;
  rememberNotebookHistory();
  const selectedText = range.toString();

  // Coleta os nos de texto que intersectam a selecao, sem extrair blocos
  // inteiros (evita quebrar/duplicar paragrafos, que causava espacamento).
  const textNodes = [];
  const walker = document.createTreeWalker(els.notebookText, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.textContent) return NodeFilter.FILTER_REJECT;
      return range.intersectsNode(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    },
  });
  let current = walker.nextNode();
  while (current) {
    textNodes.push(current);
    current = walker.nextNode();
  }

  if (textNodes.length) {
    textNodes.forEach((node) => {
      let target = node;
      // Recorta as bordas da selecao no primeiro/ultimo no
      if (node === range.endContainer && range.endOffset < node.textContent.length) {
        target.splitText(range.endOffset);
      }
      if (node === range.startContainer && range.startOffset > 0) {
        target = node.splitText(range.startOffset);
      }
      applyClassToTextNode(target, className);
    });
  } else {
    // Selecao dentro de um unico no
    const span = document.createElement("span");
    span.className = className;
    span.appendChild(range.extractContents());
    range.insertNode(span);
  }

  const selection = window.getSelection();
  selection.removeAllRanges();
  els.notebookText.innerHTML = sanitizeNotebookHtml(els.notebookText.innerHTML);
  if (!els.notebookText.textContent.trim() && selectedText.trim()) {
    els.notebookText.innerHTML = `<p><span class="${className}">${escapeHtml(selectedText)}</span></p>`;
  }
  notebookSavedRange = null;
  saveNotebookEditor();
  rememberNotebookHistory();
}

function insertNotebookHtmlAtCursor(html) {
  els.notebookText.focus();
  const range = notebookSelectionRange();
  rememberNotebookHistory();
  const clean = sanitizeNotebookHtml(html);
  if (range) {
    const wrapper = document.createElement("div");
    wrapper.innerHTML = clean;
    const frag = document.createDocumentFragment();
    while (wrapper.firstChild) frag.appendChild(wrapper.firstChild);
    range.deleteContents();
    range.insertNode(frag);
  } else {
    els.notebookText.innerHTML += clean;
  }
  els.notebookText.innerHTML = sanitizeNotebookHtml(els.notebookText.innerHTML);
  notebookSavedRange = null;
  saveNotebookEditor();
  rememberNotebookHistory();
}

function insertNotebookImage() {
  const url = window.prompt("Cole o link (URL) da imagem:\n\nDica: hospede o mapa mental no Google Drive, Imgur ou similar e cole aqui o endere\u00e7o da imagem (deve come\u00e7ar com http).");
  if (!url) return;
  const trimmed = url.trim();
  if (!/^https?:\/\//i.test(trimmed)) {
    window.alert("O link precisa come\u00e7ar com http:// ou https://");
    return;
  }
  insertNotebookHtmlAtCursor(`<p><img src="${escapeHtml(trimmed)}" alt="imagem" loading="lazy"></p><p><br></p>`);
}

function insertNotebookTable() {
  const linhas = Math.max(1, Math.min(20, Number(window.prompt("Quantas linhas? (1 a 20)", "3")) || 0));
  if (!linhas) return;
  const colunas = Math.max(1, Math.min(10, Number(window.prompt("Quantas colunas? (1 a 10)", "3")) || 0));
  if (!colunas) return;
  let html = "<table><thead><tr>";
  for (let c = 0; c < colunas; c += 1) html += "<th><br></th>";
  html += "</tr></thead><tbody>";
  for (let r = 0; r < linhas - 1; r += 1) {
    html += "<tr>";
    for (let c = 0; c < colunas; c += 1) html += "<td><br></td>";
    html += "</tr>";
  }
  html += "</tbody></table><p><br></p>";
  insertNotebookHtmlAtCursor(html);
}

function cleanNotebookSelectionStyle() {
  const range = notebookSelectionRange();
  rememberNotebookHistory();
  if (!range) {
    els.notebookText.innerHTML = plainTextToNotebookHtml(els.notebookText.innerText || els.notebookText.textContent || "");
    saveNotebookEditor();
    return;
  }
  const text = range.toString();
  range.deleteContents();
  const textNode = document.createTextNode(text);
  range.insertNode(textNode);
  const selection = window.getSelection();
  selection.removeAllRanges();
  const nextRange = document.createRange();
  nextRange.setStartAfter(textNode);
  nextRange.collapse(true);
  selection.addRange(nextRange);
  els.notebookText.innerHTML = sanitizeNotebookHtml(els.notebookText.innerHTML);
  saveNotebookEditor();
}

function notebookSubjectGroups() {
  const map = new Map();
  state.rows.forEach((row) => {
    const materia = String(row.materia || "").trim();
    if (!materia || row.estudar === "Nao") return;
    if (!map.has(materia)) map.set(materia, []);
    const title = themeTitle(row.assunto || "");
    if (title && !map.get(materia).some((t) => t.title === title)) {
      map.get(materia).push({ title, assunto: row.assunto || "" });
    }
  });
  return map;
}

function renderErrors() {
  if (!els.notebookSubjects) return;
  const groups = notebookSubjectGroups();
  const materias = [...groups.keys()];

  if (!materias.length) {
    els.notebookSubjects.innerHTML = `<div class="empty-panel">Confirme o conte\u00fado program\u00e1tico para ver as mat\u00e9rias aqui.</div>`;
    els.notebookThemes.innerHTML = "";
    els.notebookEditorHeader.innerHTML = "";
    els.notebookText.innerHTML = "";
    setNotebookEditorEnabled(false);
    els.notebookStatus.textContent = "";
    return;
  }

  if (!notebookSelection.materia || !groups.has(notebookSelection.materia)) {
    notebookSelection = { materia: materias[0], assunto: "" };
  }

  els.notebookSubjects.innerHTML = materias.map((materia) => `
    <button type="button" class="notebook-item ${materia === notebookSelection.materia ? "is-active" : ""}" data-notebook-subject="${escapeHtml(materia)}">
      <span>${escapeHtml(materia)}</span>
      <small>${groups.get(materia).length} tema${groups.get(materia).length === 1 ? "" : "s"}</small>
    </button>
  `).join("");

  const themes = groups.get(notebookSelection.materia) || [];
  els.notebookThemes.innerHTML = themes.length ? themes.map((theme) => {
    const hasNote = notebookHasContent(state.notebook[notebookKey(notebookSelection.materia, theme.assunto)] || "");
    return `
      <button type="button" class="notebook-item ${theme.title === themeTitle(notebookSelection.assunto) ? "is-active" : ""}" data-notebook-theme="${escapeHtml(theme.assunto)}">
        <span>${escapeHtml(theme.title)}</span>
        ${hasNote ? `<small class="notebook-has-note"><i data-lucide="check"></i>resumo</small>` : ""}
      </button>
    `;
  }).join("") : `<div class="empty-panel">Nenhum tema nesta mat\u00e9ria.</div>`;

  renderNotebookEditor();
  if (window.lucide) window.lucide.createIcons();
}

function renderNotebookEditor() {
  if (!notebookSelection.assunto) {
    els.notebookEditorHeader.innerHTML = `<span class="notebook-hint">Selecione um tema para escrever o resumo.</span>`;
    els.notebookText.innerHTML = "";
    setNotebookEditorEnabled(false);
    els.notebookStatus.textContent = "";
    return;
  }
  const title = themeTitle(notebookSelection.assunto);
  const details = themeDetails(notebookSelection.assunto);
  els.notebookEditorHeader.innerHTML = `
    <strong>${escapeHtml(title)}</strong>
    ${details ? `<span>${escapeHtml(shortText(details, 160))}</span>` : ""}
  `;
  setNotebookEditorEnabled(true);
  els.notebookText.innerHTML = sanitizeNotebookHtml(state.notebook[notebookKey(notebookSelection.materia, notebookSelection.assunto)] || "");
  notebookHistory = [sanitizeNotebookHtml(els.notebookText.innerHTML)];
  notebookSavedRange = null;
  els.notebookStatus.textContent = "";
}

function downloadJson() {
  if (!state.planningBase) return;
  syncPlanningSliders();
  const payload = {
    ...state.planningBase,
    cadastro: getContestConfig(),
    distribuicao: state.distribution,
    cronograma: state.generatedBlocks,
    concluidos: completedEntries(),
    ciclosAnteriores: state.cycleHistory,
    ciclosFinalizados: state.cycleResults,
    revisoesPendentes: reviewScheduleRows("all"),
    erros: state.errors,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "planejamento-estudos.json";
  link.click();
  URL.revokeObjectURL(url);
}

function renderDailyInputs() {
  els.dailyHoursGrid.innerHTML = DAYS.map(([key, label]) => `
    <label>${label}
      <input data-day="${key}" type="number" min="0" step="0.5" placeholder="0" />
    </label>
  `).join("");
}

function defaultReferenceWeek() {
  els.referenceWeek.value = dateToWeekInput(new Date());
  renderCycleLabel();
}

function formatHours(value) {
  const number = Number(value) || 0;
  return `${Number(number.toFixed(2)).toString().replace(".", ",")}h`;
}

function formatDecimal(value) {
  if (!Number.isFinite(value)) return "0";
  return Number(value.toFixed(1)).toString().replace(".", ",");
}

function formatDuration(value) {
  const totalMinutes = Math.round((Number(value) || 0) * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes ? `${hours}h${String(minutes).padStart(2, "0")}` : `${hours}h`;
}

function blockTimerTotalSeconds(block) {
  return Math.max(0, Math.round((Number(block?.duracao) || 0) * 3600));
}

function formatTimerSeconds(seconds) {
  const safe = Math.max(0, Math.ceil(Number(seconds) || 0));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function normalizeBlockTimer(block) {
  if (!block) return 0;
  const total = blockTimerTotalSeconds(block);
  let remaining = Number.isFinite(Number(block.timerRemainingSeconds)) ? Number(block.timerRemainingSeconds) : total;
  if (block.timerRunning && block.timerStartedAt) {
    const elapsed = Math.max(0, (Date.now() - Number(block.timerStartedAt)) / 1000);
    remaining = Math.max(0, remaining - elapsed);
    if (remaining <= 0) {
      block.timerRunning = false;
      block.timerStartedAt = "";
      block.timerRemainingSeconds = 0;
    }
  }
  return Math.min(remaining, total || remaining);
}

function pauseBlockTimer(block) {
  if (!block) return;
  block.timerRemainingSeconds = normalizeBlockTimer(block);
  block.timerRunning = false;
  block.timerStartedAt = "";
}

function startBlockTimer(block) {
  if (!block) return;
  const remaining = normalizeBlockTimer(block);
  block.timerRemainingSeconds = remaining > 0 ? remaining : blockTimerTotalSeconds(block);
  block.timerRunning = true;
  block.timerStartedAt = Date.now();
}

function resetBlockTimer(block) {
  if (!block) return;
  block.timerRunning = false;
  block.timerStartedAt = "";
  block.timerRemainingSeconds = blockTimerTotalSeconds(block);
}

function goalTimerMarkup(block, index) {
  const remaining = normalizeBlockTimer(block);
  const running = Boolean(block.timerRunning);
  const finished = remaining <= 0 && blockTimerTotalSeconds(block) > 0;
  return `
    <div class="goal-timer ${running ? "is-running" : ""} ${finished ? "is-finished" : ""}" data-timer-card="${index}">
      <span>Tempo</span>
      <strong data-timer-display="${index}">${formatTimerSeconds(remaining)}</strong>
      <div class="goal-timer-actions">
        <button class="timer-button" type="button" data-timer-toggle="${index}" aria-label="${running ? "Pausar tempo" : "Iniciar tempo"}">
          <i data-lucide="${running ? "pause" : "play"}"></i>
        </button>
        <button class="timer-button" type="button" data-timer-reset="${index}" aria-label="Reiniciar tempo">
          <i data-lucide="rotate-ccw"></i>
        </button>
      </div>
    </div>
  `;
}

function updateVisibleGoalTimers() {
  let finishedAny = false;
  state.generatedBlocks.forEach((block, index) => {
    const wasRunning = Boolean(block.timerRunning);
    const remaining = normalizeBlockTimer(block);
    if (wasRunning && !block.timerRunning && remaining <= 0) finishedAny = true;
    const display = document.querySelector(`[data-timer-display="${index}"]`);
    const card = document.querySelector(`[data-timer-card="${index}"]`);
    const toggle = document.querySelector(`[data-timer-toggle="${index}"]`);
    if (display) display.textContent = formatTimerSeconds(remaining);
    if (card) {
      card.classList.toggle("is-running", Boolean(block.timerRunning));
      card.classList.toggle("is-finished", remaining <= 0 && blockTimerTotalSeconds(block) > 0);
    }
    if (toggle) {
      toggle.setAttribute("aria-label", block.timerRunning ? "Pausar tempo" : "Iniciar tempo");
      toggle.innerHTML = `<i data-lucide="${block.timerRunning ? "pause" : "play"}"></i>`;
    }
  });
  if (finishedAny) saveAppStateNow("Tempo finalizado");
  if (window.lucide) window.lucide.createIcons();
}

function ensureGoalTimerInterval() {
  if (goalTimerInterval) return;
  goalTimerInterval = window.setInterval(updateVisibleGoalTimers, 1000);
}

function parseDurationInput(value, fallback = 0) {
  const text = String(value || "").trim().toLowerCase().replace(",", ".");
  if (!text) return fallback;
  const colon = text.match(/^(\d+(?:\.\d+)?)\s*:\s*(\d{1,2})\s*h?$/);
  if (colon) return Number(colon[1]) + Number(colon[2]) / 60;
  const hourMinute = text.match(/^(\d+(?:\.\d+)?)\s*h(?:\s*(\d{1,2})\s*(?:m|min)?)?$/);
  if (hourMinute) return Number(hourMinute[1]) + (Number(hourMinute[2]) || 0) / 60;
  const minutes = text.match(/^(\d+)\s*(?:m|min)$/);
  if (minutes) return Number(minutes[1]) / 60;
  const decimal = Number(text.replace(/[^\d.]/g, ""));
  return Number.isFinite(decimal) && decimal > 0 ? decimal : fallback;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getActiveTabName() {
  return document.querySelector(".tab-button.active")?.dataset.tabTarget || "continuar";
}

function planStorageKey(planId) {
  return `${APP_STATE_KEY}:${planId}`;
}

function createPlanMeta(name = "Novo concurso") {
  const id = crypto.randomUUID ? crypto.randomUUID() : `plano-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return { id, name, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
}

function planDisplayName(snapshot = captureAppState()) {
  const form = snapshot.form || {};
  return form.contestName?.trim() || form.jobRole?.trim() || "Concurso sem nome";
}

function planVisibleName(plan = {}) {
  return plan.customName || plan.name || "Novo concurso";
}

function readPlansIndex() {
  try {
    const saved = JSON.parse(localStorage.getItem(PLANS_INDEX_KEY) || "[]");
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function writePlansIndex(plans = state.plans) {
  localStorage.setItem(PLANS_INDEX_KEY, JSON.stringify(plans));
}

function renderPlanSelect() {
  if (!els.planSelect) return;
  els.planSelect.innerHTML = state.plans.map((plan) => `<option value="${plan.id}" ${plan.id === state.currentPlanId ? "selected" : ""}>${escapeHtml(planVisibleName(plan))}</option>`).join("");
}

function formState() {
  return {
    contestName: els.contestName.value,
    examBoard: els.examBoard.value,
    jobRole: els.jobRole.value,
    examDate: els.examDate.value,
    planStartDate: els.planStartDate.value,
    weeklyHours: els.weeklyHours.value,
    blockDuration: els.blockDuration.value,
    referenceWeek: els.referenceWeek.value,
    overrideWeeklyHours: els.overrideWeeklyHours.value,
    overrideCycleEnabled: Boolean(els.overrideCycleToggle?.checked),
    allowResidualBlock: els.allowResidualBlock.checked,
    reviewFilter: els.reviewFilter?.value || "all",
    dailyHours: Object.fromEntries(DAYS.map(([key]) => [key, document.querySelector(`[data-day="${key}"]`)?.value || ""])),
  };
}

function applyFormState(data = {}) {
  els.contestName.value = data.contestName ?? "";
  els.examBoard.value = data.examBoard ?? "";
  els.jobRole.value = data.jobRole ?? "";
  els.examDate.value = data.examDate ?? "";
  els.planStartDate.value = data.planStartDate ?? "";
  els.weeklyHours.value = data.weeklyHours ?? "24";
  els.blockDuration.value = data.blockDuration ?? "1.5";
  els.referenceWeek.value = data.referenceWeek || els.referenceWeek.value;
  els.overrideWeeklyHours.value = data.overrideWeeklyHours ?? "";
  if (els.overrideCycleToggle) {
    els.overrideCycleToggle.checked = data.overrideCycleEnabled ?? Boolean(data.overrideWeeklyHours);
  }
  els.allowResidualBlock.checked = data.allowResidualBlock ?? true;
  updateOverrideVisibility();
  if (els.reviewFilter) {
    const allowedFilters = new Set(["all", "today", "overdue", "upcoming", "done"]);
    els.reviewFilter.value = allowedFilters.has(data.reviewFilter) ? data.reviewFilter : "all";
  }
  DAYS.forEach(([key]) => {
    const input = document.querySelector(`[data-day="${key}"]`);
    if (input) input.value = data.dailyHours?.[key] ?? "";
  });
}

function captureAppState() {
  syncRowsFromTable();
  syncPlanningSliders();
  return {
    version: 1,
    savedAt: new Date().toISOString(),
    activeTab: getActiveTabName(),
    form: formState(),
    programText: els.programText.value,
    rows: state.rows,
    confirmed: state.confirmed,
    planningBase: state.planningBase,
    distribution: state.distribution,
    generatedBlocks: state.generatedBlocks,
    completedHistory: state.completedHistory,
    cycleHistory: state.cycleHistory,
    cycleResults: state.cycleResults,
    reviews: state.reviews,
    errors: state.errors,
    notebook: state.notebook,
    locked: state.locked,
    showPendingOnly,
  };
}

function resetPlanningAccess() {
  ["pesos", "disponibilidade", "cronograma"].forEach((tab) => setTabEnabled(tab, false));
  els.confirmationStatus.textContent = "Aguardando cadastro";
  els.confirmationStatus.classList.remove("confirmed");
  els.planningGrid.innerHTML = "";
}

function applyAppSnapshot(saved = {}) {
  isRestoring = true;
  resetPlanningAccess();
  applyFormState(saved.form);
  els.programText.value = saved.programText || "";
  state.rows = Array.isArray(saved.rows) ? saved.rows : [];
  renderRows();
  updateContentFlowSteps();

  state.confirmed = Boolean(saved.confirmed);
  state.planningBase = saved.planningBase || null;
  state.distribution = Array.isArray(saved.distribution) ? saved.distribution : [];
  state.generatedBlocks = Array.isArray(saved.generatedBlocks)
    ? saved.generatedBlocks.map((block) => ({ ...block, status: normalizeStatus(block.status) }))
    : [];
  state.completedHistory = Array.isArray(saved.completedHistory)
    ? saved.completedHistory.map((block) => ({ ...block, status: normalizeStatus(block.status || "Conclu\u00eddo") }))
    : [];
  state.cycleHistory = Array.isArray(saved.cycleHistory)
    ? saved.cycleHistory.map((cycle) => ({
      ...cycle,
      generatedBlocks: Array.isArray(cycle.generatedBlocks)
        ? cycle.generatedBlocks.map((block) => ({ ...block, status: normalizeStatus(block.status) }))
        : [],
      completedHistory: Array.isArray(cycle.completedHistory)
        ? cycle.completedHistory.map((block) => ({ ...block, status: normalizeStatus(block.status || "Conclu\u00eddo") }))
        : [],
      reviews: Array.isArray(cycle.reviews)
        ? cycle.reviews.map((record) => normalizeAdaptiveReviewRecord(record))
        : [],
    }))
    : [];
  state.cycleResults = Array.isArray(saved.cycleResults) ? saved.cycleResults : [];
  state.reviews = Array.isArray(saved.reviews) ? saved.reviews.map((record) => normalizeAdaptiveReviewRecord(record)) : [];
  state.errors = Array.isArray(saved.errors) ? saved.errors : [];
  state.notebook = saved.notebook && typeof saved.notebook === "object" ? saved.notebook : {};
  state.locked = Boolean(saved.locked);
  showPendingOnly = Boolean(saved.showPendingOnly);

  updateContestSummary();
  if (state.planningBase) {
    ["pesos", "disponibilidade"].forEach((tab) => setTabEnabled(tab, true));
    renderPlanningBase();
  }
  if (state.generatedBlocks.length) {
    setTabEnabled("cronograma", true);
  }
  if (state.confirmed) {
    els.confirmationStatus.textContent = "\u2713 Conte\u00fado confirmado";
    els.confirmationStatus.classList.add("confirmed");
  }
  updateContentFlowSteps();
  renderGeneratedSchedule();
  applyLockState();
  switchTab("continuar");
  isRestoring = false;
}

function setSaveStatus(text) {
  if (els.saveStatus) els.saveStatus.textContent = text;
}

function readBackupMeta() {
  try {
    const raw = localStorage.getItem(BACKUP_META_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function backupMetaDate(meta) {
  if (!meta) return null;
  const date = meta.exportedAt ? new Date(meta.exportedAt) : new Date(`${meta.date || ""}T${meta.time || "00:00"}`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function renderBackupReminder() {
  if (!els.backupReminderStatus) return;
  const meta = readBackupMeta();
  const date = backupMetaDate(meta);
  if (!date) {
    els.backupReminderStatus.textContent = "Nenhum backup registrado neste navegador.";
    if (els.backupReminderNotice) {
      els.backupReminderNotice.hidden = true;
      els.backupReminderNotice.textContent = "";
    }
    return;
  }
  const formattedDate = date.toLocaleDateString("pt-BR");
  const formattedTime = date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  els.backupReminderStatus.textContent = `\u00daltimo backup: ${formattedDate} \u00e0s ${formattedTime}`;
  const isOutdated = Date.now() - date.getTime() > BACKUP_REMINDER_DAYS * 24 * 60 * 60 * 1000;
  if (els.backupReminderNotice) {
    els.backupReminderNotice.hidden = !isOutdated;
    els.backupReminderNotice.textContent = isOutdated ? "Recomendamos realizar um novo backup dos seus dados." : "";
  }
}

function rememberBackupExport(version = 1) {
  const now = new Date();
  const meta = {
    date: now.toISOString().slice(0, 10),
    time: now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
    version,
    exportedAt: now.toISOString(),
  };
  try {
    localStorage.setItem(BACKUP_META_KEY, JSON.stringify(meta));
  } catch {}
  renderBackupReminder();
}

function saveAppStateNow(label = "Salvo") {
  if (isRestoring) return;
  if (!state.currentPlanId) return;
  const snapshot = captureAppState();
  localStorage.setItem(planStorageKey(state.currentPlanId), JSON.stringify(snapshot));
  localStorage.setItem(ACTIVE_PLAN_KEY, state.currentPlanId);
  const name = planDisplayName(snapshot);
  state.plans = state.plans.map((plan) => plan.id === state.currentPlanId ? { ...plan, name: plan.customName || name, updatedAt: new Date().toISOString() } : plan);
  writePlansIndex();
  renderPlanSelect();
  setSaveStatus(`${label} ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`);
  saveConnectedDataFileSoon();
}

function scheduleAutoSave() {
  if (isRestoring) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => saveAppStateNow("Salvo"), 350);
}

function restoreAppState() {
  state.plans = readPlansIndex();
  const legacyRaw = localStorage.getItem(LEGACY_APP_STATE_KEY);

  if (!state.plans.length) {
    const firstPlan = createPlanMeta("Concurso 1");
    state.plans = [firstPlan];
    state.currentPlanId = firstPlan.id;
    writePlansIndex();
    localStorage.setItem(ACTIVE_PLAN_KEY, firstPlan.id);
    if (legacyRaw) localStorage.setItem(planStorageKey(firstPlan.id), legacyRaw);
  }

  state.currentPlanId = localStorage.getItem(ACTIVE_PLAN_KEY) || state.currentPlanId || state.plans[0]?.id || "";
  if (!state.plans.some((plan) => plan.id === state.currentPlanId)) {
    state.currentPlanId = state.plans[0]?.id || "";
  }
  renderPlanSelect();

  const raw = state.currentPlanId ? localStorage.getItem(planStorageKey(state.currentPlanId)) : "";
  if (!raw) return false;

  try {
    applyAppSnapshot(JSON.parse(raw));
  } catch {
    return false;
  }

  setSaveStatus("Dados restaurados");
  return true;
}

function supportsDataFileSync() {
  return "showOpenFilePicker" in window && "showSaveFilePicker" in window && "indexedDB" in window;
}

function dataFileTypeOptions() {
  return [{ description: "Dados do Meu Cronograma Concursos", accept: { "application/json": [".json"] } }];
}

function openDataHandleDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATA_FILE_DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(DATA_FILE_STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function finishTransaction(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

async function rememberDataFileHandle(handle) {
  try {
    const db = await openDataHandleDb();
    const transaction = db.transaction(DATA_FILE_STORE, "readwrite");
    transaction.objectStore(DATA_FILE_STORE).put(handle, DATA_FILE_KEY);
    await finishTransaction(transaction);
    db.close();
  } catch (error) {
    console.warn("Nao foi possivel lembrar o arquivo de dados.", error);
  }
}

async function getRememberedDataFileHandle() {
  try {
    const db = await openDataHandleDb();
    const transaction = db.transaction(DATA_FILE_STORE, "readonly");
    const request = transaction.objectStore(DATA_FILE_STORE).get(DATA_FILE_KEY);
    const handle = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return handle;
  } catch (error) {
    console.warn("Nao foi possivel recuperar o arquivo de dados.", error);
    return null;
  }
}

async function verifyDataFilePermission(handle, mode = "readwrite", requestAccess = true) {
  const options = { mode };
  if ((await handle.queryPermission(options)) === "granted") return true;
  if (!requestAccess) return false;
  return (await handle.requestPermission(options)) === "granted";
}

function dataFileUnavailableMessage() {
  alert("Este navegador nao permite salvar direto em arquivo. Use o Chrome ou Edge e mantenha Backup/Importar como alternativa.");
}

function captureDriveDataSnapshot() {
  const currentSnapshot = state.currentPlanId ? captureAppState() : null;
  const now = new Date().toISOString();
  const plans = state.plans.map((plan) => {
    if (plan.id !== state.currentPlanId || !currentSnapshot) return plan;
    return { ...plan, name: plan.customName || planDisplayName(currentSnapshot), updatedAt: now };
  });
  const planSnapshots = {};
  plans.forEach((plan) => {
    if (plan.id === state.currentPlanId && currentSnapshot) {
      planSnapshots[plan.id] = currentSnapshot;
      return;
    }
    try {
      const raw = localStorage.getItem(planStorageKey(plan.id));
      planSnapshots[plan.id] = raw ? JSON.parse(raw) : blankAppSnapshot(plan.name);
    } catch {
      planSnapshots[plan.id] = blankAppSnapshot(plan.name);
    }
  });
  return {
    dataType: "meu-cronograma-concursos-drive-data",
    version: 1,
    savedAt: now,
    activePlanId: state.currentPlanId,
    plans,
    planSnapshots,
  };
}

function applyDriveDataSnapshot(bundle = {}) {
  const snapshots = bundle.planSnapshots && typeof bundle.planSnapshots === "object" ? bundle.planSnapshots : {};
  const snapshotIds = Object.keys(snapshots);
  const incomingPlans = Array.isArray(bundle.plans)
    ? bundle.plans.filter((plan) => plan?.id && snapshots[plan.id])
    : snapshotIds.map((id, index) => ({ id, name: snapshots[id]?.form?.contestName || `Concurso ${index + 1}`, createdAt: snapshots[id]?.savedAt || new Date().toISOString(), updatedAt: snapshots[id]?.savedAt || new Date().toISOString() }));

  if (!incomingPlans.length && bundle.form) {
    applyAppSnapshot(bundle);
    return;
  }

  state.plans = incomingPlans.length ? incomingPlans : [createPlanMeta("Concurso 1")];
  state.currentPlanId = state.plans.some((plan) => plan.id === bundle.activePlanId) ? bundle.activePlanId : state.plans[0].id;
  writePlansIndex();
  state.plans.forEach((plan) => {
    const snapshot = snapshots[plan.id] || blankAppSnapshot(plan.name);
    localStorage.setItem(planStorageKey(plan.id), JSON.stringify(snapshot));
  });
  localStorage.setItem(ACTIVE_PLAN_KEY, state.currentPlanId);
  renderPlanSelect();
  applyAppSnapshot(snapshots[state.currentPlanId] || blankAppSnapshot(state.plans[0].name));
}
async function writeSnapshotToDataFile(label = "Drive salvo") {
  if (!dataFileHandle) {
    alert("Conecte ou crie um arquivo de dados primeiro.");
    return;
  }
  if (isWritingDataFile) return;
  try {
    if (!(await verifyDataFilePermission(dataFileHandle, "readwrite"))) {
      setSaveStatus("Autorize o arquivo do Drive");
      return;
    }
    isWritingDataFile = true;
    const writable = await dataFileHandle.createWritable();
    await writable.write(JSON.stringify(captureDriveDataSnapshot(), null, 2));
    await writable.close();
    setSaveStatus(`${label} ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`);
  } catch (error) {
    console.error(error);
    setSaveStatus("Nao consegui salvar no Drive");
  } finally {
    isWritingDataFile = false;
  }
}

function saveConnectedDataFileSoon() {
  if (!dataFileHandle || isRestoring) return;
  clearTimeout(dataFileSaveTimer);
  dataFileSaveTimer = setTimeout(() => writeSnapshotToDataFile("Drive salvo"), 900);
}

async function loadSnapshotFromDataFile(handle = dataFileHandle) {
  if (!handle) {
    alert("Conecte ou crie um arquivo de dados primeiro.");
    return;
  }
  try {
    if (!(await verifyDataFilePermission(handle, "read"))) {
      setSaveStatus("Autorize o arquivo do Drive");
      return;
    }
    const file = await handle.getFile();
    const text = await file.text();
    if (!text.trim()) {
      alert("O arquivo de dados esta vazio.");
      return;
    }
    const snapshot = JSON.parse(text);
    dataFileHandle = handle;
    await rememberDataFileHandle(handle);
    if (snapshot?.dataType === "meu-cronograma-concursos-drive-data") {
      applyDriveDataSnapshot(snapshot);
    } else {
      applyAppSnapshot(snapshot);
    }
    saveAppStateNow("Drive carregado");
  } catch (error) {
    console.error(error);
    alert("Nao consegui carregar esse arquivo de dados. Verifique se ele e um JSON valido do sistema.");
  }
}

async function connectDataFile() {
  if (!supportsDataFileSync()) {
    dataFileUnavailableMessage();
    return;
  }
  try {
    const [handle] = await window.showOpenFilePicker({
      multiple: false,
      types: dataFileTypeOptions(),
    });
    if (!handle) return;
    dataFileHandle = handle;
    await rememberDataFileHandle(handle);
    await loadSnapshotFromDataFile(handle);
    setSaveStatus("Arquivo do Drive conectado");
  } catch (error) {
    if (error?.name !== "AbortError") {
      console.error(error);
      alert("Nao consegui conectar o arquivo de dados.");
    }
  }
}

async function createDataFile() {
  if (!supportsDataFileSync()) {
    dataFileUnavailableMessage();
    return;
  }
  try {
    const handle = await window.showSaveFilePicker({
      suggestedName: "meu-cronograma-concursos-dados.json",
      types: dataFileTypeOptions(),
    });
    dataFileHandle = handle;
    await rememberDataFileHandle(handle);
    await writeSnapshotToDataFile("Arquivo do Drive criado");
  } catch (error) {
    if (error?.name !== "AbortError") {
      console.error(error);
      alert("Nao consegui criar o arquivo de dados.");
    }
  }
}

async function restoreRememberedDataFile() {
  if (!supportsDataFileSync()) return;
  const handle = await getRememberedDataFileHandle();
  if (!handle) return;
  dataFileHandle = handle;
  try {
    const hasPermission = await verifyDataFilePermission(handle, "readwrite", false);
    setSaveStatus(hasPermission ? "Arquivo do Drive conectado" : "Conecte o arquivo do Drive");
  } catch {
    setSaveStatus("Conecte o arquivo do Drive");
  }
}

function exportBackup() {
  saveAppStateNow("Salvo");
  const snapshot = captureAppState();
  const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `planeja-concursos-backup-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
  rememberBackupExport(snapshot.version || 1);
}

async function importBackup(file) {
  if (!file) return;
  const text = await file.text();
  JSON.parse(text);
  if (!state.currentPlanId) {
    const plan = createPlanMeta("Backup importado");
    state.plans.push(plan);
    state.currentPlanId = plan.id;
    writePlansIndex();
  }
  localStorage.setItem(planStorageKey(state.currentPlanId), text);
  applyAppSnapshot(JSON.parse(text));
  saveAppStateNow("Backup importado");
}

function blankAppSnapshot(name = "") {
  return {
    version: 2,
    savedAt: new Date().toISOString(),
    activeTab: "continuar",
    form: {
      contestName: name,
      weeklyHours: "24",
      blockDuration: "1.5",
      referenceWeek: dateToWeekInput(new Date()),
      overrideWeeklyHours: "",
      overrideCycleEnabled: false,
      allowResidualBlock: true,
      reviewFilter: "all",
      dailyHours: {},
    },
    programText: "",
    rows: [],
    confirmed: false,
    planningBase: null,
    distribution: [],
    generatedBlocks: [],
    completedHistory: [],
    cycleHistory: [],
    cycleResults: [],
    reviews: [],
    errors: [],
    showPendingOnly: false,
  };
}

function switchPlan(planId) {
  if (!planId || planId === state.currentPlanId) return;
  saveAppStateNow("Salvo");
  state.currentPlanId = planId;
  localStorage.setItem(ACTIVE_PLAN_KEY, planId);
  renderPlanSelect();
  const raw = localStorage.getItem(planStorageKey(planId));
  applyAppSnapshot(raw ? JSON.parse(raw) : blankAppSnapshot());
  setSaveStatus("Planejamento carregado");
}

function createNewPlan() {
  saveAppStateNow("Salvo");
  const name = prompt("Nome do novo concurso:", "Novo concurso");
  if (name === null) return;
  const plan = createPlanMeta(name.trim() || "Novo concurso");
  plan.customName = plan.name;
  state.plans.push(plan);
  state.currentPlanId = plan.id;
  writePlansIndex();
  localStorage.setItem(ACTIVE_PLAN_KEY, plan.id);
  renderPlanSelect();
  applyAppSnapshot(blankAppSnapshot(plan.name));
  saveAppStateNow("Novo concurso criado");
  switchTab("concurso");
}

function activePlan() {
  return state.plans.find((plan) => plan.id === state.currentPlanId) || null;
}

function closePlanMenu() {
  if (!els.planMenu) return;
  els.planMenu.hidden = true;
  els.planMenuButton?.setAttribute("aria-expanded", "false");
}

function togglePlanMenu() {
  if (!els.planMenu) return;
  const willOpen = els.planMenu.hidden;
  els.planMenu.hidden = !willOpen;
  els.planMenuButton?.setAttribute("aria-expanded", willOpen ? "true" : "false");
}

function renameCurrentPlan() {
  const plan = activePlan();
  if (!plan) return;
  closePlanMenu();
  const currentName = planVisibleName(plan);
  const nextName = prompt("Novo nome do concurso:", currentName);
  if (nextName === null) return;
  const cleanName = nextName.trim();
  if (!cleanName || cleanName === currentName) return;
  state.plans = state.plans.map((item) => item.id === plan.id ? { ...item, name: cleanName, customName: cleanName, updatedAt: new Date().toISOString() } : item);
  writePlansIndex();
  renderPlanSelect();
  saveConnectedDataFileSoon();
  showToast("Planejamento renomeado.");
}

function openDeletePlanModal() {
  const plan = activePlan();
  if (!plan || !els.deletePlanModal) return;
  closePlanMenu();
  if (els.deletePlanQuestion) {
    els.deletePlanQuestion.textContent = `Excluir o planejamento '${planVisibleName(plan)}'?`;
  }
  els.deletePlanModal.hidden = false;
  els.confirmDeletePlanButton?.focus();
}

function closeDeletePlanModal() {
  if (!els.deletePlanModal) return;
  els.deletePlanModal.hidden = true;
}

function newestPlan(plans = []) {
  return [...plans].sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0))[0] || null;
}

function deleteCurrentPlan() {
  const plan = activePlan();
  if (!plan) return;
  const deletedId = plan.id;
  localStorage.removeItem(planStorageKey(deletedId));
  let remaining = state.plans.filter((item) => item.id !== deletedId);
  let nextPlan = newestPlan(remaining);

  if (!nextPlan) {
    nextPlan = createPlanMeta("Novo concurso");
    nextPlan.customName = nextPlan.name;
    remaining = [nextPlan];
    localStorage.setItem(planStorageKey(nextPlan.id), JSON.stringify(blankAppSnapshot(nextPlan.name)));
  }

  state.plans = remaining;
  state.currentPlanId = nextPlan.id;
  writePlansIndex();
  localStorage.setItem(ACTIVE_PLAN_KEY, nextPlan.id);
  renderPlanSelect();
  const raw = localStorage.getItem(planStorageKey(nextPlan.id));
  closeDeletePlanModal();
  applyAppSnapshot(raw ? JSON.parse(raw) : blankAppSnapshot(planVisibleName(nextPlan)));
  saveAppStateNow("Planejamento exclu\u00eddo");
  showToast("Planejamento exclu\u00eddo.");
  switchTab("continuar");
}

els.tabs.forEach((button) => button.addEventListener("click", () => switchTab(button.dataset.tabTarget, button)));
els.planMenuButton?.addEventListener("click", (event) => {
  event.stopPropagation();
  togglePlanMenu();
});
els.planMenu?.addEventListener("click", (event) => {
  if (event.target.closest("[data-rename-plan]")) {
    renameCurrentPlan();
    return;
  }
  if (event.target.closest("[data-delete-plan]")) {
    openDeletePlanModal();
  }
});
els.cancelDeletePlanButton?.addEventListener("click", closeDeletePlanModal);
els.cancelDeletePlanBackdrop?.addEventListener("click", closeDeletePlanModal);
els.confirmDeletePlanButton?.addEventListener("click", deleteCurrentPlan);
els.continuePanel?.addEventListener("click", (event) => {
  const startButton = event.target.closest("[data-start-continue]");
  if (startButton) {
    const index = Number(startButton.dataset.startContinue);
    const block = state.generatedBlocks[index];
    if (!block) return;
    startBlockTimer(block);
    unitDetailIndex = index;
    performanceEditIndex = -1;
    renderGeneratedSchedule();
    switchTab("cronograma");
    saveAppStateNow("Estudo iniciado");
    return;
  }

  if (event.target.closest("[data-next-continue]")) {
    const pending = rankedContinueEntries();
    if (pending.length > 1) {
      continueSuggestionOffset = (continueSuggestionOffset + 1) % pending.length;
      renderContinuePanel();
    }
    return;
  }

  if (event.target.closest("[data-open-cycle-goals]")) {
    switchTab("cronograma");
    return;
  }

  if (event.target.closest("[data-open-reviews]")) {
    switchTab("revisoes");
    return;
  }

  if (event.target.closest("[data-open-evolution]")) {
    switchTab("evolucao");
    return;
  }

  if (event.target.closest("[data-continue-generate]")) {
    switchTab("pesos");
  }
});
els.planSelect?.addEventListener("change", () => switchPlan(els.planSelect.value));
els.newPlanButton?.addEventListener("click", createNewPlan);
if (window.EditalImportUI) {
  window.EditalImportUI.configure({
    hasExistingRows: () => state.rows.length > 0,
    onConfirm: applyAssistedImportRows,
  });
}
els.assistedImportButton?.addEventListener("click", () => els.assistedFileInput?.click());
els.assistedFileInput?.addEventListener("change", async () => {
  const file = els.assistedFileInput.files?.[0];
  if (!file || !window.EditalImportUI) return;
  await window.EditalImportUI.start(file);
  els.assistedFileInput.value = "";
});
if (els.fileInput) els.fileInput.addEventListener("change", async () => {
  const file = els.fileInput.files[0];
  if (!file) return;
  els.fileName.textContent = file.name;
  try {
    const text = await readFile(file);
    const formatted = formatImportedProgramText(text);
    els.programText.value = formatted;
    addHistory(file.name, formatted);
  } catch (error) {
    alert(error.message);
  }
});

els.processButton.addEventListener("click", () => {
  const text = formatImportedProgramText(els.programText.value);
  if (!text.trim()) {
    alert("Informe o conte\u00fado program\u00e1tico antes de processar.");
    return;
  }
  els.programText.value = text;
  addHistory("colagem manual", text);
  state.rows = organizeRowsByTheme(parseProgramContent(text)).map((row) => enrichThemeRow({ ...row, estudar: "Sim" }));
  renderRows();
  notifyContent("Conte\u00fado organizado para confer\u00eancia.");
});

if (els.clearButton) els.clearButton.addEventListener("click", clearImportedContent);

if (els.historySelect) els.historySelect.addEventListener("change", () => {
  const entry = state.originalHistory.find((item) => item.id === els.historySelect.value);
  if (entry) {
    els.programText.value = entry.text;
  }
});

els.addRowButton?.addEventListener("click", () => {
  syncRowsFromTable();
  state.rows.push(enrichThemeRow({ materia: "", assunto: "", ordem: 1, estudar: "Sim", observacoes: "" }));
  renderRows();
});

els.organizeThemesButton?.addEventListener("click", organizeThemesFromTable);

els.selectAllTopicsButton?.addEventListener("click", () => {
  const shouldSelect = !allTopicsSelected();
  setAllTopicChecks(shouldSelect);
  syncRowsFromTable();
  renderContentSummary();
  updateSubjectStudyCounts();
  markUnconfirmed();
  notifyContent(shouldSelect ? "Todos os temas foram selecionados para o ciclo." : "Todos os temas foram desmarcados.");
});

els.deleteButton?.addEventListener("click", () => {
  const selected = selectedRows();
  if (!selected.length) return;
  selected.forEach((tr) => tr.remove());
  renumberRows();
});

els.splitButton?.addEventListener("click", () => {
  const selected = selectedRows();
  if (selected.length !== 1) return;
  const row = rowFromInputs(selected[0]);
  const parts = splitTopics(row.assunto);
  if (parts.length < 2) return;
  syncRowsFromTable();
  const index = [...els.topicsBody.querySelectorAll(".topic-item, tr")].indexOf(selected[0]);
  state.rows.splice(index, 1, ...parts.map((part) => enrichThemeRow({ ...row, assunto: normalizeTopic(part) })));
  renumberRows({ sync: false });
  notifyContent("Tema separado com sucesso.");
});

els.selectAll?.addEventListener("change", () => {
  setAllTopicChecks(els.selectAll.checked);
  syncRowsFromTable();
  renderContentSummary();
  updateSubjectStudyCounts();
  markUnconfirmed();
});

els.topicsBody.addEventListener("click", (event) => {
  const mergeSelected = event.target.closest("[data-merge-selected]");
  if (mergeSelected) {
    event.preventDefault();
    const group = mergeSelected.closest(".subject-group");
    mergeSelectedTopicItems(selectedTopicItemsForMerge(group));
    return;
  }

  const editSubject = event.target.closest("[data-edit-subject]");
  if (editSubject) {
    event.preventDefault();
    editSubject.closest(".more-actions")?.removeAttribute("open");
    const group = editSubject.closest(".subject-group");
    const oldName = group?.dataset.subjectName || "";
    const nextName = prompt("Editar nome da mat\u00e9ria:", oldName);
    if (nextName === null) return;
    syncRowsFromTable();
    state.rows = state.rows.map((row) => row.materia === oldName ? { ...row, materia: nextName.trim() || oldName } : row);
    renderRows();
    notifyContent("Mat\u00e9ria editada com sucesso.");
    return;
  }

  const topic = event.target.closest(".topic-item");
  if (!topic) return;

  if (event.target.closest("[data-focus-topic]")) {
    event.preventDefault();
    topic.querySelector("[data-theme-title]")?.focus();
  }

  if (event.target.closest("[data-toggle-merge-select]")) {
    event.preventDefault();
    topic.classList.toggle("is-merge-selected");
    const button = topic.querySelector("[data-toggle-merge-select]");
    const selected = topic.classList.contains("is-merge-selected");
    if (button) button.textContent = selected ? "Remover da jun\u00e7\u00e3o" : "Selecionar para juntar";
    updateMergeSelectionState(topic.closest(".subject-group"));
    topic.querySelector(".topic-actions-menu")?.removeAttribute("open");
    return;
  }

  if (event.target.closest("[data-toggle-observation]")) {
    event.preventDefault();
    const observation = topic.querySelector(".topic-observation");
    if (observation) observation.hidden = !observation.hidden;
    topic.querySelector(".topic-actions-menu")?.removeAttribute("open");
    return;
  }

  if (event.target.closest("[data-toggle-topic-summary]")) {
    event.preventDefault();
    const summary = topic.querySelector(".topic-summary-panel");
    if (summary) summary.hidden = !summary.hidden;
    topic.querySelector(".topic-actions-menu")?.removeAttribute("open");
    return;
  }

  if (event.target.closest("[data-split-topic]")) {
    event.preventDefault();
    const splitPanel = topic.querySelector(".topic-split-panel");
    if (splitPanel) splitPanel.hidden = !splitPanel.hidden;
    topic.querySelector(".topic-actions-menu")?.removeAttribute("open");
    return;
  }

  if (event.target.closest("[data-cancel-split]")) {
    event.preventDefault();
    const splitPanel = topic.querySelector(".topic-split-panel");
    if (splitPanel) splitPanel.hidden = true;
    return;
  }

  if (event.target.closest("[data-confirm-split]")) {
    event.preventDefault();
    const input = topic.querySelector("[data-split-input]");
    const row = rowFromInputs(topic);
    const parts = rowsFromManualSplit(row, input?.value || "");
    if (parts.length < 2) {
      notifyContent("Informe pelo menos dois temas para separar.", "warning");
      return;
    }
    syncRowsFromTable();
    const index = [...els.topicsBody.querySelectorAll(".topic-item")].indexOf(topic);
    state.rows.splice(index, 1, ...parts);
    recentTopicFeedback = { type: "split", keys: parts.map((row) => topicKey(row.materia, row.assunto)) };
    renumberRows({ sync: false });
    notifyContent(`Tema separado em ${parts.length} novos temas.`);
    return;
  }

  if (event.target.closest("[data-merge-topic]")) {
    event.preventDefault();
    syncRowsFromTable();
    const items = [...els.topicsBody.querySelectorAll(".topic-item")];
    const index = items.indexOf(topic);
    const row = state.rows[index];
    const previousIndex = state.rows.findLastIndex((item, itemIndex) => itemIndex < index && normalizeForMatch(item.materia) === normalizeForMatch(row.materia));
    if (previousIndex < 0) return;
    const previous = state.rows[previousIndex];
    state.rows[previousIndex] = enrichThemeRow({
      ...previous,
      assunto: `${themeTitle(previous.assunto)} + ${themeTitle(row.assunto)}: ${[themeDetails(previous.assunto), themeDetails(row.assunto)].filter(Boolean).join("; ")}`,
      observacoes: [previous.observacoes, row.observacoes].filter(Boolean).join("\n"),
    });
    state.rows.splice(index, 1);
    renumberRows({ sync: false });
    notifyContent("Temas juntados com sucesso.");
    return;
  }

  if (event.target.closest("[data-delete-topic]")) {
    event.preventDefault();
    topic.remove();
    renumberRows();
    notifyContent("Tema exclu\u00eddo.");
  }
});

els.topicsBody.addEventListener("input", (event) => {
  if (event.target.matches("[data-split-input]")) {
    const panel = event.target.closest(".topic-split-panel");
    const preview = panel?.querySelector("[data-split-preview]");
    if (preview) preview.textContent = splitPreviewText(event.target.value);
  }
  markUnconfirmed();
});
els.topicsBody.addEventListener("change", (event) => {
  syncRowsFromTable();
  renderContentSummary();
  updateSubjectStudyCounts();
  markUnconfirmed();
});
els.confirmButton.addEventListener("click", confirmRows);
els.backToContestButton?.addEventListener("click", () => switchTab("concurso"));
els.saveContentButton?.addEventListener("click", () => saveAppStateNow("Conte\u00fado salvo"));
els.planningGrid.addEventListener("input", (event) => {
  if (event.target.matches(".subject-slider")) {
    updateSliderOutput(event.target);
    syncPlanningSliders();
    updateGenerationSummary();
  }
});
els.planningGrid.addEventListener("click", (event) => {
  const editButton = event.target.closest("[data-edit-priority]");
  if (editButton) {
    const index = Number(editButton.dataset.editPriority);
    priorityEditIndex = priorityEditIndex === index ? -1 : index;
    renderPlanningBase();
    return;
  }

  const scaleButton = event.target.closest("[data-scale-index]");
  if (!scaleButton || !state.planningBase) return;
  const index = Number(scaleButton.dataset.scaleIndex);
  const field = scaleButton.dataset.scaleField;
  const value = Number(scaleButton.dataset.scaleValue);
  const subject = state.planningBase.materias[index];
  if (!subject || !["peso", "dominio"].includes(field)) return;
  subject[field] = value;
  subject.prioridade = priorityScore(subject);
  priorityEditIndex = index;
  renderPlanningBase();
});
els.scheduleWrap.addEventListener("click", (event) => {
  const timerToggle = event.target.closest("[data-timer-toggle]");
  if (timerToggle) {
    const index = Number(timerToggle.dataset.timerToggle);
    const block = state.generatedBlocks[index];
    if (!block) return;
    if (block.timerRunning) {
      pauseBlockTimer(block);
    } else {
      startBlockTimer(block);
    }
    updateVisibleGoalTimers();
    saveAppStateNow(block.timerRunning ? "Tempo iniciado" : "Tempo pausado");
    return;
  }

  const timerReset = event.target.closest("[data-timer-reset]");
  if (timerReset) {
    const index = Number(timerReset.dataset.timerReset);
    const block = state.generatedBlocks[index];
    if (!block) return;
    resetBlockTimer(block);
    updateVisibleGoalTimers();
    saveAppStateNow("Tempo reiniciado");
    return;
  }

  if (event.target.closest("[data-close-performance]")) {
    closePerformancePanelAnimated();
    return;
  }

  if (event.target.closest("[data-save-performance]")) {
    let adaptiveOutcome = null;
    if (performanceEditIndex >= 0) {
      const block = state.generatedBlocks[performanceEditIndex];
      if (block) {
        if (normalizeStatus(block.status) === "Concluído" && !block.concluidoEm) {
          block.concluidoEm = new Date().toLocaleDateString("pt-BR");
        }
        syncCompletedHistoryForBlock(block);
        syncBlockReviewRecords(block);
        adaptiveOutcome = syncAdaptiveReviewForBlock(block);
      }
    }
    closePerformancePanelAnimated(() => {
      renderCompleted();
      renderReviews();
      renderEvolution();
      saveAppStateNow("Desempenho salvo");
      if (adaptiveOutcome?.record?.status === "Concluída") {
        showToast("Bom resultado: a revisão adaptativa deste tema foi concluída.");
      } else if (adaptiveOutcome?.record) {
        showToast(adaptiveOutcome.record.disponibilidade || "Revisão adaptativa atualizada.");
      } else if (adaptiveOutcome?.insufficient) {
        showToast("Desempenho registrado. A amostra ainda é insuficiente para criar uma revisão automática.");
      }
    });
    return;
  }

  const manualAdaptiveButton = event.target.closest("[data-create-adaptive-review]");
  if (manualAdaptiveButton) {
    const index = Number(manualAdaptiveButton.dataset.createAdaptiveReview);
    const block = state.generatedBlocks[index];
    const outcome = block ? syncAdaptiveReviewForBlock(block, { manual: true }) : null;
    if (outcome?.record) {
      renderReviews();
      renderContinuePanel();
      renderEvolution();
      performanceEditIndex = index;
      renderGeneratedSchedule();
      saveAppStateNow("Revisão adaptativa criada");
      showToast(outcome.record.disponibilidade || "Revisão adaptativa criada.");
    }
    return;
  }

  const performanceButton = event.target.closest("[data-toggle-performance]");
  if (performanceButton) {
    const index = Number(performanceButton.dataset.togglePerformance);
    performanceEditIndex = performanceEditIndex === index ? -1 : index;
    unitDetailIndex = -1;
    renderGeneratedSchedule();
    return;
  }

  const unitButton = event.target.closest("[data-toggle-unit]");
  if (unitButton) {
    const index = Number(unitButton.dataset.toggleUnit);
    unitDetailIndex = unitDetailIndex === index ? -1 : index;
    performanceEditIndex = -1;
    renderGeneratedSchedule();
    return;
  }

  if (!event.target.closest("[data-next-week]")) return;
  completeCurrentWeekAndGenerateNext();
});
els.scheduleWrap.addEventListener("change", (event) => {
  if (event.target.matches("[data-duration-index]")) {
    const index = Number(event.target.dataset.durationIndex);
    const block = state.generatedBlocks[index];
    if (!block) return;
    block.duracao = Number(parseDurationInput(event.target.value, block.duracao).toFixed(2));
    if (!block.timerRunning) resetBlockTimer(block);
    event.target.value = formatDuration(block.duracao);
    renderWeeklyResult();
    renderCompleted();
    renderEvolution();
    renderGeneratedSchedule();
    saveAppStateNow("Dura\u00e7\u00e3o atualizada");
    return;
  }
  if (event.target.matches("[data-status-index]")) {
    const index = Number(event.target.dataset.statusIndex);
    const block = state.generatedBlocks[index];
    const previousStatus = normalizeStatus(block.status);
    block.status = normalizeStatus(event.target.value);
    event.target.closest("tr")?.classList.toggle("is-completed", block.status === "Conclu\u00eddo");
    if (block.status === "Conclu\u00eddo" && !block.concluidoEm) {
      block.concluidoEm = new Date().toLocaleDateString("pt-BR");
    }
    if (block.status !== "Conclu\u00eddo") {
      block.concluidoEm = "";
    }
    syncBlockReviewRecords(block);
    renderWeeklyResult();
    renderCompleted();
    renderReviews();
    renderEvolution();
    updateDeadlineDisplays();
    performanceEditIndex = index;
    renderGeneratedSchedule();
    if (previousStatus !== "Conclu\u00eddo" && block.status === "Conclu\u00eddo") {
      showToast("Meta conclu\u00edda. Pr\u00f3ximo passo dispon\u00edvel.");
    }
  }
  if (event.target.matches("[data-review-index]")) {
    const index = Number(event.target.dataset.reviewIndex);
    const block = state.generatedBlocks[index];
    const cycles = Array.from(document.querySelectorAll(`[data-review-index="${index}"]:checked`)).map((input) => input.value);
    setBlockReviewCycles(block, cycles);
    syncBlockReviewRecords(block);
    renderCompleted();
    renderReviews();
    renderEvolution();
    performanceEditIndex = index;
    renderGeneratedSchedule();
  }
  if (event.target.matches("[data-score-index]")) {
    const index = Number(event.target.dataset.scoreIndex);
    const field = event.target.dataset.scoreField;
    const block = state.generatedBlocks[index];
    block[field] = ["dificuldade", "observacoes"].includes(field) ? event.target.value : Number(event.target.value) || 0;
    updateBlockAccuracy(block);
    const output = document.querySelector(`[data-accuracy-index="${index}"]`);
    if (output) output.textContent = formatPercent(block.percentual || 0);
    renderWeeklyResult();
    renderCompleted();
    renderReviews();
    renderEvolution();
  }
});
els.scheduleWrap.addEventListener("input", (event) => {
  if (!event.target.matches("[data-score-index]")) return;
  const index = Number(event.target.dataset.scoreIndex);
  const field = event.target.dataset.scoreField;
  const block = state.generatedBlocks[index];
  if (field === "observacoes") {
    block.observacoes = event.target.value;
    return;
  }
  block[field] = Number(event.target.value) || 0;
  updateBlockAccuracy(block);
  if (field === "acertos" && Number(event.target.value) > Number(block.questoes)) {
    event.target.value = block.acertos;
  }
  const output = document.querySelector(`[data-accuracy-index="${index}"]`);
  if (output) output.textContent = formatPercent(block.percentual || 0);
  if (field === "questoes" && Number(block.acertos) > Number(block.questoes)) {
    const correctInput = document.querySelector(`[data-score-index="${index}"][data-score-field="acertos"]`);
    if (correctInput) correctInput.value = block.acertos;
  }
  renderWeeklyResult();
  renderCompleted();
  renderReviews();
  renderEvolution();
});
els.cycleClosurePanel?.addEventListener("click", (event) => {
  if (event.target.closest("[data-cancel-cycle-close]")) {
    els.cycleClosurePanel.hidden = true;
    return;
  }
  if (event.target.closest("[data-confirm-cycle-close]")) {
    confirmCycleClosure();
  }
});
els.notebookSubjects?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-notebook-subject]");
  if (!button) return;
  if (notebookSelection.assunto) saveNotebookEditor();
  notebookSelection = { materia: button.dataset.notebookSubject, assunto: "" };
  renderErrors();
});
els.notebookThemes?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-notebook-theme]");
  if (!button) return;
  if (notebookSelection.assunto) saveNotebookEditor();
  notebookSelection.assunto = button.dataset.notebookTheme;
  renderErrors();
});
els.notebookText?.addEventListener("input", () => {
  rememberNotebookSelection();
  saveNotebookEditor();
  rememberNotebookHistory();
});
els.notebookText?.addEventListener("mouseup", rememberNotebookSelection);
els.notebookText?.addEventListener("keyup", rememberNotebookSelection);
els.notebookText?.addEventListener("paste", (event) => {
  if (!notebookSelection.assunto) return;
  event.preventDefault();
  const html = event.clipboardData?.getData("text/html");
  const text = event.clipboardData?.getData("text/plain") || "";
  rememberNotebookHistory();
  document.execCommand("insertHTML", false, sanitizeNotebookHtml(html || text));
  saveNotebookEditor();
  rememberNotebookHistory();
});
document.querySelector(".notebook-toolbar")?.addEventListener("mousedown", (event) => {
  if (event.target.closest("button") || event.target.closest("summary")) event.preventDefault();
});
document.querySelector(".notebook-toolbar")?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-notebook-command]");
  const colorButton = event.target.closest("[data-notebook-class]");
  if ((!button && !colorButton) || !notebookSelection.assunto) return;
  els.notebookText.focus();
  restoreNotebookSelection();
  if (colorButton) {
    applyNotebookClass(colorButton.dataset.notebookClass);
    colorButton.closest(".notebook-tool-menu")?.removeAttribute("open");
    return;
  }
  const command = button.dataset.notebookCommand;
  if (command === "undo") {
    undoNotebookChange();
    return;
  }
  restoreNotebookSelection();
  rememberNotebookHistory();
  if (command === "bold") document.execCommand("bold");
  if (command === "italic") document.execCommand("italic");
  if (command === "heading") document.execCommand("formatBlock", false, "h3");
  if (command === "bullet") document.execCommand("insertUnorderedList");
  if (command === "image") {
    insertNotebookImage();
    return;
  }
  if (command === "table") {
    insertNotebookTable();
    return;
  }
  if (command === "clear") {
    cleanNotebookSelectionStyle();
    return;
  }
  saveNotebookEditor();
  rememberNotebookSelection();
  rememberNotebookHistory();
});
els.reviewFilter?.addEventListener("change", () => {
  renderReviews();
  saveAppStateNow("Filtro salvo");
});
els.reviewsBody?.addEventListener("click", (event) => {
  const adaptiveButton = event.target.closest("[data-adaptive-review-action]");
  if (adaptiveButton) {
    updateAdaptiveReviewAction(adaptiveButton.dataset.adaptiveReviewId, adaptiveButton.dataset.adaptiveReviewAction);
    return;
  }
  const button = event.target.closest("[data-toggle-review-status]");
  if (!button) return;
  ensureReviewsArray();
  const record = state.reviews.find((item) => item.id === button.dataset.toggleReviewStatus);
  if (!record) return;
  record.status = record.status === "Conclu\u00edda" ? "Pendente" : "Conclu\u00edda";
  record.completedAt = record.status === "Conclu\u00edda" ? new Date().toISOString() : "";
  renderReviews();
  renderContinuePanel();
  renderEvolution();
  saveAppStateNow("Revis\u00e3o atualizada");
});
els.themeToggleButton?.addEventListener("click", () => {
  const current = document.documentElement.dataset.theme === "night" ? "night" : "day";
  applyThemePreference(current === "night" ? "day" : "night");
});
els.settingsToggleButton?.addEventListener("click", (event) => {
  event.stopPropagation();
  toggleSettingsMenu();
});
els.settingsMenu?.addEventListener("click", (event) => event.stopPropagation());
els.saveNowButton?.addEventListener("click", () => saveAppStateNow("Salvo"));
els.connectDataFileButton?.addEventListener("click", connectDataFile);
els.createDataFileButton?.addEventListener("click", createDataFile);
els.loadDataFileButton?.addEventListener("click", () => loadSnapshotFromDataFile());
els.saveDataFileButton?.addEventListener("click", () => writeSnapshotToDataFile("Drive salvo"));
els.saveContestButton?.addEventListener("click", () => saveAppStateNow("Dados do concurso salvos"));
els.goContentButton?.addEventListener("click", () => switchTab("conteudo"));
els.backToContentFromPriorityButton?.addEventListener("click", () => switchTab("conteudo"));
els.saveCycleAdjustmentsButton?.addEventListener("click", () => saveAppStateNow("Ajustes salvos"));
els.overrideCycleToggle?.addEventListener("change", updateOverrideVisibility);
els.backToGenerateFromScheduleButton?.addEventListener("click", () => switchTab("pesos"));
els.saveTrackingButton?.addEventListener("click", () => saveAppStateNow("Acompanhamento salvo"));
els.finishCycleButton?.addEventListener("click", renderCycleClosureSummary);
els.pendingOnlyToggle?.addEventListener("click", () => {
  showPendingOnly = !showPendingOnly;
  if (showPendingOnly && performanceEditIndex >= 0 && !isPendingBlock(state.generatedBlocks[performanceEditIndex])) {
    performanceEditIndex = -1;
  }
  if (showPendingOnly && unitDetailIndex >= 0 && !isPendingBlock(state.generatedBlocks[unitDetailIndex])) {
    unitDetailIndex = -1;
  }
  renderGeneratedSchedule();
  saveAppStateNow(showPendingOnly ? "Mostrando metas pendentes" : "Mostrando todas as metas");
});
els.restoreCycleButton?.addEventListener("click", restorePreviousCycle);
els.resetCyclesButton?.addEventListener("click", resetCycles);
els.exportBackupButton?.addEventListener("click", exportBackup);
els.backupNowButton?.addEventListener("click", exportBackup);
els.importBackupInput?.addEventListener("change", async () => {
  try {
    await importBackup(els.importBackupInput.files[0]);
    els.importBackupInput.value = "";
  } catch {
    alert("N\u00e3o consegui importar esse backup. Verifique se o arquivo JSON est\u00e1 correto.");
  }
});
els.generateScheduleButton.addEventListener("click", generateSchedule);
document.addEventListener("click", (event) => {
  if (event.target.closest("[data-unlock]")) {
    unlockCycle();
    switchTab("concurso");
  }
});
els.downloadButton.addEventListener("click", downloadJson);
[els.weeklyHours, els.blockDuration, els.overrideWeeklyHours, els.overrideCycleToggle, els.allowResidualBlock, els.referenceWeek, els.examDate, els.planStartDate].filter(Boolean).forEach((input) => {
  input.addEventListener("input", updateContestSummary);
  input.addEventListener("change", updateContestSummary);
});
document.addEventListener("input", scheduleAutoSave);
document.addEventListener("change", scheduleAutoSave);
document.addEventListener("click", (event) => {
  if (!event.target.closest("#settingsMenu, #settingsToggleButton")) closeSettingsMenu();
  if (!event.target.closest("#planMenu, #planMenuButton")) closePlanMenu();
  if (event.target.closest("button, .tab-button, [data-tab-target]")) {
    scheduleAutoSave();
  }
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeSettingsMenu();
    closePlanMenu();
    closeDeletePlanModal();
  }
});
window.addEventListener("resize", () => updateSidebarActiveIndicator());
window.addEventListener("beforeunload", () => {
  if (!isRestoring && state.currentPlanId) {
    const snapshot = captureAppState();
    localStorage.setItem(planStorageKey(state.currentPlanId), JSON.stringify(snapshot));
    localStorage.setItem(ACTIVE_PLAN_KEY, state.currentPlanId);
  }
});

renderDailyInputs();
applyThemePreference();
defaultReferenceWeek();
renderHistory();
if (!restoreAppState()) {
  renderRows();
  updateContestSummary();
  renderGeneratedSchedule();
}
restoreRememberedDataFile();
renderBackupReminder();
ensureGoalTimerInterval();
if (window.lucide) window.lucide.createIcons();
requestAnimationFrame(() => {
  updateSidebarActiveIndicator();
  animatePanelNumbers(getActiveTabName());
});




