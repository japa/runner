/*
 * @japa/runner
 *
 * (c) Japa
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { createHash } from 'node:crypto'
import { relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import validator from './validator.js'
import { FilesManager } from './files_manager.js'
import { getSelectionPlan, setSelectionStats } from './planning_state.js'
import type { NamedReporterContract, NormalizedConfig, TestFiles, TestSuite } from './types.js'

/**
 * The tests planner is used to plan the tests by doing all
 * the heavy lifting of executing plugins, registering
 * reporters, filtering tests and so on.
 */
export class Planner {
  #config: NormalizedConfig
  #fileManager = new FilesManager()
  #collected = 0

  constructor(config: NormalizedConfig) {
    validator.validateActivatedReporters(config!)
    validator.validateSuitesFilter(config!)
    validator.validateSuitesForUniqueness(config!)
    validator.validateShardFilter(config!)
    this.#config = config
  }

  /**
   * Returns a list of reporters based upon the activated
   * reporters list.
   */
  #getActivatedReporters(): NamedReporterContract[] {
    return this.#config.reporters.activated.map((activated) => {
      return this.#config.reporters.list.find(({ name }) => activated === name)!
    })
  }

  /**
   * A generic method to collect files from the user defined
   * files glob and apply the files filter
   */
  async #collectFiles(files: TestFiles) {
    let filesURLs = await this.#fileManager.getFiles(this.#config.cwd, files, this.#config.exclude)
    if (this.#config.filters.files && this.#config.filters.files.length) {
      filesURLs = this.#fileManager.grep(filesURLs, this.#config.filters.files)
    }

    const collected = filesURLs.length
    const selected = this.#applySelectionIndex(filesURLs)
    this.#collected += collected
    return selected
  }

  /**
   * Drop files that the selection index proved cannot match the active filters,
   * and remember which files it has seen. A file the index has never seen is
   * always kept: a file added since the last indexed run must never be dropped.
   */
  #applySelectionIndex(filesURLs: URL[]) {
    const selection = getSelectionPlan(this.#config)
    if (!selection) return filesURLs
    const only = selection.only ? new Set<string>(selection.only) : undefined
    const onlyWithin = selection.onlyWithin ? new Set<string>(selection.onlyWithin) : undefined
    const scope = new Set<string>(selection.skipWithin ?? [])
    const skip = new Set<string>(selection.skip ?? [])
    return filesURLs.filter((url) => {
      const path = relative(this.#config.cwd, fileURLToPath(url)).split('\\').join('/')
      if (only) return only.has(path) || (onlyWithin !== undefined && !onlyWithin.has(path))
      return !scope.has(path) || !skip.has(path)
    })
  }

  /**
   * Keeps the test files of the current shard. Files are distributed in
   * round-robin order and the index continues across suites, so every
   * shard gets a similar slice of each suite.
   */
  #applyShard(suites: (TestSuite & { filesURLs: URL[] })[]) {
    const shard = this.#config.filters.shard
    if (!shard) {
      return
    }

    if (Object.keys(this.#config.shardDurations).length) {
      this.#applyBalancedShard(suites, shard)
      return
    }

    let index = 0
    for (let suite of suites) {
      suite.filesURLs = suite.filesURLs.filter(() => {
        const belongsToShard = index % shard.total === shard.current - 1
        index++
        return belongsToShard
      })
    }
  }

  /** Assign longest estimated files first, then retain original import order. */
  #applyBalancedShard(
    suites: (TestSuite & { filesURLs: URL[] })[],
    shard: { current: number; total: number }
  ) {
    const durations = this.#config.shardDurations
    const known = Object.values(durations)
      .filter((value) => value > 0)
      .sort((a, b) => a - b)
    const fallback = known[Math.floor(known.length / 2)] ?? 1
    const files = suites.flatMap((suite, suiteIndex) =>
      suite.filesURLs.map((url, fileIndex) => {
        const path = relative(this.#config.cwd, fileURLToPath(url)).split('\\').join('/')
        return {
          suiteIndex,
          fileIndex,
          duration: durations[`${suite.name}:${path}`] ?? durations[path] ?? fallback,
        }
      })
    )
    const loads = Array.from({ length: Math.min(shard.total, files.length) }, () => ({
      duration: 0,
      count: 0,
    }))
    const selected = new Set<string>()
    for (const file of files.sort(
      (a, b) => b.duration - a.duration || a.suiteIndex - b.suiteIndex || a.fileIndex - b.fileIndex
    )) {
      let worker = 0
      for (let i = 1; i < loads.length; i++) {
        if (
          loads[i].duration < loads[worker].duration ||
          (loads[i].duration === loads[worker].duration && loads[i].count < loads[worker].count)
        )
          worker = i
      }
      loads[worker].duration += file.duration
      loads[worker].count++
      if (worker === shard.current - 1) selected.add(`${file.suiteIndex}:${file.fileIndex}`)
    }
    suites.forEach((suite, suiteIndex) => {
      suite.filesURLs = suite.filesURLs.filter((_, fileIndex) =>
        selected.has(`${suiteIndex}:${fileIndex}`)
      )
    })
  }

  /**
   * Returns a collection of suites and their associated
   * test files by applying all the filters
   */
  async #getSuites(): Promise<(TestSuite & { filesURLs: URL[] })[]> {
    let suites: (TestSuite & { filesURLs: URL[] })[] = []
    let suitesFilters = this.#config.filters.suites || []

    if ('files' in this.#config) {
      suites.push({
        name: 'default',
        files: this.#config.files,
        timeout: this.#config.timeout,
        retries: this.#config.retries,
        filesURLs: await this.#collectFiles(this.#config.files),
      })
    }

    if ('suites' in this.#config) {
      for (let suite of this.#config.suites) {
        if (!suitesFilters.length || suitesFilters.includes(suite.name)) {
          suites.push({
            ...suite,
            filesURLs: await this.#collectFiles(suite.files),
          })
        }
      }
    }

    this.#applyShard(suites)
    const plannedFiles = suites
      .flatMap((suite) =>
        suite.filesURLs.map((url) =>
          relative(this.#config.cwd, fileURLToPath(url)).split('\\').join('/')
        )
      )
      .sort()
    setSelectionStats(this.#config, {
      collected: this.#collected,
      planned: plannedFiles.length,
      // Same files under a different title, group or tag filter are a different selection.
      signature: createHash('sha256')
        .update(JSON.stringify([plannedFiles, ...this.#getRefinerFilters()]))
        .digest('hex')
        .slice(0, 16),
    })
    return suites
  }

  /**
   * Returns a list of filters to the passed to the refiner
   */
  #getRefinerFilters() {
    return Object.keys(this.#config.filters).reduce(
      (result, layer) => {
        if (layer === 'tests' || layer === 'tags' || layer === 'groups') {
          result.push({ layer, filters: this.#config.filters[layer]! })
        }
        return result
      },
      [] as { layer: 'tags' | 'tests' | 'groups'; filters: string[] }[]
    )
  }

  /**
   * Creates a plan for running the tests
   */
  async plan() {
    const suites = await this.#getSuites()
    const reporters = this.#getActivatedReporters()
    const refinerFilters = this.#getRefinerFilters()
    return {
      reporters,
      suites,
      refinerFilters,
      config: this.#config,
    }
  }
}
