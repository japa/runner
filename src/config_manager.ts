/*
 * @japa/runner
 *
 * (c) Japa
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import debug from './debug.js'
import { Refiner } from '../modules/core/main.js'
import { dot, ndjson, spec } from './reporters/main.js'
import type { CLIArgs, Config, Filters, NormalizedBaseConfig, NormalizedConfig } from './types.js'

export const NOOP = () => {}

/**
 * Defaults to use for configuration
 */
const DEFAULTS = {
  files: [],
  timeout: 2000,
  retries: 0,
  forceExit: false,
  plugins: [],
  reporters: {
    activated: ['spec'],
    list: [spec(), ndjson(), dot()],
  },
  importer: (filePath) => import(filePath.href),
  configureSuite: () => {},
} satisfies Config

/**
 * Config manager is used to hydrate the configuration by merging
 * the defaults, user defined config and the command line
 * flags.
 *
 * The command line flags have the upmost priority
 */
export class ConfigManager {
  #config: Config
  #cliArgs: CLIArgs

  constructor(config: Config, cliArgs: CLIArgs) {
    this.#config = config
    this.#cliArgs = cliArgs
  }

  /**
   * Processes a CLI argument and converts it to an
   * array of strings
   */
  #processAsArray(value: string | string[], splitByComma: boolean): string[] {
    return Array.isArray(value)
      ? value
      : splitByComma
        ? value.split(',').map((item: string) => item.trim())
        : [value]
  }

  /**
   * Returns a copy of filters based upon the CLI
   * arguments.
   */
  #getCLIFilters(): Filters {
    const filters: Filters = {}

    if (this.#cliArgs.tags) {
      filters.tags = this.#processAsArray(this.#cliArgs.tags, true)
    }
    if (this.#cliArgs.tests) {
      filters.tests = this.#processAsArray(this.#cliArgs.tests, false)
    }
    if (this.#cliArgs.files) {
      filters.files = this.#processAsArray(this.#cliArgs.files, true)
    }
    if (this.#cliArgs.groups) {
      filters.groups = this.#processAsArray(this.#cliArgs.groups, false)
    }
    if (this.#cliArgs._ && this.#cliArgs._.length) {
      filters.suites = this.#processAsArray(this.#cliArgs._, true)
    }

    return filters
  }

  /**
   * Returns the timeout from the CLI args
   */
  #getCLITimeout(): number | undefined {
    if (this.#cliArgs.timeout) {
      const value = Number(this.#cliArgs.timeout)
      if (!Number.isNaN(value)) {
        return value
      }
    }
  }

  /**
   * Returns the retries from the CLI args
   */
  #getCLIRetries(): number | undefined {
    if (this.#cliArgs.retries) {
      const value = Number(this.#cliArgs.retries)
      if (!Number.isNaN(value)) {
        return value
      }
    }
  }

  /**
   * Returns the forceExit property from the CLI args
   */
  #getCLIForceExit(): boolean | undefined {
    if (this.#cliArgs.forceExit) {
      return true
    }
  }

  /**
   * Returns reporters selected using the commandline
   * --reporter flag
   */
  #getCLIReporters(): string[] | undefined {
    if (this.#cliArgs.reporters) {
      return this.#processAsArray(this.#cliArgs.reporters, true)
    }
  }

  /**
   * Hydrates the config with user defined options and the
   * command-line flags.
   */
  hydrate(): NormalizedConfig {
    const cliFilters = this.#getCLIFilters()
    const cliRetries = this.#getCLIRetries()
    const cliTimeout = this.#getCLITimeout()
    const cliReporters = this.#getCLIReporters()
    const cliForceExit = this.#getCLIForceExit()

    debug('filters applied using CLI flags %O', cliFilters)

    const baseConfig: NormalizedBaseConfig = {
      cwd: this.#config.cwd ?? process.cwd(),
      exclude: this.#config.exclude || ['node_modules/**', '.git/**', 'coverage/**'],
      filters: Object.assign({}, this.#config.filters ?? {}, cliFilters),
      importer: this.#config.importer ?? DEFAULTS.importer,
      refiner: this.#config.refiner ?? new Refiner(),
      retries: cliRetries ?? this.#config.retries ?? DEFAULTS.retries,
      timeout: cliTimeout ?? this.#config.timeout ?? DEFAULTS.timeout,
      plugins: this.#config.plugins ?? DEFAULTS.plugins,
      forceExit: cliForceExit ?? this.#config.forceExit ?? DEFAULTS.forceExit,
      reporters: this.#config.reporters
        ? {
            activated: this.#config.reporters.activated,
            list: this.#config.reporters.list || DEFAULTS.reporters.list,
          }
        : DEFAULTS.reporters,
      configureSuite: this.#config.configureSuite ?? DEFAULTS.configureSuite,
      setup: this.#config.setup || [],
      teardown: this.#config.teardown || [],
    }

    /**
     * Overwrite activated reporters when defined using CLI
     * flag
     */
    if (cliReporters) {
      baseConfig.reporters.activated = cliReporters
    }

    if ('files' in this.#config) {
      return {
        files: this.#config.files,
        ...baseConfig,
      }
    }

    return {
      suites: this.#config.suites.map((suite) => {
        return {
          name: suite.name,
          files: suite.files,
          timeout: cliTimeout ?? suite.timeout ?? baseConfig.timeout,
          retries: cliRetries ?? suite.retries ?? baseConfig.retries,
          configure: suite.configure || NOOP,
        }
      }),
      ...baseConfig,
    }
  }
}
