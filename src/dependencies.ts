/*
 * @japa/runner
 *
 * (c) Japa
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { execFile } from 'node:child_process'
import { readFile, realpath } from 'node:fs/promises'
import * as nodeModule from 'node:module'
import { promisify } from 'node:util'
import { pathToFileURL } from 'node:url'
import { join, relative, resolve } from 'node:path'
import { cacheDir, dependencyFile } from './cache_paths.js'
import { fileURLToPath } from 'node:url'
import debug from './debug.js'
import { withCacheLock } from './cache_lock.js'
import { setSelectionPlan } from './planning_state.js'
import { warn } from './helpers.js'
import { FilesManager } from './files_manager.js'
import type { HeuristicRule, NormalizedConfig, PluginFn, SelectionOptions } from './types.js'

/**
 * Files each test file depends on, captured while it imports. Built by
 * `recordDependencies`, consumed by `changedSelection`.
 */
export type DependencyMap = {
  version: 3
  /** True only when the last complete recording run saw every import it expected. */
  complete?: boolean
  /** Test file (relative) -> project files its own imports and resolvers reach (relative). */
  files: Record<string, string[]>
  /**
   * Project files a package loaded before the first test file (config, providers,
   * preloads, routes) and the project files they import. A change to one that no test
   * reaches can affect any test.
   */
  boot: string[]
  /**
   * Project files a package imported after boot (a router loading a controller, an
   * event emitter loading a listener) that no resolver claims. The walk stops at
   * packages, so no test is known to reach them and a change to one runs everything.
   */
  bridged: string[]
  /** Present when `selection.heuristic` is on; the rules it configured. */
  heuristic?: HeuristicRule[]
  /** `selection.global` when the map was written. */
  global?: string[]
}

/** The selection config `selectChanged` applies; the current config wins over the map's. */
export type SelectionPolicy = { heuristic?: HeuristicRule[]; global?: string[] }

export function selectionPolicy(options: SelectionOptions | undefined): SelectionPolicy {
  const heuristic = options?.heuristic
  return {
    ...(heuristic ? { heuristic: heuristic === true ? [] : heuristic } : {}),
    ...(options?.global?.length ? { global: options.global } : {}),
  }
}

export function mapPolicy(map: DependencyMap): SelectionPolicy {
  return {
    ...(map.heuristic ? { heuristic: map.heuristic } : {}),
    ...(map.global?.length ? { global: map.global } : {}),
  }
}

export function samePolicy(a: SelectionPolicy, b: SelectionPolicy) {
  return JSON.stringify([a.heuristic, a.global]) === JSON.stringify([b.heuristic, b.global])
}

/** What `--changed` decided to run. */
export type ChangedSelection =
  /**
   * `pending` are changed paths the map has never seen, left for a caller that knows
   * the configured test files to settle: a new spec runs itself, anything else runs all.
   */
  | { kind: 'exact'; files: string[]; pending?: string[] }
  /** `guessed` are the changed paths placed by name or rule rather than by imports. */
  | { kind: 'heuristic'; files: string[]; guessed: string[]; pending?: string[] }
  | { kind: 'full'; reason: string }

// Only comments that open a line: a `/*` or `//` inside a string (a glob, a URL)
// must never hide a real import, or the graph would be marked complete too early.
const COMMENTS = /^\s*\/\*[\s\S]*?\*\/|^\s*\/\/.*$/gm
const TYPE_ONLY = /\b(?:import|export)\s+type\b[^;]*?\bfrom\s*['"][^'"]+['"]/g
// Relative specifiers only. `#` subpath imports are not counted: TypeScript drops a value
// import used only as a type, and alias imports are where that habit is common, so they
// would mark complete maps incomplete.
const RELATIVE_IMPORT = /(?:\bfrom\s+|\bimport\s*\(|\brequire\s*\(|\bimport\s+)['"]\.{1,2}\//

/**
 * Relative imports that should have produced a resolve edge. Type-only imports
 * and specifiers inside comments are erased before Node resolves anything, so
 * counting them would mark a fully recorded graph incomplete.
 */
export function hasRuntimeRelativeImport(source: string) {
  return RELATIVE_IMPORT.test(source.replace(COMMENTS, '').replace(TYPE_ONLY, ''))
}

/** One read per file: a shared dependency is visited once for every test that reaches it. */
function relativeImportChecker() {
  const seen = new Map<string, Promise<boolean>>()
  return (path: string) => {
    let result = seen.get(path)
    if (!result) {
      result = readFile(path, 'utf8').then(hasRuntimeRelativeImport, () => false)
      seen.set(path, result)
    }
    return result
  }
}

type ImportEdges = Map<string, Set<string>>

/** Importer -> imported URLs seen by the resolve hook, once it is registered. */
let processEdges: ImportEdges | undefined
/** Stays true when this Node has no `module.registerHooks`. */
let hookUnavailable = true

const RECORD_EARLY_HINT =
  'If your framework imports app code before configure() (AdonisJS boots providers and ' +
  'preloads first), call recordImportsFromStart() at the top of the test entrypoint, then ' +
  'rerun with --prepare-caches.'

/** What `--changed` decided, per run config; read into the agent summary. */
const outcomes = new WeakMap<object, ChangedSelection>()

export function changedOutcome(config: object) {
  return outcomes.get(config)
}

/** The agent-summary fields for a `--changed` outcome. */
export function selectionDetail(outcome: ChangedSelection | undefined) {
  if (outcome?.kind === 'full') return { fallbackReason: outcome.reason }
  if (outcome?.kind === 'heuristic')
    return { heuristic: true, guessed: outcome.guessed.slice(0, 20) }
  return {}
}

function sampleOf(paths: string[]) {
  return `${paths.slice(0, 3).join(', ')}${paths.length > 3 ? ', ...' : ''}`
}

/** `app/modules/*\/` -> a regex capturing each `*` segment. */
function rulePattern(prefix: string) {
  const escaped = prefix.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '([^/]+)')
  return new RegExp(`^${escaped}`)
}

function stemOf(path: string) {
  const name = path.split('/').pop() ?? path
  return name.replace(/\.[^.]+$/, '').replace(/[._-](spec|test)$/, '')
}

/** Test files a path names: same stem, plus the prefixes the rules map it to. */
function guessTests(path: string, testFiles: string[], rules: HeuristicRule[]) {
  const stem = stemOf(path)
  const prefixes = rules.flatMap((rule) => {
    const match = rulePattern(rule.from).exec(path)
    if (!match) return []
    let index = 1
    return [rule.to.replace(/\*/g, () => match[index++] ?? '*')]
  })
  return testFiles.filter(
    (file) => stemOf(file) === stem || prefixes.some((prefix) => file.startsWith(prefix))
  )
}

/**
 * Pick the test files a set of changed paths can affect.
 *
 * A path reached through a test's imports (or a resolver) selects exactly those tests.
 * A changed test file the map has not recorded yet (`testFiles` are the configured
 * ones) selects itself. A path only boot code reaches, or one nothing reaches, runs
 * the full suite, unless the heuristic is on and can name tests for an unreached path.
 * Running too much is safe and running too little is not, so every doubt widens the run.
 */
/**
 * `testFiles` is every configured test file. Pass `'unknown'` where the config is not
 * loaded (the parallel coordinator): paths nothing reaches then come back as `pending`
 * instead of forcing the full suite.
 */
export function selectChanged(
  map: DependencyMap,
  changed: string[],
  testFiles: string[] | 'unknown' = [],
  policy: SelectionPolicy = mapPolicy(map)
): ChangedSelection {
  if (!Object.keys(map.files).length) {
    return {
      kind: 'full',
      reason: 'no dependency map yet. Run once with --prepare-caches (or a full run).',
    }
  }
  if (map.complete !== true) {
    return { kind: 'full', reason: `the dependency map is incomplete. ${RECORD_EARLY_HINT}` }
  }
  const wanted = [...new Set(changed.map((path) => path.split('\\').join('/')))]
  if (!wanted.length) return { kind: 'full', reason: 'no changed paths were found.' }

  const globalRules = (policy.global ?? []).map(rulePattern)
  const global = wanted.filter((path) => globalRules.some((rule) => rule.test(path)))
  if (global.length) {
    return {
      kind: 'full',
      reason: `${global.length} changed path(s) match selection.global (${sampleOf(global)}).`,
    }
  }
  const bridged = new Set(map.bridged)
  const viaPackage = wanted.filter((path) => bridged.has(path))
  if (viaPackage.length) {
    return {
      kind: 'full',
      reason:
        `${viaPackage.length} changed path(s) are loaded by a package after boot ` +
        `(${sampleOf(viaPackage)}), so no test is known to reach them. A selection ` +
        'resolver can name the tests that do.',
    }
  }

  const reachedBy = new Map<string, string[]>()
  for (const [testFile, dependencies] of Object.entries(map.files)) {
    for (const path of [testFile, ...dependencies]) {
      const tests = reachedBy.get(path)
      if (tests) tests.push(testFile)
      else reachedBy.set(path, [testFile])
    }
  }

  const configured = new Set(testFiles === 'unknown' ? [] : testFiles)
  const selected = new Set<string>()
  const unreached: string[] = []
  for (const path of wanted) {
    const tests = reachedBy.get(path)
    if (tests) tests.forEach((file) => selected.add(file))
    else if (configured.has(path)) selected.add(path)
    else unreached.push(path)
  }
  if (!unreached.length) return { kind: 'exact', files: [...selected] }

  const boot = new Set(map.boot)
  const atBoot = unreached.filter((path) => boot.has(path))
  if (atBoot.length) {
    return {
      kind: 'full',
      reason:
        `${atBoot.length} changed path(s) are loaded at boot and reached by no test's imports ` +
        `(${sampleOf(atBoot)}), so any test can depend on them.`,
    }
  }

  const rules = policy.heuristic
  const unplaced = rules
    ? unreached.filter((path) => {
        const guesses = guessTests(path, Object.keys(map.files), rules)
        guesses.forEach((file) => selected.add(file))
        return !guesses.length
      })
    : unreached
  if (unplaced.length && testFiles === 'unknown') {
    const guessed = unreached.filter((path) => !unplaced.includes(path))
    return guessed.length
      ? { kind: 'heuristic', files: [...selected], guessed, pending: unplaced }
      : { kind: 'exact', files: [...selected], pending: unplaced }
  }
  if (unplaced.length) return unplacedFallback(unplaced)
  return { kind: 'heuristic', files: [...selected], guessed: unreached }
}

function unplacedFallback(unplaced: string[]): ChangedSelection {
  return {
    kind: 'full',
    reason:
      `${unplaced.length} changed path(s) no test file imports (${sampleOf(unplaced)}). ` +
      'Files loaded lazily (controllers, jobs) need a selection resolver.',
  }
}

/**
 * Settle a coordinator's `pending` paths in a worker, which knows the configured test
 * files. Returns the full-suite outcome when one of them is not a test file.
 */
export async function settlePending(
  config: NormalizedConfig,
  pending: string[]
): Promise<ChangedSelection | undefined> {
  if (!pending.length) return undefined
  const configured = new Set(await configuredTestFiles(config, await realpath(config.cwd)))
  const unplaced = pending.filter((path) => !configured.has(path))
  if (!unplaced.length) return undefined
  const outcome = unplacedFallback(unplaced)
  outcomes.set(config, outcome)
  return outcome
}

function registerResolveHook(): ImportEdges | undefined {
  // Node 22.15+/23.5+ ship registerHooks. On older supported versions the
  // dependency map is simply unavailable; --changed then runs everything.
  const hooks = nodeModule as { registerHooks?: typeof nodeModule.registerHooks }
  if (typeof hooks.registerHooks !== 'function') {
    debug('node:module registerHooks is unavailable; dependency recording disabled')
    return undefined
  }
  hookUnavailable = false

  const edges: ImportEdges = new Map()
  hooks.registerHooks({
    resolve(specifier, context, nextResolve) {
      const result = nextResolve(specifier, context)
      const parent = context.parentURL?.split('?')[0]
      const child = result?.url?.split('?')[0]
      if (parent?.startsWith('file:') && child?.startsWith('file:')) {
        let set = edges.get(parent)
        if (!set) edges.set(parent, (set = new Set()))
        set.add(child)
      }
      return result
    },
  })
  return edges
}

/**
 * Record import edges from now on, for applications that load modules before
 * Japa is configured. A framework that boots first (AdonisJS loads providers,
 * preloads and config before `configure()`) resolves those modules before the
 * recorder exists, so their own imports are never seen and the map can never be
 * marked complete. Call this at the top of the test entrypoint, before booting.
 */
export function recordImportsFromStart(): boolean {
  processEdges ??= registerResolveHook()
  return processEdges !== undefined
}

/** Per-run writers, so two runs in one process cannot clobber each other. */
const writers = new WeakMap<object, () => Promise<void>>()

export async function flushDependencies(emitter: object) {
  await writers.get(emitter)?.()
}

/** Files that cannot be a test dependency worth rerunning for. */
function isBuildNoise(path: string) {
  const segments = path.split('/')
  if (
    segments.some((part) => ['node_modules', '.git', 'coverage', 'dist', 'build'].includes(part))
  ) {
    return true
  }
  return /\.(log|map)$/.test(path)
}

/**
 * Resolve the changed paths for `--changed=auto`: tracked changes against HEAD
 * plus untracked files. Returns an empty list when git cannot answer, which the
 * caller treats as "run everything".
 */
function isIgnoredPath(path: string, ignored: string[]) {
  const value = path.replace(/^\.\//, '')
  return ignored.some((entry) => value === entry || value.startsWith(`${entry}/`))
}

export async function gitChangedPaths(cwd: string, ignored: string[] = []): Promise<string[]> {
  const run = promisify(execFile)
  try {
    const [modified, untracked] = await Promise.all([
      // `--relative`: diff prints repo-root paths, which miss an app in a monorepo subdirectory.
      run('git', ['diff', '--name-only', '--relative', 'HEAD'], { cwd, timeout: 5000 }),
      run('git', ['ls-files', '--others', '--exclude-standard'], { cwd, timeout: 5000 }),
    ])
    const lines = `${modified.stdout}\n${untracked.stdout}`
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !isBuildNoise(line) && !isIgnoredPath(line, ignored))
    return [...new Set(lines)]
  } catch (error) {
    debug('unable to read changed paths from git: %O', error)
    return []
  }
}

const emptyMap = (): DependencyMap => ({
  version: 3,
  complete: false,
  files: Object.create(null),
  boot: [],
  bridged: [],
})

const isStrings = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string')

const isRules = (value: unknown): value is HeuristicRule[] =>
  Array.isArray(value) &&
  value.every(
    (rule) =>
      rule &&
      typeof (rule as HeuristicRule).from === 'string' &&
      typeof (rule as HeuristicRule).to === 'string'
  )

/**
 * Older maps are discarded: version 1 walked through packages and selected every test,
 * version 2 did not record files reached only through a package.
 */
export function parseDependencyMap(value: unknown): DependencyMap {
  if (!value || typeof value !== 'object' || (value as DependencyMap).version !== 3) {
    return emptyMap()
  }
  const { files, boot, bridged, heuristic, global, complete } = value as DependencyMap
  if (
    !files ||
    typeof files !== 'object' ||
    Array.isArray(files) ||
    !isStrings(boot) ||
    !isStrings(bridged)
  ) {
    return emptyMap()
  }
  const parsed: Record<string, string[]> = Object.create(null)
  for (const [key, dependencies] of Object.entries(files)) {
    if (!isStrings(dependencies)) return emptyMap()
    parsed[key] = dependencies
  }
  return {
    version: 3,
    complete: complete === true,
    files: parsed,
    boot,
    bridged,
    ...(isRules(heuristic) ? { heuristic } : {}),
    ...(isStrings(global) ? { global } : {}),
  }
}

export async function readDependencyMap(file: string): Promise<DependencyMap> {
  try {
    return parseDependencyMap(JSON.parse(await readFile(file, 'utf8')))
  } catch (error) {
    debug('ignoring unavailable dependency map %s: %O', file, error)
    return emptyMap()
  }
}

const isPackageUrl = (url: string) => url.includes('/node_modules/')

/** Project files reachable from `roots` without walking through a package. */
function projectClosure(edges: ImportEdges, roots: Iterable<string>) {
  const visited = new Set<string>()
  const queue = [...roots]
  while (queue.length) {
    const current = queue.pop()!
    if (visited.has(current) || isPackageUrl(current)) continue
    visited.add(current)
    for (const next of edges.get(current) ?? []) {
      if (!visited.has(next)) queue.push(next)
    }
  }
  return visited
}

/**
 * Project files a package or the entry script loaded so far. Called before the first
 * test file is imported, this is what the framework loaded at boot.
 */
function bootRoots(edges: ImportEdges, cwd: string) {
  const entry = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : undefined
  const project = pathToFileURL(`${cwd}/`).href
  const roots = new Set<string>()
  for (const [parent, children] of edges) {
    if (!isPackageUrl(parent) && parent !== entry) continue
    for (const child of children) {
      if (child.startsWith(project) && !isPackageUrl(child)) roots.add(child)
    }
  }
  return roots
}

function toFileUrl(cwd: string, path: string) {
  return path.startsWith('file:') ? path : pathToFileURL(resolve(cwd, path)).href
}

/** Record each test file's transitive imports for `--changed`. */
export function recordDependencies(options: { file?: string; dir?: string } = {}): PluginFn {
  return async ({ config, emitter, cliArgs }) => {
    const edges = processEdges ?? registerResolveHook()
    if (!edges) return

    const cwd = await realpath(config.cwd)
    const target = options.file ? resolve(cwd, options.file) : dependencyFile(cwd, options.dir)
    const map = await readDependencyMap(target)
    const testFiles = new Set<string>()
    const filters = config.filters
    const completeRun =
      Boolean(cliArgs?.prepareCaches) ||
      (!cliArgs?.changed &&
        !cliArgs?.failed &&
        !cliArgs?.bail &&
        !filters?.tests?.length &&
        !filters?.groups?.length &&
        !filters?.tags?.length &&
        !filters?.files?.length &&
        !filters?.suites?.length &&
        !filters?.shard)
    let importFailed = false
    let graphComplete = true
    let boot: Set<string> | undefined
    const resolvers = config.selection?.resolvers ?? []
    const policy = selectionPolicy(config.selection)
    const toPath = (url: string) => relative(cwd, fileURLToPath(url)).split('\\').join('/')
    const inProject = (path: string) => !path.startsWith('..') && !path.includes('node_modules')

    // Edges are importer -> imported, walked from each test file below. Load
    // events alone would miss shared modules, which ESM loads only once.
    const importer = config.importer
    config.importer = async (fileURL) => {
      // Everything loaded so far is boot code; later lazy loads are not.
      boot ??= projectClosure(edges, bootRoots(edges, cwd))
      testFiles.add(relative(cwd, fileURLToPath(fileURL)).split('\\').join('/'))
      try {
        return await importer(fileURL)
      } catch (error) {
        importFailed = true
        throw error
      }
    }

    /**
     * Files a resolver names are often loaded only on demand (a controller behind a
     * route), so `--prepare-caches` never sees their imports. Importing them here
     * records those edges; a file that fails to import still counts as a dependency.
     */
    const unloadable = new Set<string>()
    const claimed = new Set<string>()
    const resolverFailures: string[] = []
    const resolveExtra = async (testFile: string) => {
      const urls: string[] = []
      for (const resolver of resolvers) {
        try {
          for (const path of await resolver(testFile)) urls.push(toFileUrl(cwd, path))
        } catch (error) {
          // The test's record would miss what the resolver names, so the map cannot be trusted.
          debug('selection resolver failed for %s: %O', testFile, error)
          resolverFailures.push(`${testFile}: ${error instanceof Error ? error.message : error}`)
        }
      }
      urls.forEach((url) => claimed.add(url))
      for (const url of urls) {
        if (!edges.has(url)) await import(url).catch(() => unloadable.add(toPath(url)))
      }
      return urls
    }

    const write = async () => {
      if (!testFiles.size) return
      for (const testFile of testFiles) {
        const root = pathToFileURL(join(cwd, testFile)).href
        const reached = projectClosure(edges, [root, ...(await resolveExtra(testFile))])
        const project = new Set(map.files[testFile] ?? [])
        for (const url of reached) {
          const path = toPath(url)
          if (inProject(path)) project.add(path)
        }
        map.files[testFile] = [...project].sort()
      }
      const testFileSet = new Set(testFiles)
      const bootFiles = [...(boot ?? [])]
        .map(toPath)
        .filter((path) => inProject(path) && !testFileSet.has(path))
      const bridgedFiles = new Set<string>()
      for (const [parent, children] of edges) {
        if (!isPackageUrl(parent)) continue
        for (const child of children) {
          if (isPackageUrl(child) || boot?.has(child) || claimed.has(child)) continue
          const path = toPath(child)
          if (inProject(path) && !testFileSet.has(path)) bridgedFiles.add(path)
        }
      }

      const unrecorded = new Set<string>()
      if (completeRun && !importFailed) {
        const hasRelativeImports = relativeImportChecker()
        for (const testFile of testFiles) {
          const root = pathToFileURL(join(cwd, testFile)).href
          if (await hasRelativeImports(join(cwd, testFile))) {
            const recorded = edges.get(root)?.size ?? 0
            if (!recorded) unrecorded.add(testFile)
          }
          for (const dependency of map.files[testFile] ?? []) {
            if (dependency === testFile || unrecorded.has(dependency) || unloadable.has(dependency))
              continue
            const url = pathToFileURL(join(cwd, dependency)).href
            if (
              (edges.get(url)?.size ?? 0) === 0 &&
              (await hasRelativeImports(join(cwd, dependency)))
            ) {
              unrecorded.add(dependency)
            }
          }
        }
      }
      if (resolverFailures.length) {
        graphComplete = false
        warn(
          `A selection resolver threw for ${resolverFailures.length} test file(s) ` +
            `(${sampleOf(resolverFailures)}). --changed will run the full suite until it passes.`
        )
      }
      if (unrecorded.size) {
        graphComplete = false
        if (cliArgs?.prepareCaches) {
          const sample = [...unrecorded].slice(0, 3).join(', ')
          warn(
            `The dependency map is incomplete: ${unrecorded.size} file(s) imported other files ` +
              `before Japa could record them (${sample}). --changed will run the full suite. ` +
              RECORD_EARLY_HINT
          )
        }
      }

      try {
        const { mkdir, rename, writeFile } = await import('node:fs/promises')
        await withCacheLock(target, async () => {
          // Another agent may have written since this run started.
          const latest = await readDependencyMap(target)
          for (const [testFile, dependencies] of Object.entries(map.files)) {
            const merged = new Set([...(latest.files[testFile] ?? []), ...dependencies])
            latest.files[testFile] = [...merged].sort()
          }
          // Only a complete run can decide completeness, in either direction.
          if (completeRun && !importFailed) latest.complete = graphComplete
          else if (resolverFailures.length) latest.complete = false
          // A complete run saw the whole boot; a slice can only add to it.
          latest.boot =
            completeRun && !importFailed
              ? bootFiles.sort()
              : [...new Set([...latest.boot, ...bootFiles])].sort()
          // Import-only runs see fewer bridges than full ones, so bridges only accumulate.
          latest.bridged = [...new Set([...latest.bridged, ...bridgedFiles])]
            .filter((path) => !claimed.has(toFileUrl(cwd, path)))
            .sort()
          if (policy.heuristic) latest.heuristic = policy.heuristic
          else delete latest.heuristic
          if (policy.global) latest.global = policy.global
          else delete latest.global
          const temporary = `${target}.${process.pid}.tmp`
          await mkdir(resolve(target, '..'), { recursive: true })
          await writeFile(temporary, `${JSON.stringify(latest)}\n`)
          await rename(temporary, target)
        })
      } catch (error) {
        debug('unable to record dependencies: %O', error)
        await import('node:fs/promises')
          .then(({ rm }) => rm(`${target}.${process.pid}.tmp`, { force: true }))
          .catch(() => {})
      }
    }
    writers.set(emitter, write)

    emitter.once('runner:end', (): boolean => {
      void write()
      return true
    })
  }
}

/** Every test file the config names, relative to `cwd`, before any filter. */
async function configuredTestFiles(config: NormalizedConfig, cwd: string) {
  const manager = new FilesManager()
  const groups = 'suites' in config ? config.suites.map((suite) => suite.files) : [config.files]
  const urls = await Promise.all(
    groups.map((files) => manager.getFiles(cwd, files, config.exclude).catch(() => []))
  )
  return urls.flat().map((url) => relative(cwd, fileURLToPath(url)).split('\\').join('/'))
}

/**
 * Narrow the run to files affected by `--changed` paths. Falls back to the full
 * suite whenever the dependency map cannot answer confidently.
 */
export function changedSelection(options: { file?: string; dir?: string } = {}): PluginFn {
  return async ({ config, cliArgs }) => {
    const raw = cliArgs.changed
    if (!raw) return
    const cwd = await realpath(config.cwd)
    const map = await readDependencyMap(
      options.file ? resolve(cwd, options.file) : dependencyFile(cwd, options.dir)
    )
    const ignored: string[] = []
    const relativeCache = relative(cwd, cacheDir(cwd, options.dir)).split('\\').join('/')
    if (relativeCache && relativeCache !== '.' && !relativeCache.startsWith('..')) {
      ignored.push(relativeCache)
    }
    if (cliArgs.agentFile) {
      const report = relative(cwd, resolve(cwd, cliArgs.agentFile)).split('\\').join('/')
      if (report && !report.startsWith('..')) ignored.push(report, `${report}.delta.json`)
    }
    const changed =
      raw === 'auto'
        ? await gitChangedPaths(cwd, ignored)
        : raw
            .split(',')
            .map((path) => path.trim())
            .filter(Boolean)
    let outcome = selectChanged(
      map,
      changed,
      await configuredTestFiles(config, cwd),
      selectionPolicy(config.selection)
    )
    if (outcome.kind === 'full' && hookUnavailable && !processEdges) {
      outcome = {
        kind: 'full',
        reason: 'this Node has no module.registerHooks (22.15+ or 23.5+ needed).',
      }
    }
    outcomes.set(config, outcome)
    if (outcome.kind === 'full') {
      warn(`--changed is running the full suite: ${outcome.reason}`)
      return
    }
    if (outcome.kind === 'heuristic') {
      warn(
        `--changed guessed tests by name for ${outcome.guessed.length} path(s) no test imports ` +
          `(${sampleOf(outcome.guessed)}). Run the full suite before relying on it.`
      )
    }
    // Restrict only the test files the map has recorded. One it has never seen (added
    // or pulled since the map was written) has no record to rule it out, so it runs.
    setSelectionPlan(config, {
      only: Object.freeze(outcome.files),
      onlyWithin: Object.freeze(Object.keys(map.files)),
    })
  }
}
