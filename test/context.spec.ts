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
