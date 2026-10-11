// Kopiuje czcionki z node_modules do fonts/ (idempotentne). Uruchom po `npm install`.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'fonts');
fs.mkdirSync(out, { recursive: true });

const wanted = [
  ['@fontsource/anton/files/anton-latin-400-normal.woff2', 'anton-400.woff2'],
  ['@fontsource/inter/files/inter-latin-400-normal.woff2', 'inter-400.woff2'],
  ['@fontsource/inter/files/inter-latin-600-normal.woff2', 'inter-600.woff2'],
  ['@fontsource/inter/files/inter-latin-700-normal.woff2', 'inter-700.woff2'],
];

for (const [src, dst] of wanted) {
  const from = path.join(root, 'node_modules', src);
  const to = path.join(out, dst);
  if (!fs.existsSync(from)) throw new Error(`Brak ${from}. Uruchom najpierw npm install.`);
  if (!fs.existsSync(to)) fs.copyFileSync(from, to);
}
console.log('fonts ok:', fs.readdirSync(out).join(', '));
