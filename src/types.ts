/*
 * @japa/runner
 *
 * (c) Japa.dev
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { Refiner, FilteringOptions, ReporterContract } from '@japa/core'
import { Test, Group, TestContext, Runner, Suite } from './core/main'

/**
 * The cleanup function for runner hooks
 */
export declare type RunnerHooksCleanupHandler = (
  error: null | any,
  runner: Runner
) => Promise<any> | any

/**
 * The function that can be registered as a runner hook
 */
export declare type RunnerHooksHandler = (
  runner: Runner
) => Promise<any> | any | RunnerHooksCleanupHandler | Promise<RunnerHooksCleanupHandler>

/**
 * Allowed filters
 */
export type Filters = FilteringOptions & {
  files?: string[]
  suites?: string[]
}

/**
 * Shape of the plugin function
 */
export type PluginFn = (
  config: Required<Config>,
  runner: Runner,
  classes: {
    Test: typeof Test
    TestContext: typeof TestContext
    Group: typeof Group
  }
) => void | Promise<void>

/**
 * Runner hooks
 */
export type RunnerHooks = {
  setup: RunnerHooksHandler[]
  teardown: RunnerHooksHandler[]
}

/**
 * Base configuration options
 */
export type BaseConfig = {
  cliArgs?: Record<string, any>
  cwd?: string
  timeout?: number
  plugins?: PluginFn[]
  filters?: Filters
  configureSuite?: (suite: Suite) => void
  reporters?: ReporterContract[]
  importer?: (filePath: string) => void | Promise<void>
  refiner?: Refiner
  forceExit?: boolean
} & Partial<RunnerHooks>

/**
 * Type for the "config.files" property
 */
export type ConfigFiles = string[] | (() => string[] | Promise<string[]>)

/**
 * Type for the "config.suite" property
 */
export type ConfigSuite = {
  name: string
  files: string | string[] | (() => string[] | Promise<string[]>)
  configure?: (suite: Suite) => void
  timeout?: number
}

/**
 * Configuration options
 */
export type Config = BaseConfig &
  (
    | {
        files: ConfigFiles
      }
    | {
        suites: ConfigSuite[]
      }
  )
