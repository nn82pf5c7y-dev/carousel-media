// Stan przebiegu: zapis atomowy (plik tymczasowy + rename) i prosta blokada, zeby dwa przebiegi nie szly naraz.
import fs from 'node:fs';
import path from 'node:path';

export function loadState(runDir) {
  const f = path.join(runDir, 'state.json');
  if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, 'utf8'));
  return { stages: { stills: {}, videos: {} }, overflow: {}, qa: null, publish: null, updated: null };
}

export function saveState(runDir, st) {
  st.updated = new Date().toISOString();
  const f = path.join(runDir, 'state.json');
  fs.writeFileSync(f + '.tmp', JSON.stringify(st, null, 2));
  fs.renameSync(f + '.tmp', f);
}

const STALE_MS = 30 * 60 * 1000;

export function acquireLock(runDir) {
  const f = path.join(runDir, '.lock');
  if (fs.existsSync(f)) {
    const age = Date.now() - Number(fs.readFileSync(f, 'utf8'));
    if (age < STALE_MS) return false;
  }
  fs.writeFileSync(f, String(Date.now()));
  return true;
}

export function releaseLock(runDir) {
  const f = path.join(runDir, '.lock');
  if (fs.existsSync(f)) fs.unlinkSync(f);
}
