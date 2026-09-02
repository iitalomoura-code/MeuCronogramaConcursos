"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const app = fs.readFileSync(path.resolve(__dirname, "..", "app.js"), "utf8");
const index = fs.readFileSync(path.resolve(__dirname, "..", "index.html"), "utf8");
const styles = fs.readFileSync(path.resolve(__dirname, "..", "styles.css"), "utf8");

assert.ok(app.includes("function saveStudyResult"), "O registro central de desempenho deve existir.");
assert.ok(app.includes("function notebookThemeMatchesSearch"), "A busca local do Caderno de Resumos deve estar disponível.");
assert.ok(index.includes('id="notebookSearch"'), "O Caderno de Resumos deve expor a busca de resumos.");
assert.ok(app.includes("function reconstructPdfPageLines"), "A extração de PDF deve reconstruir linhas.");
assert.ok(app.includes("convertToHtml"), "A leitura DOCX deve preservar blocos quando Mammoth oferecer HTML.");
assert.ok(!/\b(?:alert|confirm|prompt)\s*\(/.test(app), "Os fluxos principais não devem usar diálogos nativos.");
assert.ok(index.includes("styles.css?v=20260902-error-notebook"), "O CSS deve usar o cache-busting atual.");
assert.ok(index.includes("app.js?v=20260902-error-notebook"), "O JavaScript deve usar o cache-busting atual.");
assert.ok(index.includes("js/study-derived-state.js?v=20260902-continue-derived-state"), "O estado derivado deve carregar antes do app.");
assert.ok(index.includes("js/continue-recommendation.js?v=20260902-error-analysis"), "O motor de recomendação deve carregar antes do app.");
assert.ok(index.includes("js/study-alerts.js?v=20260902-unified-mastery"), "A central de alertas deve ser carregada antes do app.");
assert.ok(styles.includes("overflow-x: hidden;\n  overflow-y: auto;"), "A navegação lateral não deve exibir rolagem horizontal.");
assert.ok(index.includes('class="sidebar-utility-actions"') && index.includes('id="signOutButton"'), "Tema, configurações e sair devem permanecer no rodapé da sidebar.");
assert.ok(index.includes("js/incidence.js?v=20260805-incidence-fgv"), "A base de incidÃªncia deve ser carregada antes do app.");
assert.ok(index.includes('class="ql-align" value="justify"'), "O Caderno de Resumos deve oferecer alinhamento justificado.");
assert.ok(app.includes("NOTEBOOK_QUILL_ALIGNMENTS"), "Os alinhamentos do Quill devem ser normalizados antes do salvamento.");
assert.ok(index.includes("pedagogical-grouping.js?v=20260801-subject-taxonomy"), "A taxonomia pedagógica deve usar o cache-busting atual.");
assert.ok(app.includes("state.generatedBlocks = [];\n  state.distribution = [];\n  advanceReferenceWeek();"), "O ciclo encerrado deve ser arquivado antes de gerar o próximo.");
assert.ok(app.includes("function pruneTrailingEmptyCycleClosures"), "Fechamentos vazios devem ser removidos do histórico ao restaurar dados.");
assert.ok(app.includes("function reviewDeduplicationKey"), "Revisões duplicadas devem ser consolidadas com uma chave estável.");
assert.ok(app.includes("if (!block.ciclo) block.ciclo = closingCycle;"), "O ciclo de origem deve ser definido antes de arquivar metas concluídas.");
assert.ok(app.includes('snapshot?.dataType === "meu-cronograma-concursos-drive-data"'), "A importação deve reconhecer backups completos de múltiplos planejamentos.");
assert.ok(app.includes("function completedCycleCount"), "A numeração deve ignorar fechamentos sem atividade registrada.");

assert.ok(app.includes("function repairStoredCycleLabels"), "O reparo dos rótulos de ciclos deve estar disponível.");
assert.ok(app.includes("function openReviewFocusedStudy"), "Revisões fora do ciclo atual devem abrir no modo focado.");
assert.ok(app.includes("function saveStandaloneReviewResult"), "A revisão temporária deve registrar desempenho sem criar uma meta do ciclo.");
assert.ok(app.includes("reviewSessionOnly"), "Blocos temporários de revisão não devem ser persistidos no ciclo.");
assert.ok(app.includes("function suspendFocusedStudy"), "Sair do modo focado deve preservar a sessão em andamento.");
assert.ok(app.includes("function operationalStudyUnits"), "O ciclo deve converter temas em partes operacionais vinculadas a uma meta.");
assert.ok(app.includes("function metaProgressForBlock"), "A conclusão da meta deve considerar todas as partes necessárias.");
assert.ok(index.includes("js/mastery-diagnosis.js?v=20260902-error-analysis"), "O motor de domínio deve ser carregado antes do app.");
assert.ok(index.includes("js/learning-intervention.js?v=20260902-recovery-cycle"), "O ciclo de recuperação deve carregar antes das revisões adaptativas.");
assert.ok(index.includes("js/error-analysis.js?v=20260902-error-notebook"), "A análise de erros deve carregar antes do diagnóstico central.");
assert.ok(app.includes("function masteryDiagnosisForTarget"), "Os módulos devem consultar uma fonte única de diagnóstico de domínio.");
assert.ok(index.includes('data-tab-target="aprendizado"') && index.includes('id="tab-aprendizado"'), "O Diagnóstico de aprendizagem deve ficar disponível em Acompanhamento.");
assert.ok(index.includes("js/learning-diagnosis-view.js?v=20260902-learning-diagnosis"), "A visualização de diagnóstico deve carregar antes do app.");
assert.ok(app.includes("function renderLearningDiagnosis"), "A tela deve reutilizar o diagnóstico central para montar sua leitura.");
assert.ok(index.includes('data-tab-target="caderno-erros"') && index.includes('id="tab-caderno-erros"'), "O registro bruto deve ter um Caderno de Erros separado do diagnóstico.");
assert.ok(app.includes("function registerFocusedError"), "O modo foco deve registrar erros sem depender do fechamento da sessão.");
assert.ok(app.includes("registroAutomatico: true"), "A contagem automática da sessão deve permanecer distinguível dos registros manuais.");

console.log("OK - estabilização central, extração local e diálogos internos presentes.");
