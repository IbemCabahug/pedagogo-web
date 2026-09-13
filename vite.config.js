import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

// F5 (10-persona audit): after the normal build, rewrite dist/sw.js's
// placeholders with the real build facts — the per-deploy cache stamp and the
// full emitted-file manifest — so one service-worker install seeds the entire
// offline Desk. Zero deps, runs at build time only, fails the build loudly if
// the placeholder contract is broken.
function injectPrecacheManifest() {
  return {
    name: 'pedagogo-precache-inject',
    apply: 'build',
    closeBundle() {
      const distDir = path.join(rootDir, 'dist');
      const swPath = path.join(distDir, 'sw.js');
      if (!fs.existsSync(swPath)) {
        console.warn('[precache] dist/sw.js not found — injection skipped');
        return;
      }
      const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
        const full = path.join(dir, e.name);
        return e.isDirectory() ? walk(full) : [full];
      });
      const files = walk(distDir)
        .map((p) => './' + path.relative(distDir, p).split(path.sep).join('/'))
        .filter((f) => f !== './sw.js') // never precache the SW itself
        .sort();
      let sw = fs.readFileSync(swPath, 'utf8');
      if (!sw.includes('self.__PRECACHE_MANIFEST') || !sw.includes('self.__PRECACHE_BUILD')) {
        throw new Error('[precache] placeholder missing from public/sw.js — injection aborted');
      }
      sw = sw.replace('self.__PRECACHE_BUILD = \'\';', `self.__PRECACHE_BUILD = '${new Date().toISOString()}';`);
      sw = sw.replace('self.__PRECACHE_MANIFEST = [];', `self.__PRECACHE_MANIFEST = ${JSON.stringify(files)};`);
      fs.writeFileSync(swPath, sw);
      console.log(`[precache] injected build stamp + ${files.length} files into dist/sw.js`);
    }
  };
}

export default defineConfig({
  // Portable relative assets: required for GitHub Pages subpath deploys and
  // correct on any root-domain host (audit deploy-safety pass).
  base: './',
  server: {
    port: 3000
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-pdf': ['pdfjs-dist'],
          'vendor-docs': ['mammoth', 'jszip'],
          'vendor-p2p': ['peerjs', 'qrcode']
        }
      }
    }
  },
  plugins: [injectPrecacheManifest()]
});
