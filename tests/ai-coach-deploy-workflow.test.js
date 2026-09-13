"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

const workflow = fs.readFileSync(".github/workflows/deploy-ai-coach.yml", "utf8");

assert.match(workflow, /name: Deploy AI Coach Edge Function/);
assert.match(workflow, /branches: \[main\]/);
assert.match(workflow, /supabase\/functions\/ai-strategic-coach\/\*\*/);
assert.match(workflow, /supabase\/config\.toml/);
assert.match(workflow, /concurrency:\s*[\s\S]*group: deploy-ai-strategic-coach/);
assert.match(workflow, /SUPABASE_ACCESS_TOKEN: \$\{\{ secrets\.SUPABASE_ACCESS_TOKEN \}\}/);
assert.match(workflow, /supabase\/setup-cli@v1/);
assert.match(workflow, /version: 2\.40\.0/);
assert.match(workflow, /supabase functions deploy ai-strategic-coach --project-ref/);
assert.doesNotMatch(workflow, /functions deploy(?! ai-strategic-coach)/);
assert.doesNotMatch(workflow, /--no-verify-jwt/);
assert.doesNotMatch(workflow, /OPENAI_API_KEY|service_role/i);
assert.match(workflow, /npm test/);
assert.match(workflow, /--request OPTIONS/);
assert.match(workflow, /GITHUB_SHA/);

console.log("OK - o deploy do AI Coach é restrito, testado e rastreável.");
