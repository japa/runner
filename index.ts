/*
 * @japa/runner
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { extname } from 'path'
import fastGlob from 'fast-glob'
import inclusion from 'inclusion'
import { pathToFileURL } from 'url'
import { Hooks } from '@poppinss/hooks'
import { ErrorsPrinter } from '@japa/errors-printer'
import { Test, TestContext, Group, Suite, Runner } from './src/Core'
import { Emitter, Refiner, TestExecutor, ReporterContract } from '@japa/core'
import {
  Config,
  Filters,
  PluginFn,
  RunnerHooksHandler,
  RunnerHooksCleanupHandler,
  ConfigSuite,
} from './src/Contracts'

export {
  Test,
  Config,
  Suite,
  Runner,
  Group,
  PluginFn,
  TestContext,
  ReporterContract,
  RunnerHooksHandler,
  RunnerHooksCleanupHandler,
}

/**
 * Filtering layers allowed by the refiner
 */
const refinerFilteringLayers = ['tests', 'groups', 'tags'] as const

/**
 * Reference to the recently imported file. We pass it to the
 * test and the group both
 */
let recentlyImportedFile: string

/**
 * Global timeout for tests. Fetched from runner options or suites
 * options
 */
let globalTimeout: number

/**
 * Function to create the test context for the test
 */
const getContext = (testInstance: Test<any>) => new TestContext(testInstance)

/**
 * The global reference to the tests emitter
 */
const emitter = new Emitter()

/**
 * Active suite for tests
 */
let activeSuite: Suite

/**
 * Currently active group
 */
let activeGroup: Group | undefined

/**
 * Configuration options
 */
let runnerOptions: Required<Config>

/**
 * Ensure the configure method has been called
 */
function ensureIsConfigured(message: string) {
  if (!runnerOptions) {
    throw new Error(message)
  }
}

/**
 * Validate suites filter to ensure a wrong suite is not
 * mentioned
 */
function validateSuitesFilter() {
  if (!('suites' in runnerOptions)) {
    return
  }

  if (!runnerOptions.filters.suites || !runnerOptions.filters.suites.length) {
    return
  }

  const suites = runnerOptions.suites.map(({ name }) => name)
  const invalidSuites = runnerOptions.filters.suites.filter((suite) => !suites.includes(suite))

  if (invalidSuites.length) {
    throw new Error(
      `Unrecognized suite "${invalidSuites[0]}". Make sure to define it in the config first`
    )
  }
}

/**
 * Find if the file path matches the files filter array.
 * The ending of the file is matched
 */
function isFileAllowed(filePath: string, filters: Filters): boolean {
  if (!filters.files || !filters.files.length) {
    return true
  }

  return !!filters.files.find((matcher) => {
    if (filePath.endsWith(matcher)) {
      return true
    }

    return filePath.replace(extname(filePath), '').endsWith(matcher)
  })
}

/**
 * Returns "true" when no filters are applied or the name is part
 * of the applied filter.
 */
function isSuiteAllowed(suite: ConfigSuite, filters: Filters) {
  if (!filters.suites || !filters.suites.length) {
    return true
  }

  return filters.suites.includes(suite.name)
}

/**
 * Collect files using the files collector function or by processing
 * the glob pattern.
 *
 * The return value is further filtered against the `--files` filter.
 */
async function collectFiles(files: string | string[] | (() => string[] | Promise<string[]>)) {
  if (Array.isArray(files) || typeof files === 'string') {
    const collectedFiles = await fastGlob(files, {
      absolute: true,
      onlyFiles: true,
      cwd: runnerOptions.cwd,
    })
    return collectedFiles.filter((file) => isFileAllowed(file, runnerOptions.filters))
  } else if (typeof files === 'function') {
    const collectedFiles = await files()
    return collectedFiles.filter((file) => isFileAllowed(file, runnerOptions.filters))
  }

  throw new Error('Invalid value for "files" property. Expected a string, array or a function')
}

/**
 * Import test files using the configured importer.
 */
async function importFiles(files: string[]) {
  for (let file of files) {
    recentlyImportedFile = file
    await runnerOptions.importer(file)
  }
}

/**
 * End tests. We wait for the "beforeExit" event when
 * forceExit is not set to true
 */
async function endTests(runner: Runner) {
  if (runnerOptions.forceExit) {
    await runner.end()
  } else {
    return new Promise<void>((resolve) => {
      async function beforeExit() {
        process.removeListener('beforeExit', beforeExit)
        await runner.end()
        resolve()
      }
      process.on('beforeExit', beforeExit)
    })
  }
}

/**
 * Configure the tests runner
 */
export function configure(options: Config) {
  const defaultOptions: Required<Config> = {
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

  runnerOptions = Object.assign(defaultOptions, options)
}

/**
 * Run japa tests
 */
export async function run() {
  const runner = new Runner(emitter)
  runner.manageUnHandledExceptions()
  runner.onSuite(runnerOptions.configureSuite)

  const hooks = new Hooks()
  let setupRunner: ReturnType<Hooks['runner']>
  let teardownRunner: ReturnType<Hooks['runner']>

  try {
    ensureIsConfigured('Cannot run tests without configuring the tests runner')

    /**
     * Step 1: Run all plugins
     *
     * Plugins can also mutate config. So we process the config after
     * running plugins only
     */
    for (let plugin of runnerOptions.plugins) {
      await plugin(runnerOptions, runner, { Test, TestContext, Group })
    }

    validateSuitesFilter()

    /**
     * Step 2: Notify runner about reporters
     */
    runnerOptions.reporters.forEach((reporter) => runner.registerReporter(reporter))

    /**
     * Step 3: Configure runner hooks.
     */
    runnerOptions.setup.forEach((hook) => hooks.add('setup', hook))
    runnerOptions.teardown.forEach((hook) => hooks.add('teardown', hook))
    setupRunner = hooks.runner('setup')
    teardownRunner = hooks.runner('teardown')

    /**
     * Step 3.1: Run setup hooks
     *
     * We run the setup hooks before importing test files. It
     * allows hooks to setup the app environment for the
     * test files.
     */
    await setupRunner.run(runner)

    /**
     * Step 4: Entertain files property and import test files
     * as part of the default suite
     */
    if ('files' in runnerOptions && runnerOptions.files.length) {
      /**
       * Create a default suite for files with no suite
       */
      globalTimeout = runnerOptions.timeout
      const files = await collectFiles(runnerOptions.files)

      /**
       * Create and register suite when files are collected.
       */
      if (files.length) {
        activeSuite = new Suite('default', emitter, runnerOptions.refiner)
        runner.add(activeSuite)
        await importFiles(files)
      }
    }

    /**
     * Step 5: Entertain suites property and import test files
     * for the filtered suites.
     */
    if ('suites' in runnerOptions) {
      for (let suite of runnerOptions.suites) {
        if (isSuiteAllowed(suite, runnerOptions.filters)) {
          if (suite.timeout !== undefined) {
            globalTimeout = suite.timeout
          } else {
            globalTimeout = runnerOptions.timeout
          }

          const files = await collectFiles(suite.files)

          /**
           * Only register the suite and import files when the suite
           * files glob + filter has returned one or more files.
           */
          if (files.length) {
            activeSuite = new Suite(suite.name, emitter, runnerOptions.refiner)
            if (typeof suite.configure === 'function') {
              suite.configure(activeSuite)
            }

            runner.add(activeSuite)
            await importFiles(files)
          }
        }
      }
    }

    /**
     * Step 6: Add filters to the refiner
     */
    Object.keys(runnerOptions.filters).forEach((layer: 'tests' | 'groups' | 'tags') => {
      if (refinerFilteringLayers.includes(layer)) {
        const values = runnerOptions.filters[layer]
        if (values) {
          runnerOptions.refiner.add(layer, values)
        }
      }
    })

    /**
     * Step 7.1: Start the tests runner
     */
    await runner.start()

    /**
     * Step 7.2: Execute all the tests
     */
    await runner.exec()

    /**
     * Step 7.3: Run cleanup and teardown hooks
     */
    await setupRunner.cleanup(runner)
    await teardownRunner.run(runner)
    await teardownRunner.cleanup(runner)

    /**
     * Step 7.4: End or wait for process to exit
     */
    await endTests(runner)

    /**
     * Step 8: Update the process exit code
     */
    const summary = runner.getSummary()
    if (summary.hasError) {
      process.exitCode = 1
    }

    runnerOptions.forceExit && process.exit()
  } catch (error) {
    if (setupRunner! && setupRunner.isCleanupPending) {
      await setupRunner.cleanup(error, runner)
    }
    if (teardownRunner! && teardownRunner.isCleanupPending) {
      await teardownRunner.cleanup(error, runner)
    }

    const printer = new ErrorsPrinter()
    await printer.printError(error)

    process.exitCode = 1
    runnerOptions.forceExit && process.exit()
  }
}

/**
 * Add a new test
 */
export function test(title: string, callback?: TestExecutor<TestContext, undefined>) {
  ensureIsConfigured('Cannot add test without configuring the test runner')

  const testInstance = new Test<undefined>(
    title,
    getContext,
    emitter,
    runnerOptions.refiner,
    activeGroup
  )

  /**
   * Set filename
   */
  testInstance.options.meta.fileName = recentlyImportedFile

  /**
   * Define timeout on the test when exists globally
   */
  if (globalTimeout !== undefined) {
    testInstance.timeout(globalTimeout)
  }

  /**
   * Define test executor function
   */
  if (callback) {
    testInstance.run(callback)
  }

  /**
   * Add test to the group or suite
   */
  if (activeGroup) {
    activeGroup.add(testInstance)
  } else {
    activeSuite.add(testInstance)
  }

  return testInstance
}

/**
 * Define test group
 */
test.group = function (title: string, callback: (group: Group) => void) {
  ensureIsConfigured('Cannot add test group without configuring the test runner')

  /**
   * Disallow nested groups
   */
  if (activeGroup) {
    throw new Error('Cannot create nested test groups')
  }

  activeGroup = new Group(title, emitter, runnerOptions.refiner)

  /**
   * Set filename
   */
  activeGroup.options.meta.fileName = recentlyImportedFile

  /**
   * Add group to the default suite
   */
  activeSuite.add(activeGroup)

  callback(activeGroup)
  activeGroup = undefined
}

export { processCliArgs } from './src/CliProcessor'
