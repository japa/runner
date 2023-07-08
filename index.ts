/*
 * @japa/runner
 *
 * (c) Japa
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { fileURLToPath } from 'node:url'
import { ErrorsPrinter } from '@japa/errors-printer'
import type { TestExecutor } from '@japa/core/types'

import debug from './src/debug.js'
import validator from './src/validator.js'
import { Planner } from './src/planner.js'
import { GlobalHooks } from './src/hooks.js'
import { CliParser } from './src/cli_parser.js'
import { retryPlugin } from './src/plugins/retry.js'
import type { CLIArgs, Config, NormalizedConfig } from './src/types.js'
import { ConfigManager } from './src/config_manager.js'
import { ExceptionsManager } from './src/exceptions_manager.js'
import { createTest, createTestGroup } from './src/create_test.js'
import { Emitter, Group, Runner, Suite, Test, TestContext } from './modules/core/main.js'

/**
 * Global emitter instance used by the test
 */
const emitter = new Emitter()

/**
 * The current active test
 */
let activeTest: Test<any> | undefined

/**
 * Parsed commandline arguments
 */
let cliArgs: CLIArgs = {}

/**
 * Hydrated config
 */
let runnerConfig: NormalizedConfig | undefined

/**
 * The state refers to the phase where we configure suites and import
 * test files. We stick this metadata to the test instance one can
 * later reference within the test.
 */
const executionPlanState: {
  phase: 'idle' | 'planning' | 'executing'
  file?: string
  suite?: Suite
  group?: Group
  timeout?: number
  retries?: number
} = {
  phase: 'idle',
}

/**
 * Create a Japa test. Defining a test without the callback
 * will create a todo test.
 */
export function test(title: string, callback?: TestExecutor<TestContext, undefined>) {
  validator.ensureIsInPlanningPhase(executionPlanState.phase)

  const testInstance = createTest(title, emitter, runnerConfig!.refiner, executionPlanState)
  testInstance.setup((t) => {
    activeTest = t
    return () => {
      activeTest = undefined
    }
  })

  if (callback) {
    testInstance.run(callback)
  }

  return testInstance
}

/**
 * Create a Japa test group
 */
test.group = function (title: string, callback: (group: Group) => void) {
  validator.ensureIsInPlanningPhase(executionPlanState.phase)

  executionPlanState.group = createTestGroup(
    title,
    emitter,
    runnerConfig!.refiner,
    executionPlanState
  )
  callback(executionPlanState.group)
  executionPlanState.group = undefined
}

/**
 * Get the test of currently running test
 */
export function getActiveTest() {
  return activeTest
}

/**
 * Make Japa process command line arguments. Later the parsed output
 * will be used by Japa to compute the configuration
 */
export function processCLIArgs(argv: string[]) {
  cliArgs = new CliParser().parse(argv)
}

/**
 * Configure the tests runner with inline configuration. You must
 * call configure method before the run method.
 *
 * Do note: The CLI flags will overwrite the options provided
 * to the configure method.
 */
export function configure(options: Config) {
  runnerConfig = new ConfigManager(options, cliArgs).hydrate()
}

/**
 * Execute Japa tests. Calling this function will import the test
 * files behind the scenes
 */
export async function run() {
  /**
   * Display help when help flag is used
   */
  if (cliArgs.help) {
    console.log(new CliParser().getHelp())
    return
  }

  validator.ensureIsConfigured(runnerConfig)

  executionPlanState.phase = 'planning'
  const runner = new Runner(emitter)
  const globalHooks = new GlobalHooks()
  const exceptionsManager = new ExceptionsManager()

  try {
    /**
     * Executing the retry plugin as the first thing
     */
    await retryPlugin({ config: runnerConfig!, runner, emitter, cliArgs })

    /**
     * Step 1: Executing plugins before creating a plan, so that it can mutate
     * the config
     */
    for (let plugin of runnerConfig!.plugins) {
      debug('executing "%s" plugin', plugin.name || 'anonymous')
      await plugin({ runner, emitter, cliArgs, config: runnerConfig! })
    }

    /**
     * Step 2: Creating an execution plan. The output is the result of
     * applying all the filters and validations.
     */
    const { config, reporters, suites, refinerFilters } = await new Planner(runnerConfig!).plan()

    /**
     * Step 3: Registering reporters and filters with the runner
     */
    reporters.forEach((reporter) => {
      debug('registering "%s" reporter', reporter.name)
      runner.registerReporter(reporter)
    })
    refinerFilters.forEach((filter) => {
      debug('apply %s filters "%O" ', filter.layer, filter.filters)
      config.refiner.add(filter.layer, filter.filters)
    })
    config.refiner.matchAllTags(cliArgs.matchAll ?? false)
    runner.onSuite(config.configureSuite)

    /**
     * Step 4: Running the setup hooks
     */
    debug('executing global hooks')
    globalHooks.apply(config)
    await globalHooks.setup(runner)

    /**
     * Step 5: Register suites and import test files
     */
    for (let suite of suites) {
      /**
       * Creating and configuring the suite
       */
      executionPlanState.suite = new Suite(suite.name, emitter, config.refiner)
      executionPlanState.retries = suite.retries
      executionPlanState.timeout = suite.timeout
      if (typeof suite.configure === 'function') {
        suite.configure(executionPlanState.suite)
      }
      runner.add(executionPlanState.suite)

      /**
       * Importing suite files
       */
      for (let fileURL of suite.filesURLs) {
        executionPlanState.file = fileURLToPath(fileURL)
        debug('importing test file %s', executionPlanState.file)
        await config.importer(fileURL)
      }

      /**
       * Resetting global state
       */
      executionPlanState.suite = undefined
    }

    /**
     * Onto execution phase
     */
    executionPlanState.phase = 'executing'

    /**
     * Monitor for unhandled erorrs and rejections
     */
    exceptionsManager.monitor()

    await runner.start()
    await runner.exec()

    await globalHooks.teardown(null, runner)
    await runner.end()

    /**
     * Print unhandled errors
     */
    await exceptionsManager.flow()

    const summary = runner.getSummary()
    if (summary.hasError || exceptionsManager.hasErrors) {
      process.exitCode = 1
    }
    if (config.forceExit) {
      process.exit()
    }
  } catch (error) {
    await globalHooks.teardown(error, runner)
    const printer = new ErrorsPrinter()
    await printer.printError(error)

    /**
     * Print unhandled errors in case the code inside
     * the try block never got triggered
     */
    await exceptionsManager.flow()

    process.exitCode = 1
    if (runnerConfig!.forceExit) {
      process.exit()
    }
  }
}
