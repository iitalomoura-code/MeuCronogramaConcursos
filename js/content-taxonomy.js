(function attachContentTaxonomy(global) {
  "use strict";

  const normalize = (value) => String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

  const macro = (id, name, includeTerms, options = {}) => ({
    id,
    name,
    includeTerms,
    excludeTerms: options.excludeTerms || [],
    autonomous: Boolean(options.autonomous),
  });

  const subjects = [
    {
      id: "portugues", name: "Língua Portuguesa", aliases: ["português", "língua portuguesa", "lingua portuguesa", "comunicação escrita"],
      macroThemes: [
        macro("interpretacao", "Interpretação e compreensão de textos", ["interpretacao", "compreensao", "inferencia", "leitura", "texto"]),
        macro("tipologia", "Tipologia e gêneros textuais", ["tipologia", "genero textual", "tipo textual", "genero"]),
        macro("coesao", "Coesão e coerência", ["coesao", "coerencia", "referencia", "conectivo"]),
        macro("semantica", "Semântica", ["semantica", "sentido", "significacao", "sinonimia", "antonimia", "ambiguidade"]),
        macro("classes", "Classes de palavras", ["substantivo", "adjetivo", "pronome", "verbo", "adverbio", "preposicao", "conjuncao", "classe de palavra"]),
        macro("sintaxe", "Sintaxe", ["sintaxe", "oracao", "periodo", "termo da oracao", "coordenacao", "subordinacao"]),
        macro("concordancia", "Concordância", ["concordancia nominal", "concordancia verbal"]),
        macro("regencia", "Regência e crase", ["regencia", "crase"]),
        macro("pontuacao", "Pontuação", ["pontuacao", "virgula"]),
        macro("redacao", "Reescrita e correspondência oficial", ["reescrita", "redacao oficial", "correspondencia oficial", "comunicacao oficial"]),
      ],
    },
    {
      id: "logico", name: "Raciocínio Lógico", aliases: ["raciocínio lógico", "raciocinio logico", "raciocínio lógico-matemático", "raciocinio logico matematico", "lógica"],
      macroThemes: [
        macro("proposicoes", "Proposições e conectivos", ["proposicao", "conectivo", "conjuncao", "disjuncao", "condicional", "bicondicional"]),
        macro("equivalencias", "Equivalências e negações", ["equivalencia", "negacao", "contrapositiva"]),
        macro("argumentacao", "Argumentação lógica", ["argumento", "validade", "raciocinio dedutivo", "falacia"]),
        macro("diagramas", "Diagramas e conjuntos", ["diagrama", "conjunto", "silogismo"]),
        macro("sequencias", "Sequências e padrões", ["sequencia", "padrao"]),
        macro("proporcao", "Razão, proporção e porcentagem", ["razao", "proporcao", "porcentagem"]),
        macro("combinatoria", "Análise combinatória", ["analise combinatoria", "permutacao", "arranjo", "combinacao"]),
        macro("probabilidade", "Probabilidade", ["probabilidade"]),
        macro("problemas", "Problemas lógico-matemáticos", ["problema", "quantitativa", "grafico", "tabela"]),
      ],
    },
    {
      id: "informatica", name: "Informática e Tecnologia da Informação", aliases: ["informática", "informatica", "noções de informática", "nocoes de informatica", "tecnologia da informação", "tecnologia da informacao", "tecnologia da informação e inteligência artificial", "ti"],
      macroThemes: [
        macro("internet-arquivos", "Internet, arquivos e serviços digitais", ["internet", "navegador", "browser", "mecanismo de busca", "pesquisa na internet", "arquivo eletronico", "organizacao de arquivo", "gerenciamento de arquivo", "download", "upload", "armazenamento", "compartilhamento de arquivo", "computacao em nuvem", "servico em nuvem"], { excludeTerms: ["malware", "virus", "phishing", "criptografia", "firewall", "autenticacao", "engenharia social"] }),
        macro("seguranca", "Segurança da Informação", ["seguranca da informacao", "confidencialidade", "integridade", "disponibilidade", "autenticidade", "nao repudio", "malware", "virus", "worm", "trojan", "ransomware", "phishing", "engenharia social", "firewall", "antivirus", "backup", "autenticacao", "criptografia"]),
        macro("sistemas", "Sistemas operacionais", ["sistema operacional", "windows", "linux"]),
        macro("editores", "Editores de texto", ["editor de texto", "word", "documento"]),
        macro("planilhas", "Planilhas eletrônicas", ["planilha", "excel", "formula", "funcao", "grafico"]),
        macro("apresentacoes", "Apresentações", ["apresentacao", "powerpoint", "slide"]),
        macro("redes", "Redes de computadores", ["rede", "tcp", "ip", "protocolo"]),
        macro("dados", "Banco de dados", ["banco de dados", "sql", "consulta"]),
        macro("governanca-ti", "Governança e gestão de TI", ["governanca de ti", "gestao de ti", "itil", "cobit"]),
        macro("ia", "Inteligência artificial", ["inteligencia artificial", "aprendizado de maquina", "machine learning"]),
      ],
    },
    {
      id: "constitucional", name: "Direito Constitucional", aliases: ["direito constitucional", "constitucional"],
      macroThemes: [
        macro("teoria", "Teoria da Constituição", ["teoria da constituicao", "constituicao", "poder constituinte"], { autonomous: true }),
        macro("principios", "Princípios fundamentais", ["principios fundamentais", "fundamentos da republica"], { autonomous: true }),
        macro("direitos", "Direitos e garantias fundamentais", ["direitos fundamentais", "garantias fundamentais", "remedio constitucional"], { autonomous: true }),
        macro("estado", "Organização do Estado", ["organizacao do estado", "federacao", "entes federativos"], { autonomous: true }),
        macro("administracao", "Administração Pública", ["administracao publica", "servidor publico"], { autonomous: true }),
        macro("legislativo", "Poder Legislativo", ["poder legislativo", "congresso nacional"], { autonomous: true }),
        macro("executivo", "Poder Executivo", ["poder executivo", "presidente da republica"], { autonomous: true }),
        macro("judiciario", "Poder Judiciário", ["poder judiciario", "supremo tribunal"], { autonomous: true }),
        macro("controle", "Controle de constitucionalidade", ["controle de constitucionalidade", "acao direta", "adpf"], { autonomous: true }),
      ],
    },
    {
      id: "administrativo", name: "Direito Administrativo", aliases: ["direito administrativo", "administrativo"],
      macroThemes: [
        macro("organizacao", "Organização administrativa", ["organizacao administrativa", "administracao direta", "administracao indireta", "autarquia", "fundacao"], { autonomous: true }),
        macro("principios", "Princípios administrativos", ["principio administrativo", "legalidade", "impessoalidade", "moralidade", "publicidade", "eficiencia"], { autonomous: true }),
        macro("atos", "Atos administrativos", ["ato administrativo", "anulacao", "revogacao", "convalidacao"], { autonomous: true }),
        macro("poderes", "Poderes administrativos", ["poder administrativo", "poder de policia", "poder hierarquico", "poder disciplinar"], { autonomous: true }),
        macro("agentes", "Agentes públicos", ["agente publico", "servidor publico", "cargo publico"], { autonomous: true }),
        macro("servicos", "Serviços públicos", ["servico publico", "concessao", "permissao"], { autonomous: true }),
        macro("responsabilidade", "Responsabilidade civil do Estado", ["responsabilidade civil do estado"], { autonomous: true }),
        macro("controle", "Controle da Administração", ["controle da administracao", "controle administrativo"], { autonomous: true }),
        macro("processo", "Processo administrativo", ["processo administrativo", "procedimento administrativo"], { autonomous: true }),
      ],
    },
    {
      id: "administracao", name: "Administração Geral e Pública", aliases: ["administração geral e pública", "administracao geral e publica", "administração pública", "administracao publica", "administração geral", "administracao geral"],
      macroThemes: [
        macro("teorias", "Teorias da Administração", ["teoria da administracao", "escola classica", "burocracia"]),
        macro("planejamento", "Planejamento estratégico", ["planejamento", "missao", "visao", "valores", "objetivos", "metas", "indicadores", "swot"]),
        macro("organizacao", "Organização", ["organizacao", "estrutura organizacional", "departamentalizacao"]),
        macro("direcao", "Direção", ["direcao", "lideranca", "motivacao"]),
        macro("controle", "Controle", ["controle", "monitoramento", "avaliacao"]),
        macro("pessoas", "Gestão de pessoas", ["gestao de pessoas", "competencias", "desempenho"]),
        macro("processos", "Gestão de processos", ["gestao de processos", "processo", "mapeamento"]),
        macro("projetos", "Gestão de projetos", ["gestao de projetos", "projeto"]),
        macro("governanca", "Governança pública", ["governanca publica", "governanca"]),
        macro("politicas", "Políticas públicas", ["politica publica", "politicas publicas"]),
      ],
    },
    {
      id: "afo", name: "Administração Financeira e Orçamentária", aliases: ["administração financeira e orçamentária", "administracao financeira e orcamentaria", "afo", "orçamento público", "orcamento publico"],
      macroThemes: [
        macro("orcamento", "Orçamento público", ["orcamento publico", "orcamento"]),
        macro("principios", "Princípios orçamentários", ["principio orcamentario"]),
        macro("instrumentos", "Instrumentos de planejamento", ["ppa", "ldo", "loa", "instrumento de planejamento"]),
        macro("ciclo", "Ciclo orçamentário", ["ciclo orcamentario", "elaboracao", "aprovacao", "execucao orcamentaria"]),
        macro("receita", "Receita pública", ["receita publica", "arrecadacao", "lancamento"]),
        macro("despesa", "Despesa pública", ["despesa publica", "empenho", "liquidacao", "pagamento"]),
        macro("creditos", "Créditos adicionais", ["credito adicional", "credito suplementar", "credito especial", "credito extraordinario"]),
        macro("restos", "Restos a pagar", ["restos a pagar"]),
        macro("divida", "Dívida pública", ["divida publica"]),
        macro("lrf", "Lei de Responsabilidade Fiscal", ["lei de responsabilidade fiscal", "lrf"]),
      ],
    },
    {
      id: "contabilidade", name: "Contabilidade", aliases: ["contabilidade", "contabilidade geral", "contabilidade pública", "contabilidade publica"],
      macroThemes: [
        macro("patrimonio", "Patrimônio", ["patrimonio", "ativo", "passivo", "patrimonio liquido"], { autonomous: true }),
        macro("escrituracao", "Contas e escrituração", ["conta contabil", "escrituracao", "lancamento contabil"], { autonomous: true }),
        macro("regimes", "Regimes contábeis", ["regime de caixa", "regime de competencia"]),
        macro("fatos", "Fatos contábeis", ["fato contabil", "variacao patrimonial"]),
        macro("demonstracoes", "Demonstrações contábeis", ["demonstracao contabil", "balanco patrimonial", "dre", "dfc"], { autonomous: true }),
        macro("estoques", "Estoques", ["estoque"]),
        macro("imobilizado", "Ativo imobilizado", ["ativo imobilizado", "depreciacao"]),
        macro("custos", "Contabilidade de custos", ["custo", "custeio"]),
      ],
    },
    {
      id: "licitacoes", name: "Licitações e Contratos Administrativos", aliases: ["licitações e contratos administrativos", "licitacoes e contratos administrativos", "licitações", "licitacoes", "contratos administrativos"],
      macroThemes: [
        macro("gerais", "Princípios e disposições gerais", ["principio", "disposicao geral", "lei 14133"]),
        macro("planejamento", "Planejamento das contratações", ["plano de contratacoes anual", "pca", "estudo tecnico preliminar", "etp", "termo de referencia", "projeto basico", "analise de risco", "matriz de risco", "matriz de alocacao de risco"], { excludeTerms: ["execucao contratual", "alteracao contratual"] }),
        macro("modalidades", "Modalidades", ["modalidade", "pregao", "concorrencia", "concurso", "leilao", "dialogo competitivo"], { autonomous: true }),
        macro("julgamento", "Critérios de julgamento", ["criterio de julgamento", "menor preco", "maior desconto", "tecnica e preco"]),
        macro("fases", "Fases da licitação", ["fase da licitacao", "habilitacao", "julgamento", "homologacao"]),
        macro("direta", "Contratação direta", ["contratacao direta", "dispensa", "inexigibilidade"], { autonomous: true }),
        macro("contratos", "Contratos administrativos", ["contrato administrativo", "gestao contratual", "fiscalizacao contratual"], { autonomous: true }),
        macro("execucao", "Execução contratual", ["execucao contratual", "alteracao contratual", "equilibrio economico financeiro", "sancao"], { autonomous: true }),
      ],
    },
    {
      id: "controle-externo", name: "Controle Externo", aliases: ["controle externo", "controle da administração pública", "controle da administracao publica", "tribunais de contas", "tce"],
      macroThemes: [
        macro("sistemas", "Sistemas de controle", ["sistema de controle", "controle interno", "controle externo", "controle judicial"], { autonomous: true }),
        macro("tribunais", "Tribunais de Contas", ["tribunal de contas", "tce", "tcu"], { autonomous: true }),
        macro("competencias", "Competências dos Tribunais de Contas", ["competencia", "atribuicao", "jurisdicao"], { autonomous: true }),
        macro("fiscalizacao", "Fiscalização e auditoria governamental", ["fiscalizacao", "auditoria governamental", "auditoria"]),
        macro("contas", "Prestação e tomada de contas", ["prestacao de contas", "tomada de contas", "contas de governo", "contas de gestao"], { autonomous: true }),
        macro("responsabilizacao", "Responsabilização e sanções", ["responsabilizacao", "sancao", "multa", "debito"], { autonomous: true }),
        macro("processos", "Jurisdição e processos de contas", ["processo de contas", "processual", "recurso"]),
      ],
    },
  ];

  function subjectFor(value) {
    const source = normalize(value);
    const sourceTokens = new Set(source.split(" ").filter(Boolean));
    const matches = subjects.flatMap((subject) => [subject.name, ...subject.aliases].map((alias) => {
      const normalizedAlias = normalize(alias);
      if (!normalizedAlias) return null;
      const matched = normalizedAlias.length <= 3
        ? sourceTokens.has(normalizedAlias)
        : source.includes(normalizedAlias) || (source.length > 3 && normalizedAlias.includes(source));
      return matched ? { subject, weight: normalizedAlias.length } : null;
    }).filter(Boolean));
    return matches.sort((left, right) => right.weight - left.weight)[0]?.subject || null;
  }

  global.ContentTaxonomy = { subjects, normalize, subjectFor };
})(window);
