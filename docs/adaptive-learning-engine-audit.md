# Auditoria do motor adaptativo

## Fluxo real encontrado

`generatedBlocks`, `completedHistory`, `cycleHistory`, `cycleResults`, `reviews`, `errors`, `interventionHistory` e as sessoes do Modo Foco formam a evidencia bruta. `mastery-diagnosis.js` seleciona evidencia por tema, macrotema ou materia e produz nivel, confianca, tendencia, motivos, acao e ajuste de prioridade.

Depois disso:

1. `learning-intervention.js` registra a fotografia anterior, compara a nova evidencia e classifica a resposta como `improved`, `unchanged`, `worse`, `resolved` ou sinal de melhora.
2. `adaptive-review.js` transforma a decisao em contato adaptativo quando necessario e conserva tentativas e diagnostico no registro.
3. `adaptive-learning-policy.js` traduz o diagnostico e a resposta da intervencao em uma decisao de planejamento unica.
4. `app.js` usa essa decisao para prioridade, duracao/atividade, Continuar, Ciclo Atual e candidatos da Meta Semanal.
5. O Modo Foco grava a nova sessao, questoes, acertos, tempo e erros; a proxima leitura recalcula o diagnostico.
6. Revisoes temporais continuam separadas do reforco; seu resultado entra como evidencia.
7. Diagnostico, Evolucao, alertas e fechamento semanal leem o estado central ou seus derivados.

## Resultado da auditoria

Corretas: leitura central pelo `MasteryDiagnosis`, analise de erro com deduplicacao por sessao, historico de intervencao, escalada limitada, cache do estado derivado da tela Continuar, persistencia de sessoes de foco normais e preservacao dos ciclos encerrados.

Incompletas: a Meta Semanal ainda calculava desempenho local quando recebia um diagnostico; a composicao adaptativa tambem mantinha um mapa proprio de niveis; a acao manual de diagnostico era apenas temporaria e podia perder o contexto apos recarga; o fluxo de selecao manual podia criar temporarios repetidos em cliques rapidos.

Corrigidas: a decisao de planejamento agora passa por `AdaptiveLearningPolicy`; revisao temporal vencida nao rebaixa sozinha o dominio; tipos persistentes de erro podem escolher treino de atencao quando nao ha sinal conceitual; a selecao manual usa chave do tema, e a sessao adaptativa selecionada tem snapshot persistente e idempotente.

## Scores e thresholds

O unico classificador de dominio e `MasteryDiagnosis`. A referencia de dominio forte continua em 85%, condicionada a amostra, sessoes e tendencia. `AdaptiveLearningPolicy` apenas mapeia o nivel ja decidido para planejamento: critico 120, deficiencia 82, atencao 38, evidencia insuficiente 16. A escalada por intervencao e limitada a 36 pontos.

Thresholds encontrados fora desse dominio sao compatibilidade de planos antigos, cobertura, recencia sem contato, urgencia da prova, concentracao e projecao de capacidade. Eles respondem perguntas diferentes. A Meta Semanal deixou de usar limiares proprios quando recebe `diagnosis`.

## Persistencia e idempotencia

Resultados concluídos continuam no historico. Intervencoes ficam no registro adaptativo e em `interventionHistory`; erros manuais e automaticos da mesma sessao sao consolidados pelo `ErrorAnalysis`. A selecao manual e salva em `adaptiveSelection`; a sessao de diagnostico/reforco usa `manualAdaptiveSession` para sobreviver a F5 e nao ser criada duas vezes. O fechamento remove o temporario somente depois da conclusao.

## Limitacoes conhecidas

- A aplicacao ainda tem parte da orquestracao em `app.js`; a extracao foi incremental para reduzir risco.
- Registros adaptativos permanecem armazenados no conjunto de `reviews` por compatibilidade de dados, embora a decisao diferencie revisao temporal e reforco.
- A leitura real pelo navegador, Supabase, rede lenta e dispositivos moveis nao foi automatizada nesta suite unitária.
- `predictive-evolution.js` conserva fallback para snapshots sem diagnostico; ele trata risco de cobertura e ritmo, nao substitui o dominio central.
- Parser, taxonomia, dashboards e dados historicos nao foram alterados.
