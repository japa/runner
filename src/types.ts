/*
 * @japa/runner
 *
 * (c) Japa
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import type { HookHandler } from '@poppinss/hooks/types'

import type { Emitter, Refiner, Runner, Suite } from '../modules/core/main.js'
import type { FilteringOptions, NamedReporterContract } from '../modules/core/types.js'

export * from '../modules/core/types.js'

/**
 * Global setup hook
 */
export type SetupHookState = [[runner: Runner], [error: Error | null, runner: Runner]]
export type SetupHookHandler = HookHandler<SetupHookState[0], SetupHookState[1]>

/**
 * Global teardown hook
 */
export type TeardownHookState = [[runner: Runner], [error: Error | null, runner: Runner]]
export type TeardownHookHandler = HookHandler<TeardownHookState[0], TeardownHookState[1]>

/**
 * Global set of available hooks
 */
export type HooksEvents = {
  setup: SetupHookState
  teardown: TeardownHookState
}

/**
 * Parsed command-line arguments
 */
export type CLIArgs = {
  _?: string[]
  tags?: string | string[]
  files?: string | string[]
  tests?: string | string[]
  groups?: string | string[]
  timeout?: string
  retries?: string
  reporter?: string | string[]
} & Record<string, string | string[] | boolean>

/**
 * Set of filters you can apply to run only specific tests
 */
export type Filters = FilteringOptions & {
  files?: string[]
  suites?: string[]
}

/**
 * Plugin function receives an instance of the runner,
 * emitter, config and the hooks
 */
export type PluginFn = (japa: {
  config: Required<Config>
  cliArgs: CLIArgs
  runner: Runner
  emitter: Emitter
}) => void | Promise<void>

/**
 * Base configuration options
 */
export type BaseConfig = {
  /**
   * Current working directory. It is required to search for
   * the test files
   */
  cwd?: string

  /**
   * The timeout to apply on all the tests, unless overwritten explicitly
   */
  timeout?: number

  /**
   * The retries to apply on all the tests, unless overwritten explicitly
   */
  retries?: number

  /**
   * Test filters to apply
   */
  filters?: Filters

  /**
   * A hook to configure suites. The callback will be called for each
   * suite before it gets executed.
   */
  configureSuite?: (suite: Suite) => void

  /**
   * A collection of registered reporters. Reporters are not activated by
   * default. Either you have to activate them using the commandline,
   * or using the `activated` property.
   */
  reporters?: {
    activated: string[]
    list: NamedReporterContract[]
  }

  /**
   * A collection of registered plugins
   */
  plugins?: PluginFn[]

  /**
   * A custom implementation to import test files.
   */
  importer?: (filePath: URL) => void | Promise<void>

  /**
   * Overwrite tests refiner. Check documentation for refiner
   * usage
   */
  refiner?: Refiner

  /**
   * Enable/disable force exiting.
   */
  forceExit?: boolean

  /**
   * Global hooks to execute before importing
   * the test files
   */
  setup?: SetupHookHandler[]

  /**
   * Global hooks to execute on teardown
   */
  teardown?: TeardownHookHandler[]
}

/**
 * A collection of test files defined as a glob or a callback
 * function that returns an array of URLs
 */
export type TestFiles = string | string[] | (() => URL[] | Promise<URL[]>)

/**
 * A test suite to register tests under a named suite
 */
export type TestSuite = {
  /**
   * A unique name for the suite
   */
  name: string

  /**
   * Collection of files associated with the suite. Files should be
   * defined as a glob or a callback function that returns an array of URLs
   */
  files: TestFiles

  /**
   * A callback functon to configure the suite. The callback is invoked only
   * when the runner is going to run the tests for the given suite.
   */
  configure?: (suite: Suite) => void

  /**
   * The timeout to apply on all the tests in this suite, unless overwritten explicitly
   */
  timeout?: number

  /**
   * The retries to apply on all the tests in this suite, unless overwritten explicitly
   */
  retries?: number
}

/**
 * Configuration options
 */
export type Config = BaseConfig &
  (
    | {
        files: TestFiles
      }
    | {
        suites: TestSuite[]
      }
  )
