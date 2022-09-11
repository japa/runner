import inclusion from 'inclusion'
import { pathToFileURL } from 'url'
import { ReporterContract, Refiner, NamedReporterContract } from '@japa/core'
import { Config, NormalizedConfig } from '../Contracts'

/**
 * Wrap the value inside an array if it's not one
 */
function toArray<T>(value: T | T[]): T[] {
  return Array.isArray(value) ? value : [value]
}

/**
 * Convert a ReporterContract object to a NamedReporterContract object
 */
function buildReporterConfig(reporters: ReporterContract[]): NamedReporterContract[] {
  return reporters.map((reporter) => {
    /**
     * If the reporter wasn't named, then we generate a random name
     */
    const reporterName = reporter.name || Math.random().toString(36).substring(5)

    if (typeof reporter === 'function') {
      return { handler: reporter, name: reporterName }
    }

    return reporter
  })
}

/**
 * Build the normalized `reporters` configuration
 */
function buildReportersConfig(
  options: Config & { cliReporters?: string[] }
): NormalizedConfig['reporters'] {
  /**
   * Handle the new runner.reporters API
   */
  if (options.reporters && 'list' in options.reporters) {
    let defaultsReporters = options.cliReporters || options.reporters.defaults || []

    return {
      defaults: toArray(defaultsReporters),
      list: buildReporterConfig(options.reporters.list),
    }
  }

  /**
   * Now, handle the old runner.reporters API
   *
   * We enable all reporters by default
   */
  const listReporters = buildReporterConfig(options.reporters || [])
  const defaultsReporters = listReporters.map((reporter) => reporter.name)

  return {
    defaults: defaultsReporters,
    list: listReporters,
  }
}

/**
 * Build the config object from the user defined config
 */
export function resolveConfig<R extends ReporterContract[]>(
  options: Config<R> & { cliReporters?: string[] }
): NormalizedConfig {
  const defaultOptions: Required<Config> & { cliReporters?: string[] } = {
    cwd: process.cwd(),
    files: [],
    suites: [],
    plugins: [],
    reporters: [],
    timeout: 2000,
    filters: {},
    setup: [],
    teardown: [],
    importer: (filePath) => inclusion(pathToFileURL(filePath).href),
    refiner: new Refiner({}),
    forceExit: false,
    configureSuite: () => {},
  }

  const mergedOptions = Object.assign(defaultOptions, options)

  return {
    ...mergedOptions,
    reporters: buildReportersConfig(mergedOptions),
  }
}
