/*
 * @japa/runner
 *
 * (c) Japa
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { createHash } from 'node:crypto'
import { join, resolve } from 'node:path'

const cacheKey = (cwd: string) => createHash('sha256').update(cwd).digest('hex').slice(0, 16)

export function defaultCacheDir(cwd: string) {
  return resolve(cwd, 'node_modules', '.cache', 'japa')
}

export function indexFileName(cwd: string) {
  return `index-${cacheKey(cwd)}.json`
}

export function dependencyFileName(cwd: string) {
  return `dependencies-${cacheKey(cwd)}.json`
}

/** Resolve a cache directory, with an explicit directory taking precedence. */
export function cacheDir(cwd: string, dir?: string) {
  // CLI flags default to an empty string, which must not resolve to the cwd.
  return dir ? resolve(cwd, dir) : defaultCacheDir(cwd)
}

export function indexFile(cwd: string, dir?: string) {
  return join(cacheDir(cwd, dir), indexFileName(cwd))
}

export function dependencyFile(cwd: string, dir?: string) {
  return join(cacheDir(cwd, dir), dependencyFileName(cwd))
}
