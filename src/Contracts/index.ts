/*
 * @japa/runner
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { Runner, Refiner, FilteringOptions, ReporterContract } from '@japa/core'
import { Test, Group, TestContext } from '../Core'

/**
 * The cleanup function for runner hooks
 */
export declare type RunnerHooksCleanupHandler = (
  error: null | any,
  runner: Runner<TestContext>
) => Promise<any> | any

/**
 * The function that can be registered as a runner hook
 */
export declare type RunnerHooksHandler = (
  runner: Runner<TestContext>
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
  config: Required<ConfigureOptions>,
  runner: Runner<TestContext>,
  classes: {
    Test: typeof Test
    TestContext: typeof TestContext
    Group: typeof Group
  }
) => void | Promise<void>

/**
 * Base configuration options
 */
export type BaseConfigureOptions = {
  timeout?: number
  plugins?: PluginFn[]
  filters?: Filters
  setup?: RunnerHooksHandler[]
  teardown?: RunnerHooksHandler[]
  reporters?: ReporterContract[]
  importer?: (filePath: string) => void | Promise<void>
  refiner?: Refiner
  forceExit?: boolean
}

/**
 * Configuration options
 */
export type ConfigureOptions = BaseConfigureOptions &
  (
    | {
        files: string[] | (() => string[] | Promise<string[]>)
      }
    | {
        suites: {
          name: string
          files: string | string[] | (() => string[] | Promise<string[]>)
          timeout?: number
        }[]
      }
  )
