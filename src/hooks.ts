/*
 * @japa/runner
 *
 * (c) Japa
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import Hooks from '@poppinss/hooks'
import type { Runner as HooksRunner } from '@poppinss/hooks/types'
import { Config, HooksEvents, SetupHookState, TeardownHookState } from './types.js'
import { Runner } from '../modules/core/main.js'

/**
 * Exposes API for working with global hooks
 */
export class GlobalHooks {
  #hooks = new Hooks<HooksEvents>()
  #setupRunner: HooksRunner<SetupHookState[0], SetupHookState[1]> | undefined
  #teardownRunner: HooksRunner<TeardownHookState[0], TeardownHookState[1]> | undefined

  /**
   * Apply hooks from the config
   */
  apply(config: Required<Config>) {
    config.setup.forEach((hook) => this.#hooks.add('setup', hook))
    config.teardown.forEach((hook) => this.#hooks.add('teardown', hook))
  }

  /**
   * Perform setup
   */
  async setup(runner: Runner) {
    this.#setupRunner = this.#hooks.runner('setup')
    this.#teardownRunner = this.#hooks.runner('teardown')
    await this.#setupRunner.run(runner)
  }

  /**
   * Perform cleanup
   */
  async teardown(error: Error | null, runner: Runner) {
    if (this.#setupRunner) {
      await this.#setupRunner.cleanup(error, runner)
    }
    if (this.#teardownRunner) {
      if (!error) {
        await this.#teardownRunner.run(runner)
      }
      await this.#teardownRunner.cleanup(error, runner)
    }
  }
}
