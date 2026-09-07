const assert = require("assert");
const comparator = require("../js/program-version-comparator.js");

function unit(id, materia, titulo, contents, extra = {}) {
  return { id, materia, titulo, assunto: titulo, descricao: contents.join("; "), conteudosOriginais: contents, ...extra };
}

const current = [
  unit("u-port", "Língua Portuguesa", "Pontuação", ["Emprego da vírgula", "Sinais de pontuação"]),
  unit("u-afo", "AFO", "Despesa Pública", ["Conceito", "Classificação"]),
  unit("u-old", "Direito", "Tema removido", ["Conteúdo histórico"], { resumoTema: "Resumo preservado" }),
];

let diff = comparator.compare(current, [
  unit("n-port", "Língua Portuguesa", "Pontuação", ["Emprego da virgula", "Sinais de pontuação"], { outlineNumber: "2.1" }),
  unit("n-afo", "AFO", "Despesa Pública", ["Conceito", "Classificação", "Estágios"]),
  unit("n-new", "AFO", "Receita Pública", ["Conceito"]),
]);
assert.strictEqual(diff.summary.UNCHANGED, 1, "pontuação permanece inalterada apesar de acento/numeração");
assert.strictEqual(diff.summary.MODIFIED, 1, "adição de conteúdo deve ser alteração");
assert.strictEqual(diff.summary.ADDED, 1, "novo tema deve ser adicionado");
assert.strictEqual(diff.summary.REMOVED, 1, "tema ausente deve ser removido apenas da leitura atual");
assert.ok(diff.reordered === true || diff.reordered === false);

const modified = diff.units.find((item) => item.type === "MODIFIED");
assert.deepStrictEqual(modified.addedContents, ["Estágios"]);
assert.deepStrictEqual(modified.removedContents, []);
assert.deepStrictEqual(modified.retainedContents, ["Conceito", "Classificação"]);

let applied = comparator.applyDiff(diff);
assert.strictEqual(applied.rows.find((row) => row.titulo === "Pontuação").id, "u-port", "identidade estável preservada");
assert.strictEqual(applied.rows.find((row) => row.titulo === "Tema removido").activeInCurrentProgram, false, "remoção não apaga o item histórico");
assert.strictEqual(applied.rows.find((row) => row.titulo === "Tema removido").resumoTema, "Resumo preservado");
assert.strictEqual(applied.correspondences.length, 3);

const moved = comparator.compare(
  [unit("u1", "AFO", "Despesa Pública", ["Conceito"]), unit("u2", "AFO", "Receita Pública", ["Conceito"])],
  [unit("n2", "AFO", "Receita Pública", ["Conceito"]), unit("n1", "AFO", "Despesa Pública", ["Conceito"], { outlineNumber: "4" })],
);
assert.strictEqual(moved.summary.UNCHANGED, 2, "mudança de numeração/posição sem mudança de conteúdo mantém identidade");
assert.strictEqual(moved.reordered, true, "a comparação expõe a reordenação sem criar temas");

const renamed = comparator.compare(
  [unit("u1", "AFO", "Despesa", ["Conceito", "Classificação"])],
  [unit("n1", "AFO", "Despesa pública", ["Conceito", "Classificação"])],
);
assert.ok(renamed.summary.RENAMED || renamed.summary.POSSIBLE_MATCH, "renomeação deve ser detectada ou encaminhada para revisão");

const ambiguous = comparator.compare(
  [unit("u1", "Direito", "Princípios", ["Legalidade"]), unit("u2", "Direito", "Princípios", ["Impessoalidade"])],
  [unit("n1", "Direito", "Princípios gerais", ["Legalidade e impessoalidade"])],
);
assert.strictEqual(ambiguous.needsReview, true, "correspondência ambígua exige decisão");
assert.strictEqual(ambiguous.canApply, false);
const asNew = comparator.applyDiff(ambiguous, { [ambiguous.units.find((item) => item.type === "POSSIBLE_MATCH").next.key]: "treat-as-new" });
assert.notStrictEqual(asNew.rows[0].id, "u1", "usuário pode tratar possível correspondência como novo item");

const punctuation = comparator.compare(
  [unit("u1", "AFO", "Receita pública", ["1. Conceito", "2 - Classificação"])],
  [unit("u2", "AFO", "Receita pública", ["Conceito", "Classificação"])],
);
assert.strictEqual(punctuation.summary.UNCHANGED, 1, "numeração visual não deve criar alteração");

const addedContents = comparator.diffContents(null, unit("n", "AFO", "Tema", ["Conceito"]));
assert.deepStrictEqual(addedContents.addedContents, ["Conceito"]);
assert.deepStrictEqual(addedContents.removedContents, []);

console.log("program-version-comparator: ok (15 invariantes/cenários)");
