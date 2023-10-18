/*
 * @japa/runner
 *
 * (c) Japa
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { fileURLToPath } from 'node:url'

import { Planner } from '../src/planner.js'
import { GlobalHooks } from '../src/hooks.js'
import { CliParser } from '../src/cli_parser.js'
import { createTest } from '../src/create_test.js'
import { ConfigManager } from '../src/config_manager.js'
import { Suite, Runner, Emitter, TestContext, Refiner } from '../modules/core/main.js'
import type {
  Config,
  CLIArgs,
  TestExecutor,
  RunnerSummary,
  NormalizedConfig,
} from '../src/types.js'

/**
 * Runner factory exposes the API to run dummy suites, groups and tests.
 * You might want to use the factory for testing reporters and
 * plugins usage
 */
export class RunnerFactory {
  #emitter = new Emitter()
  #config?: NormalizedConfig
  #cliArgs?: CLIArgs
  #file = fileURLToPath(import.meta.url)

  get #refiner() {
    return this.#config!.refiner
  }

  /**
   * Registers plugins
   */
  async #registerPlugins(runner: Runner) {
    for (let plugin of this.#config!.plugins) {
      await plugin({
        config: this.#config!,
        runner,
        emitter: this.#emitter,
        cliArgs: this.#cliArgs!,
      })
    }
  }

  /**
   * Configure runner
   */
  configure(config: Config, argv?: string[]) {
    this.#cliArgs = new CliParser().parse(argv || [])
    this.#config = new ConfigManager(config, this.#cliArgs).hydrate()
    return this
  }

  /**
   * Define a custom emitter instance to use
   */
  useEmitter(emitter: Emitter) {
    this.#emitter = emitter
    return this
  }

  /**
   * Run a test using the runner
   */
  async runTest(
    title: string,
    callback: TestExecutor<TestContext, undefined>
  ): Promise<RunnerSummary> {
    return this.runSuites((emitter, refiner, file) => {
      const defaultSuite = new Suite('default', emitter, refiner)

      createTest(title, emitter, refiner, {
        suite: defaultSuite,
        file: file,
      }).run(callback)

      return [defaultSuite]
    })
  }

  /**
   * Run dummy tests. You might use
   */
  async runSuites(
    suites: (emitter: Emitter, refiner: Refiner, file?: string) => Suite[]
  ): Promise<RunnerSummary> {
    const runner = new Runner(this.#emitter)
    await this.#registerPlugins(runner)

    const { config, reporters, refinerFilters } = await new Planner(this.#config!).plan()
    const globalHooks = new GlobalHooks()
    globalHooks.apply(config)

    reporters.forEach((reporter) => {
      runner.registerReporter(reporter)
    })

    refinerFilters.forEach((filter) => {
      config.refiner.add(filter.layer, filter.filters)
    })

    suites(this.#emitter, this.#refiner, this.#file).forEach((suite) => runner.add(suite))

    await globalHooks.setup(runner)
    await runner.start()
    await runner.exec()
    await runner.end()
    await globalHooks.teardown(null, runner)

    return runner.getSummary()
  }
}
