/*
 * @japa/runner
 *
 * (c) Japa
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { fileURLToPath } from 'node:url'
import type { TestExecutor } from '@japa/core/types'

import debug from './src/debug.js'
import validator from './src/validator.js'
import { Planner } from './src/planner.js'
import { GlobalHooks } from './src/hooks.js'
import { CliParser } from './src/cli_parser.js'
import { agent as agentReporter } from './src/reporters/main.js'
import { dateTimeDoubles, printPinnedTests, warn } from './src/helpers.js'
import { retryPlugin } from './src/plugins/retry.js'
import { ConfigManager } from './src/config_manager.js'
import { ExceptionsManager } from './src/exceptions_manager.js'
import { createTest, createTestGroup } from './src/create_test.js'
import type { CLIArgs, Config, NormalizedConfig } from './src/types.js'
export type { Baseline, BaselineEntry } from './src/failure_baseline.js'
export { recordImportsFromStart } from './src/dependencies.js'
import {
  changedOutcome,
  samePolicy,
  selectionDetail,
  selectionPolicy,
  settlePending,
} from './src/dependencies.js'
export type { AgentDelta, AgentTestRow, AgentSummary } from './src/agent_delta.js'
import {
  Emitter,
  type Group,
  Runner,
  Suite,
  type Test,
  type TestContext,
} from './modules/core/main.js'

type OmitFirstArg<F> = F extends [_: any, ...args: infer R] ? R : never

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
  const debuggingError = runnerConfig!.captureTestLocations ? new Error() : null

  const testInstance = createTest(
    title,
    emitter,
    runnerConfig!.refiner,
    debuggingError,
    executionPlanState
  )
  testInstance.setup((t) => {
    activeTest = t
    return () => {
      activeTest = undefined
    }
  })

  if (callback) {
    testInstance.run(callback, debuggingError ?? undefined)
  }

  return testInstance
}

/**
 * Create a Japa test group
 */
test.group = function (title: string, callback: (group: Group) => void): Group {
  validator.ensureIsInPlanningPhase(executionPlanState.phase)

  const group = createTestGroup(title, emitter, runnerConfig!.refiner, executionPlanState)
  executionPlanState.group = group

  /**
   * Enable bail on the group an when bailLayer is set to "group"
   */
  if (cliArgs.bail && cliArgs.bailLayer === 'group') {
    executionPlanState.group.bail(true)
  }

  callback(executionPlanState.group)
  executionPlanState.group = undefined

  return group
}

/**
 * Create a test bound macro. Within the macro, you can access the
 * currently executed test to read its context values or define
 * cleanup hooks
 */
test.macro = function <T extends (test: Test, ...args: any[]) => any>(
  callback: T
): (...args: OmitFirstArg<Parameters<T>>) => ReturnType<T> {
  return (...args) => {
    if (!activeTest) {
      throw new Error('Cannot invoke macro outside of the test callback')
    }
    return callback(activeTest, ...args)
  }
}

/**
 * Get the test of currently running test
 */
export function getActiveTest() {
  return activeTest
}

/**
 * Get the test of currently running test or throw an error
 */
export function getActiveTestOrFail() {
  if (!activeTest) throw new Error('Cannot access active test outside of a test callback')
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
  /**
   * `--agent` replaces the reporters with a machine-readable one. It has to be
   * decided before the config is normalized, because the runner receives the
   * reporter list then, and mixing human and agent output confuses both readers.
   * `--agent-file` alone keeps stdout free of agent JSON, so it adds the agent
   * reporter and leaves the configured ones (result files, guards) running.
   */
  if (cliArgs.reporterAgent || cliArgs.agentFile) {
    const configured = options.reporters ?? { activated: [], list: [] }
    const alreadyAgent = configured.activated.includes('agent')
    const activated = cliArgs.reporterAgent
      ? ['agent']
      : [...new Set([...configured.activated, 'agent'])]
    options = {
      ...options,
      reporters: {
        activated,
        list: alreadyAgent
          ? (configured.list ?? [])
          : [
              ...(configured.list ?? []),
              agentReporter({
                onlyFailures: process.env.JAPA_AGENT_ALL !== '1',
                compact: true,
                file: cliArgs.agentFile,
              }),
            ],
      },
    }
  }

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

  /**
   * Enable bail on the runner and all the layers after the
   * runner when no specific bailLayer is specified
   */
  if (cliArgs.bail && cliArgs.bailLayer === '') {
    runner.bail(true)
  }

  const globalHooks = new GlobalHooks()
  const exceptionsManager = new ExceptionsManager()

  try {
    /**
     * Executing the retry plugin as the first thing
     */
    await retryPlugin({ config: runnerConfig!, runner, emitter, cliArgs })
    const preparing = Boolean(cliArgs.prepareCaches)
    const filters = runnerConfig!.filters
    // Cache recording is opt-in. A plain run should not install module hooks or
    // write an index that it never asked to use.
    const recordsCaches =
      preparing ||
      Boolean(cliArgs.changed) ||
      Boolean(cliArgs.reporterAgent || cliArgs.agentFile) ||
      Boolean(filters.tests?.length || filters.groups?.length || filters.tags?.length)

    // Preparing caches always covers the whole configured suite. Otherwise a
    // `--files`/`--suites` selection would produce a map that looks complete.
    if (preparing) {
      filters.files = []
      filters.suites = []
      filters.tests = []
      filters.groups = []
      filters.tags = []
      filters.shard = undefined
    }
    // The coordinator's environment enables history without an app-config edit.
    if (
      process.env.JAPA_SPEED_SNAPSHOT ||
      process.env.JAPA_SPEED_RUN_ID ||
      process.env.JAPA_SPEED_OUTPUT
    ) {
      const { durationHistory } = await import('./src/duration_history.js')
      await durationHistory()({ config: runnerConfig!, runner, emitter, cliArgs })
    }

    /**
     * Selection index: narrow files for title/group/tag filters before they are
     * imported, and record what each file contains for the next filtered run.
     * Best-effort: an absent or stale index keeps every file.
     */
    if (process.env.JAPA_SPEED_SELECTION) {
      try {
        const { readFile } = await import('node:fs/promises')
        const { isWorkerSelection } = await import('./src/parallel.js')
        const selection: unknown = JSON.parse(
          await readFile(process.env.JAPA_SPEED_SELECTION, 'utf8')
        )
        if (!isWorkerSelection(selection)) throw new Error('malformed selection')
        if (samePolicy(selection.policy, selectionPolicy(runnerConfig!.selection))) {
          const fallback = await settlePending(runnerConfig!, selection.pending)
          if (fallback?.kind === 'full') {
            warn(`--changed is running every file of this shard: ${fallback.reason}`)
          } else {
            // A pending path is an unrecorded test file, which `onlyWithin` already keeps.
            const { setSelectionPlan } = await import('./src/planning_state.js')
            setSelectionPlan(runnerConfig!, {
              only: Object.freeze(selection.only),
              onlyWithin: Object.freeze(selection.onlyWithin),
            })
          }
        } else {
          warn(
            '--changed is running every file of this shard: selection.heuristic or ' +
              'selection.global changed since the caches were prepared. Rerun --prepare-caches.'
          )
        }
      } catch (error) {
        // Running too much is safe; a selection that cannot be read narrows nothing.
        debug('ignoring invalid coordinator selection: %O', error)
      }
    }

    /**
     * Step 1: Executing plugins before creating a plan, so that it can mutate
     * the config
     */
    for (let plugin of runnerConfig!.plugins) {
      debug('executing "%s" plugin', plugin.name || 'anonymous')
      await plugin({ runner, emitter, cliArgs, config: runnerConfig! })
    }

    if (!process.env.JAPA_SPEED_RUN_ID && recordsCaches) {
      const { changedSelection, recordDependencies } = await import('./src/dependencies.js')
      const dependencyOptions = { dir: cliArgs.cacheDir }
      // Preparing caches must import every file, even if selection flags were
      // also supplied, otherwise --changed would learn from a slice.
      if (!preparing) {
        await changedSelection(dependencyOptions)({
          config: runnerConfig!,
          runner,
          emitter,
          cliArgs,
        })
      }
      await recordDependencies(dependencyOptions)({
        config: runnerConfig!,
        runner,
        emitter,
        cliArgs,
      })
    }

    if (!process.env.JAPA_NO_SELECTION_INDEX && recordsCaches && !preparing) {
      const { selectionIndex } = await import('./src/selection_index.js')
      // `--changed` already set the selection; do not let the title index widen it.
      if (!cliArgs.changed) {
        await selectionIndex({ dir: cliArgs.cacheDir })({
          config: runnerConfig!,
          runner,
          emitter,
          cliArgs,
        })
      }
    }

    /**
     * Step 2: Creating an execution plan. The output is the result of
     * applying all the filters and validations.
     */
    const plannedAt = performance.now()
    const { config, reporters, suites, refinerFilters } = await new Planner(runnerConfig!).plan()

    /** Whether the caller asked for less than the whole suite. */
    const requestedSelection = Boolean(
      cliArgs.changed ||
      cliArgs.tests ||
      cliArgs.groups ||
      cliArgs.tags ||
      cliArgs.files ||
      cliArgs.failed
    )

    if (cliArgs.reporterAgent || cliArgs.agentFile) {
      const { setAgentContext } = await import('./src/reporters/context.js')
      const { getSelectionStats } = await import('./src/planning_state.js')
      const stats = getSelectionStats(runnerConfig!)
      setAgentContext(runner, {
        selection: {
          mode: cliArgs.changed
            ? 'changed'
            : stats && stats.planned < stats.collected
              ? 'filtered'
              : 'all',
          planned: stats?.planned ?? 0,
          skipped: stats ? stats.collected - stats.planned : 0,
          ...(stats?.signature ? { signature: stats.signature } : {}),
          ...(requestedSelection && !(stats && stats.planned < stats.collected)
            ? { fallback: true }
            : {}),
          ...selectionDetail(changedOutcome(runnerConfig!)),
        },
        phases: {
          // Process uptime includes application boot before `run()` was called.
          bootMs: Math.round(process.uptime() * 1000),
          importMs: 0,
          testMs: 0,
        },
        cwd: runnerConfig!.cwd,
      })
    }

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

    /**
     * Only run global hooks when we are not listing
     * pinned tests
     */
    // Preparing caches only needs imports. Skipping app setup keeps it cheap and
    // avoids touching databases that the caller did not reset.
    if (!cliArgs.listPinned && !preparing) {
      await globalHooks.setup(runner)
    }

    /**
     * Step 5: Register suites and import test files
     */
    for (let suite of suites) {
      /**
       * Creating and configuring the suite
       */
      debug('initiating suite %s', suite.name)
      executionPlanState.suite = new Suite(suite.name, emitter, config.refiner)
      executionPlanState.retries = suite.retries
      executionPlanState.timeout = suite.timeout
      if (typeof suite.configure === 'function') {
        suite.configure(executionPlanState.suite)
      }

      /**
       * Enable bail on the suite and all the layers after the
       * suite when bailLayer is set to "suite"
       */
      if (cliArgs.bail && cliArgs.bailLayer === 'suite') {
        debug('enabling bail mode for the suite %s', suite.name)
        executionPlanState.suite.bail(true)
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
     * Registration is complete. Record the selection index from what was
     * imported, so even a filtered run keeps its entries complete.
     */
    // Parallel workers leave both caches to single-process runs. Six workers
    // queueing on one lock to rewrite the same index stalled the end of the run.
    if (!process.env.JAPA_NO_SELECTION_INDEX && !process.env.JAPA_SPEED_RUN_ID && recordsCaches) {
      const { flushDependencies } = await import('./src/dependencies.js')
      await flushDependencies(emitter)
      const { writeSelectionIndex } = await import('./src/selection_index.js')
      await writeSelectionIndex(runner, runnerConfig!.cwd, { dir: cliArgs.cacheDir }).catch(
        (error) => console.error(`Unable to update the selection index: ${String(error)}`)
      )
    }

    /**
     * `--prepare` builds the selection and dependency caches and exits without
     * running a single test. It exists so an agent entering a repository pays the
     * import cost once instead of a full suite run.
     */
    if (cliArgs.prepareCaches) {
      const { flushDependencies } = await import('./src/dependencies.js')
      await flushDependencies(emitter)
      // Run teardown so app servers and open handlers do not keep the process
      // alive after cache preparation.
      await globalHooks.teardown(null, runner)
      const summary = { event: 'prepare', prepared: true }
      console.log(cliArgs.reporterAgent ? JSON.stringify(summary) : 'Prepared selection caches')
      // Applications can keep servers or sockets alive; --force-exit makes
      // one-shot cache preparation terminate cleanly.
      if (config.forceExit) process.exit(0)
      return
    }

    /**
     * Exit early when there are one or more pinned tests
     */
    if (cliArgs.listPinned) {
      printPinnedTests(runner)
      if (config.forceExit) {
        debug('force exiting process')
        process.exit()
      }
      return
    }

    if (cliArgs.reporterAgent || cliArgs.agentFile) {
      const { setAgentContext } = await import('./src/reporters/context.js')
      const { getAgentContext } = await import('./src/reporters/context.js')
      const phases = getAgentContext(runner).phases ?? { bootMs: 0, importMs: 0, testMs: 0 }
      setAgentContext(runner, {
        phases: { ...phases, importMs: Math.round(performance.now() - plannedAt) },
      })
    }

    /**
     * Onto execution phase
     */
    executionPlanState.phase = 'executing'

    /**
     * Monitor for unhandled erorrs and rejections
     */
    exceptionsManager.monitor()

    /**
     * Record failing tests when a baseline comparison may need them. Collected
     * during the run because `runner:end` fires before the summary is read.
     */
    const runFailures =
      cliArgs.allowKnownFailures || cliArgs.updateBaseline
        ? await (async () => {
            const { collectFailures } = await import('./src/failure_baseline.js')
            return collectFailures(emitter, runnerConfig!.cwd)
          })()
        : undefined

    const execStartedAt = performance.now()
    await runner.start()
    await runner.exec()
    await globalHooks.teardown(null, runner)
    const nonTestErrors = Boolean(runFailures?.hasNonTestError()) || exceptionsManager.hasErrors

    if (cliArgs.reporterAgent || cliArgs.agentFile) {
      const { setAgentContext, getAgentContext } = await import('./src/reporters/context.js')
      const phases = getAgentContext(runner).phases ?? { bootMs: 0, importMs: 0, testMs: 0 }
      setAgentContext(runner, {
        phases: { ...phases, testMs: Math.round(performance.now() - execStartedAt) },
        ...(nonTestErrors ? { nonTestErrors: true } : {}),
      })
    }

    /**
     * Resolve the baseline before reporters print the summary, so the summary can
     * say how many failures were expected. The write for `--update-baseline` is
     * awaited here too, before anything reads the file back.
     */
    let onlyKnownFailures = false
    if ((cliArgs.allowKnownFailures || cliArgs.updateBaseline) && runFailures) {
      const {
        readBaseline,
        diffFailures,
        updateBaseline,
        baselineFile,
        plannedSuites,
        newFailureList,
      } = await import('./src/failure_baseline.js')
      const file = baselineFile(runnerConfig!.cwd)
      /**
       * Never write a baseline from a partial selection: it would erase every
       * failure outside the slice. Naming suites is not partial; only those
       * suites' entries change. Managed workers never write; the coordinator
       * merges all shards once.
       */
      const isFullRun =
        !process.env.JAPA_SPEED_RUN_ID &&
        !cliArgs.listPinned &&
        !cliArgs.failed &&
        !cliArgs.changed &&
        !cliArgs.bail &&
        !runFailures.hasPinned() &&
        !filters.shard &&
        !filters.tests?.length &&
        !filters.groups?.length &&
        !filters.tags?.length &&
        !filters.files?.length
      const ranSuites = plannedSuites(runnerConfig!)
      const canUpdateBaseline = isFullRun && !nonTestErrors
      if (cliArgs.updateBaseline && canUpdateBaseline) {
        const update = await updateBaseline(file, runFailures.failures, ranSuites)
        if (update.added.length && update.removed.length) {
          warn(
            `Baseline changed in both directions (${update.added.length} added, ` +
              `${update.removed.length} no longer failing). Rerun on a quiet machine ` +
              'if that was unexpected.'
          )
        }
      } else if (cliArgs.updateBaseline && !process.env.JAPA_SPEED_RUN_ID) {
        warn(
          nonTestErrors
            ? 'Baseline not updated: the run had setup or teardown errors.'
            : 'Baseline not updated: --update-baseline requires a full run ' +
                '(no test, file, group, tag, changed or failed filter, no bail and no shard; ' +
                'naming suites is fine).'
        )
      }
      if (cliArgs.allowKnownFailures) {
        const baseline = await readBaseline(file)
        const {
          new: fresh,
          known,
          fixed,
        } = diffFailures(baseline, runFailures.failures, {
          fullRun: isFullRun && !nonTestErrors,
          suites: ranSuites,
        })
        onlyKnownFailures = fresh.length === 0 && !nonTestErrors
        if (fixed.length && !cliArgs.reporterAgent && !cliArgs.agentFile) {
          warn(
            `${fixed.length} baseline ${fixed.length === 1 ? 'entry' : 'entries'} did not fail; ` +
              '--update-baseline on a full run will mark them as passing; it does not remove them.'
          )
        }
        if (cliArgs.reporterAgent || cliArgs.agentFile) {
          const { setAgentContext } = await import('./src/reporters/context.js')
          setAgentContext(runner, {
            baseline: {
              known: known.length,
              new: fresh.length,
              fixed: fixed.length,
              ...(fresh.length ? { newFailures: newFailureList(fresh) } : {}),
            },
            ...(nonTestErrors ? { nonTestErrors: true } : {}),
          })
        }
      }
    }

    await runner.end()
    if (!process.env.JAPA_SPEED_RUN_ID) {
      const { flushDependencies } = await import('./src/dependencies.js')
      await flushDependencies(emitter)
    }

    /**
     * Print unhandled errors
     */
    await exceptionsManager.report()

    const summary = runner.getSummary()

    /**
     * A run whose only failures are recorded in the baseline exits 0, so a suite
     * with known red tests is usable in CI and from agents.
     */
    const processFailure = Boolean(runFailures?.hasNonTestError()) || exceptionsManager.hasErrors
    if ((summary.hasError && !onlyKnownFailures) || processFailure) {
      debug(
        'updating exit code to 1. summary.hasError %s, process.hasError %s',
        summary.hasError,
        processFailure
      )
      process.exitCode = 1
    }
    if (config.forceExit) {
      debug('force exiting process')
      process.exit()
    }
  } catch (error) {
    debug('error running tests %O', error)
    await globalHooks.teardown(error, runner)
    const { ErrorsPrinter } = await import('@japa/errors-printer')
    const printer = new ErrorsPrinter()
    await printer.printError(error)

    /**
     * Print unhandled errors in case the code inside
     * the try block never got triggered
     */
    await exceptionsManager.report()

    /**
     * Under the agent reporter, reserve exit code 2 for setup/planning failures so
     * a harness can tell "tests failed" from "the command or config is wrong".
     */
    process.exitCode = cliArgs.reporterAgent || cliArgs.agentFile ? 2 : 1
    if (runnerConfig!.forceExit) {
      debug('force exiting process')
      process.exit()
    }
  }
}

export const timeTravel = test.macro(($test, durationOrTime: string | number | Date) => {
  $test.cleanup(() => {
    dateTimeDoubles.reset()
  })
  dateTimeDoubles.travelTo(durationOrTime)
})

export const freezeTime = test.macro(($test, date?: Date) => {
  $test.cleanup(() => {
    dateTimeDoubles.reset()
  })
  dateTimeDoubles.freeze(date)
})
