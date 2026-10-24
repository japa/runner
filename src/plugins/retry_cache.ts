/*
 * @japa/runner
 *
 * (c) Japa
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { join, dirname } from 'node:path'
import { randomUUID } from 'node:crypto'
import findCacheDirectory from 'find-cache-directory'
import { mkdir, readFile, rename, rm, unlink, writeFile } from 'node:fs/promises'

export function failedTestsFile(cwd = process.cwd()) {
  const directory = findCacheDirectory({ name: '@japa/runner', cwd })
  return directory ? join(directory, 'summary.json') : undefined
}

/** Where a failed title came from, so two tests sharing a title stay apart. */
export type FailedTest = { file: string; title: string }

const isFailedTests = (value: unknown): value is FailedTest[] =>
  Array.isArray(value) &&
  value.every(
    (item) =>
      item &&
      typeof item === 'object' &&
      typeof (item as FailedTest).file === 'string' &&
      typeof (item as FailedTest).title === 'string'
  )

export async function getFailedTests(
  cwd = process.cwd()
): Promise<{ tests?: string[]; failures?: FailedTest[] }> {
  const file = failedTestsFile(cwd)
  if (!file) return {}
  try {
    const value: unknown = JSON.parse(await readFile(file, 'utf8'))
    if (!value || typeof value !== 'object') throw new Error('Invalid failed tests cache')
    if (!('tests' in value)) return {}
    if (!Array.isArray(value.tests) || !value.tests.every((title) => typeof title === 'string')) {
      throw new Error('Invalid failed tests cache')
    }
    const failures =
      'failures' in value && isFailedTests(value.failures) ? value.failures : undefined
    return { tests: value.tests, ...(failures ? { failures } : {}) }
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') return {}
    throw new Error('Unable to read failed tests cache file', { cause: error })
  }
}

export async function cacheFailedTests(
  tests: string[],
  cwd = process.cwd(),
  failures?: FailedTest[]
) {
  const file = failedTestsFile(cwd)
  if (!file) return
  await mkdir(dirname(file), { recursive: true })
  const temporary = `${file}.${randomUUID()}.tmp`
  try {
    await writeFile(
      temporary,
      JSON.stringify({ tests, ...(failures?.length ? { failures } : {}) }),
      {
        flag: 'wx',
      }
    )
    await rename(temporary, file)
  } finally {
    await rm(temporary, { force: true }).catch(() => {})
  }
}

export async function clearCache(cwd = process.cwd()) {
  const file = failedTestsFile(cwd)
  if (file) await unlink(file)
}
