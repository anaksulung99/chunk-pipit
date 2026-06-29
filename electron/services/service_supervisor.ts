import { spawn, type ChildProcess } from 'node:child_process'
import net from 'node:net'
import http from 'node:http'
import path from 'node:path'
import fs from 'node:fs'
import { findFreePort } from './port_manager.js'

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function platformDir(): 'win32' | 'darwin' | 'linux' {
  if (process.platform === 'win32') return 'win32'
  if (process.platform === 'darwin') return 'darwin'
  return 'linux'
}

/** Resolve a bundled resource, dev (APP_ROOT/resources) or packaged (resourcesPath). */
function findResource(rel: string): string | undefined {
  const candidates = [
    process.resourcesPath ? path.join(process.resourcesPath, rel) : undefined,
    path.join(process.env.APP_ROOT || process.cwd(), 'resources', rel),
  ].filter(Boolean) as string[]
  return candidates.find((c) => fs.existsSync(c))
}

/* -------------------------------------------------------------------------- */
/* Redis                                                                      */
/* -------------------------------------------------------------------------- */

function redisBinary(): string {
  const name = process.platform === 'win32' ? 'redis-server.exe' : 'redis-server'
  const bin = findResource(path.join('redis', platformDir(), name))
  if (!bin) throw new Error(`Redis binary not found (resources/redis/${platformDir()}/${name})`)
  return bin
}

function redisPing(port: number, timeoutMs = 1000): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect(port, '127.0.0.1')
    let done = false
    const finish = (ok: boolean) => {
      if (done) return
      done = true
      socket.destroy()
      resolve(ok)
    }
    socket.setTimeout(timeoutMs)
    socket.on('connect', () => socket.write('PING\r\n'))
    socket.on('data', (data) => finish(data.toString().includes('PONG')))
    socket.on('timeout', () => finish(false))
    socket.on('error', () => finish(false))
  })
}

function startRedis(port: number): ChildProcess {
  return spawn(
    redisBinary(),
    ['--port', String(port), '--save', '', '--appendonly', 'no', '--bind', '127.0.0.1'],
    { stdio: 'ignore', windowsHide: true }
  )
}

async function waitRedis(port: number, retries = 40): Promise<void> {
  for (let i = 0; i < retries; i++) {
    if (await redisPing(port)) return
    await sleep(300)
  }
  throw new Error('Redis did not become ready in time')
}

async function shutdownRedis(port: number, child: ChildProcess): Promise<void> {
  // Ask redis to shut down cleanly, then ensure the process is gone.
  await new Promise<void>((resolve) => {
    const socket = net.connect(port, '127.0.0.1')
    socket.on('connect', () => socket.write('SHUTDOWN NOSAVE\r\n'))
    socket.on('close', () => resolve())
    socket.on('error', () => resolve())
    socket.setTimeout(1500, () => {
      socket.destroy()
      resolve()
    })
  })
  await stopChild(child, 3000)
}

/* -------------------------------------------------------------------------- */
/* Node child processes (API server + worker)                                 */
/* -------------------------------------------------------------------------- */

/** Spawn a node script using the Electron binary in node mode (no separate node needed). */
function spawnNode(entry: string, args: string[], env: NodeJS.ProcessEnv): ChildProcess {
  return spawn(process.execPath, [entry, ...args], {
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', ...env },
    stdio: 'inherit',
    windowsHide: true,
  })
}

function apiEntry(): string {
  // Packaged: resources/app/bin/server.js (the bundled `node ace build` output).
  // Dev fallback: ./build/bin/server.js. Override with SIDECAR_API_ENTRY.
  return (
    process.env.SIDECAR_API_ENTRY ||
    findResource(path.join('app', 'bin', 'server.js')) ||
    findResource(path.join('sidecar', 'server.js')) ||
    path.join(process.env.APP_ROOT || process.cwd(), 'build', 'bin', 'server.js')
  )
}

function workerEntry(): string | undefined {
  // Ace commands run via ace.js: `node app/ace.js queue:work`.
  return (
    process.env.SIDECAR_WORKER_ENTRY ||
    findResource(path.join('app', 'ace.js')) ||
    (() => {
      const ace = path.join(process.env.APP_ROOT || process.cwd(), 'build', 'ace.js')
      return fs.existsSync(ace) ? ace : undefined
    })()
  )
}

function httpStatus(port: number, urlPath: string): Promise<number> {
  return new Promise((resolve) => {
    const req = http.get({ host: '127.0.0.1', port, path: urlPath }, (res) => {
      res.resume()
      resolve(res.statusCode ?? 0)
    })
    req.on('error', () => resolve(0))
    req.setTimeout(2000, () => {
      req.destroy()
      resolve(0)
    })
  })
}

async function waitHealth(port: number, retries = 60): Promise<void> {
  for (let i = 0; i < retries; i++) {
    if ((await httpStatus(port, '/health')) === 200) return
    await sleep(500)
  }
  throw new Error('AdonisJS API did not become healthy in time')
}

function stopChild(child: ChildProcess | undefined, graceMs: number): Promise<void> {
  return new Promise((resolve) => {
    if (!child || child.exitCode !== null) return resolve()
    let settled = false
    const done = () => {
      if (settled) return
      settled = true
      resolve()
    }
    child.once('exit', done)
    try {
      child.kill('SIGTERM')
    } catch {
      return done()
    }
    setTimeout(() => {
      try {
        child.kill('SIGKILL')
      } catch {
        // ignore
      }
      done()
    }, graceMs)
  })
}

/* -------------------------------------------------------------------------- */
/* Orchestration                                                              */
/* -------------------------------------------------------------------------- */

export type Services = { apiUrl: string; stop: () => Promise<void> }

/**
 * Production startup: allocate ports → start portable Redis → start the
 * AdonisJS API (child process, on the chosen port, pointed at the local
 * Redis) → start the queue worker. RabbitMQ stays on CloudAMQP (no local
 * process). Returns the API URL for the BrowserWindow plus a graceful stop().
 */
export async function startServices(): Promise<Services> {
  const apiPort = await findFreePort(3333)
  const redisPort = await findFreePort(6379)

  const redis = startRedis(redisPort)
  await waitRedis(redisPort)

  // Point the worker's Playwright at the bundled browsers (the worker is a
  // child process spawned before the renderer ever sets this).
  const browsersPath = findResource('browsers')

  const sharedEnv: NodeJS.ProcessEnv = {
    ...process.env,
    PORT: String(apiPort),
    HOST: '127.0.0.1',
    NODE_ENV: 'production',
    REDIS_HOST: '127.0.0.1',
    REDIS_PORT: String(redisPort),
    REDIS_PASSWORD: '', // portable Redis runs without auth
    LIMITER_STORE: 'redis',
    ...(browsersPath ? { PLAYWRIGHT_BROWSERS_PATH: browsersPath } : {}),
  }

  const api = spawnNode(apiEntry(), [], sharedEnv)
  await waitHealth(apiPort)

  const entry = workerEntry()
  const worker = entry
    ? spawnNode(entry, entry.endsWith('ace.js') ? ['queue:work'] : [], sharedEnv)
    : undefined

  const stop = async () => {
    await stopChild(worker, 5000)
    await stopChild(api, 8000)
    try {
      await shutdownRedis(redisPort, redis)
    } catch {
      await stopChild(redis, 3000)
    }
  }

  return { apiUrl: `http://127.0.0.1:${apiPort}`, stop }
}
