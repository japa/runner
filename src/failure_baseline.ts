/*
 * @japa/runner
 *
 * (c) Japa
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { withCacheLock } from './cache_lock.js'
import { dirname, relative, resolve } from 'node:path'
import debug from './debug.js'

/**
 * A known-failing test, keyed by suite, group, file and expanded title. The key
 * is stable across runs and across worker assignment, so a baseline committed to
 * a repository still matches after the suite is sharded.
 */
export type BaselineEntry = {
  suite: string
  group?: string
  file: string
  title: string
  /** Consecutive full runs in which this failure appeared. */
  consecutive?: number
  /** Last time the entry was observed failing. */
  updatedAt?: string
}

export type Baseline = {
  version: 1 | 2
  failures: BaselineEntry[]
}

export function baselineFile(cwd: string, file?: string) {
  return resolve(cwd, file ?? 'japa.baseline.json')
}

function keyOf(entry: BaselineEntry) {
  return `${entry.suite}\u0000${entry.group ?? ''}\u0000${entry.file}\u0000${entry.title}`
}

export function parseBaseline(value: unknown): Baseline {
  if (
    !value ||
    typeof value !== 'object' ||
    !('version' in value) ||
    (value.version !== 1 && value.version !== 2)
  ) {
    return { version: 2, failures: [] }
  }
  const failures = (value as Baseline).failures
  if (!Array.isArray(failures)) return { version: 2, failures: [] }
  return {
    version: 2,
    failures: failures.filter((entry): entry is BaselineEntry =>
      Boolean(
        entry &&
        typeof entry === 'object' &&
        typeof entry.suite === 'string' &&
        typeof entry.file === 'string' &&
        typeof entry.title === 'string' &&
        (!('group' in entry) || typeof entry.group === 'string')
      )
    ),
  }
}

export async function readBaseline(file: string): Promise<Baseline> {
  try {
    return parseBaseline(JSON.parse(await readFile(file, 'utf8')))
  } catch (error) {
    debug('ignoring unavailable failure baseline %s: %O', file, error)
    return { version: 2, failures: [] }
  }
}

export async function writeBaseline(file: string, baseline: Baseline) {
  await mkdir(dirname(file), { recursive: true })
  const temporary = `${file}.${process.pid}.tmp`
  const failures = [...baseline.failures].sort((a, b) => keyOf(a).localeCompare(keyOf(b)) || 0)
  try {
    await writeFile(temporary, `${JSON.stringify({ version: 2, failures }, null, 2)}\n`)
    await rename(temporary, file)
  } finally {
    await rm(temporary, { force: true }).catch(() => {})
  }
}

/**
 * Collect this run's failing tests in baseline form. Attach before the run
 * starts; the returned function detaches the listener. Suite and group errors
 * are tracked separately: they must never be suppressed by a known-failure
 * baseline, because they usually mean setup or teardown did not complete.
 */
export function collectFailures(
  emitter: {
    on(event: 'test:end' | 'group:end' | 'suite:end', handler: (payload: any) => void): () => void
  },
  cwd: string
) {
  const failures: BaselineEntry[] = []
  let nonTestError = false
  let pinned = false
  const stopTest = emitter.on('test:end', (payload) => {
    if (payload.isPinned) pinned = true
    if (!payload.hasError) return
    const file = payload.meta?.fileName
    if (typeof file !== 'string') return
    failures.push({
      suite: String(payload.meta?.suite?.name ?? 'default'),
      group: payload.meta?.group?.title,
      file: relative(cwd, file).split('\\').join('/'),
      title: payload.title.expanded,
    })
  })
  const stopGroup = emitter.on('group:end', (payload) => {
    if (payload.errors?.length) nonTestError = true
  })
  const stopSuite = emitter.on('suite:end', (payload) => {
    if (payload.errors?.length) nonTestError = true
  })
  return {
    failures,
    hasNonTestError: () => nonTestError,
    hasPinned: () => pinned,
    stop() {
      stopTest()
      stopGroup()
      stopSuite()
    },
  }
}

/**
 * Merge this run's failures into the previous baseline.
 *
 * Entries that fail again gain a consecutive count; entries that passed stay in
 * the file with `consecutive: 0` so a later run can still recognise them and so
 * the UI can report them as passing. `added` and `removed` describe the
 * disagreement in both directions, which is the signal that a run may be noisy.
 */
export function mergeBaseline(
  previous: Baseline,
  observed: BaselineEntry[],
  now = new Date().toISOString(),
  suites?: readonly string[]
): { baseline: Baseline; added: BaselineEntry[]; removed: BaselineEntry[] } {
  // A run of some suites says nothing about the others; their entries stay as they are.
  const inScope = (entry: BaselineEntry) => !suites || suites.includes(entry.suite)
  const untouched = previous.failures.filter((entry) => !inScope(entry))
  const existing = new Map(previous.failures.map((entry) => [keyOf(entry), entry]))
  const seen = new Set<string>()
  const failures: BaselineEntry[] = []
  const added: BaselineEntry[] = []

  for (const entry of observed) {
    const key = keyOf(entry)
    // Retries may report the same failure more than once in a single run.
    if (seen.has(key)) continue
    seen.add(key)
    const old = existing.get(key)
    const merged: BaselineEntry = {
      suite: entry.suite,
      ...(entry.group ? { group: entry.group } : {}),
      file: entry.file,
      title: entry.title,
      consecutive: (old?.consecutive ?? 0) + 1,
      updatedAt: now,
    }
    if (!old) added.push(merged)
    failures.push(merged)
  }

  const removed = previous.failures.filter((entry) => inScope(entry) && !seen.has(keyOf(entry)))
  for (const entry of removed) {
    failures.push({ ...entry, consecutive: 0 })
  }

  return { baseline: { version: 2, failures: [...failures, ...untouched] }, added, removed }
}

/** Read, merge and write a baseline under an exclusive lock. */
export async function updateBaseline(
  file: string,
  observed: BaselineEntry[],
  suites?: readonly string[]
) {
  return withCacheLock(file, async () => {
    const previous = await readBaseline(file)
    const result = mergeBaseline(previous, observed, undefined, suites)
    await writeBaseline(file, result.baseline)
    return result
  })
}

/**
 * Separate tests this run failed from failures the baseline already knows.
 *
 * `new` is what a caller acts on; `known` and `fixed` are informational. A test
 * missing from this run is never reported as fixed, because partial selections
 * and shards only ever see a slice of the suite.
 */
export function diffFailures(
  baseline: Baseline,
  failures: BaselineEntry[],
  options: { fullRun?: boolean; suites?: readonly string[] } = {}
): { new: BaselineEntry[]; known: BaselineEntry[]; fixed: BaselineEntry[] } {
  const expected = new Set(baseline.failures.map(keyOf))
  const observed = new Map<string, BaselineEntry>()
  for (const failure of failures) observed.set(keyOf(failure), failure)
  const seen = new Set(observed.keys())
  const fresh: BaselineEntry[] = []
  const known: BaselineEntry[] = []
  for (const failure of observed.values()) {
    ;(expected.has(keyOf(failure)) ? known : fresh).push(failure)
  }
  // A slice cannot tell a passing test from a test that was never selected.
  const fixed =
    options.fullRun === false
      ? []
      : baseline.failures.filter(
          (entry) =>
            !seen.has(keyOf(entry)) && (!options.suites || options.suites.includes(entry.suite))
        )
  return { new: fresh, known, fixed }
}

/** The suites a run covers: the configured ones, narrowed by a suite filter. */
export function plannedSuites(config: {
  suites?: { name: string }[]
  filters?: { suites?: string[] }
}) {
  const names = config.suites ? config.suites.map((suite) => suite.name) : ['default']
  const only = config.filters?.suites
  return only?.length ? names.filter((name) => only.includes(name)) : names
}

/** New failures named in an agent summary; the count says how many were left out. */
export const MAX_NEW_FAILURES = 20

export function newFailureList(entries: Pick<BaselineEntry, 'file' | 'title'>[]) {
  return entries.slice(0, MAX_NEW_FAILURES).map(({ file, title }) => ({ file, title }))
}
