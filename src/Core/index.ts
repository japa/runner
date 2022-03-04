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
  TestContext as BaseTestContext,
} from '@japa/core'

export class TestContext extends BaseTestContext {
  constructor(public test: Test) {
    super()
  }
}

export class Test<TestData extends DataSetNode = undefined> extends BaseTest<
  TestContext,
  TestData
> {}

export class Group extends BaseGroup<TestContext> {}
export class Suite extends BaseSuite<TestContext> {}
export class Runner extends BaseRunner<TestContext> {}
