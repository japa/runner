/*
 * @japa/runner
 *
 * (c) Japa
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import validator from './validator.js'
import { FilesManager } from './files_manager.js'
import type { Config, TestFiles, TestSuite } from './types.js'

/**
 * The tests planner is used to plan the tests by doing all
 * the heavy lifting of executing plugins, registering
 * reporters, filtering tests and so on.
 */
export class Planner {
  #config: Required<Config>
  #fileManager = new FilesManager()

  constructor(config: Required<Config>) {
    validator.validateActivatedReporters(config!)
    validator.validateSuitesFilter(config!)
    validator.validateSuitesForUniqueness(config!)
    this.#config = config
  }

  /**
   * Returns a list of reporters based upon the activated
   * reporters list.
   */
  #getActivatedReporters() {
    return this.#config.reporters.activated.map((activated) => {
      return this.#config.reporters.list.find(({ name }) => activated === name)!
    })
  }

  /**
   * A generic method to collect files from the user defined
   * files glob and apply the files filter
   */
  async #collectFiles(files: TestFiles) {
    let filesURLs = await this.#fileManager.getFiles(this.#config.cwd, files)
    if (this.#config.filters.files && this.#config.filters.files.length) {
      filesURLs = this.#fileManager.grep(filesURLs, this.#config.filters.files)
    }

    return filesURLs
  }

  /**
   * Returns a collection of suites and their associated
   * test files by applying all the filters
   */
  async #getSuites() {
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

    return suites
  }

  /**
   * Returns a list of filters to the passed to the refiner
   */
  #getRefinerFilters() {
    return Object.keys(this.#config.filters).reduce((result, layer) => {
      if (layer === 'tests' || layer === 'tags' || layer === 'groups') {
        result.push({ layer, filters: this.#config.filters[layer]! })
      }
      return result
    }, [] as { layer: 'tags' | 'tests' | 'groups'; filters: string[] }[])
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
