import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { onRequestGet as youtubeLookup } from './functions/api/youtube.js'
import { onRequestPost as subscribePost } from './functions/api/subscribe.js'

// Same headers as public/_headers, so dev matches production. credentialless
// keeps the page cross-origin isolated (faster multi-threaded WASM) without
// requiring every third-party resource to opt in.
const isolationHeaders = {
  'Cross-Origin-Embedder-Policy': 'credentialless',
  'Cross-Origin-Opener-Policy': 'same-origin',
}

// Runs the Cloudflare Pages Function for /api/youtube inside the dev and
// preview servers.
const youtubeMiddleware = async (req, res) => {
  const response = await youtubeLookup({ request: new Request(`http://localhost${req.originalUrl}`) })
  res.statusCode = response.status
  response.headers.forEach((value, key) => res.setHeader(key, value))
  res.end(await response.text())
}

// Same for POST /api/subscribe. Without the Resend settings it stores nothing.
const subscribeMiddleware = async (req, res) => {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  const response = await subscribePost({
    request: new Request('http://localhost/api/subscribe', { method: 'POST', body: Buffer.concat(chunks) }),
    env: {},
  })
  res.statusCode = response.status
  response.headers.forEach((value, key) => res.setHeader(key, value))
  res.end(await response.text())
}

const pagesFunctions = {
  name: 'pages-functions',
  configureServer(server) {
    server.middlewares.use('/api/youtube', youtubeMiddleware)
    server.middlewares.use('/api/subscribe', subscribeMiddleware)
  },
  configurePreviewServer(server) {
    server.middlewares.use('/api/youtube', youtubeMiddleware)
    server.middlewares.use('/api/subscribe', subscribeMiddleware)
  },
}

// transformers.js loads ONNX Runtime's WASM from the jsDelivr CDN at runtime,
// so the 27 MB copy Vite would bundle is never used (and is over Cloudflare
// Pages' 25 MB per-file limit).
const dropBundledOrtWasm = {
  name: 'drop-bundled-ort-wasm',
  apply: 'build',
  generateBundle(_, bundle) {
    for (const name of Object.keys(bundle)) {
      if (/ort-wasm[^/]*\.wasm$/.test(name)) delete bundle[name]
    }
  },
}

export default defineConfig({
  plugins: [react(), pagesFunctions, dropBundledOrtWasm],
  resolve: {
    alias: {
      '@local': fileURLToPath(new URL('./local/src', import.meta.url)),
    },
  },
  optimizeDeps: {
    exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util']
  },
  worker: {
    format: 'es',
    plugins: () => [dropBundledOrtWasm],
  },
  server: {
    headers: isolationHeaders,
  },
  preview: {
    headers: isolationHeaders,
  },
  build: {
    target: 'es2022',
    minify: 'terser',
    sourcemap: false,
  }
})
