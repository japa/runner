/*
 * @japa/runner
 *
 * (c) Japa
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { SpecReporter } from './spec.js'
import type { BaseReporterOptions, NamedReporterContract } from '../types.js'

/**
 * Reference to the spec reporter
 */
export const spec: (options?: BaseReporterOptions) => NamedReporterContract = (options) => {
  return {
    name: 'spec',
    handler: (...args) => new SpecReporter(options).boot(...args),
  }
}
