/*
 * @japa/runner
 *
 * (c) Japa
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import debug from './debug.js'
import { spec } from './reporters/main.js'
import { Refiner } from '../modules/core/main.js'
import type { CLIArgs, Config, Filters } from './types.js'

/**
 * Defaults to use for configuration
 */
const DEFAULTS = {
  files: [],
  timeout: 2000,
  retries: 1,
  forceExit: false,
  plugins: [],
  reporters: {
    activated: ['spec'],
    list: [spec()],
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
  #processAsArray(value: string | string[]): string[] {
    return Array.isArray(value) ? value : value.split(',').map((item: string) => item.trim())
  }

  /**
   * Returns a copy of filters based upon the CLI
   * arguments.
   */
  #getCLIFilters(): Filters {
    const filters: Filters = {}

    if (this.#cliArgs.tags) {
      filters.tags = this.#processAsArray(this.#cliArgs.tags)
    }
    if (this.#cliArgs.tests) {
      filters.tests = this.#processAsArray(this.#cliArgs.tests)
    }
    if (this.#cliArgs.files) {
      filters.files = this.#processAsArray(this.#cliArgs.files)
    }
    if (this.#cliArgs.groups) {
      filters.groups = this.#processAsArray(this.#cliArgs.groups)
    }
    if (this.#cliArgs._ && this.#cliArgs._.length) {
      filters.suites = this.#processAsArray(this.#cliArgs._)
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
   * Returns reporters selected using the commandline
   * --reporter flag
   */
  #getCLIReporters(): string[] | undefined {
    if (this.#cliArgs.reporter) {
      return this.#processAsArray(this.#cliArgs.reporter)
    }
  }

  /**
   * Hydrates the config with user defined options and the
   * command-line flags.
   */
  hydrate(): Required<Config> {
    const cliFilters = this.#getCLIFilters()
    const cliRetries = this.#getCLIRetries()
    const cliTimeout = this.#getCLITimeout()
    const cliReporters = this.#getCLIReporters()

    debug('filters applied using CLI flags %O', cliFilters)

    const baseConfig: Omit<Required<Config>, 'files' | 'suites'> = {
      cwd: this.#config.cwd ?? process.cwd(),
      filters: Object.assign({}, this.#config.filters ?? {}, cliFilters),
      importer: this.#config.importer ?? DEFAULTS.importer,
      refiner: this.#config.refiner ?? new Refiner(),
      retries: cliRetries ?? this.#config.retries ?? DEFAULTS.retries,
      timeout: cliTimeout ?? this.#config.timeout ?? DEFAULTS.timeout,
      plugins: this.#config.plugins ?? DEFAULTS.plugins,
      forceExit: this.#config.forceExit ?? DEFAULTS.forceExit,
      reporters: this.#config.reporters ?? DEFAULTS.reporters,
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
          configure: suite.configure,
        }
      }),
      ...baseConfig,
    }
  }
}
