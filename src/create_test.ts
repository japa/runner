/*
 * @japa/runner
 *
 * (c) Japa
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { Emitter, Group, Refiner, Suite, Test, TestContext } from '../modules/core/main.js'

/**
 * Function to create the test context for the test
 */
const contextBuilder = (testInstance: Test<any>) => new TestContext(testInstance)

/**
 * Create a new instance of the Test
 */
export function createTest(
  title: string,
  emitter: Emitter,
  refiner: Refiner,
  options: {
    group?: Group
    suite?: Suite
    file?: string
    timeout?: number
    retries?: number
  }
) {
  const testInstance = new Test<undefined>(title, contextBuilder, emitter, refiner, options.group)
  testInstance.options.meta.suite = options.suite
  testInstance.options.meta.group = options.group
  testInstance.options.meta.fileName = options.file

  if (options.timeout) {
    testInstance.timeout(options.timeout)
  }
  if (options.retries) {
    testInstance.retry(options.retries)
  }

  /**
   * Register test as a child either with the group or the suite
   */
  if (options.group) {
    options.group.add(testInstance)
  } else if (options.suite) {
    options.suite.add(testInstance)
  }

  return testInstance
}

/**
 * Create a new instance of the Group
 */
export function createTestGroup(
  title: string,
  emitter: Emitter,
  refiner: Refiner,
  options: {
    group?: Group
    suite?: Suite
    file?: string
    timeout?: number
    retries?: number
  }
) {
  if (options.group) {
    throw new Error('Nested groups are not supported by Japa')
  }

  const group = new Group(title, emitter, refiner)
  group.options.meta.suite = options.suite
  group.options.meta.fileName = options.file

  if (options.suite) {
    options.suite.add(group)
  }

  return group
}
