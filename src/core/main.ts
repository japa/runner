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

import debug from '../debug'

/**
 * Runner specific test context. Here we extend the test context to register
 * cleanup methods with the test and register hooks to get notified when
 * a new instance of test context is created.
 */
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
    debug('registering test context created hook "%s"', callback)
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

/**
 * Runner specific Test with a fixed TestContext static type.
 */
export class Test<TestData extends DataSetNode = undefined> extends BaseTest<
  TestContext,
  TestData
> {
  public static disposeCallbacks = []
}

/**
 * Runner specific Group with a fixed TestContext static type.
 */
export class Group extends BaseGroup<TestContext> {}

/**
 * Runner specific Suite with a fixed TestContext static type.
 */
export class Suite extends BaseSuite<TestContext> {
  public onGroup(callback: (group: Group) => void): this {
    super.onGroup(callback)
    return this
  }

  public onTest(callback: (test: Test<any>) => void): this {
    super.onTest(callback)
    return this
  }
}

/**
 * Runner specific tests Runner with a fixed TestContext static type.
 */
export class Runner extends BaseRunner<TestContext> {
  public onSuite(callback: (suite: Suite) => void): this {
    super.onSuite(callback)
    return this
  }
}
