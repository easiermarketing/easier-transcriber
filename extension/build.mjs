// Builds the Chrome extension into extension/dist.
//   npm run build:extension          the real build
//   EXT_TEST=1 npm run build:extension   a test build (extension/dist-test) that also
//                                        has access to http://127.0.0.1, for automated checks
import { copyFileSync, cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '..');
const test = process.env.EXT_TEST === '1';
const outDir = resolve(here, test ? 'dist-test' : 'dist');

const alias = { '@local': join(repo, 'local/src'), '@app': join(repo, 'src') };

// ONNX Runtime's wasm is shipped separately in ort/ (an extension can't load it from a CDN).
const dropBundledOrtWasm = {
  name: 'drop-bundled-ort-wasm',
  generateBundle(_, bundle) {
    for (const name of Object.keys(bundle)) if (/ort-wasm[^/]*\.wasm$/.test(name)) delete bundle[name];
  },
};

rmSync(outDir, { recursive: true, force: true });

// 1. Pages (popup, results), the service worker and the Whisper worker.
await build({
  configFile: false,
  root: join(here, 'src'),
  base: './',
  publicDir: false,
  logLevel: 'warn',
  resolve: { alias },
  plugins: [dropBundledOrtWasm],
  worker: { format: 'es', plugins: () => [dropBundledOrtWasm] },
  build: {
    outDir,
    emptyOutDir: true,
    target: 'es2022',
    modulePreload: false,
    rollupOptions: {
      input: {
        popup: join(here, 'src/popup.html'),
        results: join(here, 'src/results.html'),
        background: join(here, 'src/background.js'),
      },
      output: {
        entryFileNames: (chunk) => (chunk.name === 'background' ? 'background.js' : 'assets/[name]-[hash].js'),
      },
    },
  },
});

// 2. The content script: a single classic script, injected when the button is pressed.
await build({
  configFile: false,
  root: join(here, 'src'),
  publicDir: false,
  logLevel: 'warn',
  resolve: { alias },
  build: {
    outDir,
    emptyOutDir: false,
    target: 'es2022',
    lib: { entry: join(here, 'src/content.js'), formats: ['iife'], name: 'EasierContent', fileName: () => 'content.js' },
  },
});

// 3. Files that are copied as they are.
const manifest = JSON.parse(readFileSync(join(here, 'manifest.json'), 'utf8'));
if (test) manifest.host_permissions.push('http://127.0.0.1/*', ...(process.env.EXT_TEST_HOSTS || '').split(',').filter(Boolean));
writeFileSync(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

mkdirSync(join(outDir, 'ort'), { recursive: true });
const ort = join(repo, 'node_modules/onnxruntime-web/dist');
for (const f of ['ort-wasm-simd-threaded.asyncify.mjs', 'ort-wasm-simd-threaded.asyncify.wasm']) copyFileSync(join(ort, f), join(outDir, 'ort', f));

mkdirSync(join(outDir, 'ffmpeg'), { recursive: true });
const ffmpeg = join(repo, 'node_modules/@ffmpeg/core/dist/esm');
for (const f of ['ffmpeg-core.js', 'ffmpeg-core.wasm']) copyFileSync(join(ffmpeg, f), join(outDir, 'ffmpeg', f));

cpSync(join(here, 'icons'), join(outDir, 'icons'), { recursive: true });

console.log(`Extension built in ${outDir}\nLoad it: chrome://extensions, turn on Developer mode, Load unpacked, pick that folder.`);
