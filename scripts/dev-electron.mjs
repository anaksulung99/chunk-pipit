/**
 * Dev orchestrator for the Electron shell.
 *
 * 1. Starts the AdonisJS server (`ace serve --hmr`) — serves the Inertia app on :3333.
 * 2. Starts the queue worker (`ace queue:work`) for campaign jobs.
 * 3. Waits until the HTTP server responds.
 * 4. Transpiles Electron main/preload scripts to `dist-electron/`.
 * 5. Launches Electron against the generated main entry.
 *
 * This launcher keeps Electron dev startup independent from the web bundler,
 * which avoids Windows-specific startup issues in this project.
 */
import { spawn } from 'node:child_process'
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import ts from 'typescript'

function loadDotEnv(filePath) {
  if (!fs.existsSync(filePath)) return {}

  const values = {}

  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx <= 0) continue

    const key = trimmed.slice(0, idx).trim()
    let value = trimmed.slice(idx + 1).trim()

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    values[key] = value
  }

  return values
}

function normalizeLoopbackUrl(value) {
  if (!value) return value

  try {
    const url = new URL(value)
    if (url.hostname === 'localhost') {
      url.hostname = '127.0.0.1'
    }
    return url.toString().replace(/\/$/, '')
  } catch {
    return value
  }
}

const projectRoot = process.cwd()
const envFile = path.join(projectRoot, '.env')
const dotEnv = loadDotEnv(envFile)
const resolvedPort = process.env.PORT || dotEnv.PORT || '3333'
const resolvedHost =
  normalizeLoopbackUrl(`http://${process.env.HOST || dotEnv.HOST || '127.0.0.1'}`)?.replace(
    /^https?:\/\//,
    ''
  ) || '127.0.0.1'
const APP_URL =
  normalizeLoopbackUrl(process.env.APP_URL) || `http://${resolvedHost}:${resolvedPort}`
const sharedDevEnv = {
  ...process.env,
  HOST: resolvedHost,
  PORT: resolvedPort,
  APP_URL,
  APP_SERVER_URL: normalizeLoopbackUrl(process.env.APP_SERVER_URL) || APP_URL,
}
const require = createRequire(import.meta.url)
const electronBinary = require('electron')
const distDir = path.join(projectRoot, 'dist-electron')
const mainEntry = path.join(projectRoot, 'electron', 'main.ts')
const preloadEntry = path.join(projectRoot, 'electron', 'preload.ts')
const mainOutput = path.join(distDir, 'main.js')
const preloadOutput = path.join(distDir, 'preload.cjs')
const children = new Set()
const watchers = []
let electronChild = null
let workerChild = null
let electronRestartTimer = null
let workerRestartTimer = null
let watchersStarted = false
let shuttingDown = false

function timestamp() {
  return new Date().toLocaleTimeString('en-GB', { hour12: false })
}

function log(scope, message) {
  console.log(`[${timestamp()}] [${scope}] ${message}`)
}

function logError(scope, message) {
  console.error(`[${timestamp()}] [${scope}] ${message}`)
}

function trackChild(child) {
  children.add(child)
  child.once('exit', () => {
    children.delete(child)
  })
  return child
}

function pipeOutput(stream, scope, writer) {
  if (!stream) return

  let buffer = ''
  stream.on('data', (chunk) => {
    buffer += chunk.toString()
    const lines = buffer.split(/\r?\n/)
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      writer(`[${timestamp()}] [${scope}] ${line}`)
    }
  })
  stream.on('end', () => {
    if (buffer) writer(`[${timestamp()}] [${scope}] ${buffer}`)
  })
}

function run(cmd, args, scope, env = process.env, options = {}) {
  const { shutdownOnExit = true } = options
  const child = trackChild(
    spawn(cmd, args, {
      stdio: ['inherit', 'pipe', 'pipe'],
      env,
    })
  )

  pipeOutput(child.stdout, scope, console.log)
  pipeOutput(child.stderr, scope, console.error)

  const handleExit = (code) => {
    if (shuttingDown) return
    if (!shutdownOnExit) {
      log(scope, `Exited with code ${code ?? 0}`)
      return
    }

    shutdown()
    process.exit(code ?? 0)
  }

  child.__traeExitHandler = handleExit
  child.on('exit', handleExit)
  return child
}

function stopManagedChild(child) {
  if (!child) return

  try {
    if (child.__traeExitHandler) {
      child.removeListener('exit', child.__traeExitHandler)
    }
    child.kill()
  } catch {
    // ignore
  }
}

function shutdown() {
  shuttingDown = true

  if (electronRestartTimer) {
    clearTimeout(electronRestartTimer)
    electronRestartTimer = null
  }

  if (workerRestartTimer) {
    clearTimeout(workerRestartTimer)
    workerRestartTimer = null
  }

  for (const child of children) {
    try {
      child.kill()
    } catch {
      // ignore
    }
  }

  for (const watcher of watchers) {
    try {
      watcher.close()
    } catch {
      // ignore
    }
  }
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true })
}

function writeTranspiledFile(sourcePath, outputPath, moduleKind) {
  const source = fs.readFileSync(sourcePath, 'utf8')
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: moduleKind,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
      sourceMap: true,
      inlineSources: true,
      isolatedModules: true,
      esModuleInterop: true,
    },
    fileName: sourcePath,
  })

  fs.writeFileSync(outputPath, transpiled.outputText, 'utf8')

  if (transpiled.sourceMapText) {
    fs.writeFileSync(`${outputPath}.map`, transpiled.sourceMapText, 'utf8')
  }
}

function buildElectronSources() {
  ensureDir(distDir)
  writeTranspiledFile(mainEntry, mainOutput, ts.ModuleKind.ESNext)
  writeTranspiledFile(preloadEntry, preloadOutput, ts.ModuleKind.CommonJS)
  log('build', `Electron sources transpiled -> ${path.basename(mainOutput)}, ${path.basename(preloadOutput)}`)
}

function stopElectron() {
  if (!electronChild) return

  stopManagedChild(electronChild)
  electronChild = null
}

function launchElectron() {
  stopElectron()

  electronChild = trackChild(
    spawn(electronBinary, [mainOutput], {
      cwd: projectRoot,
      stdio: ['inherit', 'pipe', 'pipe'],
      env: {
        ...sharedDevEnv,
      },
    })
  )

  pipeOutput(electronChild.stdout, 'electron', console.log)
  pipeOutput(electronChild.stderr, 'electron', console.error)

  electronChild.on('exit', (code) => {
    electronChild = null
    if (shuttingDown) return
    log('electron', `Exited with code ${code ?? 0}; dev watcher stays active`)
  })

  log('electron', `Launched with entry ${path.relative(projectRoot, mainOutput)}`)
}

function restartElectron() {
  try {
    log('watch', 'Rebuilding Electron after source change...')
    buildElectronSources()
    launchElectron()
  } catch (error) {
    logError('watch', `Failed to rebuild Electron sources: ${error.message}`)
  }
}

function startWorker() {
  workerChild = run(process.execPath, ['ace', 'queue:work'], 'worker', sharedDevEnv, {
    shutdownOnExit: true,
  })
}

function restartWorker(reason) {
  log('watch', `Restarting queue worker after ${reason}`)

  if (workerChild) {
    stopManagedChild(workerChild)
    workerChild = null
  }

  startWorker()
}

function registerRecursiveWatcher(target, onChange) {
  const watcher = fs.watch(target, { recursive: true }, (_eventType, fileName) => {
    if (!fileName || !fileName.endsWith('.ts')) return
    onChange(fileName.replace(/\\/g, '/'))
  })

  watchers.push(watcher)
}

function watchElectronSources() {
  if (watchersStarted) return
  watchersStarted = true

  registerRecursiveWatcher(path.join(projectRoot, 'electron'), (fileName) => {
    if (electronRestartTimer) clearTimeout(electronRestartTimer)
    electronRestartTimer = setTimeout(() => {
      log('watch', `Detected Electron source change: ${fileName}`)
      restartElectron()
    }, 150)
  })

  registerRecursiveWatcher(path.join(projectRoot, 'app', 'services', 'automation'), (fileName) => {
    if (workerRestartTimer) clearTimeout(workerRestartTimer)
    workerRestartTimer = setTimeout(() => {
      restartWorker(`automation/${fileName}`)
    }, 250)
  })

  registerRecursiveWatcher(path.join(projectRoot, 'app', 'services', 'queue'), (fileName) => {
    if (workerRestartTimer) clearTimeout(workerRestartTimer)
    workerRestartTimer = setTimeout(() => {
      restartWorker(`queue/${fileName}`)
    }, 250)
  })

  registerRecursiveWatcher(path.join(projectRoot, 'commands'), (fileName) => {
    if (fileName !== 'queue_work.ts') return

    if (workerRestartTimer) clearTimeout(workerRestartTimer)
    workerRestartTimer = setTimeout(() => {
      restartWorker(`commands/${fileName}`)
    }, 250)
  })
}

process.on('SIGINT', () => {
  shutdown()
  process.exit(0)
})
process.on('SIGTERM', () => {
  shutdown()
  process.exit(0)
})

function waitForServer(url, timeoutMs = 60000) {
  const start = Date.now()
  return new Promise((resolve, reject) => {
    const tick = () => {
      const req = http.get(url, (res) => {
        res.destroy()
        if ((res.statusCode ?? 0) >= 200 && (res.statusCode ?? 0) < 500) {
          resolve()
          return
        }

        if (Date.now() - start > timeoutMs) {
          reject(new Error(`Timed out waiting for healthy response from ${url}`))
          return
        }

        setTimeout(tick, 500)
      })
      req.on('error', () => {
        if (Date.now() - start > timeoutMs) {
          reject(new Error(`Timed out waiting for ${url}`))
        }
        else setTimeout(tick, 500)
      })
    }
    tick()
  })
}

log('dev', 'Step 1/5: starting AdonisJS server (ace serve --hmr)')
run(process.execPath, ['ace', 'serve', '--hmr'], 'adonis', sharedDevEnv)
log('dev', 'Step 2/5: starting queue worker (ace queue:work)')
startWorker()

try {
  log('dev', `Step 3/5: waiting for ${APP_URL}`)
  await waitForServer(APP_URL)
  log('dev', `Step 4/5: AdonisJS ready at ${APP_URL}`)
  buildElectronSources()
  log('dev', 'Step 5/5: launching Electron shell')
  launchElectron()
  watchElectronSources()
  log(
    'dev',
    'Watching `electron/**/*.ts` and automation worker sources for changes; queue worker auto-restarts when needed'
  )
} catch (err) {
  logError('dev', err.message)
  shutdown()
  process.exit(1)
}
