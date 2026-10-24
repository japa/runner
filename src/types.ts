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
  reporters?: string | string[]
  forceExit?: boolean
  failed?: boolean
  help?: boolean
  matchAll?: boolean
  listPinned?: boolean
  allowKnownFailures?: boolean
  updateBaseline?: boolean
  reporterAgent?: boolean
  changed?: string
  prepareCaches?: boolean
  failedNew?: boolean
  agentFile?: string
  cacheDir?: string
  bail?: boolean
  bailLayer?: string
  shard?: string
} & Record<string, string | string[] | boolean>

/**
 * Map a test file to source files it depends on without importing them, such as the
 * controller behind a route it requests. Paths are relative to `cwd` or absolute.
 */
export type DependencyResolver = (testFile: string) => Iterable<string> | Promise<Iterable<string>>

/**
 * Guess the tests for a changed file that no test reaches. `from` and `to` are path
 * prefixes where each `*` stands for one path segment, e.g.
 * `{ from: 'app/modules/*\/', to: 'tests/modules/*\/' }`.
 */
export type HeuristicRule = { from: string; to: string }

export type SelectionOptions = {
  /** Run while recording the dependency map; their files join the test's dependencies. */
  resolvers?: DependencyResolver[]
  /**
   * When a changed path is reached by no test and is not loaded at boot, run test files
   * named after it (`lease.ts` -> `lease.spec.ts`) plus the files the rules map it to,
   * instead of the full suite. The selection is reported as heuristic. Off by default.
   */
  heuristic?: boolean | HeuristicRule[]
  /**
   * Path prefixes (`*` stands for one segment) whose change can affect any test even
   * when some test imports them: config, bootstrap and route files, whose effect is
   * loading itself. A change to one runs the full suite.
   */
  global?: string[]
}

/**
 * The shard to run when splitting test files across multiple
 * processes or CI jobs. Both values are 1-based.
 */
export type Shard = {
  current: number
  total: number
}

/**
 * Set of filters you can apply to run only specific tests
 */
export type Filters = FilteringOptions & {
  files?: string[]
  suites?: string[]
  shard?: Shard
}

/**
 * Plugin function receives an instance of the runner,
 * emitter, config and the hooks
 */
export type PluginFn = (japa: {
  config: NormalizedConfig
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

  /** Capture declaration stacks for timeout/pinned-test diagnostics. Defaults to true. */
  captureTestLocations?: boolean

  /** File duration estimates in milliseconds; enables balanced sharding when nonempty. */
  shardDurations?: Record<string, number>

  /** How `--changed` places files that no import reaches. */
  selection?: SelectionOptions

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
    list?: NamedReporterContract[]
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

  /**
   * An array of directories to exclude when searching
   * for test files.
   *
   * For example, if you search for test files inside the entire
   * project, you might want to exclude "node_modules"
   */
  exclude?: string[]
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
 * BaseConfig after normalized by the config manager
 */
export type NormalizedBaseConfig = Required<Omit<BaseConfig, 'reporters'>> & {
  reporters: {
    activated: string[]
    list: NamedReporterContract[]
  }
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

/**
 * Config after normalized by the config manager
 */
export type NormalizedConfig = NormalizedBaseConfig &
  (
    | {
        files: TestFiles
      }
    | {
        suites: Required<TestSuite>[]
      }
  )
