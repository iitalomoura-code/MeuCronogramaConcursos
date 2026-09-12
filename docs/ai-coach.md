# AI Coach

## Arquitetura

O cliente monta `buildCurrentAIStrategicSnapshot()` e chama a Edge Function
`ai-strategic-coach` somente por ação explícita. A função valida o JWT com o
Supabase, confere o usuário permitido, valida o contrato e envia apenas o
snapshot canônico à OpenAI Responses API. O review retornado é validado antes
de ser entregue ao navegador.

O Coach recomenda; os motores locais calculam; o usuário decide. Nenhum review
altera state, Base Permanente, diagnóstico, prioridade, ciclo ou histórico.

## Configuração segura

Configure os secrets no projeto Supabase, nunca no frontend ou no Git:

- `OPENAI_API_KEY`
- `AI_ALLOWED_USER_ID`

Os valores também podem ser usados localmente em
`supabase/functions/.env`, que permanece ignorado pelo Git. O arquivo
`.env.example` contém somente os nomes das variáveis.

## Modelo e contrato

O modelo inicial é `gpt-5.6-terra`. A chamada usa `POST /v1/responses` com
Structured Outputs via `text.format.type = json_schema`, contrato versão 1 e
`store: false`. O input contém somente instruções fixas e o AI Strategic
Snapshot; não contém state bruto, HTML, tokens, UID ou e-mail.

O review possui `periodDiagnosis`, `facts`, `interpretation`,
`recommendation`, `advances`, `bottlenecks`, até três `priorities`,
`maintenance`, `avoidForNow`, `uncertainties`, `strategicNotes` e, no modo
`question`, `answerToQuestion`. O modo `progress-check` usa também
`sinceLastReview`, enquanto `cycle-review` usa `cycleEvaluation`.

## Modos e continuidade

O contrato aceita três modos independentes do fechamento de ciclo:

- `cycle-review`: revisão oficial e mais profunda ligada ao ciclo, podendo comparar o snapshot do ciclo anterior;
- `progress-check`: consulta intermediária sobre o que mudou desde a última análise;
- `question`: pergunta contextual do usuário, limitada a 2.000 caracteres.

`AIStrategicCoachClient.analyze(snapshot)` mantém o modo
`progress-check` durante a transição por compatibilidade. Também estão disponíveis
`analyzeCycle(snapshot, previousContext)`,
`checkProgress(snapshot, previousContext)`,
`reanalyze(snapshot, previousContext)` como alias de compatibilidade, e
`ask(snapshot, question, previousContext)`.

`previousContext` pode conter `previousCoachReview`,
`previousCoachCheckpoint`, `deltaSinceLastCoachReview` e
`previousCycleSnapshot`. `previousCoachReview` é a memória da última consulta
do Coach; `previousCycleSnapshot` é a referência factual/estratégica do ciclo
anterior. Eles não são intercambiáveis. A revisão anterior é contexto
estratégico, não evidência factual: o snapshot atual sempre tem precedência.
Consultas intermediárias priorizam o delta e o snapshot atual, sem exigir
releitura completa do histórico; `cycle-review` pode comparar os dois
snapshots de ciclo. A última consulta do Coach nunca substitui
`previousCycleSnapshot`.

O dedupe do cliente considera `snapshotSignature`, modo e pergunta
normalizada. Assim, análises iguais de `cycle-review`/`reanalyze-now` podem
ser compartilhadas, enquanto perguntas diferentes continuam independentes.
Não existe regra de uma consulta por ciclo; permanece apenas o rate limit
técnico por usuário.

## Códigos de erro

`401 AI_AUTH_REQUIRED`, `403 AI_ACCESS_DENIED`, `413 AI_SNAPSHOT_TOO_LARGE`,
`422 AI_CONTRACT_VERSION_UNSUPPORTED`, `422 AI_INVALID_SNAPSHOT`,
`429 AI_RATE_LIMITED`, `502 AI_PROVIDER_ERROR`, `504 AI_PROVIDER_TIMEOUT`.

O rate limit inicial é best-effort em memória: cinco análises por usuário por
hora por instância da Edge Function. A persistência e histórico de reviews
ficam fora da Fase 4.3A.

## Teste e deploy

O navegador expõe `AIStrategicCoachClient.analyze(snapshot)`,
`AIStrategicCoachClient.reanalyze(snapshot, previousContext)` e
`AIStrategicCoachClient.ask(snapshot, question, previousContext)`, além de
`requestAIStrategicCoachReview()` para teste manual. A chamada não é automática.

Com o Supabase CLI autenticado e o projeto conectado:

```bash
supabase secrets set OPENAI_API_KEY=... AI_ALLOWED_USER_ID=...
supabase functions deploy ai-strategic-coach --use-api
```

Os testes automatizados usam mocks e não consomem créditos da OpenAI. O deploy
real depende do projeto Supabase estar vinculado e dos secrets configurados.

## Fase 4.3B: memória e continuidade

As análises são persistidas em `ai_coach_reviews` no Supabase, com RLS para
leitura e inserção somente pelo usuário autenticado. Cada linha é imutável e
guarda o modo, a pergunta original quando existir, a assinatura do snapshot,
os metadados, o review e um checkpoint factual derivado do snapshot usado na
chamada. O checkpoint não é um novo diagnóstico.

`AICoachCheckpoint.fromSnapshot(snapshot)` reduz o contrato canônico a totais,
matérias, tópicos e referência do ciclo. `AICoachDelta.compare(...)` somente
compara esses valores registrados; não recalcula domínio, confiança,
readiness ou prioridade. Sem checkpoint anterior, o delta é `null`.

O Orientador oferece `Analisar ciclo`, `Ver minha evolução` e `Perguntar ao
Coach`. A consulta de ciclo usa o review oficial de ciclo anterior quando
disponível; as outras consultas usam o último review independentemente do
ciclo. O histórico inicial carrega apenas os dez registros mais recentes.

O snapshot atual permanece a fonte de verdade. Reviews anteriores são apenas
contexto estratégico compacto. Se a resposta chegar mas o salvamento falhar,
a resposta continua visível com aviso e nenhuma nova chamada é disparada
automaticamente. O fechamento do ciclo não chama a IA sem ação explícita.
