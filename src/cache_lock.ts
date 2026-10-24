/*
 * @japa/runner
 *
 * (c) Japa
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { mkdir, open, readFile, rm, stat } from 'node:fs/promises'
import { dirname } from 'node:path'
import debug from './debug.js'

const RETRY_MS = 25
const STALE_MS = 30_000
const TIMEOUT_MS = 5_000

/** Exclusive lock for a cache read-modify-write sequence. */
export async function withCacheLock<T>(
  file: string,
  callback: () => Promise<T>,
  options: { timeoutMs?: number; staleMs?: number } = {}
): Promise<T> {
  const lock = `${file}.lock`
  const timeoutMs = options.timeoutMs ?? TIMEOUT_MS
  const staleMs = options.staleMs ?? STALE_MS
  const started = Date.now()

  await mkdir(dirname(lock), { recursive: true })
  while (true) {
    try {
      const handle = await open(lock, 'wx')
      try {
        return await callback()
      } finally {
        await handle.close()
        await rm(lock, { force: true }).catch(() => {})
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error

      // A crashed process can leave the lock behind; age it out.
      const info = await stat(lock).catch(() => null)
      if (info && Date.now() - info.mtimeMs > staleMs) {
        debug('removing stale cache lock %s', lock)
        await rm(lock, { force: true }).catch(() => {})
        continue
      }
      if (Date.now() - started > timeoutMs) {
        throw new Error(`Timed out waiting for cache lock ${lock}`)
      }
      // Must not be unref'd: the lock waiter has no other handle to keep the loop alive.
      await new Promise((done) => setTimeout(done, RETRY_MS))
    }
  }
}

function isAlive(pid: number) {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM'
  }
}

/**
 * Exclusive lock held for a whole run, which can last minutes, so staleness is
 * decided by whether the owning process still exists rather than by age.
 */
export async function withRunLock<T>(
  lock: string,
  callback: () => Promise<T>,
  onWait: (owner: number) => void,
  signal?: AbortSignal
): Promise<T> {
  await mkdir(dirname(lock), { recursive: true })
  let announced = false
  while (true) {
    signal?.throwIfAborted()
    try {
      const handle = await open(lock, 'wx')
      await handle.writeFile(String(process.pid))
      try {
        return await callback()
      } finally {
        await handle.close()
        await rm(lock, { force: true }).catch(() => {})
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
      const owner = Number(await readFile(lock, 'utf8').catch(() => ''))
      // An empty file is a lock being written right now, unless it has stayed empty:
      // the owner died between creating the file and writing its pid.
      const written = Number.isInteger(owner) && owner > 0
      const abandoned = !written && (await isOlderThan(lock, OWNERLESS_MS))
      if ((written && !isAlive(owner)) || abandoned) {
        debug('removing run lock %s left by exited process %s', lock, written ? owner : '?')
        await rm(lock, { force: true }).catch(() => {})
        continue
      }
      if (!announced && owner > 0) {
        announced = true
        onWait(owner)
      }
      await abortableDelay(250, signal)
    }
  }
}

/** A lock file with no pid after this long was left by a process that died writing it. */
const OWNERLESS_MS = 5_000

async function isOlderThan(file: string, ms: number) {
  const info = await stat(file).catch(() => null)
  return info !== null && Date.now() - info.mtimeMs > ms
}

function abortableDelay(ms: number, signal?: AbortSignal) {
  return new Promise<void>((done, fail) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      done()
    }, ms)
    const onAbort = () => {
      clearTimeout(timer)
      fail(signal!.reason)
    }
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}
