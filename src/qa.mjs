// Uzycie: node src/qa.mjs <run-id>
// Kontrola techniczna: komplet plikow, wymiary, kodek, dlugosc, brak przepelnien tekstu. Buduje tez out/contact.jpg do rzutu oka.
// Kod wyjscia 0 = przechodzi, 1 = blad (wtedy nie publikujemy, tylko szkic).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { loadState, saveState } from './state.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const runId = process.argv[2];
if (!runId) { console.error('Podaj id przebiegu.'); process.exit(2); }
const runDir = path.join(root, 'runs', runId);
const outDir = path.join(runDir, 'out');
const carousel = JSON.parse(fs.readFileSync(path.join(runDir, 'carousel.json'), 'utf8'));
const brand = JSON.parse(fs.readFileSync(path.join(root, 'brand.json'), 'utf8'));
const state = loadState(runDir);
const pad = (n) => String(n).padStart(2, '0');
const problems = [];

const probe = (f) => {
  const r = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type,codec_name,pix_fmt,width,height:format=duration,size', '-of', 'json', f], { encoding: 'utf8' });
  try { return JSON.parse(r.stdout); } catch { return null; }
};

const thumbs = path.join(runDir, '.tmp', 'thumbs');
fs.rmSync(thumbs, { recursive: true, force: true });
fs.mkdirSync(thumbs, { recursive: true });

for (const s of carousel.slides) {
  const isVideo = s.type === 'tool';
  const f = path.join(outDir, `slide-${pad(s.n)}.${isVideo ? 'mp4' : 'png'}`);
  if (!fs.existsSync(f)) { problems.push(`slajd ${s.n}: brak pliku`); continue; }
  const p = probe(f);
  if (!p) { problems.push(`slajd ${s.n}: ffprobe nie czyta pliku`); continue; }
  const v = p.streams.find((x) => x.codec_type === 'video');
  if (!v || v.width !== brand.video.width || v.height !== brand.video.height) problems.push(`slajd ${s.n}: zly wymiar ${v && v.width}x${v && v.height}`);
  if (isVideo) {
    const dur = Number(p.format.duration);
    if (!(dur >= 3 && dur <= 60)) problems.push(`slajd ${s.n}: dlugosc ${dur}s poza 3 do 60 s`);
    if (v.codec_name !== 'h264' || v.pix_fmt !== 'yuv420p') problems.push(`slajd ${s.n}: kodek ${v.codec_name}/${v.pix_fmt}`);
    if (Number(p.format.size) > 100 * 1024 * 1024) problems.push(`slajd ${s.n}: plik za duzy`);
  }
  const ov = state.overflow[s.n] || [];
  if (ov.length) problems.push(`slajd ${s.n}: tekst: ${ov.join('; ')}`);
  const args = isVideo ? ['-y', '-v', 'error', '-ss', '4.6', '-i', f] : ['-y', '-v', 'error', '-i', f];
  spawnSync('ffmpeg', [...args, '-frames:v', '1', '-vf', 'scale=360:-1', path.join(thumbs, `t-${pad(s.n)}.jpg`)]);
}

// plansza podgladu (4 w rzedzie)
const cols = 4, rows = Math.ceil(carousel.slides.length / cols);
spawnSync('ffmpeg', ['-y', '-v', 'error', '-framerate', '1', '-i', path.join(thumbs, 't-%02d.jpg'), '-vf', `tile=${cols}x${rows}:padding=8:color=0x0B1320`, '-frames:v', '1', path.join(outDir, 'contact.jpg')]);

state.qa = { ok: problems.length === 0, problems, at: new Date().toISOString() };
saveState(runDir, state);
console.log(problems.length ? 'QA: BLEDY\n- ' + problems.join('\n- ') : 'QA: OK');
process.exit(problems.length ? 1 : 0);
