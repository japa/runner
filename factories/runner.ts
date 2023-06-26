/*
 * @japa/runner
 *
 * (c) Japa
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import assert from 'node:assert'
import { fileURLToPath } from 'node:url'

import { Planner } from '../src/planner.js'
import { GlobalHooks } from '../src/hooks.js'
import { CliParser } from '../src/cli_parser.js'
import { CLIArgs, Config } from '../src/types.js'
import { ConfigManager } from '../src/config_manager.js'
import { createTest, createTestGroup } from '../src/create_test.js'
import { Group, Suite, Runner, Emitter } from '../modules/core/main.js'

/**
 * Runner factory exposes the API to run dummy suites, groups and tests.
 * You might want to use the factory for testing reporters and
 * plugins usage
 */
export class RunnerFactory {
  #emitter = new Emitter()
  #config?: Required<Config>
  #cliArgs?: CLIArgs
  #suites?: Suite[]
  #file = fileURLToPath(import.meta.url)

  get #refiner() {
    return this.#config!.refiner
  }

  /**
   * Creating unit and functional suites
   */
  #createSuites() {
    return [
      new Suite('unit', this.#emitter, this.#refiner),
      new Suite('functional', this.#emitter, this.#refiner),
    ]
  }

  /**
   * Creates a variety of tests for Maths.add method
   */
  #createAdditionTests(group: Group) {
    createTest('add two numbers', this.#emitter, this.#refiner, { group, file: this.#file }).run(
      () => {
        assert.equal(2 + 2, 4)
      }
    )
    createTest('add three numbers', this.#emitter, this.#refiner, {
      group,
      file: this.#file,
    }).run(() => {
      assert.equal(2 + 2 + 2, 6)
    })
    createTest('add group of numbers', this.#emitter, this.#refiner, { group, file: this.#file })
    createTest('use math.js lib', this.#emitter, this.#refiner, { group, file: this.#file }).skip(
      true,
      'Library work pending'
    )
    createTest('add multiple numbers', this.#emitter, this.#refiner, {
      file: this.#file,
      group,
    }).run(() => {
      assert.equal(2 + 2 + 2 + 2, 6)
    })
    createTest('add floating numbers', this.#emitter, this.#refiner, { group, file: this.#file })
      .run(() => {
        assert.equal(2 + 2.2 + 2.1, 6)
      })
      .fails('Have to add support for floating numbers')
  }

  /**
   * Creates a variety of dummy tests for creating
   * a new user
   */
  #createUserStoreTests(group: Group) {
    createTest('Validate user data', this.#emitter, this.#refiner, {
      group,
      file: this.#file,
    }).run(() => {})
    createTest('Disallow duplicate emails', this.#emitter, this.#refiner, {
      group,
      file: this.#file,
    }).run(() => {})
    createTest('Disallow duplicate emails across tenants', this.#emitter, this.#refiner, {
      group,
      file: this.#file,
    }).run(() => {
      const users = ['', '']
      assert.equal(users.length, 1)
    })
    createTest('Normalize email before persisting it', this.#emitter, this.#refiner, {
      group,
      file: this.#file,
    }).skip(true, 'Have to build a normalizer')
    createTest('Send email verification mail', this.#emitter, this.#refiner, {
      group,
      file: this.#file,
    })
  }

  /**
   * Creates tests for the unit tests suite
   */
  #createUnitTests(suite: Suite) {
    const additionGroup = createTestGroup('Maths#add', this.#emitter, this.#refiner, {
      suite,
      file: this.#file,
    })
    this.#createAdditionTests(additionGroup)

    createTest('A top level test inside a suite', this.#emitter, this.#refiner, {
      suite,
      file: this.#file,
    }).run(() => {})
  }

  /**
   * Creates tests for the functional tests suite
   */
  #createFunctionalTests(suite: Suite) {
    const usersStoreGroup = createTestGroup('Users/store', this.#emitter, this.#refiner, {
      suite,
      file: this.#file,
    })
    this.#createUserStoreTests(usersStoreGroup)

    const usersListGroup = createTestGroup('Users/list', this.#emitter, this.#refiner, {
      suite,
      file: this.#file,
    })
    usersListGroup.setup(() => {
      throw new Error('Unable to cleanup database')
    })
    createTest(
      'A test that will never because the group hooks fails',
      this.#emitter,
      this.#refiner,
      { group: usersListGroup }
    )

    createTest('A top level test inside functional suite', this.#emitter, this.#refiner, {
      suite,
      file: this.#file,
    }).run(() => {})
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
    this.#cliArgs = new CliParser(argv || []).parse()
    this.#config = new ConfigManager(config, this.#cliArgs).hydrate()
    return this
  }

  /**
   * Register custom suites to execute instead
   * of the dummy one's
   */
  withSuites(suites: Suite[]) {
    this.#suites = suites
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
   * Run dummy tests. You might use
   */
  async run() {
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

    if (this.#suites) {
      this.#suites.forEach((suite) => runner.add(suite))
    } else {
      const [unit, functional] = this.#createSuites()

      this.#createUnitTests(unit)
      runner.add(unit)

      this.#createFunctionalTests(functional)
      runner.add(functional)
    }

    await globalHooks.setup(runner)
    await runner.start()
    await runner.exec()
    await runner.end()
    await globalHooks.teardown(null, runner)

    return runner.getSummary()
  }
}
