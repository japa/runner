/*
 * @japa/runner
 *
 * (c) Japa
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { type NormalizedConfig } from './types.js'

/**
 * Validator encapsulates the validations to perform before running
 * the tests
 */
class Validator {
  /**
   * Ensures the japa is configured. Otherwise raises an exception
   */
  ensureIsConfigured(config: NormalizedConfig | undefined) {
    if (!config) {
      throw new Error(
        `Cannot run tests. Make sure to call "configure" method before the "run" method`
      )
    }
  }

  /**
   * Ensures the japa is in planning phase
   */
  ensureIsInPlanningPhase(phase: 'idle' | 'planning' | 'executing') {
    if (phase !== 'planning') {
      throw new Error(
        `Cannot import japa test file directly. It must be imported by calling the "japa.run" method`
      )
    }
  }

  /**
   * Ensures the suites filter uses a subset of the user configured suites.
   */
  validateSuitesFilter(config: NormalizedConfig) {
    /**
     * Do not perform any validation if no filters are applied
     * in the first place
     */
    if (!config.filters.suites || !config.filters.suites.length) {
      return
    }

    /**
     * Notify user they have applied the suites filter but forgot to define
     * suites
     */
    if (!('suites' in config) || !config.suites.length) {
      throw new Error(`Cannot apply suites filter. You have not configured any test suites`)
    }

    const suites = config.suites.map(({ name }) => name)

    /**
     * Find unknown suites and report the error
     */
    const unknownSuites = config.filters.suites.filter((suite) => !suites.includes(suite))
    if (unknownSuites.length) {
      throw new Error(`Cannot apply suites filter. "${unknownSuites[0]}" suite is not configured`)
    }
  }

  /**
   * Ensures the shard filter has positive integer values and the
   * current shard is within the total number of shards
   */
  validateShardFilter(config: NormalizedConfig) {
    const shard = config.filters.shard
    if (!shard) {
      return
    }

    const isValid =
      Number.isInteger(shard.current) &&
      Number.isInteger(shard.total) &&
      shard.current >= 1 &&
      shard.current <= shard.total

    if (!isValid) {
      throw new Error(
        `Invalid shard. Expected "current/total" where both are positive integers and current is not greater than total. For example: --shard=1/4`
      )
    }
  }

  /**
   * Ensure there are unique suites
   */
  validateSuitesForUniqueness(config: NormalizedConfig) {
    if (!('suites' in config)) {
      return
    }

    const suites: Set<string> = new Set()
    config.suites.forEach(({ name }) => {
      if (suites.has(name)) {
        throw new Error(`Duplicate suite "${name}"`)
      }
      suites.add(name)
    })

    suites.clear()
  }

  /**
   * Ensure the activated reporters are in the list of defined
   * reporters
   */
  validateActivatedReporters(config: NormalizedConfig) {
    const reportersList = config.reporters.list.map(({ name }) => name)
    const unknownReporters = config.reporters.activated.filter(
      (name) => !reportersList.includes(name)
    )

    if (unknownReporters.length) {
      throw new Error(
        `Invalid reporter "${unknownReporters[0]}". Make sure to register it first inside the "reporters.list" array`
      )
    }
  }
}

export default new Validator()
