/*
 * @japa/runner
 *
 * (c) Japa
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import {
  Emitter,
  Refiner,
  Test as BaseTest,
  Suite as BaseSuite,
  Group as BaseGroup,
  Runner as BaseRunner,
  TestContext as BaseTestContext,
} from '@japa/core'
import { BaseReporter } from './reporters/base.js'
import type { DataSetNode, TestHooksCleanupHandler } from './types.js'

export { Emitter, Refiner, BaseReporter }

/**
 * Test context carries context data for a given test.
 */
export class TestContext extends BaseTestContext {
  /**
   * Register a cleanup function that runs after the test finishes
   * successfully or with an error.
   */
  declare cleanup: (cleanupCallback: TestHooksCleanupHandler<TestContext>) => void

  constructor(public test: Test) {
    super()
    this.cleanup = (cleanupCallback: TestHooksCleanupHandler<TestContext>) => {
      test.cleanup(cleanupCallback)
    }
  }
}

/**
 * Test class represents an individual test and exposes API to tweak
 * its runtime behavior.
 */
export class Test<TestData extends DataSetNode = undefined> extends BaseTest<
  TestContext,
  TestData
> {
  /**
   * @inheritdoc
   */
  static executedCallbacks = []

  /**
   * @inheritdoc
   */
  static executingCallbacks = []
}

/**
 * TestGroup is used to bulk configure a collection of tests and
 * define lifecycle hooks for them
 */
export class Group extends BaseGroup<TestContext> {}

/**
 * A suite is a collection of tests created around a given
 * testing type. For example: A suite for unit tests, a
 * suite for functional tests and so on.
 */
export class Suite extends BaseSuite<TestContext> {}

/**
 * Runner class is used to execute the tests
 */
export class Runner extends BaseRunner<TestContext> {}
