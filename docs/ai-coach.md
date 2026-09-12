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
`maintenance`, `avoidForNow`, `uncertainties` e `strategicNotes`.

## Códigos de erro

`401 AI_AUTH_REQUIRED`, `403 AI_ACCESS_DENIED`, `413 AI_SNAPSHOT_TOO_LARGE`,
`422 AI_CONTRACT_VERSION_UNSUPPORTED`, `422 AI_INVALID_SNAPSHOT`,
`429 AI_RATE_LIMITED`, `502 AI_PROVIDER_ERROR`, `504 AI_PROVIDER_TIMEOUT`.

O rate limit inicial é best-effort em memória: cinco análises por usuário por
hora por instância da Edge Function. A persistência e histórico de reviews
ficam fora da Fase 4.3A.

## Teste e deploy

O navegador expõe `AIStrategicCoachClient.analyze(snapshot)` e
`requestAIStrategicCoachReview()` para teste manual. A chamada não é automática.

Com o Supabase CLI autenticado e o projeto conectado:

```bash
supabase secrets set OPENAI_API_KEY=... AI_ALLOWED_USER_ID=...
supabase functions deploy ai-strategic-coach --use-api
```

Os testes automatizados usam mocks e não consomem créditos da OpenAI. O deploy
real depende do projeto Supabase estar vinculado e dos secrets configurados.
