/**
 * Kaynakları tek dosyaya gömer.
 *
 *   dist/index.html    — tam, bağımsız HTML belgesi (GitHub Pages / yerel açılış)
 *   dist/artifact.html — yalnızca gövde içeriği (Claude Artifact yayını için;
 *                        doctype/head/body sarmalayıcıyı platform ekler)
 *
 * Harici istek yok: CSS ve JS satır içine alınır, böylece katı CSP altında da
 * çalışır.
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFile(join(root, p), "utf8");

const TITLE = "Motor Tasarım Atölyesi";
const DESC = "Kalıcı mıknatıslı senkron motorlar için etkileşimli stator ve rotor tasarım aracı.";

const css = await read("src/style.css");

// Tek bir modül gövdesi hâline getirilir: `export` sözcükleri ve yerel
// `import` bildirimleri düşürülür, dosyalar bağımlılık sırasına dizilir.
const stripExports = (s) => s.replace(/^export\s+/gm, "");
const stripLocalImports = (s) =>
  s.replace(/^import\s+(?:\{[\s\S]*?\}|[\w$]+)\s+from\s+["']\.\/[^"']+["'];?\s*$/gm, "");

const bundle = (await Promise.all(
  ["src/laminations.js", "src/motor.js", "src/view3d.js", "src/app.js"].map(read)
)).map((s) => stripLocalImports(stripExports(s))).join("\n\n");

const body = `<title>${TITLE}</title>
<meta name="description" content="${DESC}">
<style>
${css}</style>

<main class="wrap" id="app"></main>

<script type="module">
${bundle}
</script>
`;

const full = `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${body}</html>
`;

await mkdir(join(root, "dist"), { recursive: true });
await writeFile(join(root, "dist/index.html"), full);
await writeFile(join(root, "dist/artifact.html"), body);

const kb = (s) => (Buffer.byteLength(s) / 1024).toFixed(1);
console.log(`dist/index.html     ${kb(full)} kB`);
console.log(`dist/artifact.html  ${kb(body)} kB`);
