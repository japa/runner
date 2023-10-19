/*
 * @japa/runner
 *
 * (c) Japa
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { join } from 'node:path'
import findCacheDirectory from 'find-cache-dir'
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises'

import { colors } from '../helpers.js'
import type { PluginFn } from '../types.js'

/**
 * Paths to the cache directory and the summary file
 */
const CACHE_DIR = findCacheDirectory({ name: '@japa/runner' })
const SUMMARY_FILE = CACHE_DIR ? join(CACHE_DIR, 'summary.json') : undefined

/**
 * Returns an object with the title of the tests failed during
 * the last run.
 */
export async function getFailedTests(): Promise<{ tests?: string[] }> {
  try {
    const summary = await readFile(SUMMARY_FILE!, 'utf-8')
    return JSON.parse(summary)
  } catch (error) {
    if (error.code === 'ENOENT') {
      return {}
    }
    throw new Error('Unable to read failed tests cache file', { cause: error })
  }
}

/**
 * Writes failing tests to the cache directory
 */
export async function cacheFailedTests(tests: string[]) {
  await mkdir(CACHE_DIR!, { recursive: true })
  await writeFile(SUMMARY_FILE!, JSON.stringify({ tests: tests }))
}

/**
 * Clears the cache dir
 */
export async function clearCache() {
  await unlink(SUMMARY_FILE!)
}

/**
 * Exposes the API to run failing tests using the "failed" CLI flag.
 */
export const retryPlugin: PluginFn = async function retry({ config, cliArgs }) {
  if (!SUMMARY_FILE) {
    return
  }

  config.teardown.push(async (runner) => {
    const summary = runner.getSummary()
    await cacheFailedTests(summary.failedTestsTitles)
  })

  if (cliArgs.failed) {
    try {
      const { tests } = await getFailedTests()
      if (!tests || !tests.length) {
        console.log(colors.bgYellow().black(' No failing tests found. Running all the tests '))
        return
      }
      config.filters.tests = tests
    } catch (error) {
      console.log(colors.bgRed().black(' Unable to read failed tests. Running all the tests '))
      console.log(colors.red(error))
    }
  }
}
