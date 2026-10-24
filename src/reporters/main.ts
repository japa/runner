/*
 * @japa/runner
 *
 * (c) Japa
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import type { BaseReporterOptions, NamedReporterContract } from '../types.js'
import type { AgentReporterOptions } from './agent.js'
export type { AgentReporterOptions } from './agent.js'

/**
 * Create an instance of the spec reporter
 */
export const spec: (options?: BaseReporterOptions) => NamedReporterContract = (options) => {
  return {
    name: 'spec',
    handler: async (...args) => {
      const { SpecReporter } = await import('./spec.js')
      new SpecReporter(options).boot(...args)
    },
  }
}

/**
 * Create an instance of the dot reporter
 */
export const dot: (options?: BaseReporterOptions) => NamedReporterContract = (options) => {
  return {
    name: 'dot',
    handler: async (...args) => {
      const { DotReporter } = await import('./dot.js')
      new DotReporter(options).boot(...args)
    },
  }
}

/**
 * Create an instance of the ndjson reporter
 */
export const ndjson: (options?: BaseReporterOptions) => NamedReporterContract = (options) => {
  return {
    name: 'ndjson',
    handler: async (...args) => {
      const { NdJSONReporter } = await import('./ndjson.js')
      new NdJSONReporter(options).boot(...args)
    },
  }
}

/**
 * Create an instance of the agent reporter: one bounded JSON object per line,
 * no terminal formatting, for agents and harnesses.
 */
export const agent: (options?: AgentReporterOptions) => NamedReporterContract = (options) => {
  return {
    name: 'agent',
    handler: async (...args) => {
      const { AgentReporter } = await import('./agent.js')
      new AgentReporter(options).boot(...args)
    },
  }
}

/**
 * Create an instance of the github reporter
 */
export const github: (options?: BaseReporterOptions) => NamedReporterContract = (options) => {
  return {
    name: 'github',
    handler: async (...args) => {
      const { GithubReporter } = await import('./github.js')
      new GithubReporter(options).boot(...args)
    },
  }
}

/** Collect execution estimates without loading terminal reporters. */
export const fileDurations: typeof import('./file_durations.js').fileDurations = (options) => ({
  name: 'file-durations',
  handler: async (...args) => {
    const { fileDurations: createReporter } = await import('./file_durations.js')
    await createReporter(options).handler(...args)
  },
})
