/*
 * @japa/runner
 *
 * (c) Japa
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

export { disallowPinnedTests } from './disallow_pinned_tests.js'

/** Automatically load and learn duration estimates when opted in. */
export const durationHistory: typeof import('../duration_history.js').durationHistory =
  (options) => async (context) => {
    const { durationHistory: createPlugin } = await import('../duration_history.js')
    await createPlugin(options)(context)
  }
