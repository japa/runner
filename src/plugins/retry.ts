/*
 * @japa/runner
 *
 * (c) Japa
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { readFile } from 'node:fs/promises'
import { colors } from '../helpers.js'
import { setSelectionPlan } from '../planning_state.js'
import type { PluginFn } from '../types.js'
import { relative } from 'node:path'
import {
  failedTestsFile,
  getFailedTests,
  cacheFailedTests,
  type FailedTest,
} from './retry_cache.js'
export { getFailedTests, cacheFailedTests, clearCache } from './retry_cache.js'

/**
 * Exposes the API to run failing tests using the "failed" CLI flag.
 */
const relativePath = (cwd: string, file: string) => relative(cwd, file).split('\\').join('/')

export const retryPlugin: PluginFn = async function retry({ config, cliArgs, emitter }) {
  const managed = Boolean(process.env.JAPA_SPEED_SNAPSHOT || process.env.JAPA_SPEED_RUN_ID)
  if (!managed && !failedTestsFile(config.cwd)) {
    return
  }

  if (!managed) {
    const failures: FailedTest[] = []
    emitter.on('test:end', (payload) => {
      const file = payload.meta.fileName
      if (!payload.hasError || typeof file !== 'string') return
      failures.push({ file: relativePath(config.cwd, file), title: payload.title.expanded })
    })
    config.teardown.push(async (runner) => {
      const summary = runner.getSummary()
      await cacheFailedTests(summary.failedTestsTitles, config.cwd, failures)
    })
  }

  if (cliArgs.failed) {
    try {
      let tests: string[] | undefined
      let failures: FailedTest[] | undefined
      if (managed) {
        const snapshot: unknown = JSON.parse(
          await readFile(process.env.JAPA_SPEED_SNAPSHOT!, 'utf8')
        )
        if (
          !snapshot ||
          typeof snapshot !== 'object' ||
          !('failedTests' in snapshot) ||
          !Array.isArray(snapshot.failedTests) ||
          !snapshot.failedTests.every((title) => typeof title === 'string')
        ) {
          throw new Error('Invalid parallel failed-test snapshot')
        }
        tests = snapshot.failedTests
        // The coordinator writes the cache only after every worker finished.
        const cached = await getFailedTests(config.cwd).catch(() => ({ failures: undefined }))
        failures = cached.failures
      } else {
        const cached = await getFailedTests(config.cwd)
        tests = cached.tests
        failures = cached.failures
      }
      /**
       * With a committed baseline, `--failed-new` skips failures that are already
       * expected. The retry filter is by title, so a title is skipped only when every
       * failure recorded under it is a known failure of the same file. A cache without
       * those records (an older runner wrote it) skips nothing.
       */
      let filteredByBaseline = false
      if (cliArgs.failedNew && tests?.length && failures) {
        const { readBaseline, baselineFile } = await import('../failure_baseline.js')
        const baseline = await readBaseline(baselineFile(config.cwd))
        const known = new Set(baseline.failures.map((entry) => `${entry.file}\0${entry.title}`))
        const expected = (title: string) => {
          const sources = failures!.filter((failure) => failure.title === title)
          return (
            sources.length > 0 &&
            sources.every((failure) => known.has(`${failure.file}\0${failure.title}`))
          )
        }
        filteredByBaseline = tests.some(expected)
        tests = tests.filter((title) => !expected(title))
      }
      if (!tests || !tests.length) {
        if (filteredByBaseline) {
          setSelectionPlan(config, { only: Object.freeze([]) })
          return
        }
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
