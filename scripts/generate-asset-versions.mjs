import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const indexPath = new URL("../index.html", import.meta.url);
const write = process.argv.includes("--write");
let index = await readFile(indexPath, "utf8");
const matches = [...index.matchAll(/(?:href|src)="(\.\/(?:[^"?#]+\.(?:css|js)))(?:\?v=[^"]*)?"/g)];
for (const match of matches) {
  const relative = match[1];
  const file = new URL(`../${relative.slice(2)}`, import.meta.url);
  const hash = createHash("sha256").update(await readFile(file)).digest("hex").slice(0, 12);
  const replacement = match[0].replace(/(?:\?v=[^"]*)?"$/, `?v=${hash}"`);
  index = index.replace(match[0], replacement);
}
if (write) await writeFile(indexPath, index);
else if ((await readFile(indexPath, "utf8")) !== index) {
  console.error("Os identificadores de cache dos assets não correspondem ao conteúdo. Execute: node scripts/generate-asset-versions.mjs --write");
  process.exit(1);
}