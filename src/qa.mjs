// Uzycie: node src/qa.mjs <run-id>
// Kontrola techniczna: komplet plikow, wymiary, kodek, dlugosc, brak przepelnien tekstu. Buduje tez out/contact.jpg do rzutu oka.
// Dla przebiegow A/B (pole variant) dodatkowo: 6 slajdow, slajd 1 typu hook, 8 s i 24 kl/s, kolejnosc narzedzi w opisie i alt.
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
  const r = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type,codec_name,pix_fmt,width,height,r_frame_rate:format=duration,size', '-of', 'json', f], { encoding: 'utf8' });
  try { return JSON.parse(r.stdout); } catch { return null; }
};

const thumbs = path.join(runDir, '.tmp', 'thumbs');
fs.rmSync(thumbs, { recursive: true, force: true });
fs.mkdirSync(thumbs, { recursive: true });

for (const s of carousel.slides) {
  const isVideo = s.type === 'tool' || s.type === 'hook';
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
    if (p.streams.some((x) => x.codec_type === 'audio')) problems.push(`slajd ${s.n}: wideo ma sciezke dzwieku`);
    if (carousel.variant) { // przebiegi A/B: wideo ma byc dokladnie 8 s i 24 kl/s
      if (Math.abs(dur - brand.video.seconds) > 0.15) problems.push(`slajd ${s.n}: dlugosc ${dur}s zamiast ${brand.video.seconds} s`);
      if (v.r_frame_rate !== `${brand.video.fps}/1`) problems.push(`slajd ${s.n}: tempo klatek ${v.r_frame_rate} zamiast ${brand.video.fps}/1`);
    }
  }
  const ov = state.overflow[s.n] || [];
  if (ov.length) problems.push(`slajd ${s.n}: tekst: ${ov.join('; ')}`);
  const args = isVideo ? ['-y', '-v', 'error', '-ss', '4.6', '-i', f] : ['-y', '-v', 'error', '-i', f];
  // format=yuvj420p: enkoder mjpeg odrzuca wideo yuv420p z ograniczonym zakresem, a wtedy miniatura nie powstaje
  const tr = spawnSync('ffmpeg', [...args, '-frames:v', '1', '-vf', 'scale=360:-1,format=yuvj420p', path.join(thumbs, `t-${pad(s.n)}.jpg`)], { encoding: 'utf8' });
  if (!fs.existsSync(path.join(thumbs, `t-${pad(s.n)}.jpg`))) problems.push(`slajd ${s.n}: nie powstala miniatura do podgladu ${(tr.stderr || '').trim().split('\n')[0]}`);
}

// struktura: numeracja, ostatni slajd = CTA, alt zgodny z kolejnoscia slajdow, brak em dashy
const total = carousel.slides.length;
carousel.slides.forEach((s, i) => { if (s.n !== i + 1) problems.push(`numeracja: slajd na pozycji ${i + 1} ma n=${s.n}`); });
if (carousel.slides[total - 1].type !== 'cta') problems.push('ostatni slajd nie jest CTA');
if (carousel.slides.filter((s) => s.type === 'cta').length !== 1) problems.push('powinien byc dokladnie jeden slajd CTA');
if (carousel.variant) {
  if (total !== 6) problems.push(`wariant A/B ma ${total} slajdow zamiast 6`);
  if (carousel.slides[0].type !== 'hook') problems.push('slajd 1 nie jest typu hook');
  if (carousel.cta_live !== false) problems.push('cta_live musi byc false');
  const order = carousel.tool_order || [];
  const cap = carousel.post.caption;
  let at = -1;
  for (const name of order) { // kolejnosc narzedzi w opisie = kolejnosc slajdow
    const k = cap.indexOf(name + ' ', cap.indexOf('Here are five'));
    if (k < 0 || k < at) problems.push(`caption: narzedzie "${name}" poza kolejnoscia slajdow`);
    at = k;
  }
  const names = carousel.slides.filter((s) => s.type !== 'cta').map((s) => s.tag.split('  /  ')[0]);
  if (JSON.stringify(names) !== JSON.stringify(order)) problems.push(`tool_order (${order.join(', ')}) rozni sie od slajdow (${names.join(', ')})`);
}
const alts = carousel.post.alt || [];
if (alts.length !== total) problems.push(`alt: ${alts.length} wpisow dla ${total} slajdow`);
carousel.slides.forEach((s, i) => {
  const a = alts[i] || '';
  if (s.type === 'cta') { if (!/Call to action/.test(a)) problems.push(`alt ${i + 1}: oczekiwano opisu CTA`); }
  else if (s.type !== 'cover' && (!a.includes(s.headline) || !a.includes(s.tag.split('  /  ')[0]))) problems.push(`alt ${i + 1}: nie pasuje do slajdu (${s.tag.split('  /  ')[0]})`);
});
if (JSON.stringify(carousel).includes(String.fromCharCode(0x2014))) problems.push('tekst zawiera em dash');

// plansza podgladu (4 w rzedzie)
const cols = 4, rows = Math.ceil(carousel.slides.length / cols);
spawnSync('ffmpeg', ['-y', '-v', 'error', '-framerate', '1', '-i', path.join(thumbs, 't-%02d.jpg'), '-vf', `tile=${cols}x${rows}:padding=8:color=0x0B1320`, '-frames:v', '1', path.join(outDir, 'contact.jpg')]);

state.qa = { ok: problems.length === 0, problems, at: new Date().toISOString() };
saveState(runDir, state);
console.log(problems.length ? 'QA: BLEDY\n- ' + problems.join('\n- ') : 'QA: OK');
process.exit(problems.length ? 1 : 0);
