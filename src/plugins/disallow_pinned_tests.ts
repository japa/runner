/*
 * @japa/runner
 *
 * (c) Japa
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import string from '@poppinss/string'
import type { PluginFn } from '../types.js'
import type { Test } from '../../modules/core/main.js'

/**
 * Disallows pinned tests by throwing an error before the runner
 * starts executing the tests.
 */
export function disallowPinnedTests(options?: {
  disallow?: boolean
  errorMessage?: string
}): PluginFn {
  const disallow = options?.disallow ?? true
  const errorMessage =
    options?.errorMessage ??
    'Pinning test is disallowed by the "disallowPinnedTests" plugin. Use --list-pinned flag to list pinned tests'

  const pluginFn: PluginFn = async function disallowPinnedTestsPluginFn({ runner, emitter }) {
    /**
     * Return early when disallow flag is not enabled
     */
    if (!disallow) {
      return
    }

    function disallowPinned(test: Test) {
      if (test.isPinned) {
        test.options.meta.abort(string.interpolate(errorMessage, { test: test.title }))
      }
    }

    /**
     * Wait for the runner to start and then loop over all the tests
     * and fail if there are one or more pinned tests
     */
    emitter.on('runner:start', () => {
      runner.onSuite((suite) => {
        suite.onGroup((group) => {
          group.tap(disallowPinned)
        })
        suite.onTest(disallowPinned)
      })
    })
  }

  return pluginFn
}
