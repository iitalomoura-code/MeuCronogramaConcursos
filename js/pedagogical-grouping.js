(function (global) {
  "use strict";

  function normalize(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  }

  function matchesAny(text, terms) {
    return terms.some((term) => text.includes(term));
  }

  function subjectMatches(subject, aliases) {
    const value = normalize(subject);
    return aliases.some((alias) => value === alias || value.includes(alias));
  }

  // Conservative rules: a group exists only with two or more clearly related rows.
  const RULES = [
    { subjects: ["lingua portuguesa", "portugues"], title: "Ortografia, acentuação e pontuação", terms: ["ortografia", "acentuacao", "pontuacao"] },
    { subjects: ["lingua portuguesa", "portugues"], title: "Classes de palavras", terms: ["substantivo", "adjetivo", "pronome", "verbo", "adverbio", "interjeicao", "artigo", "numeral", "preposicao", "conjuncao"] },
    { subjects: ["raciocinio logico", "logica matematica", "raciocinio logico-matematico"], title: "Lógica proposicional", terms: ["proposicao", "conectivo", "negacao", "conjuncao", "disjuncao", "condicional", "bicondicional", "equivalencia", "tabela verdade"] },
    { subjects: ["raciocinio logico", "logica matematica", "raciocinio logico-matematico"], title: "Argumentação lógica", terms: ["argumento", "inferencia", "silogismo", "falacia", "validade", "deducao", "inducao"] },
    { subjects: ["informatica", "tecnologia da informacao", "tecnologia da informacao e de inteligencia artificial"], title: "Internet, arquivos e serviços digitais", terms: ["internet", "navegador", "mecanismo de busca", "mecanismos de busca", "arquivo eletronico", "arquivos eletronicos", "gerenciamento de arquivo", "gerenciamento de arquivos", "armazenamento de arquivo", "computacao em nuvem", "cloud computing", "servico digital"] },
    { subjects: ["direito constitucional", "constitucional"], title: "Organização constitucional do Estado", terms: ["organizacao do estado", "entes federativos", "uniao", "estados", "municipios", "distrito federal", "intervencao federal", "intervencao estadual"] },
    { subjects: ["direito administrativo", "administrativo"], title: "Organização administrativa", terms: ["administracao direta", "administracao indireta", "autarquia", "fundacao publica", "fundacoes publicas", "empresa publica", "empresas publicas", "sociedade de economia mista", "sociedades de economia mista", "descentralizacao", "desconcentracao"] },
    { subjects: ["administracao geral e publica", "administracao publica", "administracao geral"], title: "Planejamento estratégico", terms: ["missao", "visao", "valore", "objetivo", "meta", "indicador", "planejamento estrategico"] },
    { subjects: ["administracao financeira e orcamentaria", "afo", "direito financeiro"], title: "Despesa pública", terms: ["conceito de despesa", "classificacao da despesa", "estagio da despesa", "empenho", "liquidacao", "pagamento"] },
    { subjects: ["contabilidade", "contabilidade publica"], title: "Patrimônio e variações patrimoniais", terms: ["patrimonio", "ativo", "passivo", "variacao patrimonial", "fato contabil"] },
    { subjects: ["licitacoes e contratos", "licitacao e contratos", "licitacoes"], title: "Planejamento das contratações", terms: ["pca", "plano de contratacoes anual", "etp", "estudo tecnico preliminar", "termo de referencia", "projeto basico", "analise de risco", "matriz de risco"] },
    { subjects: ["contabilidade", "contabilidade publica"], title: "Demonstrações contábeis", terms: ["balanco patrimonial", "demonstracao das variacoes", "demonstracao dos fluxos", "demonstracao do resultado", "demonstracoes contabeis"] },
    { subjects: ["controle externo", "controle externo e legislacao"], title: "Processo de contas e garantias processuais", terms: ["instrucao processual", "contraditorio", "ampla defesa", "prazo", "prescricao", "recurso", "pedido de reconsideracao"] },
  ];

  function sourceItems(row) {
    const stored = Array.isArray(row?.conteudosOriginais) ? row.conteudosOriginais : [];
    return stored.length ? stored : [String(row?.assunto || "").trim()].filter(Boolean);
  }

  function rowMatchesRule(row, rule) {
    return Boolean(row?.assunto) && subjectMatches(row.materia, rule.subjects) && matchesAny(normalize(row.assunto), rule.terms);
  }

  function groupRows(rows) {
    if (!Array.isArray(rows) || !rows.length) return Array.isArray(rows) ? rows.slice() : [];
    const consumed = new Set();
    const groupsAtIndex = new Map();

    RULES.forEach((rule) => {
      const indexes = rows.map((row, index) => ({ row, index }))
        .filter(({ row, index }) => !consumed.has(index) && rowMatchesRule(row, rule))
        .map(({ index }) => index);
      if (indexes.length < 2) return;
      const selected = indexes.map((index) => rows[index]);
      const originalItems = selected.flatMap(sourceItems);
      const origins = selected.map((row) => row.origemEdital).filter(Boolean);
      const base = selected[0];
      groupsAtIndex.set(indexes[0], {
        ...base,
        assunto: `${rule.title}: ${originalItems.join("; ")}`,
        temaExplicito: true,
        conteudosOriginais: originalItems,
        agrupamentoPedagogico: { title: rule.title, originalItems: originalItems.slice() },
        origemEdital: origins.length ? { type: "agrupamento-pedagogico", sources: origins } : base.origemEdital || null,
      });
      indexes.forEach((index) => consumed.add(index));
    });

    const counters = new Map();
    return rows.reduce((output, row, index) => {
      if (groupsAtIndex.has(index)) output.push(groupsAtIndex.get(index));
      else if (!consumed.has(index)) output.push(row);
      return output;
    }, []).map((row) => {
      const key = normalize(row.materia);
      const ordem = (counters.get(key) || 0) + 1;
      counters.set(key, ordem);
      return { ...row, ordem };
    });
  }

  const api = { groupRows, RULES };
  global.PedagogicalContentGrouping = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
