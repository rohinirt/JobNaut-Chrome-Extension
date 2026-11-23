// One-time setup: downloads the libraries Jobnaut bundles locally (Chrome extensions can't load remote code).
// Usage:  node setup-vendor.mjs      (Node 18+)
import { mkdir, writeFile } from "node:fs/promises";

const dir = new URL("./vendor/", import.meta.url);
await mkdir(dir, { recursive: true });

const files = {
  "jszip.min.js": "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js",
  "jspdf.umd.min.js": "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
  "transformers.min.js": "https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2/dist/transformers.min.js"
};

// the ONNX wasm runtime files that sit next to transformers.min.js
const list = await (await fetch("https://data.jsdelivr.com/v1/package/npm/@xenova/transformers@2.17.2/flat")).json();
for (const f of list.files) {
  const m = /^\/dist\/(ort-wasm[^/]*\.(wasm|js|mjs))$/.exec(f.name);
  if (m) files[m[1]] = "https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2" + f.name;
}

for (const [name, url] of Object.entries(files)) {
  process.stdout.write(`↓ ${name} … `);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  await writeFile(new URL(name, dir), Buffer.from(await res.arrayBuffer()));
  console.log("ok");
}
console.log("\nDone. Reload the extension at chrome://extensions.");
