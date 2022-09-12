/*
 * @japa/runner
 *
 * (c) Harminder Virk <virk@adonisjs.com>
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
  public cleanup: (handler: TestHooksCleanupHandler<this>) => void

  constructor(public test: Test) {
    super()
    this.cleanup = (handler: TestHooksCleanupHandler<this>) => {
      test.cleanup(handler)
    }
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
