/*
 * @japa/runner
 *
 * (c) Japa
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { Emitter, Refiner } from '@japa/core'
import test from 'japa'
import { TestContext, Test } from '../src/Core'

test('forward cleanup handlers from context to test', async (assert) => {
  const emitter = new Emitter()
  const refiner = new Refiner()
  const stack: string[] = []
  const t = new Test('2 + 2 = 4', (testInstance) => new TestContext(testInstance), emitter, refiner)

  t.run(({ cleanup }) => {
    cleanup(() => {
      stack.push('test cleanup')
    })
    stack.push('test')
  })

  await t.exec()
  assert.deepEqual(stack, ['test', 'test cleanup'])
})
