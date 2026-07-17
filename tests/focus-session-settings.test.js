"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const index = fs.readFileSync(path.join(root, "index.html"), "utf8");

["normalizeActiveFocusSession", "persistFocusedSession", "restoreFocusedSessionFromSnapshot", "resolveLongFocusedSession", "discardFocusedStudySession"].forEach((name) => {
  assert.ok(app.includes(`function ${name}`), `${name} deve manter a sessão focada persistente.`);
});
assert.ok(app.includes("activeFocusSession"), "O snapshot deve incluir a sessão focada ativa.");
assert.ok(app.includes("FOCUS_SESSION_PERSIST_INTERVAL"), "A sessão em execução deve ter salvamento periódico.");
assert.ok(app.includes("pagehide"), "A sessão deve ter cópia de segurança ao sair da página.");
assert.ok(app.includes("scheduleLocalMigrationPrompt"), "A migração local deve ser apresentada somente quando necessária.");
assert.ok(!index.includes("Opções avançadas"), "O menu não deve expor opções avançadas legadas.");
assert.ok(!index.includes("Configurar arquivo externo"), "O menu não deve expor arquivo externo.");
assert.ok(!index.includes("Fazer backup agora"), "O menu não deve duplicar a exportação de backup.");
assert.ok(!index.includes("Atalhos de teclado"), "O menu não deve listar atalhos sem uma tela de ajuda.");
assert.ok(index.includes("Dados e segurança"), "O menu deve manter a seção de dados e segurança.");

console.log("OK - sessão focada persistente e configurações simplificadas presentes.");
