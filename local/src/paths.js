import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

/**
 * Where models and helper binaries are kept between runs.
 * Override with EASIER_TRANSCRIBE_HOME.
 */
export function cacheDir(...parts) {
  let base = process.env.EASIER_TRANSCRIBE_HOME;
  if (!base) {
    if (process.platform === 'win32') {
      base = path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'easier-transcribe');
    } else if (process.platform === 'darwin') {
      base = path.join(os.homedir(), 'Library', 'Caches', 'easier-transcribe');
    } else {
      base = path.join(process.env.XDG_CACHE_HOME || path.join(os.homedir(), '.cache'), 'easier-transcribe');
    }
  }
  const dir = path.join(base, ...parts);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** Find an executable on PATH. Returns its full path or null. */
export function which(name) {
  const exts = process.platform === 'win32' ? (process.env.PATHEXT || '.EXE;.CMD;.BAT').split(';') : [''];
  for (const dir of (process.env.PATH || '').split(path.delimiter)) {
    if (!dir) continue;
    for (const ext of exts) {
      const candidate = path.join(dir, name + ext.toLowerCase());
      const upper = path.join(dir, name + ext);
      for (const file of [candidate, upper]) {
        try {
          if (fs.statSync(file).isFile()) return file;
        } catch {
          // not here
        }
      }
    }
  }
  return null;
}

/** Log to stderr. stdout belongs to the MCP protocol and to CLI output. */
export function log(...args) {
  if (process.env.EASIER_TRANSCRIBE_QUIET) return;
  console.error('[easier-transcribe]', ...args);
}
