/*
 * @japa/runner
 *
 * (c) Japa
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { test } from 'node:test'
import { createTest } from '../src/create_test.js'
import { printPinnedTests } from '../src/helpers.js'
import { Emitter, Refiner, Suite, Runner, Group } from '../modules/core/main.js'

test.describe('Helpers', () => {
  test('print pinned tests', async () => {
    const stack: string[] = []

    const emitter = new Emitter()
    const refiner = new Refiner()

    const suite = new Suite('same', emitter, refiner)
    const runner = new Runner(emitter)
    runner.add(suite)

    createTest('pinned test', emitter, refiner, new Error(), { suite })
      .run(() => {
        stack.push('executing pinned test')
      })
      .pin()

    createTest('passing test', emitter, refiner, new Error(), { suite }).run(() => {
      stack.push('executing passing test')
    })

    printPinnedTests(runner)
    await emitter.emit('runner:start')
  })

  test('print pinned tests from a group', async () => {
    const stack: string[] = []

    const emitter = new Emitter()
    const refiner = new Refiner()

    const runner = new Runner(emitter)
    const suite = new Suite('same', emitter, refiner)
    const group = new Group('Tests group', emitter, refiner)

    suite.add(group)
    runner.add(suite)

    createTest('pinned test', emitter, refiner, new Error(), { suite, group })
      .run(() => {
        stack.push('executing pinned test')
      })
      .pin()

    createTest('passing test', emitter, refiner, new Error(), { suite, group }).run(() => {
      stack.push('executing passing test')
    })

    printPinnedTests(runner)
    await emitter.emit('runner:start')
  })
})
