// Uzycie: node src/render.mjs <run-id> [--only=2,3]
// Etapy: stills (PNG dla cover i cta) oraz videos (MP4 dla slajdow typu tool). Kazdy gotowy plik jest pomijany przy wznowieniu.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { loadState, saveState, acquireLock, releaseLock } from './state.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const runId = process.argv[2];
if (!runId) { console.error('Podaj id przebiegu, np. node src/render.mjs 2026-10-11-proto'); process.exit(2); }
const onlyArg = process.argv.find((a) => a.startsWith('--only='));
const only = onlyArg ? onlyArg.slice(7).split(',').map(Number) : null;

const runDir = path.join(root, 'runs', runId);
const outDir = path.join(runDir, 'out');
const tmpRoot = path.join(runDir, '.tmp');
fs.mkdirSync(outDir, { recursive: true });

const carousel = JSON.parse(fs.readFileSync(path.join(runDir, 'carousel.json'), 'utf8'));
const brand = JSON.parse(fs.readFileSync(path.join(root, 'brand.json'), 'utf8'));
const { fps, seconds, width, height } = brand.video;
const templateUrl = pathToFileURL(path.join(root, 'templates', 'slide.html')).href;
const total = carousel.slides.length;

const pad = (n) => String(n).padStart(2, '0');
const probe = (f) => {
  const r = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height:format=duration', '-of', 'json', f], { encoding: 'utf8' });
  try { return JSON.parse(r.stdout); } catch { return null; }
};
const validPng = (f) => fs.existsSync(f) && fs.statSync(f).size > 5000;
const validVideo = (f) => {
  if (!fs.existsSync(f)) return false;
  const p = probe(f);
  return !!(p && p.streams && p.streams[0] && p.streams[0].width === width && p.streams[0].height === height && Number(p.format.duration) >= 3);
};

if (!acquireLock(runDir)) { console.error('Przebieg jest zablokowany (inny proces pracuje). Przerywam.'); process.exit(3); }
const state = loadState(runDir);

let browser;
try {
  try { browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] }); }
  catch { browser = await chromium.launch({ headless: true, args: ['--no-sandbox'], executablePath: '/opt/pw-browsers/chromium' }); }

  for (const slide of carousel.slides) {
    if (only && !only.includes(slide.n)) continue;
    const isVideo = slide.type === 'tool';
    const file = path.join(outDir, `slide-${pad(slide.n)}.${isVideo ? 'mp4' : 'png'}`);
    const stage = isVideo ? 'videos' : 'stills';
    if (isVideo ? validVideo(file) : validPng(file)) {
      state.stages[stage][slide.n] = 'done';
      console.log(`slajd ${slide.n}: pominiety (gotowy)`);
      continue;
    }

    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
    await page.goto(templateUrl);
    await page.evaluate(() => window.__ready());
    const report = await page.evaluate((d) => window.__init(d), { brand, slide, total });
    state.overflow[slide.n] = report;

    if (!isVideo) {
      await page.screenshot({ path: file + '.part.png', type: 'png' });
      fs.renameSync(file + '.part.png', file);
    } else {
      const tmp = path.join(tmpRoot, pad(slide.n));
      fs.rmSync(tmp, { recursive: true, force: true });
      fs.mkdirSync(tmp, { recursive: true });
      const frames = fps * seconds;
      for (let i = 0; i < frames; i++) {
        await page.evaluate((t) => window.__setTime(t), i / fps);
        await page.screenshot({ path: path.join(tmp, `${String(i).padStart(4, '0')}.jpg`), type: 'jpeg', quality: 94 });
      }
      const part = file + '.part.mp4';
      const r = spawnSync('ffmpeg', ['-y', '-v', 'error', '-framerate', String(fps), '-i', path.join(tmp, '%04d.jpg'),
        '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', part], { encoding: 'utf8' });
      if (r.status !== 0) throw new Error('ffmpeg: ' + r.stderr);
      fs.renameSync(part, file);
      fs.rmSync(tmp, { recursive: true, force: true });
    }
    await page.close();
    state.stages[stage][slide.n] = 'done';
    saveState(runDir, state);
    console.log(`slajd ${slide.n}: gotowy (${path.basename(file)})${report.length ? ' UWAGA: ' + report.join('; ') : ''}`);
  }
  saveState(runDir, state);
} finally {
  if (browser) await browser.close();
  releaseLock(runDir);
}
