(function (global) {
  "use strict";

  function normalize(value) {
    return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
  }

  function contains(text, term) {
    return normalize(text).includes(normalize(term));
  }

  // Generic words describe many subjects and must never decide a grouping alone.
  const GENERIC_TERMS = ["conceito", "conceitos", "principio", "principios", "classificacao", "classificacoes", "caracteristica", "caracteristicas", "aplicacao", "aplicacoes", "aspecto", "aspectos", "fundamento", "fundamentos"];

  const TAXONOMY = [
    {
      id: "portugues",
      aliases: ["lingua portuguesa", "portugues"],
      preserveSeparate: ["interpretacao de texto", "interpretacao de textos", "sintaxe", "coesao", "coerencia", "reescrita", "redacao oficial"],
      macrothemes: [
        { title: "Ortografia, acentuação e pontuação", terms: ["ortografia", "acentuacao", "pontuacao"] },
        { title: "Classes de palavras", terms: ["substantivo", "adjetivo", "pronome", "verbo", "adverbio", "interjeicao", "artigo", "numeral", "preposicao", "conjuncao"] },
        { title: "Concordância nominal e verbal", terms: ["concordancia nominal", "concordancia verbal"] },
        { title: "Regência e crase", terms: ["regencia nominal", "regencia verbal", "crase"] },
      ],
    },
    {
      id: "raciocinio-logico",
      aliases: ["raciocinio logico", "raciocinio logico-matematico", "logica matematica"],
      preserveSeparate: ["probabilidade", "analise combinatoria", "conjuntos", "razoes e proporcoes"],
      macrothemes: [
        { title: "Lógica proposicional", terms: ["proposicao", "conectivo", "negacao", "conjuncao", "disjuncao", "condicional", "bicondicional", "equivalencia", "tabela verdade"] },
        { title: "Argumentação lógica", terms: ["argumento", "inferencia", "silogismo", "falacia", "validade", "deducao", "inducao"] },
      ],
    },
    {
      id: "informatica-ti",
      aliases: ["informatica", "tecnologia da informacao", "tecnologia da informacao e de inteligencia artificial", "nocoes de tecnologia da informacao e de inteligencia artificial"],
      preserveSeparate: ["sistema operacional", "planilha", "editor de texto", "banco de dados", "rede", "inteligencia artificial"],
      macrothemes: [
        { title: "Internet, arquivos e serviços digitais", terms: ["internet", "navegador", "mecanismo de busca", "mecanismos de busca", "arquivo eletronico", "arquivos eletronicos", "gerenciamento de arquivo", "gerenciamento de arquivos", "armazenamento de arquivo", "computacao em nuvem", "cloud computing", "servico digital"] },
        { title: "Segurança da Informação", terms: ["virus", "malware", "phishing", "engenharia social", "firewall", "antivirus", "seguranca da informacao"] },
      ],
    },
    {
      id: "direito-constitucional",
      aliases: ["direito constitucional", "constitucional"],
      preserveSeparate: ["controle de constitucionalidade", "poder legislativo", "poder executivo", "poder judiciario"],
      macrothemes: [
        { title: "Organização constitucional do Estado", terms: ["organizacao do estado", "entes federativos", "uniao", "estados", "municipios", "distrito federal", "intervencao federal", "intervencao estadual"] },
        { title: "Direitos e garantias fundamentais", terms: ["direitos fundamentais", "garantias constitucionais", "remedios constitucionais", "habeas corpus", "mandado de seguranca", "acao popular"] },
      ],
    },
    {
      id: "direito-administrativo",
      aliases: ["direito administrativo", "administrativo"],
      preserveSeparate: ["atos administrativos", "poderes administrativos", "agentes publicos", "servicos publicos", "responsabilidade civil do estado", "organizacao administrativa", "processo administrativo"],
      macrothemes: [
        // Only internal enumerations are grouped; the autonomous theme names above remain intact.
        { title: "Organização administrativa", terms: ["administracao direta", "administracao indireta", "autarquia", "fundacao publica", "fundacoes publicas", "empresa publica", "empresas publicas", "sociedade de economia mista", "sociedades de economia mista", "descentralizacao", "desconcentracao"] },
      ],
    },
    {
      id: "administracao-geral-publica",
      aliases: ["administracao geral e publica", "administracao publica", "administracao geral"],
      preserveSeparate: ["gestao de pessoas", "gestao de processos", "gestao de projetos", "governanca", "politicas publicas"],
      macrothemes: [
        { title: "Planejamento estratégico", terms: ["missao", "visao", "valores", "objetivos", "metas", "indicadores", "planejamento estrategico"] },
        { title: "Comportamento organizacional", terms: ["lideranca", "motivacao", "comunicacao organizacional"] },
      ],
    },
    {
      id: "afo",
      aliases: ["administracao financeira e orcamentaria", "afo", "direito financeiro"],
      preserveSeparate: ["receita publica", "despesa publica", "credito publico", "orcamento publico", "lei de responsabilidade fiscal"],
      macrothemes: [
        { title: "Despesa pública", terms: ["conceito de despesa", "classificacao da despesa", "estagio da despesa", "estagios da despesa", "empenho", "liquidacao", "pagamento"] },
        { title: "Receita pública", terms: ["conceito de receita", "classificacao da receita", "previsao da receita", "lancamento", "arrecadacao", "recolhimento", "estagios da receita"] },
      ],
    },
    {
      id: "contabilidade",
      aliases: ["contabilidade", "contabilidade publica"],
      preserveSeparate: ["balanco patrimonial", "demonstracoes contabeis", "lancamentos contabeis"],
      macrothemes: [
        { title: "Patrimônio e variações patrimoniais", terms: ["patrimonio", "ativo", "passivo", "variacao patrimonial", "fato contabil"] },
        { title: "Demonstrações contábeis", terms: ["balanco patrimonial", "demonstracao das variacoes", "demonstracao dos fluxos", "demonstracao do resultado", "demonstracoes contabeis"] },
      ],
    },
    {
      id: "licitacoes-contratos",
      aliases: ["licitacoes e contratos", "licitacao e contratos", "licitacoes e contratos administrativos", "licitacoes"],
      preserveSeparate: ["contratacao direta", "modalidades", "criterios de julgamento", "contratos", "sancoes", "execucao contratual"],
      macrothemes: [
        { title: "Planejamento das contratações", terms: ["pca", "plano de contratacoes anual", "etp", "estudo tecnico preliminar", "termo de referencia", "projeto basico", "analise de risco", "matriz de risco"] },
      ],
    },
    {
      id: "controle-externo",
      aliases: ["controle externo", "controle externo e legislacao", "controle externo e legislacao do tce pe"],
      preserveSeparate: ["sistemas de controle", "tribunais de contas", "competencias", "fiscalizacao", "prestacao de contas", "tomada de contas", "responsabilizacao", "parecer previo", "processos de contas"],
      macrothemes: [
        { title: "Processo de contas e garantias processuais", terms: ["instrucao processual", "contraditorio", "ampla defesa", "prazo processual", "prescricao", "pedido de reconsideracao", "embargos de declaracao"] },
      ],
    },
  ];

  function subjectTaxonomy(subject) {
    const normalizedSubject = normalize(subject);
    return TAXONOMY.find((item) => item.aliases.some((alias) => normalizedSubject === alias || normalizedSubject.includes(alias))) || null;
  }

  function isProtectedTopic(row, taxonomy) {
    const value = normalize(row?.assunto);
    return taxonomy.preserveSeparate.some((term) => value === term || value.startsWith(`${term}:`) || value.includes(`${term}:`));
  }

  function matchingMacrotheme(row, taxonomy) {
    if (!row?.assunto || isProtectedTopic(row, taxonomy)) return null;
    const value = normalize(row.assunto);
    const matches = taxonomy.macrothemes.filter((macrotheme) => macrotheme.terms.some((term) => contains(value, term)));
    return matches.length === 1 ? matches[0] : null;
  }

  function sourceItems(row) {
    const stored = Array.isArray(row?.conteudosOriginais) ? row.conteudosOriginais : [];
    return stored.length ? stored : [String(row?.assunto || "").trim()].filter(Boolean);
  }

  function groupRows(rows) {
    if (!Array.isArray(rows) || !rows.length) return Array.isArray(rows) ? rows.slice() : [];
    const groupsAtIndex = new Map();
    const consumed = new Set();

    TAXONOMY.forEach((taxonomy) => {
      taxonomy.macrothemes.forEach((macrotheme) => {
        const indexes = rows.map((row, index) => ({ row, index }))
          .filter(({ row, index }) => !consumed.has(index) && subjectTaxonomy(row.materia)?.id === taxonomy.id && matchingMacrotheme(row, taxonomy)?.title === macrotheme.title)
          .map(({ index }) => index);
        if (indexes.length < 2) return;
        const selected = indexes.map((index) => rows[index]);
        const originalItems = selected.flatMap(sourceItems);
        const origins = selected.map((row) => row.origemEdital).filter(Boolean);
        const base = selected[0];
        groupsAtIndex.set(indexes[0], {
          ...base,
          assunto: `${macrotheme.title}: ${originalItems.join("; ")}`,
          temaExplicito: true,
          conteudosOriginais: originalItems,
          agrupamentoPedagogico: {
            materia: taxonomy.id,
            macrotema: macrotheme.title,
            motivo: `Conteúdos correlatos de ${macrotheme.title.toLowerCase()} foram reunidos para estudo conjunto.`,
            originalItems: originalItems.slice(),
          },
          origemEdital: origins.length ? { type: "agrupamento-pedagogico", sources: origins } : base.origemEdital || null,
        });
        indexes.forEach((index) => consumed.add(index));
      });
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

  const api = { TAXONOMY, GENERIC_TERMS, groupRows, subjectTaxonomy, matchingMacrotheme };
  global.PedagogicalContentGrouping = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
