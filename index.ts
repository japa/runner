/*
 * @japa/runner
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import getopts from 'getopts'
import { extname } from 'path'
import fastGlob from 'fast-glob'
import inclusion from 'inclusion'
import { Hooks } from '@poppinss/hooks'
import { Emitter, Refiner, Suite, Runner, TestExecutor } from '@japa/core'

import { Test, TestContext, Group } from './src/Core'
import { ConfigureOptions, Filters } from './src/Contracts'

export { Test, TestContext, Group } from './src/Core'

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
 * Function to create the test context for the test
 */
const getContext = (testInstance: Test<TestContext, any>) => new TestContext(testInstance)

/**
 * The global reference to the tests emitter
 */
const emitter = new Emitter()

/**
 * The default suite for registering tests
 */
const suite = new Suite('default', emitter)

/**
 * Currently active group
 */
let activeGroup: Group<TestContext> | undefined

/**
 * Configuration options
 */
let runnerOptions: Required<ConfigureOptions>

/**
 * Ensure the configure method has been called
 */
function ensureIsConfigured(message: string) {
  if (!runnerOptions) {
    throw new Error(message)
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
 * Process command line args to an array of strings
 */
function processArg(flag: string | string[]): string[] {
  return (Array.isArray(flag) ? flag : flag.split(',')).map((tag: string) => tag.trim())
}

/**
 * Find if the file path matches the files filter array.
 * The ending of the file is matched
 */
function isFileAllowed(filePath: string, filters: string[]): boolean {
  return !!filters.find((matcher) => {
    if (filePath.endsWith(matcher)) {
      return true
    }

    return filePath.replace(extname(filePath), '').endsWith(matcher)
  })
}

/**
 * Configure the tests runner
 */
export function configure(options: ConfigureOptions) {
  const defaultOptions: Required<ConfigureOptions> = {
    files: [],
    plugins: [],
    reporters: [],
    timeout: 2000,
    filters: {},
    setup: [],
    teardown: [],
    importer: (filePath) => inclusion(filePath),
    refiner: new Refiner({}),
    forceExit: false,
  }

  runnerOptions = Object.assign(defaultOptions, options)
}

/**
 * Add a new test
 */
export default function test(title: string, callback?: TestExecutor<TestContext, undefined>) {
  ensureIsConfigured('Cannot add test without configuring the test runner')

  const testInstance = new Test<TestContext, undefined>(
    title,
    getContext,
    emitter,
    runnerOptions.refiner
  )

  /**
   * Set filename
   */
  testInstance.options.meta.fileName = recentlyImportedFile

  /**
   * Define timeout on the test when exists globally
   */
  if (runnerOptions.timeout !== undefined) {
    testInstance.timeout(runnerOptions.timeout)
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
    suite.add(testInstance)
  }

  return testInstance
}

/**
 * Define test group
 */
test.group = function (title: string, callback: (group: Group<TestContext>) => void) {
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

  callback(activeGroup)

  /**
   * Add group to the default suite
   */
  suite.add(activeGroup)
  activeGroup = undefined
}

/**
 * Run japa tests
 */
export async function run() {
  const runner = new Runner(emitter)
  runner.add(suite).manageUnHandledExceptions()

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

    /**
     * Step 2: Notify runner about reporters
     */
    runnerOptions.reporters.forEach((reporter) => runner.registerReporter(reporter))

    /**
     * Step 3: Run runner hooks.
     *
     * We run hooks before importing test files. It allows hooks
     * to setup the app environment for the test files
     */
    runnerOptions.setup.forEach((hook) => hooks.add('setup', hook))
    runnerOptions.teardown.forEach((hook) => hooks.add('teardown', hook))
    setupRunner = hooks.runner('setup')
    teardownRunner = hooks.runner('teardown')

    /**
     * Step 3.1: Run setup hooks
     */
    await setupRunner.run(runner)

    /**
     * Step 4: Collect all test files
     */
    let files: string[] = []
    if (Array.isArray(runnerOptions.files)) {
      files = await fastGlob(runnerOptions.files, { absolute: true, onlyFiles: true })
    } else if (typeof runnerOptions.files === 'function') {
      files = await runnerOptions.files()
    }

    /**
     * Step 5: Import files
     */
    for (let file of files) {
      recentlyImportedFile = file
      if (runnerOptions.filters.files && runnerOptions.filters.files.length) {
        if (isFileAllowed(file, runnerOptions.filters.files)) {
          await runnerOptions.importer(file)
        }
      } else {
        await runnerOptions.importer(file)
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
     * Step 7.3: Run teardown hooks
     */
    await teardownRunner.run(runner)

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
    await setupRunner.cleanup(runner)
    await teardownRunner.cleanup(runner)
  } catch (error) {
    if (setupRunner! && setupRunner.isCleanupPending) {
      await setupRunner.cleanup(error, runner)
    }
    if (teardownRunner! && teardownRunner.isCleanupPending) {
      await teardownRunner.cleanup(error, runner)
    }

    process.exitCode = 1
    runnerOptions.forceExit && process.exit()
  }
}

/**
 * Process CLI arguments into filters
 */
export function processCliArgs(argv: string[]): Filters {
  const parsed = getopts(argv, {
    string: ['tests', 'tags', 'groups', 'ignoreTags', 'files'],
    alias: {
      ignoreTags: 'ignore-tags',
    },
  })

  const filters: Filters = {}

  if (parsed.tags) {
    filters.tags = processArg(parsed.tags)
  }

  if (parsed.ignoreTags) {
    filters.tags = filters.tags || []
    processArg(parsed.ignoreTags).forEach((tag) => {
      filters.tags!.push(`!${tag}`)
    })
  }

  if (parsed.groups) {
    filters.groups = processArg(parsed.groups)
  }

  if (parsed.tests) {
    filters.tests = processArg(parsed.tests)
  }

  if (parsed.files) {
    filters.files = processArg(parsed.files)
  }

  return filters
}
