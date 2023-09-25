/*
 * @japa/runner
 *
 * (c) Japa
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { ReporterContract } from '../src/types.js'
import { RunnerFactory } from './runner.js'

/**
 * Create an instance of the runner factory
 */
export const runner = () => new RunnerFactory()
export { createDiverseTests } from './create_diverse_tests.js'
export const syncReporter: ReporterContract = {
  name: 'sync',
  handler(r, emitter) {
    emitter.on('runner:end', function () {
      const summary = r.getSummary()
      if (summary.hasError) {
        throw summary.failureTree[0].children[0].errors[0].error
      }
    })
  },
}
