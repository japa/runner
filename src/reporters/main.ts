/*
 * @japa/runner
 *
 * (c) Japa
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { SpecReporter } from './spec.js'
import { DotReporter } from './dot.js'
import type { BaseReporterOptions, NamedReporterContract } from '../types.js'

/**
 * Create an instance of the spec reporter
 */
export const spec: (options?: BaseReporterOptions) => NamedReporterContract = (options) => {
  return {
    name: 'spec',
    handler: (...args) => new SpecReporter(options).boot(...args),
  }
}

/**
 * Create an instance of the dot reporter
 */
export const dot: (options?: BaseReporterOptions) => NamedReporterContract = (options) => {
  return {
    name: 'dot',
    handler: (...args) => new DotReporter(options).boot(...args),
  }
}
