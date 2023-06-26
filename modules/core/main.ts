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
import { inspect } from 'node:util'
import { AssertionError } from 'node:assert'
import { BaseReporter } from './reporters/base.js'
import type { DataSetNode, TestHooksCleanupHandler } from './types.js'

declare module '@japa/core' {
  interface Test<Context extends Record<any, any>, TestData extends DataSetNode = undefined> {
    throws(message: string | RegExp, errorConstructor?: any): this
  }
  interface TestContext {
    cleanup: (cleanupCallback: TestHooksCleanupHandler<TestContext>) => void
  }
}

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

  /**
   * Assert the test callback throws an exception when a certain
   * error message and optionally is an instance of a given
   * Error class.
   */
  throws(message: string | RegExp, errorConstructor?: any) {
    const errorInPoint = new AssertionError({})
    const existingExecutor = this.options.executor
    if (!existingExecutor) {
      throw new Error('Cannot use "test.throws" method without a test callback')
    }

    /**
     * Overwriting existing callback
     */
    this.options.executor = async (...args: [any, any, any]) => {
      let raisedException: any
      try {
        await existingExecutor(...args)
      } catch (error) {
        raisedException = error
      }

      /**
       * Notify no exception has been raised
       */
      if (!raisedException) {
        errorInPoint.message = 'Expected test to throw an exception'
        throw errorInPoint
      }

      /**
       * Constructor mis-match
       */
      if (errorConstructor && !(raisedException instanceof errorConstructor)) {
        errorInPoint.message = `Expected test to throw "${inspect(errorConstructor)}"`
        throw errorInPoint
      }

      /**
       * Error does not have a message property
       */
      const exceptionMessage: unknown = raisedException.message
      if (!exceptionMessage || typeof exceptionMessage !== 'string') {
        errorInPoint.message = 'Expected test to throw an exception with message property'
        throw errorInPoint
      }

      /**
       * Message does not match
       */
      if (typeof message === 'string') {
        if (exceptionMessage !== message) {
          errorInPoint.message = `Expected test to throw "${message}". Instead received "${raisedException.message}"`
          errorInPoint.actual = raisedException.message
          errorInPoint.expected = message
          throw errorInPoint
        }
        return
      }

      if (!message.test(exceptionMessage)) {
        errorInPoint.message = `Expected test error to match "${message}" regular expression`
        throw errorInPoint
      }
    }

    return this
  }
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
