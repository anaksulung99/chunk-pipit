/**
 * Production build pipeline for the packaged desktop app.
 *
 *   node scripts/build-production.mjs            # full build + electron-builder
 *   node scripts/build-production.mjs --no-pack  # build only, skip packaging
 *
 * Steps:
 *   1. `node ace build`  → build/ (AdonisJS backend + Inertia assets + dist-electron main/preload)
 *   2. install production node_modules inside build/ (the sidecar runs from there)
 *   3. electron-builder  → release/<version>/  (bundles build/ as resources/app)
 */
import { execSync } from 'node:child_process'
import fs from 'node:fs'

const skipPack = process.argv.includes('--no-pack')

function run(cmd, opts = {}) {
  console.log(`\n$ ${cmd}`)
  execSync(cmd, { stdio: 'inherit', ...opts })
}

console.log('=== [1/3] Building AdonisJS app (backend + assets + electron) ===')
run('node ace build')

console.log('\n=== [2/3] Installing production dependencies in build/ ===')
if (!fs.existsSync('build/package.json')) {
  throw new Error('build/package.json missing — did `node ace build` succeed?')
}
// Use npm against the build manifest; the sidecar needs prod deps available.
run('npm install --omit=dev --no-audit --no-fund', { cwd: 'build' })

if (!fs.existsSync('resources/app.env')) {
  console.warn('\n[warn] resources/app.env is missing — copying from .env')
  fs.copyFileSync('.env', 'resources/app.env')
}

if (skipPack) {
  console.log('\nBuild complete (packaging skipped).')
  process.exit(0)
}

console.log('\n=== [3/3] Packaging with electron-builder ===')
run('npx electron-builder')

console.log('\nDone → release/')
