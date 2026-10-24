/*
 * @japa/runner
 *
 * (c) Japa
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { spawn, type ChildProcess, type StdioOptions } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { availableParallelism, setPriority } from 'node:os'
import {
  gitChangedPaths,
  mapPolicy,
  readDependencyMap,
  selectChanged,
  selectionDetail,
  type ChangedSelection,
  type SelectionPolicy,
} from './dependencies.js'
import { warn } from './helpers.js'
import { cacheDir, dependencyFile } from './cache_paths.js'
import debug from './debug.js'
import { getFailedTests, cacheFailedTests } from './plugins/retry_cache.js'
import {
  baselineFile,
  newFailureList,
  updateBaseline,
  type BaselineEntry,
} from './failure_baseline.js'
import { withCacheLock, withRunLock } from './cache_lock.js'
import {
  blendDuration,
  historyFile,
  parseHistory,
  readHistory,
  writeHistory,
  type DurationMap,
} from './duration_history.js'

export type ParallelOptions = {
  command: string
  args?: string[]
  cwd?: string
  workers?: number | 'auto'
  historyFile?: string
  env?: NodeJS.ProcessEnv
  workerEnv?: (worker: number, total: number) => NodeJS.ProcessEnv
  signal?: AbortSignal
  stdio?: StdioOptions
  /** Merge worker failures and write the baseline from the coordinator. */
  updateBaseline?: boolean
}

export type ParallelResult = {
  exitCode: number
  historyUpdated: boolean
  baselineUpdated: boolean
  baselineChanges?: { added: number; removed: number }
  /** Why `updateBaseline` did not write, worded for the user. */
  baselineSkipped?: string
  workers: { worker: number; exitCode: number; signal?: NodeJS.Signals; error?: string }[]
}

function optionValue(args: string[], name: string) {
  for (let index = 0; index < args.length; index++) {
    const arg = args[index]
    if (arg.startsWith(`${name}=`)) return arg.slice(name.length + 1)
    if (arg === name) return args[index + 1]
  }
  return undefined
}

/**
 * Freeze one changed-file selection for every worker. The coordinator has no app
 * config, so it applies the policy the map was written with; workers check it.
 */
async function changedFiles(cwd: string, args: string[], options: { quiet?: boolean } = {}) {
  const changed = optionValue(args, '--changed')
  if (!changed) return undefined
  const paths =
    changed === 'auto'
      ? await gitChangedPaths(cwd)
      : changed
          .split(',')
          .map((path) => path.trim())
          .filter(Boolean)
  const map = await readDependencyMap(dependencyFile(cwd, optionValue(args, '--cache-dir')))
  const outcome = selectChanged(map, paths, 'unknown')
  if (options.quiet) return { outcome, map }
  if (outcome.kind === 'full') {
    warn(`[japa-parallel] --changed is running the full suite: ${outcome.reason}`)
  } else if (outcome.kind === 'heuristic') {
    warn(
      `[japa-parallel] --changed guessed tests by name for ${outcome.guessed.length} path(s) ` +
        'no test imports. Run the full suite before relying on it.'
    )
  }
  return { outcome, map }
}

/** What every worker narrows to; `index.ts` reads it from `JAPA_SPEED_SELECTION`. */
export type WorkerSelection = {
  only: string[]
  /** Test files the map recorded; any other file is kept. */
  onlyWithin: string[]
  /** The policy the selection was made with; a worker whose config differs runs its whole shard. */
  policy: SelectionPolicy
  /** Changed paths the map never saw; a worker runs its whole shard unless all are test files. */
  pending: string[]
}

const isStringList = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string')

export function isWorkerSelection(value: unknown): value is WorkerSelection {
  if (!value || typeof value !== 'object') return false
  const { only, onlyWithin, policy, pending } = value as Partial<WorkerSelection>
  return (
    isStringList(only) &&
    isStringList(onlyWithin) &&
    isStringList(pending) &&
    Boolean(policy) &&
    typeof policy === 'object'
  )
}

/** Test time an extra worker must take over to pay for booting the app once more. */
const WORKER_BREAK_EVEN_MS = 10_000

/** Workers yield to the editor, the dev server and anything else the machine runs. */
const WORKER_PRIORITY = 10

/** The most workers an automatic pool starts; `JAPA_MAX_WORKERS` replaces the default. */
function maxAutoWorkers() {
  const raw = process.env.JAPA_MAX_WORKERS
  if (raw === undefined || raw === '') return Math.max(1, Math.min(8, availableParallelism() - 2))
  const value = Number(raw)
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`JAPA_MAX_WORKERS must be a positive integer, got "${raw}"`)
  }
  return value
}

/**
 * Recorded test time of the files a run will plan, or all of them when `only` is unset,
 * within the named suites when there are any.
 */
export function estimateDurationMs(
  durations: Record<string, number>,
  only?: readonly string[],
  suites?: readonly string[]
) {
  const entries = Object.entries(durations).filter(
    ([key]) => !suites?.length || suites.includes(key.slice(0, key.indexOf(':')))
  )
  if (!entries.length) return undefined
  if (!only) return entries.reduce((total, [, ms]) => total + ms, 0)
  const byFile = new Map<string, number>()
  for (const [key, ms] of entries) {
    const file = key.slice(key.indexOf(':') + 1)
    byFile.set(file, (byFile.get(file) ?? 0) + ms)
  }
  const known = [...byFile.values()].sort((a, b) => a - b)
  const median = known[Math.floor(known.length / 2)] ?? 0
  return only.reduce((total, file) => total + (byFile.get(file) ?? median), 0)
}

function replaceAgentFile(args: string[], file: string) {
  const replaced: string[] = []
  for (let index = 0; index < args.length; index++) {
    const arg = args[index]
    if (arg.startsWith('--agent-file=')) {
      replaced.push(`--agent-file=${file}`)
    } else if (arg === '--agent-file') {
      replaced.push(`--agent-file=${file}`)
      index++
    } else {
      replaced.push(arg)
    }
  }
  return replaced
}

function sumField(records: Record<string, unknown>[], key: string) {
  return records.reduce(
    (total, record) => total + (typeof record[key] === 'number' ? record[key] : 0),
    0
  )
}

function isFailureName(value: unknown): value is { file: string; title: string } {
  if (!value || typeof value !== 'object') return false
  const { file, title } = value as Record<string, unknown>
  return typeof file === 'string' && typeof title === 'string'
}

function workerFallbackReason(selections: Record<string, unknown>[]) {
  for (const item of selections) {
    if (typeof item.fallbackReason === 'string') return item.fallbackReason
  }
  return undefined
}

export async function mergeAgentReports(
  files: string[],
  target: string,
  outcome: ChangedSelection | undefined,
  workers: { exitCode: number; error?: string }[]
) {
  const lines: string[] = []
  const summaries: Record<string, unknown>[] = []
  for (const file of files) {
    const text = await readFile(file, 'utf8').catch(() => '')
    for (const line of text.split('\n')) {
      if (!line.trim()) continue
      try {
        const record = JSON.parse(line) as Record<string, unknown>
        if (record.event === 'summary') summaries.push(record)
        else lines.push(line)
      } catch {
        // Ignore a malformed worker line; the rest of the report is still useful.
      }
    }
  }
  if (!lines.length && !summaries.length) return

  let summary: Record<string, unknown> | undefined
  if (summaries.length) {
    const selections = summaries
      .map((item) => item.selection)
      .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
    const signatures = selections
      .map((item) => item.signature)
      .filter((item) => typeof item === 'string')
    const phases = summaries
      .map((item) => item.phases)
      .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
    const baselines = summaries
      .map((item) => item.baseline)
      .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
    const fallbackReason = workerFallbackReason(selections)
    const newFailures = baselines.flatMap((item) =>
      Array.isArray(item.newFailures) ? item.newFailures.filter(isFailureName) : []
    )
    const errorGroups = new Map<string, number>()
    for (const item of summaries) {
      const groups = Array.isArray(item.errorGroups) ? item.errorGroups : []
      for (const group of groups) {
        if (!group || typeof group !== 'object') continue
        const typed = group as Record<string, unknown>
        if (typeof typed.message !== 'string' || typeof typed.count !== 'number') continue
        errorGroups.set(typed.message, (errorGroups.get(typed.message) ?? 0) + typed.count)
      }
    }
    summary = {
      event: 'summary',
      ...Object.fromEntries(
        ['total', 'passed', 'failed', 'skipped', 'todo', 'regression'].map((key) => [
          key,
          sumField(summaries, key),
        ])
      ),
      // Workers run side by side, so the slowest one is the run's duration.
      durationMs: Math.max(
        0,
        ...summaries.map((item) => (typeof item.durationMs === 'number' ? item.durationMs : 0))
      ),
      // A worker that wrote no summary, or failed outside its tests, is not ok.
      ok:
        summaries.length === workers.length &&
        workers.every((worker) => !worker.error) &&
        summaries.every((item) => item.ok === true),
      ...(summaries.length < workers.length
        ? { missingSummaries: workers.length - summaries.length }
        : {}),
      ...(summaries.some((item) => item.processError === true) ||
      workers.some((worker) => worker.error)
        ? { processError: true }
        : {}),
      ...(selections.length
        ? {
            selection: {
              mode: selections.every((item) => item.mode === selections[0].mode)
                ? selections[0].mode
                : 'mixed',
              planned: sumField(selections, 'planned'),
              skipped: sumField(selections, 'skipped'),
              ...(signatures.length === selections.length
                ? {
                    signature: createHash('sha256')
                      .update([...signatures].sort().join('\n'))
                      .digest('hex')
                      .slice(0, 16),
                  }
                : {}),
              ...(selections.some((item) => item.fallback === true) || outcome?.kind === 'full'
                ? { fallback: true }
                : {}),
              ...selectionDetail(outcome),
              // A worker that settled a pending path as "not a test" fell back on its own.
              ...(outcome?.kind !== 'full' && fallbackReason ? { fallbackReason } : {}),
            },
          }
        : {}),
      ...(phases.length
        ? {
            phases: {
              bootMs: Math.max(
                ...phases.map((item) => (typeof item.bootMs === 'number' ? item.bootMs : 0))
              ),
              importMs: sumField(phases, 'importMs'),
              testMs: sumField(phases, 'testMs'),
            },
          }
        : {}),
      ...(baselines.length
        ? {
            baseline: {
              known: sumField(baselines, 'known'),
              new: sumField(baselines, 'new'),
              fixed: sumField(baselines, 'fixed'),
              ...(newFailures.length ? { newFailures: newFailureList(newFailures) } : {}),
            },
          }
        : {}),
      // Known-only when some shard failed and every failing shard failed on known tests only.
      ...(summaries.length === workers.length &&
      summaries.some((item) => item.ok !== true) &&
      summaries.every((item) => item.ok === true || item.knownOnly === true)
        ? { knownOnly: true }
        : {}),
      ...(summaries.some((item) => item.nonTestErrors === true) ? { nonTestErrors: true } : {}),
      ...(errorGroups.size
        ? {
            errorGroups: [...errorGroups].map(([message, count]) => ({ message, count })),
          }
        : {}),
    }
  }

  await mkdir(join(target, '..'), { recursive: true })
  await writeFile(
    target,
    `${[...lines, ...(summary ? [JSON.stringify(summary)] : [])].join('\n')}\n`
  )
}

/**
 * A narrow selection usually costs less than the extra application boots a pool
 * would pay. With recorded durations the count follows the planned test time;
 * without them, title/file/tag/group/change/failed filters run on one worker.
 */
export function autoWorkerCount(args: string[], estimatedMs?: number) {
  if (estimatedMs !== undefined) {
    return Math.max(1, Math.min(maxAutoWorkers(), Math.floor(estimatedMs / WORKER_BREAK_EVEN_MS)))
  }
  const narrow = args.some(
    (arg) =>
      arg.startsWith('--tests') ||
      arg.startsWith('--groups') ||
      arg.startsWith('--tags') ||
      arg.startsWith('--files') ||
      arg.startsWith('--failed') ||
      arg.startsWith('--changed')
  )
  return narrow ? 1 : Math.min(4, availableParallelism(), maxAutoWorkers())
}

/** Only a change selection or the whole suite has a plan the history can price. */
function pricedEstimate(
  args: string[],
  outcome: ChangedSelection | undefined,
  durations: Record<string, number>
) {
  const filtered = args.some((arg) => /^--(tests|groups|tags|files|failed)/.test(arg))
  if (outcome === undefined && filtered) return undefined
  // Positional arguments that name a recorded suite (`unit functional`) narrow the run.
  const recorded = new Set(Object.keys(durations).map((key) => key.slice(0, key.indexOf(':'))))
  const suites = args.filter((arg) => !arg.startsWith('-') && recorded.has(arg))
  return estimateDurationMs(
    durations,
    outcome && outcome.kind !== 'full' ? outcome.files : undefined,
    suites
  )
}

/**
 * The worker count `--workers=auto` would pick for this command, without running it.
 * Wrappers use it to stay in one process when a pool would not pay for itself.
 */
export async function plannedWorkerCount(options: {
  args: string[]
  cwd?: string
  historyFile?: string
}) {
  const cwd = await realpath(options.cwd ?? process.cwd())
  const history = await readHistory(historyFile(cwd, options.historyFile), cwd)
  const changed = await changedFiles(cwd, options.args, { quiet: true })
  return autoWorkerCount(
    options.args,
    pricedEstimate(options.args, changed?.outcome, history.durations)
  )
}

/**
 * Launch shards against one frozen history snapshot and promote results together.
 *
 * Worker N of every run gets the same resources (`JAPA_WORKER_ID` decides an app's
 * database, port and so on), so two pools in one project would share them. A second
 * run waits for the first. `JAPA_PARALLEL_LOCK=0` opts out for apps that isolate runs
 * themselves.
 */
export async function runParallel(options: ParallelOptions): Promise<ParallelResult> {
  if (process.env.JAPA_PARALLEL_LOCK === '0') return runPool(options)
  const cwd = await realpath(options.cwd ?? process.cwd())
  try {
    return await withRunLock(
      join(cacheDir(cwd), 'parallel.lock'),
      () => runPool(options),
      (owner) => warn(`[japa-parallel] waiting for the run in process ${owner} to finish`),
      options.signal
    )
  } catch (error) {
    // Cancelled while another run held the lock: nothing ran.
    if (!options.signal?.aborted || options.signal.reason !== error) throw error
    return {
      exitCode: 130,
      historyUpdated: false,
      baselineUpdated: false,
      ...(options.updateBaseline ? { baselineSkipped: 'the run was cancelled' } : {}),
      workers: [],
    }
  }
}

async function runPool(options: ParallelOptions): Promise<ParallelResult> {
  if (!options.command) throw new Error('A test command is required')
  if (options.args?.some((arg) => arg === '--shard' || arg.startsWith('--shard='))) {
    throw new Error('The coordinator assigns --shard automatically; remove it from the command')
  }
  const cwd = await realpath(options.cwd ?? process.cwd())
  const file = historyFile(cwd, options.historyFile)
  const history = await readHistory(file, cwd)
  const failed = await getFailedTests(cwd).catch(() => ({}) as { tests?: string[] })
  const args = options.args ?? []
  const changed = await changedFiles(cwd, args)
  const outcome = changed?.outcome
  const selection: WorkerSelection | undefined =
    changed && outcome && outcome.kind !== 'full'
      ? {
          only: outcome.files,
          onlyWithin: Object.keys(changed.map.files),
          policy: mapPolicy(changed.map),
          pending: outcome.pending ?? [],
        }
      : undefined
  const count =
    options.workers === 'auto'
      ? autoWorkerCount(args, pricedEstimate(args, outcome, history.durations))
      : (options.workers ?? Math.min(4, availableParallelism()))
  if (!Number.isInteger(count) || count < 1 || count > 256)
    throw new Error('workers must be an integer between 1 and 256')
  if (count > availableParallelism()) {
    warn(
      `[japa-parallel] ${count} workers on ${availableParallelism()} CPUs: each worker boots the ` +
        'app, so extra workers usually make the run slower, not faster.'
    )
  }
  const agentReport = optionValue(options.args ?? [], '--agent-file')
  if (agentReport) await writeFile(resolve(cwd, agentReport), '').catch(() => {})
  const runId = randomUUID()
  // Evaluate environment callbacks before spawning anything, so a configuration
  // error cannot leave a partially launched pool behind.
  const environments = Array.from(
    { length: count },
    (_, i) => options.workerEnv?.(i + 1, count) ?? {}
  )
  await mkdir(dirname(file), { recursive: true })
  const directory = await mkdtemp(join(dirname(file), 'run-'))
  const snapshot = join(directory, 'snapshot.json')
  const children: ChildProcess[] = []
  let aborted = false
  let escalation: Promise<void> | undefined
  const kill = (child: ChildProcess, signal: NodeJS.Signals) => {
    if (!child.pid) return
    try {
      if (process.platform === 'win32') child.kill(signal)
      else process.kill(-child.pid, signal)
    } catch (error) {
      debug('unable to signal worker: %O', error)
    }
  }
  const abort = () => {
    if (aborted) return
    aborted = true
    for (const child of children) kill(child, 'SIGTERM')
    if (!children.length) return
    escalation = new Promise((done) =>
      setTimeout(() => {
        for (const child of children) kill(child, 'SIGKILL')
        done()
      }, 1000)
    )
  }

  try {
    await writeHistory(snapshot, { ...history, runId, failedTests: failed.tests ?? [] })
    const selectionFile = join(directory, 'selection.json')
    if (selection) await writeFile(selectionFile, JSON.stringify(selection))
    options.signal?.addEventListener('abort', abort, { once: true })
    if (options.signal?.aborted) abort()
    const workers = await Promise.all(
      Array.from(
        { length: count },
        (
          _,
          index
        ): ParallelResult['workers'][number] | Promise<ParallelResult['workers'][number]> => {
          const worker = index + 1
          if (aborted)
            return {
              worker,
              exitCode: 130,
              error: 'Cancelled',
            } satisfies ParallelResult['workers'][number]
          return new Promise<ParallelResult['workers'][number]>((done) => {
            let child: ChildProcess
            try {
              const agentFile = agentReport ? join(directory, `agent-${worker}.jsonl`) : undefined
              child = spawn(
                options.command,
                [
                  ...(agentFile
                    ? replaceAgentFile(options.args ?? [], agentFile)
                    : (options.args ?? [])),
                  `--shard=${worker}/${count}`,
                ],
                {
                  cwd,
                  detached: process.platform !== 'win32',
                  stdio: options.stdio ?? 'inherit',
                  env: {
                    ...process.env,
                    ...options.env,
                    ...environments[index],
                    JAPA_WORKER_ID: String(worker),
                    JAPA_WORKER_COUNT: String(count),
                    JAPA_SPEED_RUN_ID: runId,
                    JAPA_SPEED_SNAPSHOT: snapshot,
                    JAPA_SPEED_OUTPUT: join(directory, `${worker}.json`),
                    ...(selection ? { JAPA_SPEED_SELECTION: selectionFile } : {}),
                  },
                }
              )
              children.push(child)
              if (child.pid !== undefined) {
                try {
                  setPriority(child.pid, WORKER_PRIORITY)
                } catch {
                  // The worker already exited, or the platform refused: it runs at normal priority.
                }
              }
            } catch (error) {
              done({ worker, exitCode: 1, error: String(error) })
              return
            }
            child.once('error', (error) => done({ worker, exitCode: 1, error: error.message }))
            child.once('close', (code, signal) =>
              done({ worker, exitCode: code ?? 1, ...(signal ? { signal } : {}) })
            )
          })
        }
      )
    )
    if (escalation) await escalation
    const mergeReports = async () => {
      if (!agentReport) return
      await mergeAgentReports(
        Array.from({ length: count }, (_, index) => join(directory, `agent-${index + 1}.jsonl`)),
        resolve(cwd, agentReport),
        outcome,
        workers
      ).catch((error) => debug('unable to merge agent reports: %O', error))
    }
    let exitCode = aborted ? 130 : (workers.find((worker) => worker.exitCode !== 0)?.exitCode ?? 0)
    let historyUpdated = false
    let baselineUpdated = false
    let baselineChanges: { added: number; removed: number } | undefined
    let baselineSkipped: string | undefined
    const baselineFailures: BaselineEntry[] = []
    const estimates: DurationMap = Object.create(null)
    let complete = true
    let fullRun = true
    let validReports = true
    const ranSuites = new Set<string>()
    const failures = new Set<string>()
    if (!aborted) {
      for (const worker of workers) {
        try {
          const raw: unknown = JSON.parse(
            await readFile(join(directory, `${worker.worker}.json`), 'utf8')
          )
          const result = parseHistory(raw, cwd)
          if (
            !raw ||
            typeof raw !== 'object' ||
            !('worker' in raw) ||
            raw.worker !== worker.worker ||
            !('total' in raw) ||
            raw.total !== count ||
            !('complete' in raw) ||
            typeof raw.complete !== 'boolean' ||
            result.runId !== runId
          )
            throw new Error('Invalid coordinated worker result')
          if (!result.failedTests) throw new Error('Missing failed-test worker report')
          if ('processError' in raw && raw.processError === true) {
            worker.error = 'an uncaught error or unhandled rejection reached the worker'
            worker.exitCode = worker.exitCode || 1
            exitCode = exitCode || 1
          }
          for (const title of result.failedTests) failures.add(title)
          if (result.failures) baselineFailures.push(...result.failures)
          complete &&= raw.complete
          fullRun &&= result.fullRun === true
          for (const suite of result.suites ?? []) ranSuites.add(suite)
          for (const [key, duration] of Object.entries(result.durations)) {
            if (Object.hasOwn(estimates, key))
              throw new Error(`Workers reported the same file: ${key}`)
            estimates[key] = duration
          }
        } catch (error) {
          validReports = false
          const missing = (error as NodeJS.ErrnoException).code === 'ENOENT'
          const ended = worker.signal
            ? `was killed by ${worker.signal}`
            : `exited with code ${worker.exitCode}`
          worker.error = missing
            ? `${ended} before writing its report. Its output above says why. Likely causes: ` +
              'an app shutdown waiting on a connection a timed-out test still holds, or a ' +
              'teardown hook that calls process.exit(). Japa writes the report after teardown.'
            : `wrote an unusable report (${String(error)}); is the command running this runner fork?`
          worker.exitCode = worker.exitCode || 1
          exitCode = 1
        }
      }
      await mergeReports()
      if (validReports && !aborted) {
        const identities = baselineFailures.map((failure) => ({
          file: failure.file,
          title: failure.title,
        }))
        await cacheFailedTests([...failures], cwd, identities).catch((error) =>
          debug('unable to update failed-test cache: %O', error)
        )
      }
      // Test failures exit nonzero but still report complete file costs; a
      // signal or missing report does not.
      const finished = workers.every((worker) => !worker.signal && !worker.error)
      if (validReports && finished && complete && !aborted) {
        try {
          await withCacheLock(file, async () => {
            const latest = await readHistory(file, cwd)
            const merged: DurationMap = { ...latest.durations }
            for (const [key, measured] of Object.entries(estimates)) {
              merged[key] = blendDuration(merged[key], measured)
            }
            await writeHistory(file, {
              version: 1,
              cwd,
              durations: merged,
            })
          })
          historyUpdated = true
        } catch {
          // The test result remains authoritative when a best-effort cache fails.
          historyUpdated = false
        }
      }

      // Same gate as timings: a cancelled, partial or unreported run must not
      // replace a committed baseline with a slice of the suite.
      if (options.updateBaseline && validReports && finished && complete && fullRun && !aborted) {
        try {
          const update = await updateBaseline(
            baselineFile(cwd),
            baselineFailures,
            ranSuites.size ? [...ranSuites] : undefined
          )
          baselineChanges = {
            added: update.added.length,
            removed: update.removed.length,
          }
          baselineUpdated = true
        } catch (error) {
          debug('unable to write the failure baseline: %O', error)
          baselineSkipped = `the baseline file could not be written (${String(error)})`
        }
      } else if (options.updateBaseline) {
        baselineSkipped =
          !validReports || !finished
            ? 'a worker did not finish or report'
            : !fullRun
              ? 'the run was filtered (tests, files, groups, tags, changed or failed)'
              : 'a suite or group hook failed, or an error was thrown outside a test'
      }
    }
    if (aborted && options.updateBaseline) baselineSkipped = 'the run was cancelled'
    if (aborted) await mergeReports()
    if (escalation) await escalation
    return {
      exitCode: aborted ? 130 : exitCode,
      historyUpdated,
      baselineUpdated,
      ...(baselineChanges ? { baselineChanges } : {}),
      ...(baselineSkipped ? { baselineSkipped } : {}),
      workers,
    }
  } finally {
    options.signal?.removeEventListener('abort', abort)
    await rm(directory, { recursive: true, force: true })
  }
}
