/*
 * @japa/runner
 *
 * (c) Japa.dev
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import {
  DataSetNode,
  Test as BaseTest,
  Group as BaseGroup,
  Suite as BaseSuite,
  Runner as BaseRunner,
  TestHooksCleanupHandler,
  TestContext as BaseTestContext,
} from '@japa/core'

export class TestContext extends BaseTestContext {
  /**
   * Methods to call after the test context instance
   * is created
   */
  public static createdCallbacks: ((context: TestContext) => void)[] = []

  /**
   * Register a function to get notified when an instance of test
   * context is created. The callback must be synchronous
   */
  public static created(callback: (context: TestContext) => void) {
    this.createdCallbacks.push(callback)
    return this
  }

  /**
   * Register a cleanup function. Cleanup functions are called after
   * the test finishes
   */
  public cleanup: (handler: TestHooksCleanupHandler<this>) => void

  constructor(public test: Test) {
    super()
    this.cleanup = (handler: TestHooksCleanupHandler<this>) => {
      test.cleanup(handler)
    }

    /**
     * Invoke ready callbacks
     */
    const Constructor = this.constructor as unknown as typeof TestContext
    Constructor.createdCallbacks.forEach((callback) => callback(this))
  }
}

export class Test<TestData extends DataSetNode = undefined> extends BaseTest<
  TestContext,
  TestData
> {
  public static disposeCallbacks = []
}

export class Group extends BaseGroup<TestContext> {}
export class Suite extends BaseSuite<TestContext> {}
export class Runner extends BaseRunner<TestContext> {}
