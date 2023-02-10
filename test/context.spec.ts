/*
 * @japa/runner
 *
 * (c) Japa.dev
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import test from 'japa'
import { Emitter, Refiner } from '@japa/core'
import { TestContext, Test } from '../src/core/main'

test.group('Context', () => {
  test('forward cleanup handlers from context to test', async (assert) => {
    const emitter = new Emitter()
    const refiner = new Refiner()
    const stack: string[] = []
    const t = new Test(
      '2 + 2 = 4',
      (testInstance) => new TestContext(testInstance),
      emitter,
      refiner
    )

    t.run(({ cleanup }) => {
      cleanup(() => {
        stack.push('test cleanup')
      })
      stack.push('test')
    })

    await t.exec()
    assert.deepEqual(stack, ['test', 'test cleanup'])
  })

  test('call created callbacks when the context instance is created', async (assert) => {
    const emitter = new Emitter()
    const refiner = new Refiner()
    const stack: string[] = []

    TestContext.created(() => {
      stack.push('callback 1')
    })

    TestContext.created(() => {
      stack.push('callback 2')
    })

    const t = new Test(
      '2 + 2 = 4',
      (testInstance) => new TestContext(testInstance),
      emitter,
      refiner
    )
    t.run(() => {})
    await t.exec()

    assert.deepEqual(stack, ['callback 1', 'callback 2'])
  })
})
